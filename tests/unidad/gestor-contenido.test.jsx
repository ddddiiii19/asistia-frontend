// Q7 — Módulos "Información institucional" y "Preguntas frecuentes" del panel administrativo.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const router = { replace: vi.fn(), push: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/admin/informacion' }));

vi.mock('@/lib/api', async (original) => {
  const real = await original();
  return {
    ...real,
    api: {
      dependencias: vi.fn(), adminInformacion: vi.fn(), crearInformacion: vi.fn(), editarInformacion: vi.fn(), eliminarInformacion: vi.fn(),
      adminFaq: vi.fn(), crearFaq: vi.fn(), editarFaq: vi.fn(), eliminarFaq: vi.fn(),
    },
  };
});

import { api, ApiError } from '@/lib/api';
import { AuthProvider } from '@/components/AuthProvider';
import { GestorContenido } from '@/components/admin/GestorContenido';
import { guardarSesion } from '@/lib/sesion';

const DEPENDENCIAS = [{ id_dependencia: 1, nombre: 'Admisiones' }, { id_dependencia: 3, nombre: 'Bienestar' }];
const INFO = [
  { id_info: 4, id_dependencia: 3, dependencia: 'Bienestar', titulo: 'Apoyo psicosocial', contenido: 'Texto de apoyo.\nSegunda línea.', fecha_actualizacion: '2026-11-06T04:00:00.000Z' },
  { id_info: 1, id_dependencia: 1, dependencia: 'Admisiones', titulo: 'Requisitos', contenido: 'Documento de identidad.', fecha_actualizacion: '2026-10-01T10:00:00.000Z' },
];
const FAQ = [{ id_faq: 3, id_dependencia: 3, dependencia: 'Bienestar', pregunta: '¿Cómo agendo una cita?', respuesta: 'Comunícate con Bienestar.', frecuencia: 5 }];

const montar = (tipo) => render(<AuthProvider><GestorContenido tipo={tipo} /></AuthProvider>);
const sesion = (alcance) => guardarSesion({ token: 't', cuenta: { tipo: 'administrador', alcance_admin: alcance, id_dependencia: alcance === 'dependencia' ? 3 : null, nombre_usuario: 'admin' } });

beforeEach(() => {
  vi.clearAllMocks();
  api.dependencias.mockResolvedValue(DEPENDENCIAS);
  api.adminInformacion.mockResolvedValue(INFO);
  api.adminFaq.mockResolvedValue(FAQ);
});

