// @vitest-environment node
// Q8 — Integración del front-end con el back-end real: dependencia personalizada desde la creación de cuenta y formato
// estándar de respuesta (mensaje, contacto y dependencia). Mismos requisitos que api-real.test.js (backend con
// AI_PROVIDER=simulador y las variables del .env exportadas). Reinicie el backend antes de cada ejecución.
// Limpia lo que crea: la dependencia de prueba y su cuenta.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'node:crypto';
import pg from 'pg';
import { crearCliente } from '@/lib/api';

const API = process.env.API_URL || 'http://localhost:3000';
const { DATABASE_URL, ADMIN_SEED_PASSWORD, USER_SEED_PASSWORD } = process.env;
const sufijo = crypto.randomBytes(4).toString('hex');
const CLAVE = 'ClaveInicial2026';
const NOMBRE_DEP = `Biblioteca ${sufijo}`;
let pool;

async function entrar(identificador, contrasena) {
  const estado = { token: null };
  const cliente = crearCliente({ baseUrl: API, obtenerToken: () => estado.token, alSesionInvalida: vi.fn() });
  const r = await cliente.login(identificador, contrasena);
  estado.token = r.token;
  return { cliente, datos: r };
}

beforeAll(() => {
  for (const [k, v] of Object.entries({ DATABASE_URL, ADMIN_SEED_PASSWORD, USER_SEED_PASSWORD })) {
    if (!v) throw new Error(`Falta la variable de entorno ${k} (ver encabezado del archivo).`);
  }
  pool = new pg.Pool({ connectionString: DATABASE_URL });
});
afterAll(async () => {
  if (pool) {
    await pool.query('DELETE FROM administrador WHERE nombre_usuario LIKE $1', [`bib_${sufijo}%`]);
    await pool.query('DELETE FROM dependencia WHERE nombre = $1', [NOMBRE_DEP]);
    await pool.end();
  }
});

describe('formato estándar de respuesta (front-end contra el back-end real)', () => {
  it('el chat devuelve respuesta, contacto y dependencia separados, sin repetir el contacto en el mensaje', async () => {
    const u = await entrar('usuario_demo', USER_SEED_PASSWORD);
    const r = await u.cliente.chat({ idSesion: `sesion-q8-${sufijo}-0001`, mensaje: '¿Cuáles son los requisitos de inscripción?' });
    expect(r.escalada).toBe(false);
    expect(r.dependencia).toEqual({ id_dependencia: expect.any(Number), nombre: 'Admisiones' });
    expect(r.contacto.texto).toContain('@');
    expect(r.respuesta).not.toContain(r.contacto.correos[0]);
    expect(r.respuesta).not.toMatch(/Contacto de/);
    const conv = await u.cliente.conversacion(r.id_conversacion);
    const asistente = conv.mensajes.find((m) => m.emisor === 'asistente');
    expect(asistente.contenido).toBe(r.respuesta);
    expect(asistente.contacto.texto).toBe(r.contacto.texto);
    expect(asistente.dependencia.nombre).toBe('Admisiones');
  });

  it('el escalamiento con dependencia no nombra la dependencia ni su contacto en el mensaje; sin dependencia, ambos son nulos', async () => {
    const u = await entrar('usuario_demo', USER_SEED_PASSWORD);
    const r = await u.cliente.chat({ idSesion: `sesion-q8-${sufijo}-0002`, mensaje: '¿Tienen sede en Medellín?' });
    expect(r.escalada).toBe(true);
    expect(r.respuesta).not.toContain('Información general');
    expect(r.respuesta).not.toContain('601 743 32 00');
    expect(r.contacto.texto).toContain('601 743 32 00');
    const sin = await u.cliente.chat({ idSesion: `sesion-q8-${sufijo}-0003`, mensaje: 'xyzzy plugh qwerty' });
    expect(sin.contacto).toBeNull();
    expect(sin.dependencia).toBeNull();
  });

  it('una pregunta frecuente devuelve el mismo formato', async () => {
    const u = await entrar('usuario_demo', USER_SEED_PASSWORD);
    const faq = (await u.cliente.preguntasFrecuentes()).find((f) => f.dependencia === 'Admisiones');
    const r = await u.cliente.consultarPregunta(faq.id_faq);
    expect(Object.keys(r).sort()).toEqual(['contacto', 'dependencia', 'id_faq', 'pregunta', 'respuesta']);
    expect(r.dependencia.nombre).toBe('Admisiones');
  });
});

