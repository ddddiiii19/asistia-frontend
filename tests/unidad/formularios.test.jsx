import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/login',
}));

vi.mock('@/lib/api', async (original) => {
  const real = await original();
  return {
    ...real,
    api: {
      login: vi.fn(), olvideContrasena: vi.fn(), restablecerContrasena: vi.fn(),
      me: vi.fn(), crearCuentaUsuario: vi.fn(), dependencias: vi.fn(),
    },
  };
});

import { api, ApiError } from '@/lib/api';
import { AuthProvider } from '@/components/AuthProvider';
import { FormularioLogin } from '@/components/FormularioLogin';
import { FormularioOlvide } from '@/components/FormularioOlvide';
import { FormularioRestablecer } from '@/components/FormularioRestablecer';
import { PanelAdmin } from '@/components/PanelAdmin';
import { guardarSesion } from '@/lib/sesion';

const envolver = (ui) => render(<AuthProvider>{ui}</AuthProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('login compartido', () => {
  it('redirige al chat si el backend devuelve cuenta de tipo usuario', async () => {
    api.login.mockResolvedValue({ token: 'jwt', cuenta: { tipo: 'usuario', rol: 'usuario', nombre_usuario: 'usuario_demo' } });
    envolver(<FormularioLogin />);
    await userEvent.type(screen.getByLabelText('Usuario o correo'), 'usuario_demo');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Clave12345');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/chat'));
    expect(api.login).toHaveBeenCalledWith('usuario_demo', 'Clave12345');
    expect(JSON.parse(window.sessionStorage.getItem('asistia.sesion')).token).toBe('jwt');
  });

  it('redirige al panel si el backend devuelve cuenta de administrador', async () => {
    api.login.mockResolvedValue({ token: 'jwt2', cuenta: { tipo: 'administrador', rol: 'administrador', alcance_admin: 'global', nombre_usuario: 'admin' } });
    envolver(<FormularioLogin />);
    await userEvent.type(screen.getByLabelText('Usuario o correo'), 'admin');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Clave12345');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin'));
  });

  it('muestra el error de credenciales y no guarda sesión', async () => {
    api.login.mockRejectedValue(new ApiError(401, 'credenciales_invalidas', 'Usuario/correo o contraseña incorrectos.'));
    envolver(<FormularioLogin />);
    await userEvent.type(screen.getByLabelText('Usuario o correo'), 'x');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'y');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario/correo o contraseña incorrectos.');
    expect(window.sessionStorage.getItem('asistia.sesion')).toBeNull();
  });

  it('no llama a la API con campos vacíos', async () => {
    envolver(<FormularioLogin />);
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ingresa tu usuario');
    expect(api.login).not.toHaveBeenCalled();
  });

  it('la contraseña se puede mostrar y ocultar', async () => {
    envolver(<FormularioLogin />);
    const campo = screen.getByLabelText('Contraseña');
    expect(campo).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    expect(campo).toHaveAttribute('type', 'text');
  });

  it('ofrece el enlace de recuperación', () => {
    envolver(<FormularioLogin />);
    expect(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toHaveAttribute('href', '/olvide-contrasena');
  });
});

describe('olvidé mi contraseña', () => {
  it('muestra la respuesta genérica del backend', async () => {
    api.olvideContrasena.mockResolvedValue({ mensaje: 'Si existe una cuenta asociada a ese correo, recibirás instrucciones para restablecer la contraseña.' });
    envolver(<FormularioOlvide />);
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'alguien@ejemplo.com');
    await userEvent.click(screen.getByRole('button', { name: /Enviar enlace/ }));
    expect(await screen.findByRole('status')).toHaveTextContent('Si existe una cuenta asociada');
    expect(api.olvideContrasena).toHaveBeenCalledWith('alguien@ejemplo.com');
  });

  it('valida el correo antes de enviar', async () => {
    envolver(<FormularioOlvide />);
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'no-es-correo');
    await userEvent.click(screen.getByRole('button', { name: /Enviar enlace/ }));
    expect(screen.getByText('Ingresa un correo válido.')).toBeInTheDocument();
    expect(api.olvideContrasena).not.toHaveBeenCalled();
  });

  it('informa el límite de solicitudes (429)', async () => {
    api.olvideContrasena.mockRejectedValue(new ApiError(429, 'demasiadas_solicitudes', 'Has solicitado demasiados enlaces. Intenta más tarde.'));
    envolver(<FormularioOlvide />);
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'a@b.co');
    await userEvent.click(screen.getByRole('button', { name: /Enviar enlace/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('demasiados enlaces');
  });
});

