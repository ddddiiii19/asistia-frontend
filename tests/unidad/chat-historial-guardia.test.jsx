import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const replace = vi.fn();
// El router real de Next es estable entre renders; el mock debe serlo también, porque RequiereRol lo usa
// como dependencia de un efecto (un objeto nuevo en cada render repetiría la llamada a api.me).
const router = { replace, push: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/chat',
}));

vi.mock('@/lib/api', async (original) => {
  const real = await original();
  return {
    ...real,
    api: {
      me: vi.fn(), chat: vi.fn(), preguntasFrecuentes: vi.fn(), consultarPregunta: vi.fn(),
      conversacion: vi.fn(), conversaciones: vi.fn(),
    },
  };
});

import { api, ApiError } from '@/lib/api';
import { AuthProvider, useAuth } from '@/components/AuthProvider';
import { RequiereRol } from '@/components/RequiereRol';
import { Chat } from '@/components/chat/Chat';
import { ListaHistorial, DetalleConversacion } from '@/components/Historial';
import { guardarSesion } from '@/lib/sesion';

const envolver = (ui) => render(<AuthProvider>{ui}</AuthProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/chat');
  api.preguntasFrecuentes.mockResolvedValue([
    { id_faq: 1, pregunta: '[DATO DE PRUEBA] ¿Qué hago para inscribirme?', dependencia: 'Admisiones' },
  ]);
});

