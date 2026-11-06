import { describe, it, expect, vi } from 'vitest';
import { crearCliente, ApiError } from '@/lib/api';

function respuesta(estado, cuerpo) {
  return { ok: estado >= 200 && estado < 300, status: estado, json: async () => cuerpo };
}

describe('cliente de la API', () => {
  it('envía el JWT como Bearer solo en rutas autenticadas', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respuesta(200, {}));
    const c = crearCliente({ baseUrl: 'http://api', obtenerToken: () => 'tok123', fetchImpl });
    await c.conversaciones();
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer tok123');
    await c.login('a', 'b');
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBeUndefined();
    await c.olvideContrasena('a@b.co');
    expect(fetchImpl.mock.calls[2][1].headers.Authorization).toBeUndefined();
  });

  it('el login envía solo identificador y contraseña (sin rol elegido por el cliente)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respuesta(200, {}));
    const c = crearCliente({ baseUrl: 'http://api/', fetchImpl });
    await c.login('usuario_demo', 'Clave12345');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://api/api/auth/login');
    expect(JSON.parse(init.body)).toEqual({ identificador: 'usuario_demo', contrasena: 'Clave12345' });
  });

  it('el chat incluye id_conversacion solo si existe', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respuesta(200, {}));
    const c = crearCliente({ baseUrl: 'http://api', fetchImpl });
    await c.chat({ idSesion: 'x'.repeat(16), mensaje: 'hola' });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ id_sesion: 'x'.repeat(16), mensaje: 'hola' });
    await c.chat({ idSesion: 'x'.repeat(16), mensaje: 'hola', idConversacion: 7 });
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).id_conversacion).toBe(7);
  });

  it('traduce errores de la API a ApiError con código y mensaje', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respuesta(503, { error: 'servicio_ia_no_disponible', mensaje: 'caído' }));
    const c = crearCliente({ baseUrl: 'http://api', fetchImpl });
    await expect(c.chat({ idSesion: 'x'.repeat(16), mensaje: 'hola' })).rejects.toMatchObject({
      name: 'ApiError', estado: 503, codigo: 'servicio_ia_no_disponible', message: 'caído',
    });
  });

  it('invoca alSesionInvalida con 401 de sesión, pero no con credenciales inválidas del login', async () => {
    const alSesionInvalida = vi.fn();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(respuesta(401, { error: 'sesion_revocada', mensaje: 'x' }))
      .mockResolvedValueOnce(respuesta(401, { error: 'credenciales_invalidas', mensaje: 'y' }));
    const c = crearCliente({ baseUrl: 'http://api', obtenerToken: () => 't', alSesionInvalida, fetchImpl });
    await expect(c.me()).rejects.toBeInstanceOf(ApiError);
    expect(alSesionInvalida).toHaveBeenCalledTimes(1);
    await expect(c.login('a', 'b')).rejects.toBeInstanceOf(ApiError);
    expect(alSesionInvalida).toHaveBeenCalledTimes(1);
  });

  it('distingue falta de conexión y 403 sin cerrar la sesión', async () => {
    const alSesionInvalida = vi.fn();
    const c1 = crearCliente({ baseUrl: 'http://api', alSesionInvalida, fetchImpl: vi.fn().mockRejectedValue(new TypeError('fallo')) });
    await expect(c1.me()).rejects.toMatchObject({ codigo: 'sin_conexion' });
    const c2 = crearCliente({ baseUrl: 'http://api', alSesionInvalida, fetchImpl: vi.fn().mockResolvedValue(respuesta(403, { error: 'rol_insuficiente', mensaje: 'no' })) });
    await expect(c2.me()).rejects.toMatchObject({ estado: 403 });
    expect(alSesionInvalida).not.toHaveBeenCalled();
  });
});