describe('restablecer contraseña', () => {
  const abrirConToken = () => window.history.replaceState(null, '', '/restablecer-contrasena?token=TOKEN.SECRETO.JWT&otro=1');

  it('toma el token de la URL, lo retira de ella y no lo guarda en ningún almacenamiento', async () => {
    abrirConToken();
    envolver(<FormularioRestablecer />);
    expect(await screen.findByRole('heading', { name: 'Restablecer contraseña' })).toBeInTheDocument();
    expect(window.location.search).toBe('?otro=1');
    expect(window.location.href).not.toContain('TOKEN');
    expect(JSON.stringify({ ...window.localStorage })).not.toContain('TOKEN');
    expect(JSON.stringify({ ...window.sessionStorage })).not.toContain('TOKEN');
    expect(document.cookie).not.toContain('TOKEN');
  });

  it('envía el token y la contraseña nueva y vuelve al login', async () => {
    abrirConToken();
    api.restablecerContrasena.mockResolvedValue({ mensaje: 'ok' });
    envolver(<FormularioRestablecer />);
    await userEvent.type(await screen.findByLabelText('Contraseña nueva'), 'NuevaClave2026');
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'NuevaClave2026');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?reset=1'));
    expect(api.restablecerContrasena).toHaveBeenCalledWith('TOKEN.SECRETO.JWT', 'NuevaClave2026');
  });

  it('exige que ambas contraseñas coincidan y cumplan los requisitos', async () => {
    abrirConToken();
    envolver(<FormularioRestablecer />);
    await userEvent.type(await screen.findByLabelText('Contraseña nueva'), 'corta');
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'corta');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(screen.getByText(/no cumple todos los requisitos/)).toBeInTheDocument();
    expect(api.restablecerContrasena).not.toHaveBeenCalled();
  });

  it('detecta contraseñas que no coinciden', async () => {
    abrirConToken();
    envolver(<FormularioRestablecer />);
    await userEvent.type(await screen.findByLabelText('Contraseña nueva'), 'NuevaClave2026');
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'OtraClave2026');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    expect(api.restablecerContrasena).not.toHaveBeenCalled();
  });

  it('enlace vencido o ya usado: ofrece solicitar uno nuevo', async () => {
    abrirConToken();
    api.restablecerContrasena.mockRejectedValue(new ApiError(400, 'token_recuperacion_invalido', 'El enlace de recuperación no es válido o ya venció. Solicita uno nuevo.'));
    envolver(<FormularioRestablecer />);
    await userEvent.type(await screen.findByLabelText('Contraseña nueva'), 'NuevaClave2026');
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'NuevaClave2026');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByRole('heading', { name: 'Enlace no válido' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Solicitar un enlace nuevo' })).toHaveAttribute('href', '/olvide-contrasena');
  });

  it('sin token en la URL muestra enlace no válido', async () => {
    window.history.replaceState(null, '', '/restablecer-contrasena');
    envolver(<FormularioRestablecer />);
    expect(await screen.findByRole('heading', { name: 'Enlace no válido' })).toBeInTheDocument();
    expect(api.restablecerContrasena).not.toHaveBeenCalled();
  });
});

describe('panel administrativo', () => {
  it('el administrador global ve el formulario de creación de cuentas', () => {
    guardarSesion({ token: 't', cuenta: { tipo: 'administrador', alcance_admin: 'global', nombre_usuario: 'admin' } });
    envolver(<PanelAdmin />);
    return screen.findByRole('heading', { name: 'Crear cuenta de usuario' });
  });

  it('el administrador de dependencia no ve el formulario y su alcance es su dependencia', async () => {
    guardarSesion({ token: 't', cuenta: { tipo: 'administrador', alcance_admin: 'dependencia', id_dependencia: 2, nombre_usuario: 'admin_registro' } });
    api.dependencias.mockResolvedValue([{ id_dependencia: 2, nombre: 'Registro y Control' }]);
    envolver(<PanelAdmin />);
    expect(await screen.findByText(/Registro y Control/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Crear cuenta de usuario' })).toBeNull();
    expect(screen.getByText('Dependencia: Registro y Control')).toBeInTheDocument();
  });

  it('crea una cuenta y no muestra la contraseña', async () => {
    guardarSesion({ token: 't', cuenta: { tipo: 'administrador', alcance_admin: 'global', nombre_usuario: 'admin' } });
    api.crearCuentaUsuario.mockResolvedValue({ cuenta: { nombre_usuario: 'nuevo' } });
    envolver(<PanelAdmin />);
    await userEvent.type(await screen.findByLabelText('Nombre de usuario'), 'nuevo');
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'nuevo@ejemplo.com');
    await userEvent.type(screen.getByLabelText('Contraseña inicial'), 'ClaveInicial2026');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('status')).toHaveTextContent('nuevo');
    expect(document.body.textContent).not.toContain('ClaveInicial2026');
  });
});
