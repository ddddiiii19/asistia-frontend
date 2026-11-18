// Q7 — Creación de cuentas de dependencia desde el panel administrativo (solo administrador global).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => '/admin' }));
vi.mock('@/lib/api', async (original) => {
  const real = await original();
  return { ...real, api: { dependencias: vi.fn(), crearCuentaUsuario: vi.fn(), crearAdministradorDependencia: vi.fn() } };
});

import { api, ApiError, crearCliente } from '@/lib/api';
import { AuthProvider } from '@/components/AuthProvider';
import { PanelAdmin } from '@/components/PanelAdmin';
import { guardarSesion } from '@/lib/sesion';

const DEPENDENCIAS = [{ id_dependencia: 1, nombre: 'Admisiones' }, { id_dependencia: 3, nombre: 'Bienestar' }];
const CLAVE = 'ClaveInicial2026';
const montar = () => render(<AuthProvider><PanelAdmin /></AuthProvider>);

async function llenar({ nombre = 'bienestar_nuevo', correo = 'bienestar@ejemplo.com' } = {}) {
  await userEvent.type(screen.getByLabelText('Nombre de usuario'), nombre);
  await userEvent.type(screen.getByLabelText('Correo electrónico'), correo);
  await userEvent.type(screen.getByLabelText('Contraseña inicial'), CLAVE);
}

beforeEach(() => {
  vi.clearAllMocks();
  guardarSesion({ token: 't', cuenta: { tipo: 'administrador', alcance_admin: 'global', nombre_usuario: 'admin' } });
  api.dependencias.mockResolvedValue(DEPENDENCIAS);
});

