// @vitest-environment node
// Q7 — Integración del front-end con el back-end real: contacto en las respuestas y cuentas de dependencia.
// Mismos requisitos que api-real.test.js (backend en marcha con AI_PROVIDER=simulador y las variables del .env exportadas).
// Reinicie el backend antes de cada ejecución: sus límites de intentos están en memoria.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'node:crypto';
import pg from 'pg';
import { crearCliente } from '@/lib/api';

const API = process.env.API_URL || 'http://localhost:3000';
const { DATABASE_URL, ADMIN_SEED_PASSWORD, USER_SEED_PASSWORD } = process.env;
const sufijo = crypto.randomBytes(4).toString('hex');
const CLAVE = 'ClaveInicial2026';
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
    await pool.query('DELETE FROM administrador WHERE nombre_usuario LIKE $1', [`dep_${sufijo}%`]);
    await pool.end();
  }
});

describe('contacto de la dependencia en las respuestas (front-end contra el back-end real)', () => {
  // Q8: el contacto viaja en el campo `contacto` (y no como línea dentro del texto).
  it('una respuesta resuelta del chat trae el contacto de su dependencia en su propio campo', async () => {
    const u = await entrar('usuario_demo', USER_SEED_PASSWORD);
    const r = await u.cliente.chat({ idSesion: `sesion-q7-${sufijo}-0001`, mensaje: '¿Cuáles son los requisitos de inscripción?' });
    expect(r.escalada).toBe(false);
    expect(r.dependencia.nombre).toBe('Admisiones');
    expect(r.contacto.texto).toMatch(/@/);
    expect(r.respuesta).not.toContain(r.contacto.correos[0]);
    expect(r.respuesta).not.toMatch(/Contacto de/);
  });

  it('la respuesta de una pregunta frecuente también lleva el contacto', async () => {
    const u = await entrar('usuario_demo', USER_SEED_PASSWORD);
    const faqs = await u.cliente.preguntasFrecuentes();
    const faq = faqs.find((f) => f.dependencia === 'Admisiones');
    const r = await u.cliente.consultarPregunta(faq.id_faq);
    expect(r.contacto.texto).toMatch(/@/);
    expect(r.dependencia.nombre).toBe('Admisiones');
    expect(r.respuesta).not.toMatch(/Contacto de/);
  });
});

describe('cuentas de dependencia (front-end contra el back-end real)', () => {
  const nueva = { nombreUsuario: `dep_${sufijo}`, correo: `dep_${sufijo}@ejemplo.invalid`, contrasena: CLAVE };

  it('el global crea la cuenta; el de dependencia y el usuario no pueden; la cuenta nueva ve solo su dependencia', async () => {
    const g = await entrar('admin', ADMIN_SEED_PASSWORD);
    const dependencias = await g.cliente.dependencias();
    const bienestar = dependencias.find((d) => d.nombre === 'Bienestar');

    const creada = await g.cliente.crearAdministradorDependencia({ ...nueva, idDependencia: bienestar.id_dependencia });
    expect(creada.cuenta).toMatchObject({ alcance_admin: 'dependencia', id_dependencia: bienestar.id_dependencia, dependencia: 'Bienestar' });
    expect(creada.cuenta.contrasena_hash).toBeUndefined();
    await expect(g.cliente.crearAdministradorDependencia({ ...nueva, idDependencia: bienestar.id_dependencia })).rejects.toMatchObject({ estado: 409 });

    const d = await entrar('admin_registro', ADMIN_SEED_PASSWORD);
    await expect(d.cliente.crearAdministradorDependencia({ ...nueva, nombreUsuario: `dep_${sufijo}_b`, correo: `dep_${sufijo}_b@ejemplo.invalid`, idDependencia: bienestar.id_dependencia })).rejects.toMatchObject({ estado: 403 });
    const u = await entrar('usuario_demo', USER_SEED_PASSWORD);
    await expect(u.cliente.crearAdministradorDependencia({ ...nueva, nombreUsuario: `dep_${sufijo}_c`, correo: `dep_${sufijo}_c@ejemplo.invalid`, idDependencia: bienestar.id_dependencia })).rejects.toMatchObject({ estado: 403 });

    const n = await entrar(nueva.nombreUsuario, CLAVE);
    expect(n.datos.cuenta).toMatchObject({ tipo: 'administrador', alcance_admin: 'dependencia', id_dependencia: bienestar.id_dependencia });
    const resumen = await n.cliente.reporteResumen({});
    expect(resumen.por_dependencia.every((x) => x.dependencia === 'Bienestar')).toBe(true);
    const interacciones = await n.cliente.reporteInteracciones({});
    expect(interacciones.every((i) => i.dependencia === 'Bienestar')).toBe(true);
    await expect(n.cliente.reporteResumen({ dependencia: dependencias.find((x) => x.nombre === 'Admisiones').id_dependencia })).rejects.toMatchObject({ estado: 403 });
  });
});
