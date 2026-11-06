// @vitest-environment node
// Pruebas de integración: el cliente de la API del front-end contra el back-end real de Q4 (Express + PostgreSQL,
// con AI_PROVIDER=simulador). Requiere el backend en marcha y las variables del .env del backend exportadas:
//   API_URL, FRONTEND_ORIGIN, DATABASE_URL, JWT_SECRET, JWT_RESET_SECRET, USER_SEED_PASSWORD, ADMIN_SEED_PASSWORD
// Reinicie el backend antes de cada ejecución: sus límites de intentos están en memoria.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'node:crypto';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import { crearCliente } from '@/lib/api';

const API = process.env.API_URL || 'http://localhost:3000';
const ORIGEN = process.env.FRONTEND_ORIGIN || 'http://localhost:3001';
const { DATABASE_URL, JWT_SECRET, JWT_RESET_SECRET, USER_SEED_PASSWORD, ADMIN_SEED_PASSWORD } = process.env;

// Un cliente por "navegador": cada uno guarda su propio token, como sessionStorage en cada pestaña.
function navegador() {
  const estado = { token: null, sesionInvalida: vi.fn() };
  const cliente = crearCliente({ baseUrl: API, obtenerToken: () => estado.token, alSesionInvalida: estado.sesionInvalida });
  return { estado, cliente };
}
async function entrar(identificador, contrasena) {
  const n = navegador();
  const r = await n.cliente.login(identificador, contrasena);
  n.estado.token = r.token;
  n.datos = r;
  return n;
}
const sufijo = crypto.randomBytes(4).toString('hex');
const nuevoUsuario = { nombreUsuario: `prueba_${sufijo}`, correo: `prueba_${sufijo}@ejemplo.invalid`, contrasena: 'ClaveInicial2026' };
let pool;

beforeAll(() => {
  for (const [k, v] of Object.entries({ DATABASE_URL, JWT_SECRET, JWT_RESET_SECRET, USER_SEED_PASSWORD, ADMIN_SEED_PASSWORD })) {
    if (!v) throw new Error(`Falta la variable de entorno ${k} (ver encabezado del archivo).`);
  }
  pool = new pg.Pool({ connectionString: DATABASE_URL });
});
afterAll(async () => { if (pool) await pool.end(); });