describe('formulario de creación de cuentas', () => {
  it('por defecto crea cuentas de Usuario y no pide las dependencias', async () => {
    api.crearCuentaUsuario.mockResolvedValue({ cuenta: { nombre_usuario: 'nuevo' } });
    montar();
    expect(await screen.findByLabelText('Tipo de cuenta')).toHaveValue('usuario');
    expect(screen.queryByLabelText('Dependencia')).toBeNull();
    await llenar({ nombre: 'nuevo', correo: 'nuevo@ejemplo.com' });
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Cuenta de usuario «nuevo» creada.');
    expect(api.crearCuentaUsuario).toHaveBeenCalledWith({ nombreUsuario: 'nuevo', correo: 'nuevo@ejemplo.com', contrasena: CLAVE });
    expect(api.dependencias).not.toHaveBeenCalled();
    expect(api.crearAdministradorDependencia).not.toHaveBeenCalled();
  });

  // Q8: el nombre de la dependencia se escribe libremente (sin lista predeterminada) con su descripción y contacto.
  async function elegirDependencia() {
    await userEvent.selectOptions(await screen.findByLabelText('Tipo de cuenta'), 'dependencia');
  }
  async function llenarDependencia({ nombre = 'Biblioteca y Recursos', descripcion = 'Préstamo de libros y recursos.', correos = 'biblioteca@teinco.edu.co, recursos@teinco.edu.co', telefono = '601 555 01 02' } = {}) {
    await userEvent.type(screen.getByLabelText('Nombre de la dependencia'), nombre);
    await userEvent.type(screen.getByLabelText('Descripción de la dependencia'), descripcion);
    await userEvent.type(screen.getByLabelText('Correos de contacto'), correos);
    if (telefono) await userEvent.type(screen.getByLabelText('Teléfono de contacto'), telefono);
  }

  it('al elegir "Administrador de dependencia" pide escribir el nombre, sin lista de dependencias, y explica el alcance', async () => {
    montar();
    await elegirDependencia();
    expect(screen.getByLabelText('Nombre de la dependencia')).toHaveValue('');
    expect(screen.queryByRole('combobox', { name: 'Dependencia' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Bienestar' })).toBeNull();
    expect(screen.getByText(/información, las preguntas frecuentes, el historial y los reportes de esa dependencia/)).toBeInTheDocument();
    expect(api.dependencias).not.toHaveBeenCalled();
  });

  it('exige el nombre, la descripción y al menos un correo, y no llama al servidor si faltan', async () => {
    montar();
    await elegirDependencia();
    await llenar();
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(screen.getByText(/Escribe el nombre de la dependencia/)).toBeInTheDocument();
    expect(screen.getByText(/Escribe una descripción/)).toBeInTheDocument();
    expect(screen.getByText('Ingresa al menos un correo de contacto.')).toBeInTheDocument();
    expect(api.crearAdministradorDependencia).not.toHaveBeenCalled();
  });

  it('valida los correos y el teléfono de contacto', async () => {
    montar();
    await elegirDependencia();
    await llenarDependencia({ correos: 'no-es-correo', telefono: '123' });
    await llenar();
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(screen.getByText(/Revisa los correos/)).toBeInTheDocument();
    expect(screen.getByText(/Ingresa un teléfono válido/)).toBeInTheDocument();
    expect(api.crearAdministradorDependencia).not.toHaveBeenCalled();
  });

  it('crea la dependencia nueva con su cuenta, avisa que empieza sin contenido y no muestra la contraseña', async () => {
    api.crearAdministradorDependencia.mockResolvedValue({ cuenta: { nombre_usuario: 'bienestar_nuevo', dependencia: 'Biblioteca y Recursos', id_dependencia: 7 } });
    montar();
    await elegirDependencia();
    await llenarDependencia();
    await llenar();
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Cuenta «bienestar_nuevo» creada para la dependencia Biblioteca y Recursos.');
    expect(screen.getByRole('status')).toHaveTextContent(/sin contenido/);
    expect(api.crearAdministradorDependencia).toHaveBeenCalledWith({
      nombreUsuario: 'bienestar_nuevo', correo: 'bienestar@ejemplo.com', contrasena: CLAVE,
      nombreDependencia: 'Biblioteca y Recursos', descripcion: 'Préstamo de libros y recursos.',
      correos: ['biblioteca@teinco.edu.co', 'recursos@teinco.edu.co'], telefono: '601 555 01 02',
    });
    expect(api.crearCuentaUsuario).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain(CLAVE);
    expect(screen.getByLabelText('Nombre de usuario')).toHaveValue('');
    expect(screen.getByLabelText('Nombre de la dependencia')).toHaveValue('');
  });

  it('muestra el error del servidor (por ejemplo, nombre de dependencia repetido) y conserva lo escrito', async () => {
    api.crearAdministradorDependencia.mockRejectedValue(new ApiError(409, 'dependencia_existente', 'Ya existe una dependencia con ese nombre.'));
    montar();
    await elegirDependencia();
    await llenarDependencia({ nombre: 'Admisiones' });
    await llenar({ nombre: 'repetida' });
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe una dependencia con ese nombre.');
    expect(screen.getByLabelText('Nombre de usuario')).toHaveValue('repetida');
    expect(screen.getByLabelText('Nombre de la dependencia')).toHaveValue('Admisiones');
  });

  it('el administrador de dependencia no ve el formulario', async () => {
    guardarSesion({ token: 't', cuenta: { tipo: 'administrador', alcance_admin: 'dependencia', id_dependencia: 3, nombre_usuario: 'bienestar_nuevo' } });
    montar();
    expect(await screen.findByRole('heading', { name: 'Panel administrativo' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Tipo de cuenta')).toBeNull();
    expect(await screen.findByText('Dependencia: Bienestar')).toBeInTheDocument();
  });
});

describe('cliente API: cuenta de dependencia', () => {
  it('envía los datos con los nombres que espera el backend', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ cuenta: {} }) });
    const c = crearCliente({ baseUrl: 'http://api', obtenerToken: () => 'tok', fetchImpl });
    await c.crearAdministradorDependencia({ nombreUsuario: 'x', correo: 'x@e.co', contrasena: 'Clave12345678', idDependencia: 3 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://api/api/admin/cuentas/administradores-dependencia');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({ nombre_usuario: 'x', correo: 'x@e.co', contrasena: 'Clave12345678', id_dependencia: 3 });
  });
});