describe('guardia de rutas por rol', () => {
  it('sin sesión redirige al login y no muestra contenido', async () => {
    envolver(<RequiereRol rol="usuario"><p>secreto</p></RequiereRol>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('secreto')).toBeNull();
    expect(api.me).not.toHaveBeenCalled();
  });

  it('muestra el contenido solo cuando el backend confirma el rol', async () => {
    guardarSesion({ token: 't', cuenta: { tipo: 'usuario', nombre_usuario: 'u' } });
    api.me.mockResolvedValue({ cuenta: { tipo: 'usuario', rol: 'usuario' } });
    envolver(<RequiereRol rol="usuario"><p>contenido</p></RequiereRol>);
    expect(screen.queryByText('contenido')).toBeNull();
    expect(await screen.findByText('contenido')).toBeInTheDocument();
  });

  it('si el backend dice que la cuenta es administrador, no muestra el área de usuario y redirige al panel', async () => {
    // Aunque el almacenamiento del navegador diga "usuario", manda el rol que informa la API.
    guardarSesion({ token: 't', cuenta: { tipo: 'usuario', nombre_usuario: 'u' } });
    api.me.mockResolvedValue({ cuenta: { tipo: 'administrador', rol: 'administrador' } });
    envolver(<RequiereRol rol="usuario"><p>contenido</p></RequiereRol>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin'));
    expect(screen.queryByText('contenido')).toBeNull();
  });

  it('un usuario que intenta entrar al área administrativa es devuelto al chat', async () => {
    guardarSesion({ token: 't', cuenta: { tipo: 'administrador', nombre_usuario: 'a' } });
    api.me.mockResolvedValue({ cuenta: { tipo: 'usuario', rol: 'usuario' } });
    envolver(<RequiereRol rol="administrador"><p>panel</p></RequiereRol>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/chat'));
    expect(screen.queryByText('panel')).toBeNull();
  });

  it('al expirar la sesión redirige una sola vez, conservando el aviso (regresión)', async () => {
    guardarSesion({ token: 't', cuenta: { tipo: 'usuario', nombre_usuario: 'u' } });
    api.me.mockResolvedValue({ cuenta: { tipo: 'usuario' } });
    function Expirar() {
      const { cerrarSesion } = useAuth();
      return <button onClick={() => cerrarSesion('expirada')}>expirar</button>;
    }
    envolver(<RequiereRol rol="usuario"><Expirar /></RequiereRol>);
    await userEvent.click(await screen.findByRole('button', { name: 'expirar' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?expirada=1'));
    expect(replace).not.toHaveBeenCalledWith('/login');
  });

  it('ante un fallo de red ofrece reintentar', async () => {
    guardarSesion({ token: 't', cuenta: { tipo: 'usuario', nombre_usuario: 'u' } });
    api.me.mockRejectedValueOnce(new ApiError(0, 'sin_conexion', 'x'));
    api.me.mockResolvedValueOnce({ cuenta: { tipo: 'usuario' } });
    envolver(<RequiereRol rol="usuario"><p>contenido</p></RequiereRol>);
    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible conectar');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('contenido')).toBeInTheDocument();
  });
});

describe('chat', () => {
  it('envía la consulta, muestra la respuesta con la dependencia sugerida y conserva la conversación', async () => {
    api.chat.mockResolvedValueOnce({
      id_conversacion: 12, respuesta: 'Debes comunicarte con Admisiones.', dependencia: { id_dependencia: 1, nombre: 'Admisiones' }, escalada: false,
    });
    api.chat.mockResolvedValueOnce({ id_conversacion: 12, respuesta: 'Otra respuesta.', dependencia: null, escalada: false });
    envolver(<Chat />);
    await userEvent.type(screen.getByLabelText('Escribe tu consulta'), 'Quiero inscribirme');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Debes comunicarte con Admisiones.')).toBeInTheDocument();
    expect(screen.getByText('Dependencia sugerida: Admisiones')).toBeInTheDocument();
    const primera = api.chat.mock.calls[0][0];
    expect(primera.mensaje).toBe('Quiero inscribirme');
    expect(primera.idSesion).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(primera.idConversacion).toBeNull();

    await userEvent.type(screen.getByLabelText('Escribe tu consulta'), 'Gracias');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText('Otra respuesta.');
    expect(api.chat.mock.calls[1][0].idConversacion).toBe(12);
  });

  it('distingue visualmente el escalamiento y lo indica como caso registrado', async () => {
    api.chat.mockResolvedValue({
      id_conversacion: 3, respuesta: 'No cuento con información suficiente. Tu consulta quedó registrada como caso de escalamiento.',
      dependencia: { id_dependencia: 2, nombre: 'Registro y Control' }, escalada: true,
    });
    envolver(<Chat />);
    await userEvent.type(screen.getByLabelText('Escribe tu consulta'), 'algo raro');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Escalamiento · caso registrado')).toBeInTheDocument();
    expect(screen.getByText('Dependencia sugerida: Registro y Control')).toBeInTheDocument();
  });

  it('ante un 503 muestra el aviso, retira el mensaje no registrado y devuelve el texto para reintentar', async () => {
    api.chat.mockRejectedValue(new ApiError(503, 'servicio_ia_no_disponible', 'El servicio de IA no está disponible en este momento.'));
    envolver(<Chat />);
    await userEvent.type(screen.getByLabelText('Escribe tu consulta'), 'Hola asistente');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no fue registrado');
    expect(screen.getByLabelText('Escribe tu consulta')).toHaveValue('Hola asistente');
    expect(screen.getByRole('log', { name: 'Conversación' }).children).toHaveLength(0);
  });

  it('Enter envía y Shift+Enter agrega salto de línea', async () => {
    api.chat.mockResolvedValue({ id_conversacion: 1, respuesta: 'ok', dependencia: null, escalada: false });
    envolver(<Chat />);
    const caja = screen.getByLabelText('Escribe tu consulta');
    await userEvent.type(caja, 'línea uno{Shift>}{Enter}{/Shift}línea dos');
    expect(api.chat).not.toHaveBeenCalled();
    expect(caja).toHaveValue('línea uno\nlínea dos');
    await userEvent.type(caja, '{Enter}');
    await waitFor(() => expect(api.chat).toHaveBeenCalledTimes(1));
  });

  it('no permite enviar vacío ni más de 1000 caracteres', async () => {
    envolver(<Chat />);
    const boton = screen.getByRole('button', { name: 'Enviar' });
    expect(boton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Escribe tu consulta'), { target: { value: 'a'.repeat(1001) } });
    expect(boton).toBeDisabled();
    expect(screen.getByText('1001/1000')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Escribe tu consulta'), { target: { value: 'a'.repeat(1000) } });
    expect(boton).toBeEnabled();
  });

  it('muestra preguntas frecuentes y su respuesta sin enviarlas como mensaje del chat', async () => {
    api.consultarPregunta.mockResolvedValue({ id_faq: 1, pregunta: '[DATO DE PRUEBA] ¿Qué hago para inscribirme?', respuesta: '[DATO DE PRUEBA] Respuesta de prueba.' });
    envolver(<Chat />);
    await userEvent.click(await screen.findByRole('button', { name: /Qué hago para inscribirme/ }));
    expect(await screen.findByText('[DATO DE PRUEBA] Respuesta de prueba.')).toBeInTheDocument();
    expect(screen.getByText('Pregunta frecuente')).toBeInTheDocument();
    expect(api.consultarPregunta).toHaveBeenCalledWith(1);
    expect(api.chat).not.toHaveBeenCalled();
  });

  it('retoma una conversación propia desde el historial (?c=ID)', async () => {
    window.history.replaceState(null, '', '/chat?c=5');
    api.conversacion.mockResolvedValue({
      id_conversacion: 5, fecha_inicio: '2026-10-15T10:00:00.000Z',
      mensajes: [{ id_mensaje: 1, emisor: 'usuario', contenido: 'Hola previo', fecha: 'x' }, { id_mensaje: 2, emisor: 'asistente', contenido: 'Respuesta previa', fecha: 'x' }],
    });
    api.chat.mockResolvedValue({ id_conversacion: 5, respuesta: 'Continúa', dependencia: null, escalada: false });
    envolver(<Chat />);
    expect(await screen.findByText('Respuesta previa')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Escribe tu consulta'), 'sigo');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText('Continúa');
    expect(api.chat.mock.calls[0][0].idConversacion).toBe(5);
  });

  it('"Nueva conversación" limpia el hilo y deja de enviar id_conversacion', async () => {
    api.chat.mockResolvedValue({ id_conversacion: 9, respuesta: 'r1', dependencia: null, escalada: false });
    envolver(<Chat />);
    await userEvent.type(screen.getByLabelText('Escribe tu consulta'), 'uno');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByText('r1');
    await userEvent.click(screen.getByRole('button', { name: 'Nueva conversación' }));
    expect(screen.queryByText('r1')).toBeNull();
    await userEvent.type(screen.getByLabelText('Escribe tu consulta'), 'dos');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(api.chat).toHaveBeenCalledTimes(2));
    expect(api.chat.mock.calls[1][0].idConversacion).toBeNull();
  });
});

describe('historial propio', () => {
  it('lista las conversaciones con su consulta y dependencia', async () => {
    api.conversaciones.mockResolvedValue([
      { id_conversacion: 4, fecha_inicio: '2026-10-15T10:00:00.000Z', primera_consulta: '¿Cómo me inscribo?', dependencia: 'Admisiones' },
    ]);
    envolver(<ListaHistorial />);
    const enlace = await screen.findByRole('link', { name: /¿Cómo me inscribo\?/ });
    expect(enlace).toHaveAttribute('href', '/historial/4');
    expect(screen.getByText('Admisiones')).toBeInTheDocument();
  });

  it('muestra un estado vacío', async () => {
    api.conversaciones.mockResolvedValue([]);
    envolver(<ListaHistorial />);
    expect(await screen.findByText(/Aún no tienes conversaciones/)).toBeInTheDocument();
  });

  it('el detalle muestra los mensajes y permite continuar la conversación', async () => {
    api.conversacion.mockResolvedValue({
      id_conversacion: 4, fecha_inicio: '2026-10-15T10:00:00.000Z',
      mensajes: [{ id_mensaje: 1, emisor: 'usuario', contenido: 'pregunta', fecha: 'x' }, { id_mensaje: 2, emisor: 'asistente', contenido: 'respuesta', fecha: 'x' }],
    });
    envolver(<DetalleConversacion id="4" />);
    expect(await screen.findByText('respuesta')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continuar esta conversación' })).toHaveAttribute('href', '/chat?c=4');
  });

  it('una conversación ajena o inexistente se informa como no encontrada', async () => {
    api.conversacion.mockRejectedValue(new ApiError(404, 'conversacion_no_encontrada', 'La conversación no existe para esta cuenta.'));
    envolver(<DetalleConversacion id="99" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('no existe para esta cuenta');
  });
});