describe('información institucional (administrador global)', () => {
  beforeEach(() => sesion('global'));

  it('lista los textos con su dependencia y permite filtrar por dependencia', async () => {
    montar('informacion');
    expect(await screen.findByRole('heading', { name: 'Apoyo psicosocial' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Información institucional' })).toBeInTheDocument();
    expect(screen.getByText('Requisitos')).toBeInTheDocument();
    expect(api.adminInformacion).toHaveBeenLastCalledWith({ dependencia: '' });
    await userEvent.selectOptions(screen.getByLabelText('Dependencia'), '3');
    expect(api.adminInformacion).toHaveBeenLastCalledWith({ dependencia: '3' });
  });

  it('crea un texto nuevo y recarga la lista', async () => {
    api.crearInformacion.mockResolvedValue({ id_info: 9 });
    montar('informacion');
    await screen.findByText('Requisitos');
    await userEvent.click(screen.getByRole('button', { name: 'Nueva información' }));
    const form = screen.getByRole('form', { name: 'Nueva información' });
    await userEvent.selectOptions(within(form).getByLabelText('Dependencia'), '1');
    await userEvent.type(within(form).getByLabelText('Título'), '  Costos  ');
    await userEvent.type(within(form).getByLabelText('Contenido'), 'Consulta los costos con la dependencia.');
    await userEvent.click(within(form).getByRole('button', { name: 'Guardar' }));
    expect(api.crearInformacion).toHaveBeenCalledWith({ id_dependencia: 1, titulo: 'Costos', contenido: 'Consulta los costos con la dependencia.' });
    expect(await screen.findByRole('status')).toHaveTextContent('Información guardada.');
    expect(screen.queryByRole('form')).toBeNull();
    expect(api.adminInformacion).toHaveBeenCalledTimes(2);
  });

  it('valida campos obligatorios y el largo del título antes de enviar', async () => {
    montar('informacion');
    await screen.findByText('Requisitos');
    await userEvent.click(screen.getByRole('button', { name: 'Nueva información' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByText('Selecciona una dependencia.')).toBeInTheDocument();
    expect(screen.getByText('Ingresa un título.')).toBeInTheDocument();
    expect(screen.getByText('Ingresa el contenido.')).toBeInTheDocument();
    expect(api.crearInformacion).not.toHaveBeenCalled();
  });

  it('edita un texto existente con sus datos precargados', async () => {
    api.editarInformacion.mockResolvedValue({ id_info: 4 });
    montar('informacion');
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Apoyo psicosocial' }));
    const form = screen.getByRole('form');
    expect(within(form).getByLabelText('Título')).toHaveValue('Apoyo psicosocial');
    expect(within(form).getByLabelText('Dependencia')).toHaveValue('3');
    await userEvent.clear(within(form).getByLabelText('Contenido'));
    await userEvent.type(within(form).getByLabelText('Contenido'), 'Nuevo texto.');
    await userEvent.click(within(form).getByRole('button', { name: 'Guardar' }));
    expect(api.editarInformacion).toHaveBeenCalledWith(4, { id_dependencia: 3, titulo: 'Apoyo psicosocial', contenido: 'Nuevo texto.' });
  });

  it('pide confirmación antes de eliminar y elimina solo al confirmar', async () => {
    api.eliminarInformacion.mockResolvedValue(null);
    montar('informacion');
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar Requisitos' }));
    expect(api.eliminarInformacion).not.toHaveBeenCalled();
    const confirmacion = screen.getByRole('alertdialog');
    expect(confirmacion).toHaveTextContent('Esta acción no se puede deshacer');
    await userEvent.click(within(confirmacion).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Requisitos' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
    expect(api.eliminarInformacion).toHaveBeenCalledWith(1);
    expect(await screen.findByRole('status')).toHaveTextContent('Información eliminada.');
  });

  it('muestra el error del servidor al guardar sin cerrar el formulario', async () => {
    api.crearInformacion.mockRejectedValue(new ApiError('validacion', 'El título es demasiado largo.', 400));
    montar('informacion');
    await screen.findByText('Requisitos');
    await userEvent.click(screen.getByRole('button', { name: 'Nueva información' }));
    const form = screen.getByRole('form');
    await userEvent.selectOptions(within(form).getByLabelText('Dependencia'), '1');
    await userEvent.type(within(form).getByLabelText('Título'), 'X');
    await userEvent.type(within(form).getByLabelText('Contenido'), 'Y');
    await userEvent.click(within(form).getByRole('button', { name: 'Guardar' }));
    expect(await within(form).findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('form')).toBeInTheDocument();
  });

  it('muestra un mensaje cuando no hay registros y permite reintentar ante un error de carga', async () => {
    api.adminInformacion.mockResolvedValueOnce([]);
    const { unmount } = montar('informacion');
    expect(await screen.findByText('No hay información registrada.')).toBeInTheDocument();
    unmount();
    api.adminInformacion.mockRejectedValueOnce(new ApiError('red', 'Sin conexión', 0)).mockResolvedValueOnce(INFO);
    montar('informacion');
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Requisitos')).toBeInTheDocument();
  });
});

describe('preguntas frecuentes (administrador global)', () => {
  beforeEach(() => sesion('global'));

  it('lista las preguntas con su contador y crea una nueva con los campos de FAQ', async () => {
    api.crearFaq.mockResolvedValue({ id_faq: 10 });
    montar('faq');
    expect(await screen.findByRole('heading', { level: 1, name: 'Preguntas frecuentes' })).toBeInTheDocument();
    expect(screen.getByText('Abierta 5 veces')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Nueva pregunta' }));
    const form = screen.getByRole('form');
    await userEvent.selectOptions(within(form).getByLabelText('Dependencia'), '3');
    await userEvent.type(within(form).getByLabelText('Pregunta'), '¿Dónde queda Bienestar?');
    await userEvent.type(within(form).getByLabelText('Respuesta'), 'En la sede 7 de Agosto.');
    await userEvent.click(within(form).getByRole('button', { name: 'Guardar' }));
    expect(api.crearFaq).toHaveBeenCalledWith({ id_dependencia: 3, pregunta: '¿Dónde queda Bienestar?', respuesta: 'En la sede 7 de Agosto.' });
    expect(await screen.findByRole('status')).toHaveTextContent('Pregunta frecuente guardada.');
  });

  it('elimina una pregunta tras confirmar', async () => {
    api.eliminarFaq.mockResolvedValue(null);
    montar('faq');
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar ¿Cómo agendo una cita?' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
    expect(api.eliminarFaq).toHaveBeenCalledWith(3);
  });
});

describe('administrador de dependencia', () => {
  it('Q8: gestiona solo lo de su dependencia: sin selector de dependencia, con botones de crear, editar y eliminar', async () => {
    sesion('dependencia');
    montar('informacion');
    expect(await screen.findByRole('heading', { name: 'Apoyo psicosocial' })).toBeInTheDocument();
    expect(screen.getByText(/Puedes crear, editar y eliminar el contenido de tu dependencia/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Dependencia')).toBeNull();
    expect(screen.getByRole('button', { name: 'Nueva información' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Editar/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Eliminar/ }).length).toBeGreaterThan(0);
    expect(api.dependencias).not.toHaveBeenCalled();
  });

  it('Q8: al crear envía siempre su propia dependencia, sin pedirla', async () => {
    sesion('dependencia');
    api.crearInformacion.mockResolvedValue({ id_info: 9 });
    montar('informacion');
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva información' }));
    const form = screen.getByRole('form');
    expect(within(form).queryByLabelText('Dependencia')).toBeNull();
    await userEvent.type(within(form).getByLabelText('Título'), 'Horarios');
    await userEvent.type(within(form).getByLabelText('Contenido'), 'Atención de lunes a viernes.');
    await userEvent.click(within(form).getByRole('button', { name: 'Guardar' }));
    expect(api.crearInformacion).toHaveBeenCalledWith({ id_dependencia: 3, titulo: 'Horarios', contenido: 'Atención de lunes a viernes.' });
  });
});
