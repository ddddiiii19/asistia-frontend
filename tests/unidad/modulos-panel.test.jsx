// Q7 — Panel administrativo con todos los módulos activos y navegación que distingue el módulo actual.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

let rutaActual = '/admin';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => rutaActual }));
vi.mock('@/lib/api', async (original) => {
  const real = await original();
  return { ...real, api: { dependencias: vi.fn().mockResolvedValue([]), crearCuentaUsuario: vi.fn() } };
});

import { AuthProvider } from '@/components/AuthProvider';
import { PanelAdmin } from '@/components/PanelAdmin';
import { Encabezado } from '@/components/Encabezado';
import { guardarSesion } from '@/lib/sesion';
import { crearCliente } from '@/lib/api';

beforeEach(() => {
  rutaActual = '/admin';
  guardarSesion({ token: 't', cuenta: { tipo: 'administrador', alcance_admin: 'global', nombre_usuario: 'admin' } });
});

describe('panel administrativo', () => {
  it('los cuatro módulos son enlaces activos y ya no aparece "Próximamente"', async () => {
    render(<AuthProvider><PanelAdmin /></AuthProvider>);
    const modulos = await screen.findByRole('region', { name: 'Módulos' });
    const enlaces = [...modulos.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')]);
    expect(enlaces.map((e) => e[1])).toEqual(['/admin/reportes', '/admin/informacion', '/admin/faq', '/admin/historial']);
    expect(enlaces.map((e) => e[0]).join(' ')).toContain('Información institucional');
    expect(enlaces.map((e) => e[0]).join(' ')).toContain('Preguntas frecuentes');
    expect(document.body.textContent).not.toMatch(/Próximamente/i);
    expect(screen.getByRole('heading', { level: 1, name: 'Panel administrativo' })).toBeInTheDocument();
  });
});

describe('navegación principal', () => {
  const ENLACES = [
    { href: '/admin', texto: 'Panel', exacto: true, modulo: 'panel' },
    { href: '/admin/reportes', texto: 'Reportes', modulo: 'reportes' },
    { href: '/admin/informacion', texto: 'Información', modulo: 'informacion' },
    { href: '/admin/faq', texto: 'Preguntas frecuentes', modulo: 'faq' },
  ];

  it('marca solo el módulo actual con aria-current y un estilo distinto', () => {
    rutaActual = '/admin/informacion';
    render(<AuthProvider><Encabezado enlaces={ENLACES} /></AuthProvider>);
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    const actuales = [...nav.querySelectorAll('[aria-current="page"]')];
    expect(actuales.map((a) => a.textContent)).toEqual(['Información']);
    expect(actuales[0].className).toContain('bg-white');
    expect(screen.getByRole('link', { name: 'Reportes' }).className).not.toContain('bg-white ');
    expect(screen.getByRole('link', { name: 'Panel' })).not.toHaveAttribute('aria-current');
  });
});

describe('cliente API de contenido', () => {
  const respuesta = (estado, cuerpo) => ({ ok: estado < 300, status: estado, json: async () => cuerpo });

  it('usa los métodos y rutas del backend para información y preguntas frecuentes', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respuesta(200, []));
    const c = crearCliente({ baseUrl: 'http://api', obtenerToken: () => 'tok', fetchImpl });
    await c.adminInformacion({ dependencia: '3' });
    await c.crearInformacion({ id_dependencia: 3, titulo: 'a', contenido: 'b' });
    await c.editarInformacion(4, { id_dependencia: 3, titulo: 'a', contenido: 'c' });
    await c.eliminarInformacion(4);
    await c.adminFaq({ dependencia: '' });
    await c.crearFaq({ id_dependencia: 3, pregunta: 'p', respuesta: 'r' });
    await c.editarFaq(3, { id_dependencia: 3, pregunta: 'p', respuesta: 'r2' });
    await c.eliminarFaq(3);
    const llamadas = fetchImpl.mock.calls.map(([url, init]) => `${init.method || 'GET'} ${url.replace('http://api', '')}`);
    expect(llamadas).toEqual([
      'GET /api/admin/informacion?dependencia=3',
      'POST /api/admin/informacion',
      'PUT /api/admin/informacion/4',
      'DELETE /api/admin/informacion/4',
      'GET /api/admin/faq',
      'POST /api/admin/faq',
      'PUT /api/admin/faq/3',
      'DELETE /api/admin/faq/3',
    ]);
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body)).toEqual({ id_dependencia: 3, titulo: 'a', contenido: 'c' });
  });
});
