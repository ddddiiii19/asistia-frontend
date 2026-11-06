import { describe, it, expect } from 'vitest';
import { guardarSesion, leerSesion, limpiarSesion, obtenerIdSesion, reiniciarIdSesion } from '@/lib/sesion';
import { contrasenaValida, correoValido, requisitosContrasena } from '@/lib/validacion';
import { mensajeError } from '@/lib/errores';
import { ApiError } from '@/lib/api';

describe('sesión', () => {
  it('guarda en sessionStorage (no en localStorage) y limpia', () => {
    guardarSesion({ token: 'abc', cuenta: { tipo: 'usuario', nombre_usuario: 'u' } });
    expect(window.sessionStorage.getItem('asistia.sesion')).toContain('abc');
    expect(window.localStorage.length).toBe(0);
    expect(leerSesion().cuenta.tipo).toBe('usuario');
    limpiarSesion();
    expect(leerSesion()).toBeNull();
  });

  it('rechaza datos corruptos o con tipo desconocido', () => {
    window.sessionStorage.setItem('asistia.sesion', '{no es json');
    expect(leerSesion()).toBeNull();
    window.sessionStorage.setItem('asistia.sesion', JSON.stringify({ token: 't', cuenta: { tipo: 'superadmin' } }));
    expect(leerSesion()).toBeNull();
  });

  it('id_sesion cumple el formato del backend y se reinicia', () => {
    const id = obtenerIdSesion();
    expect(id).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(obtenerIdSesion()).toBe(id);
    expect(reiniciarIdSesion()).not.toBe(id);
  });
});

describe('validación de contraseña (mismas reglas que el backend)', () => {
  it('acepta una contraseña válida', () => {
    expect(contrasenaValida('ClaveSegura2026')).toBe(true);
  });
  it.each([
    ['Corta1a', 'longitud'],
    ['SINMINUSCULA123', 'minuscula'],
    ['sinmayuscula123', 'mayuscula'],
    ['SinNumeroAlguno', 'numero'],
    [`Aa1${'ñ'.repeat(40)}`, 'bytes'],
  ])('rechaza %s por %s', (valor, id) => {
    expect(contrasenaValida(valor)).toBe(false);
    expect(requisitosContrasena(valor).find((r) => r.id === id).cumple).toBe(false);
  });
  it('valida formato de correo', () => {
    expect(correoValido('a@b.co')).toBe(true);
    expect(correoValido('sin-arroba')).toBe(false);
    expect(correoValido('')).toBe(false);
  });
});

describe('mensajes de error', () => {
  it('el 503 del servicio de IA aclara que no se registró el mensaje', () => {
    expect(mensajeError(new ApiError(503, 'servicio_ia_no_disponible', 'x'))).toMatch(/no fue registrado/);
  });
  it('usa el mensaje en español del backend para el resto', () => {
    expect(mensajeError(new ApiError(401, 'credenciales_invalidas', 'Usuario/correo o contraseña incorrectos.'))).toBe('Usuario/correo o contraseña incorrectos.');
  });
});
