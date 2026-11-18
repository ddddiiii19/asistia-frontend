// Q8 — Crear cuenta de dependencia: el nombre de una dependencia NUEVA se escribe libremente (sin opciones
// predeterminadas); la lista de dependencias solo aparece si se elige crear otra cuenta de una dependencia EXISTENTE.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => '/admin' }));
vi.mock('@/lib/api', async (original) => {
  const real = await original();
  return { ...real, api: { dependencias: vi.fn(), adminDependencias: vi.fn(), editarDependencia: vi.fn(), crearCuentaUsuario: vi.fn(), crearAdministradorDependencia: vi.fn() } };
});

import { api, ApiError } from '@/lib/api';
import { AuthProvider } from '@/components/AuthProvider';
import { PanelAdmin } from '@/components/PanelAdmin';
import { guardarSesion } from '@/lib/sesion';

const CLAVE = 'ClaveInicial2026';
const DEPS = [{ id_dependencia: 1, nombre: 'Admisiones' }, { id_dependencia: 3, nombre: 'Bienestar' }];

async function abrirFormularioDependencia() {
  render(<AuthProvider><PanelAdmin /></AuthProvider>);
  await userEvent.selectOptions(await screen.findByLabelText('Tipo de cuenta'), 'dependencia');
}
async function datosCuenta() {
  await userEvent.type(screen.getByLabelText('Nombre de usuario'), 'cuenta_nueva');
  await userEvent.type(screen.getByLabelText('Correo electrónico'), 'cuenta@ejemplo.com');
  await userEvent.type(screen.getByLabelText('Contraseña inicial'), CLAVE);
}

beforeEach(() => {
  vi.clearAllMocks();
  guardarSesion({ token: 't', cuenta: { tipo: 'administrador', alcance_admin: 'global', nombre_usuario: 'admin' } });
  api.dependencias.mockResolvedValue(DEPS);
  api.adminDependencias.mockResolvedValue([]);
});

describe('dependencia nueva: nombre escrito por el administrador', () => {
  it('es el modo por defecto, con un campo de texto libre y sin lista, selector ni sugerencias de nombres', async () => {
    await abrirFormularioDependencia();
    expect(screen.getByRole('radio', { name: /Dependencia nueva/ })).toBeChecked();
    const campo = screen.getByLabelText('Nombre de la dependencia');
    expect(campo.tagName).toBe('INPUT');
    expect(campo).toHaveValue('');
    expect(campo).not.toHaveAttribute('list');
    expect(campo).toHaveAttribute('autocomplete', 'off');
    expect(document.querySelector('datalist')).toBeNull();
    expect(screen.queryByRole('combobox', { name: /Dependencia/ })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Admisiones' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Bienestar' })).toBeNull();
    expect(api.dependencias).not.toHaveBeenCalled();
  });

  it('envía el nombre escrito y no consulta la lista de dependencias', async () => {
    api.crearAdministradorDependencia.mockResolvedValue({ cuenta: { nombre_usuario: 'cuenta_nueva', dependencia: 'Egresados' } });
    await abrirFormularioDependencia();
    await userEvent.type(screen.getByLabelText('Nombre de la dependencia'), 'Egresados');
    await userEvent.type(screen.getByLabelText('Descripción de la dependencia'), 'Servicios para egresados.');
    await userEvent.type(screen.getByLabelText('Correos de contacto'), 'egresados@teinco.edu.co');
    await datosCuenta();
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(api.crearAdministradorDependencia).toHaveBeenCalledWith(expect.objectContaining({ nombreDependencia: 'Egresados', correos: ['egresados@teinco.edu.co'] }));
    expect(api.crearAdministradorDependencia.mock.calls[0][0].idDependencia).toBeUndefined();
    expect(api.dependencias).not.toHaveBeenCalled();
  });

  it('si el nombre ya existe, el error orienta a elegir «Dependencia existente» para otra cuenta', async () => {
    api.crearAdministradorDependencia.mockRejectedValue(new ApiError(409, 'dependencia_existente', 'Ya existe una dependencia con ese nombre.'));
    await abrirFormularioDependencia();
    await userEvent.type(screen.getByLabelText('Nombre de la dependencia'), 'Admisiones');
    await userEvent.type(screen.getByLabelText('Descripción de la dependencia'), 'Inscripciones.');
    await userEvent.type(screen.getByLabelText('Correos de contacto'), 'a@teinco.edu.co');
    await datosCuenta();
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Ya existe una dependencia con ese nombre\. Para crear otra cuenta de esa dependencia, elige «Dependencia existente»/);
  });
});

describe('dependencia existente: otra cuenta de la misma dependencia', () => {
  it('solo al elegir ese modo aparece la lista, sin datos de la dependencia que editar', async () => {
    await abrirFormularioDependencia();
    await userEvent.click(screen.getByRole('radio', { name: /Dependencia existente/ }));
    const lista = await screen.findByLabelText('Dependencia existente');
    expect(lista.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'Admisiones' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Nombre de la dependencia')).toBeNull();
    expect(screen.queryByLabelText('Descripción de la dependencia')).toBeNull();
    expect(screen.queryByLabelText('Correos de contacto')).toBeNull();
  });

  it('exige elegir la dependencia y luego envía su identificador, sin crear una dependencia nueva', async () => {
    api.crearAdministradorDependencia.mockResolvedValue({ cuenta: { nombre_usuario: 'cuenta_nueva', dependencia: 'Bienestar' } });
    await abrirFormularioDependencia();
    await userEvent.click(screen.getByRole('radio', { name: /Dependencia existente/ }));
    await screen.findByLabelText('Dependencia existente');
    await datosCuenta();
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(screen.getByText('Selecciona la dependencia a la que pertenece la cuenta.')).toBeInTheDocument();
    expect(api.crearAdministradorDependencia).not.toHaveBeenCalled();
    await userEvent.selectOptions(screen.getByLabelText('Dependencia existente'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(api.crearAdministradorDependencia).toHaveBeenCalledWith({ nombreUsuario: 'cuenta_nueva', correo: 'cuenta@ejemplo.com', contrasena: CLAVE, idDependencia: 3 });
    expect(await screen.findByRole('status')).toHaveTextContent('Cuenta «cuenta_nueva» creada para la dependencia Bienestar.');
    expect(document.body.textContent).not.toContain(CLAVE);
  });

  it('volver al modo nuevo vuelve a mostrar el campo de nombre escrito a mano', async () => {
    await abrirFormularioDependencia();
    await userEvent.click(screen.getByRole('radio', { name: /Dependencia existente/ }));
    await userEvent.click(screen.getByRole('radio', { name: /Dependencia nueva/ }));
    expect(screen.getByLabelText('Nombre de la dependencia')).toBeInTheDocument();
    expect(screen.queryByLabelText('Dependencia existente')).toBeNull();
  });
});