describe('CORS entre el front-end (origen configurado) y la API', () => {
  it('la solicitud previa (preflight) con Authorization desde el origen del front-end es aceptada', async () => {
    const r = await fetch(`${API}/api/chat`, {
      method: 'OPTIONS',
      headers: { Origin: ORIGEN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' },
    });
    expect(r.status).toBeLessThan(300);
    expect(r.headers.get('access-control-allow-origin')).toBe(ORIGEN);
    expect(r.headers.get('access-control-allow-headers').toLowerCase()).toContain('authorization');
  });

  it('otro origen no recibe permiso CORS', async () => {
    const r = await fetch(`${API}/api/health`, { headers: { Origin: 'http://sitio-ajeno.example' } });
    expect(r.headers.get('access-control-allow-origin')).not.toBe('http://sitio-ajeno.example');
  });
});

describe('acceso y roles', () => {
  it('el usuario recibe tipo usuario y /auth/me lo confirma', async () => {
    const u = await entrar('usuario_demo', USER_SEED_PASSWORD);
    expect(u.datos.cuenta.tipo).toBe('usuario');
    const me = await u.cliente.me();
    expect(me.cuenta.tipo).toBe('usuario');
    expect(me.cuenta.rol).toBe('usuario');
  });

  it('el administrador global y el de dependencia reciben tipo administrador con su alcance', async () => {
    const g = await entrar('admin', ADMIN_SEED_PASSWORD);
    expect(g.datos.cuenta).toMatchObject({ tipo: 'administrador', alcance_admin: 'global' });
    const d = await entrar('admin_registro', ADMIN_SEED_PASSWORD);
    expect(d.datos.cuenta.alcance_admin).toBe('dependencia');
    expect(d.datos.cuenta.id_dependencia).toBeGreaterThan(0);
    expect((await d.cliente.me()).cuenta.tipo).toBe('administrador');
  });

  it('el login también acepta el correo y rechaza credenciales incorrectas con el mensaje del backend', async () => {
    const n = navegador();
    await expect(n.cliente.login('usuario_demo', 'ClaveIncorrecta1')).rejects.toMatchObject({ estado: 401, codigo: 'credenciales_invalidas' });
    await expect(n.cliente.login('no_existe', 'ClaveIncorrecta1')).rejects.toMatchObject({ estado: 401, codigo: 'credenciales_invalidas' });
    const r = await n.cliente.login('usuario.demo@ejemplo.invalid', USER_SEED_PASSWORD);
    expect(r.cuenta.nombre_usuario).toBe('usuario_demo');
  });

  it('sin token las rutas privadas responden 401', async () => {
    const n = navegador();
    await expect(n.cliente.conversaciones()).rejects.toMatchObject({ estado: 401, codigo: 'no_autenticado' });
  });

  it('el administrador no puede usar el chat de usuario y el usuario no puede entrar a rutas de administración (403)', async () => {
    const a = await entrar('admin', ADMIN_SEED_PASSWORD);
    await expect(a.cliente.chat({ idSesion: 'sesion-admin-0123456789', mensaje: 'hola' })).rejects.toMatchObject({ estado: 403, codigo: 'rol_insuficiente' });
    const u = await entrar('usuario_demo', USER_SEED_PASSWORD);
    await expect(u.cliente.crearCuentaUsuario(nuevoUsuario)).rejects.toMatchObject({ estado: 403 });
  });

  it('un token manipulado (rol alterado sin la clave) es rechazado', async () => {
    const u = await entrar('usuario_demo', USER_SEED_PASSWORD);
    const [h, , s] = u.estado.token.split('.');
    const carga = Buffer.from(JSON.stringify({ tipo: 'administrador', rol: 'administrador', alcance_admin: 'global', ver: 0, sub: '1' })).toString('base64url');
    u.estado.token = `${h}.${carga}.${s}`;
    await expect(u.cliente.me()).rejects.toMatchObject({ estado: 401, codigo: 'token_invalido' });
    expect(u.estado.sesionInvalida).toHaveBeenCalledTimes(1);
  });
});

describe('asistente, preguntas frecuentes e historial propio', () => {
  let u;
  let idConversacion;
  beforeAll(async () => { u = await entrar('usuario_demo', USER_SEED_PASSWORD); });

  it('responde una consulta con dependencia, o escala cuando no hay respaldo', async () => {
    const r = await u.cliente.chat({ idSesion: 'sesion-integracion-0001', mensaje: 'Quiero información sobre inscripción y admisión' });
    idConversacion = r.id_conversacion;
    expect(typeof r.respuesta).toBe('string');
    expect(typeof r.escalada).toBe('boolean');
    expect(r.dependencia === null || typeof r.dependencia.nombre === 'string').toBe(true);

    const e = await u.cliente.chat({ idSesion: 'sesion-integracion-0002', mensaje: 'zzzz qqqq xxxx' });
    expect(e.escalada).toBe(true);
    expect(e.respuesta).toMatch(/escalamiento/i);
  });

  it('continúa la misma conversación con id_conversacion y la lista en el historial', async () => {
    const r = await u.cliente.chat({ idSesion: 'sesion-integracion-0001', mensaje: 'Gracias, ¿y para pagar la matrícula?', idConversacion });
    expect(r.id_conversacion).toBe(idConversacion);
    const lista = await u.cliente.conversaciones();
    expect(lista.some((c) => c.id_conversacion === idConversacion)).toBe(true);
    const det = await u.cliente.conversacion(idConversacion);
    expect(det.mensajes.length).toBeGreaterThanOrEqual(4);
    expect(det.mensajes.map((m) => m.emisor)).toEqual(expect.arrayContaining(['usuario', 'asistente']));
  });

  it('lista las preguntas frecuentes y devuelve la respuesta al seleccionar una', async () => {
    const faqs = await u.cliente.preguntasFrecuentes();
    expect(faqs.length).toBeGreaterThan(0);
    expect(faqs[0]).toHaveProperty('dependencia');
    const r = await u.cliente.consultarPregunta(faqs[0].id_faq);
    expect(r.respuesta).toBeTruthy();
  });

  it('valida entradas: mensaje vacío y de más de 1000 caracteres', async () => {
    await expect(u.cliente.chat({ idSesion: 'sesion-integracion-0001', mensaje: '' })).rejects.toMatchObject({ estado: 400 });
    await expect(u.cliente.chat({ idSesion: 'sesion-integracion-0001', mensaje: 'a'.repeat(1001) })).rejects.toMatchObject({ estado: 400 });
  });

  it('otro usuario no puede ver la conversación ajena (404) ni aparece en su historial', async () => {
    const g = await entrar('admin', ADMIN_SEED_PASSWORD);
    await g.cliente.crearCuentaUsuario(nuevoUsuario);
    const otro = await entrar(nuevoUsuario.nombreUsuario, nuevoUsuario.contrasena);
    await expect(otro.cliente.conversacion(idConversacion)).rejects.toMatchObject({ estado: 404 });
    const lista = await otro.cliente.conversaciones();
    expect(lista).toHaveLength(0);
  });
});

describe('alta de cuentas por el administrador', () => {
  it('el global crea cuentas (la nueva ya existe por la prueba anterior: duplicado 409); el de dependencia no puede (403)', async () => {
    const g = await entrar('admin', ADMIN_SEED_PASSWORD);
    await expect(g.cliente.crearCuentaUsuario(nuevoUsuario)).rejects.toMatchObject({ estado: 409, codigo: 'cuenta_existente' });
    const d = await entrar('admin_admisiones', ADMIN_SEED_PASSWORD);
    await expect(d.cliente.crearCuentaUsuario({ ...nuevoUsuario, nombreUsuario: `x_${sufijo}`, correo: `x_${sufijo}@ejemplo.invalid` })).rejects.toMatchObject({ estado: 403, codigo: 'permiso_denegado' });
  });

  it('rechaza contraseñas que no cumplen las reglas', async () => {
    const g = await entrar('admin', ADMIN_SEED_PASSWORD);
    await expect(g.cliente.crearCuentaUsuario({ nombreUsuario: `d_${sufijo}`, correo: `d_${sufijo}@ejemplo.invalid`, contrasena: 'corta' })).rejects.toMatchObject({ estado: 400, codigo: 'contrasena_insegura' });
  });
});

describe('recuperación de contraseña', () => {
  const nueva = 'ContrasenaNueva2026';
  const firmar = (idCuenta, jti, opciones = {}, secreto = JWT_RESET_SECRET) => jwt.sign(
    { tipo_cuenta: 'usuario', proposito: 'restablecer_contrasena', jti }, secreto,
    { algorithm: 'HS256', subject: String(idCuenta), expiresIn: '15m', ...opciones },
  );
  const registrar = (idCuenta, jti, expira = new Date(Date.now() + 15 * 60 * 1000)) => pool.query(
    "INSERT INTO token_recuperacion_contrasena (tipo_cuenta, id_cuenta, jti_hash, expira_en) VALUES ('usuario', $1, $2, $3)",
    [idCuenta, crypto.createHash('sha256').update(jti).digest('hex'), expira],
  );

  it('la solicitud devuelve el mismo mensaje exista o no el correo (no revela cuentas)', async () => {
    const n = navegador();
    const existente = await n.cliente.olvideContrasena(nuevoUsuario.correo);
    const inexistente = await n.cliente.olvideContrasena('nadie_registrado@ejemplo.invalid');
    expect(existente).toEqual(inexistente);
    expect(existente.mensaje).toMatch(/Si existe una cuenta/);
  });

  it('flujo completo: enlace válido cambia la contraseña, revoca sesiones previas y es de un solo uso', async () => {
    const sesionPrevia = await entrar(nuevoUsuario.nombreUsuario, nuevoUsuario.contrasena);
    const idCuenta = (await sesionPrevia.cliente.me()).cuenta.id;
    // La solicitud anterior invalidó cualquier enlace previo; se registra uno nuevo como lo haría el backend al enviar el correo.
    const jti = crypto.randomUUID();
    await registrar(idCuenta, jti);
    const token = firmar(idCuenta, jti);

    const n = navegador();
    await expect(n.cliente.restablecerContrasena(token, 'corta')).rejects.toMatchObject({ estado: 400, codigo: 'contrasena_insegura' });
    const ok = await n.cliente.restablecerContrasena(token, nueva);
    expect(ok.mensaje).toMatch(/Contraseña actualizada/);

    // La contraseña anterior ya no sirve y la nueva sí.
    await expect(n.cliente.login(nuevoUsuario.nombreUsuario, nuevoUsuario.contrasena)).rejects.toMatchObject({ codigo: 'credenciales_invalidas' });
    await expect(n.cliente.login(nuevoUsuario.nombreUsuario, nueva)).resolves.toHaveProperty('token');
    // El JWT de acceso emitido antes del cambio queda revocado.
    await expect(sesionPrevia.cliente.me()).rejects.toMatchObject({ estado: 401, codigo: 'sesion_revocada' });
    expect(sesionPrevia.estado.sesionInvalida).toHaveBeenCalledTimes(1);
    // Uso único.
    await expect(n.cliente.restablecerContrasena(token, 'OtraContrasena2026')).rejects.toMatchObject({ estado: 400, codigo: 'token_recuperacion_invalido' });
  });

  it('un enlace vencido, uno firmado con la clave de acceso y uno no registrado son rechazados', async () => {
    const n = navegador();
    const u = await entrar(nuevoUsuario.nombreUsuario, nueva);
    const idCuenta = (await u.cliente.me()).cuenta.id;

    const jtiVencido = crypto.randomUUID();
    await registrar(idCuenta, jtiVencido, new Date(Date.now() - 60 * 1000));
    const vencido = firmar(idCuenta, jtiVencido, { expiresIn: '-10s' });
    await expect(n.cliente.restablecerContrasena(vencido, 'ContrasenaOtra2026')).rejects.toMatchObject({ estado: 400, codigo: 'token_recuperacion_invalido' });

    const jtiClave = crypto.randomUUID();
    await registrar(idCuenta, jtiClave);
    await expect(n.cliente.restablecerContrasena(firmar(idCuenta, jtiClave, {}, JWT_SECRET), 'ContrasenaOtra2026')).rejects.toMatchObject({ codigo: 'token_recuperacion_invalido' });

    await expect(n.cliente.restablecerContrasena(firmar(idCuenta, crypto.randomUUID()), 'ContrasenaOtra2026')).rejects.toMatchObject({ codigo: 'token_recuperacion_invalido' });
    await expect(n.cliente.restablecerContrasena('no.es.jwt', 'ContrasenaOtra2026')).rejects.toMatchObject({ codigo: 'token_recuperacion_invalido' });
  });
});

describe('reportes (Q6): front-end contra el back-end real', () => {
  // Una sola sesión por rol: el backend limita los intentos de login (en memoria) y la suite ya usa varios.
  let g; let d; let u;
  beforeAll(async () => {
    g = await entrar('admin', ADMIN_SEED_PASSWORD);
    d = await entrar('admin_registro', ADMIN_SEED_PASSWORD);
    u = await entrar('usuario_demo', USER_SEED_PASSWORD);
  });

  it('el administrador global recibe indicadores coherentes entre sí', async () => {
    const r = await g.cliente.reporteResumen();
    expect(r.total).toBeGreaterThan(0);
    expect(r.resueltas + r.escaladas).toBe(r.total);
    expect(r.por_dependencia.reduce((s, x) => s + x.total, 0)).toBe(r.total);
    expect(Array.isArray(r.preguntas_mas_frecuentes)).toBe(true);
    expect(Array.isArray(r.consultas_por_dia)).toBe(true);
    expect(r.tiempo_promedio_ms).toBeGreaterThan(0);
  });

  it('una consulta real hecha por un usuario aparece en el reporte con su tiempo de respuesta', async () => {
    const antes = (await g.cliente.reporteResumen()).total;
    await u.cliente.chat({ idSesion: `integracion-q6-${sufijo}-0000`, mensaje: `¿Cuáles son los requisitos de inscripción? (${sufijo})` });
    const despues = (await g.cliente.reporteResumen()).total;
    expect(despues).toBe(antes + 1);
    const [ultima] = await g.cliente.reporteInteracciones({ limite: 1 });
    expect(ultima.consulta).toContain(sufijo);
    expect(Number.isInteger(ultima.tiempo_respuesta_ms)).toBe(true);
  });

  it('el administrador de dependencia queda limitado a su dependencia, también si intenta pedir otra', async () => {
    const r = await d.cliente.reporteResumen();
    expect(r.por_dependencia.map((x) => x.dependencia)).toEqual(['Registro y Control']);
    await expect(d.cliente.reporteResumen({ dependencia: 1 })).rejects.toMatchObject({ estado: 403, codigo: 'fuera_de_alcance' });
    await expect(d.cliente.reporteInteracciones({ dependencia: 1 })).rejects.toMatchObject({ estado: 403 });
  });

  it('una cuenta de usuario no accede a los reportes y los filtros inválidos se rechazan', async () => {
    await expect(u.cliente.reporteResumen()).rejects.toMatchObject({ estado: 403, codigo: 'rol_insuficiente' });
    await expect(g.cliente.reporteResumen({ desde: '2026-02-01', hasta: '2026-01-01' })).rejects.toMatchObject({ estado: 400, codigo: 'fecha_invalida' });
    expect((await g.cliente.reporteResumen({ desde: '2999-01-01' })).total).toBe(0);
  });
});

describe('historial administrativo (Q6): front-end contra el back-end real', () => {
  let g; let d; let u;
  beforeAll(async () => {
    g = await entrar('admin', ADMIN_SEED_PASSWORD);
    d = await entrar('admin_registro', ADMIN_SEED_PASSWORD);
    u = await entrar('usuario_demo', USER_SEED_PASSWORD);
  });

  it('el administrador global lista conversaciones con dependencia, estado y paginación', async () => {
    const pagina1 = await g.cliente.adminConversaciones({ limite: 5, desplazamiento: 0 });
    const pagina2 = await g.cliente.adminConversaciones({ limite: 5, desplazamiento: 5 });
    expect(pagina1).toHaveLength(5);
    expect(pagina2).toHaveLength(5);
    expect(pagina1[0].id_conversacion).not.toBe(pagina2[0].id_conversacion);
    for (const c of pagina1) {
      expect(typeof c.escalada).toBe('boolean');
      expect(c.mensajes).toBeGreaterThan(0);
      expect(c).toHaveProperty('dependencia');
      expect(c).not.toHaveProperty('id_sesion'); // el id de sesión funciona como credencial y no se expone
    }
  });

  it('el detalle trae mensajes y la ficha de la consulta, y es el mismo al que enlaza el reporte', async () => {
    const [fila] = await g.cliente.reporteInteracciones({ limite: 1 });
    const conv = await g.cliente.adminConversacion(fila.id_conversacion);
    expect(conv.id_conversacion).toBe(fila.id_conversacion);
    expect(conv.mensajes.length).toBeGreaterThanOrEqual(2);
    expect(conv.consultas.some((c) => c.id_consulta === fila.id_consulta)).toBe(true);
    const ficha = conv.consultas.find((c) => c.id_consulta === fila.id_consulta);
    expect(ficha.estado).toBe(fila.estado);
    expect(ficha.tiempo_respuesta_ms).toBe(fila.tiempo_respuesta_ms);
    expect(conv).not.toHaveProperty('id_sesion');
  });

  it('el administrador de dependencia solo ve sus conversaciones y no puede abrir las de otra dependencia', async () => {
    const propias = await d.cliente.adminConversaciones({ limite: 50 });
    expect(propias.length).toBeGreaterThan(0);
    expect(propias.every((c) => c.dependencia === 'Registro y Control')).toBe(true);
    const todas = await g.cliente.adminConversaciones({ limite: 100 });
    const ajena = todas.find((c) => c.dependencia === 'Admisiones');
    await expect(d.cliente.adminConversacion(ajena.id_conversacion)).rejects.toMatchObject({ estado: 404, codigo: 'conversacion_no_encontrada' });
    await expect(d.cliente.adminConversaciones({ dependencia: 1 })).rejects.toMatchObject({ estado: 403, codigo: 'fuera_de_alcance' });
  });

  it('una cuenta de usuario no accede al historial administrativo y los identificadores inválidos se rechazan', async () => {
    await expect(u.cliente.adminConversaciones()).rejects.toMatchObject({ estado: 403, codigo: 'rol_insuficiente' });
    await expect(u.cliente.adminConversacion(1)).rejects.toMatchObject({ estado: 403 });
    await expect(g.cliente.adminConversacion('abc')).rejects.toMatchObject({ estado: 400 });
    await expect(g.cliente.adminConversacion(99999999)).rejects.toMatchObject({ estado: 404 });
  });
});

describe('alcance del historial en conversaciones mixtas (front-end contra el back-end real)', () => {
  let g; let adm; let reg; let u; let idConv;
  beforeAll(async () => {
    g = await entrar('admin', ADMIN_SEED_PASSWORD);
    adm = await entrar('admin_admisiones', ADMIN_SEED_PASSWORD);
    reg = await entrar('admin_registro', ADMIN_SEED_PASSWORD);
    u = await entrar('usuario_demo', USER_SEED_PASSWORD);
    // Una sola conversación con una pregunta para Admisiones y otra para Registro y Control.
    const idSesion = `integracion-mixta-${sufijo}-0001`;
    const a = await u.cliente.chat({ idSesion, mensaje: `¿Cuáles son los requisitos de inscripción? (${sufijo})` });
    idConv = a.id_conversacion;
    await u.cliente.chat({ idSesion, idConversacion: idConv, mensaje: `¿Cómo solicito un certificado de notas? (${sufijo})` });
  });

  it('el administrador global ve la conversación completa', async () => {
    const c = await g.cliente.adminConversacion(idConv);
    expect(c.mensajes).toHaveLength(4);
    expect(c.consultas).toHaveLength(2);
  });

  it('cada administrador de dependencia ve solo los mensajes de su dependencia', async () => {
    const a = await adm.cliente.adminConversacion(idConv);
    expect(a.mensajes).toHaveLength(2);
    expect(a.mensajes.map((m) => m.contenido).join(' ')).not.toMatch(/certificado/);
    const r = await reg.cliente.adminConversacion(idConv);
    expect(r.mensajes).toHaveLength(2);
    expect(r.mensajes.map((m) => m.contenido).join(' ')).not.toMatch(/requisitos/);
  });

  it('la lista aplica el mismo alcance al contar mensajes y mostrar la primera consulta', async () => {
    const lista = await adm.cliente.adminConversaciones({ limite: 100 });
    const fila = lista.find((c) => c.id_conversacion === idConv);
    expect(fila.mensajes).toBe(2);
    expect(fila.primera_consulta).toMatch(/requisitos de inscripción/);
  });
});

// Requiere haber ejecutado `npm run db:cargar-info-general` en el backend (README) y AI_PROVIDER=simulador.
describe('información general de TEINCO (front-end contra el back-end real)', () => {
  let u; let g;
  beforeAll(async () => {
    u = await entrar('usuario_demo', USER_SEED_PASSWORD);
    g = await entrar('admin', ADMIN_SEED_PASSWORD);
    const deps = await u.cliente.dependencias();
    if (!deps.some((d) => d.nombre === 'Información general')) {
      throw new Error("Falta la dependencia 'Información general': ejecute `npm run db:cargar-info-general` en el backend.");
    }
  });

  it('responde dónde están las sedes y qué carreras se ofrecen, con la información cargada', async () => {
    const sedes = await u.cliente.chat({ idSesion: `integracion-info-${sufijo}-0001`, mensaje: '¿Dónde están las sedes de TEINCO?' });
    expect(sedes.escalada).toBe(false);
    expect(sedes.dependencia.nombre).toBe('Información general');
    expect(sedes.respuesta).toContain('Avenida Caracas Nº 63-85');
    const carreras = await u.cliente.chat({ idSesion: `integracion-info-${sufijo}-0002`, mensaje: '¿Qué carreras ofrece TEINCO?' });
    expect(carreras.escalada).toBe(false);
    expect(carreras.respuesta).toContain('Ingeniería Mecatrónica');
  });

  it('lo que no está en la información se escala con el contacto institucional, sin inventar', async () => {
    const r = await u.cliente.chat({ idSesion: `integracion-info-${sufijo}-0003`, mensaje: '¿Tienen sede en Medellín?' });
    expect(r.escalada).toBe(true);
    expect(r.respuesta).toContain('601 743 32 00');
    expect(r.respuesta).not.toContain('Medellín');
  });

  it('las preguntas frecuentes del catálogo incluyen las generales y devuelven su respuesta', async () => {
    const faq = await u.cliente.preguntasFrecuentes();
    const sedes = faq.find((f) => f.pregunta === '¿Dónde están las sedes de TEINCO?');
    expect(sedes.dependencia).toBe('Información general');
    expect((await u.cliente.consultarPregunta(sedes.id_faq)).respuesta).toContain('Mosquera');
  });

  it('la consulta general aparece en los reportes como una dependencia más', async () => {
    const r = await g.cliente.reporteResumen();
    expect(r.por_dependencia.some((d) => d.dependencia === 'Información general' && d.total >= 2)).toBe(true);
  });
});
