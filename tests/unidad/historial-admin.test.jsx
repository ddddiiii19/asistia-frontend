import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const replace = vi.fn();
const router = { replace, push: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/admin/historial' }));

vi.mock('@/lib/api', async (original) => {
  const real = await original();
  return { ...real, api: { adminConversaciones: vi.fn(), adminConversacion: vi.fn(), dependencias: vi.fn() } };
});

import { api, ApiError } from '@/lib/api';
import { AuthProvider } from '@/components/AuthProvider';
import { HistorialAdmin } from '@/components/historial/HistorialAdmin';
import { ConversacionAdmin } from '@/components/historial/ConversacionAdmin';
import { guardarSesion } from '@/lib/sesion';

const FILA = (n, extra = {}) => ({
  id_conversacion: n, fecha_inicio: '2026-10-21T10:00:00', mensajes: 2, primera_consulta: `¿Pregunta número ${n}?`,
  escalada: false, dependencia: 'Registro y Control', ...extra,
});
const CONV = {
  id_conversacion: 7, fecha_inicio: '2026-10-21T10:00:00',
  mensajes: [
    { id_mensaje: 1, emisor: 'usuario', contenido: '¿Cómo solicito un certificado?', fecha: '2026-10-21T10:00:00' },
    { id_mensaje: 2, emisor: 'asistente', contenido: 'Debes pedirlo en Registro y Control.', fecha: '2026-10-21T10:00:03' },
  ],
  consultas: [{
    id_consulta: 11, id_mensaje: 1, fecha: '2026-10-21T10:00:00', dependencia: 'Registro y Control', clasificacion: 'certificado de notas',
    tiempo_respuesta_ms: 3400, estado: 'resuelta', motivo_escalamiento: null,
  }],
};

const admin = (alcance = 'global') => guardarSesion({
  token: 't', cuenta: { tipo: 'administrador', alcance_admin: alcance, id_dependencia: alcance === 'dependencia' ? 2 : null, nombre_usuario: 'admin' },
});
const montarLista = () => render(<AuthProvider><HistorialAdmin /></AuthProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  api.dependencias.mockResolvedValue([{ id_dependencia: 1, nombre: 'Admisiones' }, { id_dependencia: 2, nombre: 'Registro y Control' }]);
  api.adminConversaciones.mockResolvedValue([
    FILA(1),
    FILA(2, { escalada: true, dependencia: null, mensajes: 1, primera_consulta: '¿Dónde queda la cafetería?' }),
  ]);
  api.adminConversacion.mockResolvedValue(CONV);
});

