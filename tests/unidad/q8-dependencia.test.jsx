// Q8 — Datos de la dependencia (descripción y contacto) en el panel, y aviso de dependencia sin contenido.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => '/admin' }));
vi.mock('@/lib/api', async (original) => {
  const real = await original();
  return { ...real, api: { dependencias: vi.fn(), adminDependencias: vi.fn(), editarDependencia: vi.fn(), crearCuentaUsuario: vi.fn(), crearAdministradorDependencia: vi.fn() } };
});

import { api, ApiError, crearCliente } from '@/lib/api';
import { AuthProvider } from '@/components/AuthProvider';
import { PanelAdmin } from '@/components/PanelAdmin';
import { guardarSesion } from '@/lib/sesion';
import { dividirCorreos, errorCorreosContacto, telefonoValido } from '@/lib/validacion';

const montar = () => render(<AuthProvider><PanelAdmin /></AuthProvider>);
const DEPS = [
  { id_dependencia: 1, nombre: 'Admisiones', descripcion: 'Inscripciones.', correos: ['adm@teinco.edu.co'], telefono: '601 743 32 00', total_informacion: 2, total_faq: 1 },
  { id_dependencia: 7, nombre: 'Biblioteca', descripcion: 'Libros.', correos: ['bib@teinco.edu.co'], telefono: null, total_informacion: 0, total_faq: 0 },
];

beforeEach(() => { vi.clearAllMocks(); api.dependencias.mockResolvedValue([]); });

describe('administrador de una dependencia', () => {
  beforeEach(() => {
    guardarSesion({ token: 't', cuenta: { tipo: 'administrador', alcance_admin: 'dependencia', id_dependencia: 7, nombre_usuario: 'bib' } });
    api.adminDependencias.mockResolvedValue([DEPS[1]]);
  });

  it('ve los datos de SU dependencia, sin selector, y el aviso de que no tiene contenido', async () => {
    montar();
    expect(await screen.findByRole('heading', { name: 'Datos de la dependencia' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Dependencia' })).toBeNull();
    expect(screen.getByLabelText('Descripción de la dependencia')).toHaveValue('Libros.');
    expect(screen.getByLabelText('Correos de contacto')).toHaveValue('bib@teinco.edu.co');
    expect(screen.getByLabelText('Teléfono de contacto')).toHaveValue('');
    expect(screen.getByText(/aún no tiene información institucional ni preguntas frecuentes: sus consultas se escalan/)).toBeInTheDocument();
  });

  it('guarda descripción y contacto, y envía los correos como lista', async () => {
    api.editarDependencia.mockResolvedValue({ ...DEPS[1], descripcion: 'Préstamos.', correos: ['a@teinco.edu.co', 'b@teinco.edu.co'], telefono: '601 111 22 33', total_informacion: 0, total_faq: 0 });
    montar();
    const desc = await screen.findByLabelText('Descripción de la dependencia');
    await userEvent.clear(desc);
    await userEvent.type(desc, 'Préstamos.');
    const correos = screen.getByLabelText('Correos de contacto');
    await userEvent.clear(correos);
    await userEvent.type(correos, 'a@teinco.edu.co, b@teinco.edu.co');
    await userEvent.type(screen.getByLabelText('Teléfono de contacto'), '601 111 22 33');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar datos' }));
    expect(api.editarDependencia).toHaveBeenCalledWith(7, { descripcion: 'Préstamos.', correos: ['a@teinco.edu.co', 'b@teinco.edu.co'], telefono: '601 111 22 33' });
    expect(await screen.findByText('Datos de la dependencia guardados.')).toBeInTheDocument();
  });

  it('valida antes de enviar y muestra el error del servidor', async () => {
    montar();
    const correos = await screen.findByLabelText('Correos de contacto');
    await userEvent.clear(correos);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar datos' }));
    expect(screen.getByText('Ingresa al menos un correo de contacto.')).toBeInTheDocument();
    expect(api.editarDependencia).not.toHaveBeenCalled();
    await userEvent.type(correos, 'ok@teinco.edu.co');
    api.editarDependencia.mockRejectedValue(new ApiError(403, 'fuera_de_alcance', 'Solo puedes modificar el contenido de tu dependencia.'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar datos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo puedes modificar');
  });
});

describe('administrador global', () => {
  it('elige la dependencia a editar y no ve el aviso si ya tiene contenido', async () => {
    guardarSesion({ token: 't', cuenta: { tipo: 'administrador', alcance_admin: 'global', nombre_usuario: 'admin' } });
    api.adminDependencias.mockResolvedValue(DEPS);
    montar();
    const selector = await screen.findAllByLabelText('Dependencia');
    expect(selector.length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Descripción de la dependencia')).toHaveValue('Inscripciones.');
    expect(screen.queryByText(/sus consultas se escalan/)).toBeNull();
    await userEvent.selectOptions(selector[0], '7');
    expect(screen.getByLabelText('Descripción de la dependencia')).toHaveValue('Libros.');
    expect(screen.getByText(/Biblioteca aún no tiene información institucional ni preguntas frecuentes/)).toBeInTheDocument();
  });
});

describe('cliente API y validaciones de contacto', () => {
  it('enviar los datos de una dependencia nueva usa los nombres del backend', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ cuenta: {} }) });
    const c = crearCliente({ baseUrl: 'http://api', obtenerToken: () => 'tok', fetchImpl });
    await c.crearAdministradorDependencia({ nombreUsuario: 'x', correo: 'x@e.co', contrasena: 'Clave12345678', nombreDependencia: 'Egresados', descripcion: 'Servicios.', correos: ['e@e.co'], telefono: '601 111 22 33' });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      nombre_usuario: 'x', correo: 'x@e.co', contrasena: 'Clave12345678', nombre_dependencia: 'Egresados', descripcion: 'Servicios.', correos: ['e@e.co'], telefono: '601 111 22 33',
    });
    await c.adminDependencias();
    expect(fetchImpl.mock.calls[1][0]).toBe('http://api/api/admin/dependencias');
    await c.editarDependencia(7, { descripcion: 'x' });
    expect(fetchImpl.mock.calls[2][0]).toBe('http://api/api/admin/dependencias/7');
    expect(fetchImpl.mock.calls[2][1].method).toBe('PUT');
  });

  it('dividirCorreos, errorCorreosContacto y telefonoValido siguen las reglas del backend', () => {
    expect(dividirCorreos('a@x.co, B@x.co ; a@X.co\nc@x.co')).toEqual(['a@x.co', 'B@x.co', 'c@x.co']);
    expect(errorCorreosContacto('')).toMatch(/al menos un correo/);
    expect(errorCorreosContacto('a@x.co, malo')).toMatch(/Revisa los correos/);
    expect(errorCorreosContacto('1@x.co,2@x.co,3@x.co,4@x.co,5@x.co,6@x.co')).toMatch(/máximo 5/);
    expect(errorCorreosContacto('a@x.co, b@x.co')).toBe('');
    expect(telefonoValido('')).toBe(true);
    expect(telefonoValido('601 743 32 00 · WhatsApp 301 333 79 56')).toBe(true);
    expect(telefonoValido('123')).toBe(false);
    expect(telefonoValido('abcdefghij')).toBe(false);
  });
});