describe('dependencia personalizada creada desde la cuenta (front-end contra el back-end real)', () => {
  it('el global escribe el nombre; la dependencia y su cuenta nacen limitadas, y el asistente le dirige consultas', async () => {
    const g = await entrar('admin', ADMIN_SEED_PASSWORD);
    const nueva = {
      nombreUsuario: `bib_${sufijo}`, correo: `bib_${sufijo}@ejemplo.invalid`, contrasena: CLAVE,
      nombreDependencia: NOMBRE_DEP, descripcion: 'Préstamo de libros y recursos bibliográficos de la biblioteca.',
      correos: [`biblioteca_${sufijo}@ejemplo.invalid`], telefono: '601 555 01 02',
    };
    const creada = await g.cliente.crearAdministradorDependencia(nueva);
    expect(creada.cuenta).toMatchObject({ alcance_admin: 'dependencia', dependencia: NOMBRE_DEP });
    expect(creada.dependencia).toMatchObject({ nombre: NOMBRE_DEP, telefono: '601 555 01 02', total_informacion: 0, total_faq: 0 });
    await expect(g.cliente.crearAdministradorDependencia({ ...nueva, nombreUsuario: `bib_${sufijo}_2`, correo: `bib2_${sufijo}@ejemplo.invalid`, nombreDependencia: NOMBRE_DEP.toUpperCase() }))
      .rejects.toMatchObject({ estado: 409, codigo: 'dependencia_existente' });
    expect((await g.cliente.dependencias()).some((d) => d.nombre === NOMBRE_DEP)).toBe(true);

    const b = await entrar(nueva.nombreUsuario, CLAVE);
    const propias = await b.cliente.adminDependencias();
    expect(propias).toHaveLength(1);
    const info = await b.cliente.crearInformacion({ id_dependencia: creada.dependencia.id_dependencia, titulo: 'Préstamo de libros', contenido: 'El préstamo de libros se solicita en el mostrador con el carné vigente.' });
    expect(info.id_dependencia).toBe(creada.dependencia.id_dependencia);
    const admisiones = (await g.cliente.dependencias()).find((d) => d.nombre === 'Admisiones');
    await expect(b.cliente.crearInformacion({ id_dependencia: admisiones.id_dependencia, titulo: 'x', contenido: 'y' })).rejects.toMatchObject({ estado: 403 });

    const u = await entrar('usuario_demo', USER_SEED_PASSWORD);
    const r = await u.cliente.chat({ idSesion: `sesion-q8-${sufijo}-0004`, mensaje: '¿Cómo solicito el préstamo de libros de la biblioteca?' });
    expect(r.dependencia.nombre).toBe(NOMBRE_DEP);
    expect(r.escalada).toBe(false);
    expect(r.contacto.texto).toBe(`biblioteca_${sufijo}@ejemplo.invalid · Tel. 601 555 01 02`);
    const resumen = await b.cliente.reporteResumen({});
    expect(resumen.total).toBe(1);
    expect((await g.cliente.reporteResumen({})).por_dependencia.some((d) => d.dependencia === NOMBRE_DEP)).toBe(true);
    const hist = await b.cliente.adminConversaciones({});
    expect(hist).toHaveLength(1);
    const editada = await b.cliente.editarDependencia(creada.dependencia.id_dependencia, { descripcion: 'Biblioteca y préstamos.', correos: [`nuevo_${sufijo}@ejemplo.invalid`], telefono: '' });
    expect(editada.correos).toEqual([`nuevo_${sufijo}@ejemplo.invalid`]);
    expect(editada.telefono).toBeNull();
  });
});