describe('historial administrativo: lista', () => {
  it('muestra cada conversación con fecha, consulta, dependencia, estado y enlace a su detalle', async () => {
    admin('global');
    montarLista();
    const primera = (await screen.findByText('¿Pregunta número 1?')).closest('a');
    expect(primera).toHaveAttribute('href', '/admin/historial/1');
    expect(within(primera).getByText('Registro y Control')).toBeInTheDocument();
    expect(within(primera).getByText('Resuelta')).toBeInTheDocument();
    expect(within(primera).getByText('2 mensajes')).toBeInTheDocument();
    const segunda = screen.getByText('¿Dónde queda la cafetería?').closest('a');
    expect(within(segunda).getByText('Sin identificar')).toBeInTheDocument();
    expect(within(segunda).getByText('Escalada')).toBeInTheDocument();
    expect(within(segunda).getByText('1 mensaje')).toBeInTheDocument();
    expect(api.adminConversaciones).toHaveBeenCalledWith({ dependencia: '', desde: '', hasta: '', limite: 16, desplazamiento: 0 });
  });

  it('el administrador global filtra por dependencia y periodo; el de dependencia no ve ese filtro', async () => {
    admin('global');
    const { unmount } = montarLista();
    await screen.findByText('¿Pregunta número 1?');
    api.adminConversaciones.mockClear();
    await userEvent.selectOptions(await screen.findByLabelText('Dependencia'), '1');
    await userEvent.type(screen.getByLabelText('Desde'), '2026-10-01');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    await waitFor(() => expect(api.adminConversaciones).toHaveBeenCalledWith({ dependencia: '1', desde: '2026-10-01', hasta: '', limite: 16, desplazamiento: 0 }));
    unmount();

    vi.clearAllMocks();
    api.adminConversaciones.mockResolvedValue([FILA(1)]);
    admin('dependencia');
    montarLista();
    await screen.findByText('¿Pregunta número 1?');
    expect(screen.queryByLabelText('Dependencia')).toBeNull();
    expect(api.dependencias).not.toHaveBeenCalled();
    expect(screen.getByText(/dirigidas a tu dependencia/)).toBeInTheDocument();
  });

  it('un periodo invertido se avisa sin consultar la API', async () => {
    admin('global');
    montarLista();
    await screen.findByText('¿Pregunta número 1?');
    api.adminConversaciones.mockClear();
    await userEvent.type(screen.getByLabelText('Desde'), '2026-10-20');
    await userEvent.type(screen.getByLabelText('Hasta'), '2026-10-01');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('posterior');
    expect(api.adminConversaciones).not.toHaveBeenCalled();
  });

  it('pagina pidiendo una fila de más y vuelve a la página 1 al cambiar los filtros', async () => {
    admin('global');
    const dieciseis = Array.from({ length: 16 }, (_, i) => FILA(i + 1));
    api.adminConversaciones.mockResolvedValueOnce(dieciseis).mockResolvedValue([FILA(99)]);
    montarLista();
    await screen.findByText('¿Pregunta número 1?');
    expect(screen.getAllByRole('link', { name: /Pregunta número/ })).toHaveLength(15);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(api.adminConversaciones).toHaveBeenCalledWith({ dependencia: '', desde: '', hasta: '', limite: 16, desplazamiento: 15 }));
    expect(await screen.findByText('Página 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();

    await userEvent.selectOptions(await screen.findByLabelText('Dependencia'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    await waitFor(() => expect(api.adminConversaciones).toHaveBeenLastCalledWith({ dependencia: '2', desde: '', hasta: '', limite: 16, desplazamiento: 0 }));
    expect(await screen.findByText('Página 1')).toBeInTheDocument();
  });

  it('sin resultados muestra un estado vacío', async () => {
    admin('global');
    api.adminConversaciones.mockResolvedValue([]);
    montarLista();
    expect(await screen.findByText('No hay conversaciones para los filtros seleccionados.')).toBeInTheDocument();
  });

  it('ante un error avisa y permite reintentar; un 401 no muestra error', async () => {
    admin('global');
    api.adminConversaciones.mockRejectedValueOnce(new ApiError(0, 'sin_conexion', 'x'));
    const { unmount } = montarLista();
    expect(await screen.findByText(/No fue posible conectar/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('¿Pregunta número 1?')).toBeInTheDocument();
    unmount();

    api.adminConversaciones.mockRejectedValue(new ApiError(401, 'sesion_revocada', 'x'));
    montarLista();
    await waitFor(() => expect(api.adminConversaciones).toHaveBeenCalledTimes(3));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('historial administrativo: detalle', () => {
  it('muestra la ficha de la consulta y los mensajes, sin opción de continuar la conversación', async () => {
    admin('global');
    render(<AuthProvider><ConversacionAdmin id="7" /></AuthProvider>);
    expect(await screen.findByText('¿Cómo solicito un certificado?')).toBeInTheDocument();
    expect(api.adminConversacion).toHaveBeenCalledWith('7');
    const ficha = screen.getByRole('region', { name: 'Consulta registrada' });
    expect(within(ficha).getByText('Registro y Control')).toBeInTheDocument();
    expect(within(ficha).getByText('certificado de notas')).toBeInTheDocument();
    expect(within(ficha).getByText('3,4 s')).toBeInTheDocument();
    expect(within(ficha).getByText('Resuelta')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Mensajes de la conversación' })).toBeInTheDocument();
    expect(screen.getByText('Debes pedirlo en Registro y Control.')).toBeInTheDocument();
    // Es de solo lectura y no se atribuye al propio administrador ("Tú") lo que escribió otra persona.
    expect(screen.queryByText(/Continuar esta conversación/)).toBeNull();
    expect(screen.getByText('Usuario:')).toBeInTheDocument();
    expect(screen.queryByText('Tú:')).toBeNull();
    expect(screen.getByRole('link', { name: '← Volver al historial' })).toHaveAttribute('href', '/admin/historial');
  });

  it('una consulta escalada muestra su motivo y varias consultas usan el título en plural', async () => {
    admin('global');
    api.adminConversacion.mockResolvedValue({
      ...CONV,
      consultas: [
        CONV.consultas[0],
        { ...CONV.consultas[0], id_consulta: 12, dependencia: null, clasificacion: null, estado: 'escalada', motivo_escalamiento: 'dependencia_no_identificada', tiempo_respuesta_ms: null },
      ],
    });
    render(<AuthProvider><ConversacionAdmin id="7" /></AuthProvider>);
    const ficha = await screen.findByRole('region', { name: 'Consultas registradas' });
    expect(within(ficha).getByText('Escalada')).toBeInTheDocument();
    expect(within(ficha).getByText('No se identificó la dependencia')).toBeInTheDocument();
    expect(within(ficha).getByText('Sin identificar')).toBeInTheDocument();
    expect(within(ficha).getByText('Sin clasificar')).toBeInTheDocument();
    expect(within(ficha).getByText('—')).toBeInTheDocument();
  });

  it('al administrador de dependencia se le avisa que solo ve los mensajes de su dependencia; al global no', async () => {
    admin('dependencia');
    const { unmount } = render(<AuthProvider><ConversacionAdmin id="7" /></AuthProvider>);
    expect(await screen.findByText(/Se muestran únicamente los mensajes de las consultas dirigidas a tu dependencia/)).toBeInTheDocument();
    unmount();
    admin('global');
    render(<AuthProvider><ConversacionAdmin id="7" /></AuthProvider>);
    await screen.findByText('¿Cómo solicito un certificado?');
    expect(screen.queryByText(/Se muestran únicamente los mensajes/)).toBeNull();
  });

  it('una conversación fuera del alcance muestra el mensaje del backend', async () => {
    admin('dependencia');
    api.adminConversacion.mockRejectedValue(new ApiError(404, 'conversacion_no_encontrada', 'La conversación no existe o está fuera de tu alcance.'));
    render(<AuthProvider><ConversacionAdmin id="999" /></AuthProvider>);
    expect(await screen.findByText('La conversación no existe o está fuera de tu alcance.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Mensajes de la conversación' })).toBeNull();
  });
});
