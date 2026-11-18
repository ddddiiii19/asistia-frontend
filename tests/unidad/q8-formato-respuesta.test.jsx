// Q8 — Formato estándar de respuesta en la interfaz: (1) mensaje, (2) «Contacto: …» y (3) «Dependencia: X»,
// el mismo componente en el chat, las preguntas frecuentes, «Mi historial» y el historial del administrador.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const router = { replace: vi.fn(), push: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/chat' }));
vi.mock('@/lib/api', async (original) => {
  const real = await original();
  return {
    ...real,
    api: {
      me: vi.fn(), chat: vi.fn(), preguntasFrecuentes: vi.fn(), consultarPregunta: vi.fn(),
      conversacion: vi.fn(), conversaciones: vi.fn(), adminConversacion: vi.fn(),
    },
  };
});

import { api } from '@/lib/api';
import { AuthProvider } from '@/components/AuthProvider';
import { Burbuja } from '@/components/chat/Burbuja';
import { Chat } from '@/components/chat/Chat';
import { DetalleConversacion } from '@/components/Historial';
import { ConversacionAdmin } from '@/components/historial/ConversacionAdmin';
import { guardarSesion } from '@/lib/sesion';

const CONTACTO = { correos: ['admisiones@teinco.edu.co'], telefono: '601 743 32 00', texto: 'admisiones@teinco.edu.co · Tel. 601 743 32 00' };
const DEP = { id_dependencia: 1, nombre: 'Admisiones' };
const envolver = (ui) => render(<AuthProvider>{ui}</AuthProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/chat');
  guardarSesion({ token: 't', cuenta: { tipo: 'usuario', alcance_admin: null, nombre_usuario: 'usuario_demo' } });
  api.preguntasFrecuentes.mockResolvedValue([{ id_faq: 1, pregunta: '¿Cómo me inscribo?', dependencia: 'Admisiones' }]);
});

describe('Burbuja: tres bloques en orden', () => {
  it('muestra mensaje, «Contacto: …» y «Dependencia: X», en ese orden y sin la etiqueta anterior', () => {
    render(<ol><Burbuja mensaje={{ rol: 'asistente', texto: 'Diligencia el formulario.', contacto: CONTACTO, dependencia: DEP }} /></ol>);
    const item = screen.getByRole('listitem');
    const bloques = [...item.querySelectorAll('p')].map((p) => p.textContent);
    expect(bloques).toEqual(['Diligencia el formulario.', `Contacto: ${CONTACTO.texto}`, 'Dependencia: Admisiones']);
    expect(item.textContent).not.toContain('sugerida');
  });

  it('acepta el contacto como texto y la dependencia como texto (historiales antiguos)', () => {
    render(<ol><Burbuja mensaje={{ rol: 'asistente', texto: 'Hola', contacto: 'correo@teinco.edu.co', dependencia: 'Bienestar' }} /></ol>);
    expect(screen.getByText('Contacto:').parentElement).toHaveTextContent('Contacto: correo@teinco.edu.co');
    expect(screen.getByText('Dependencia: Bienestar')).toBeInTheDocument();
  });

  it('sin contacto ni dependencia (saludo o consulta sin identificar) muestra solo el mensaje', () => {
    render(<ol><Burbuja mensaje={{ rol: 'asistente', texto: '¡Hola!', contacto: null, dependencia: null }} /></ol>);
    expect(screen.queryByText(/Contacto:/)).toBeNull();
    expect(screen.queryByText(/Dependencia:/)).toBeNull();
    expect(screen.getByText('¡Hola!')).toBeInTheDocument();
  });

  it('con dependencia pero sin contacto muestra solo el mensaje y la dependencia', () => {
    render(<ol><Burbuja mensaje={{ rol: 'asistente', texto: 'Texto', contacto: null, dependencia: DEP }} /></ol>);
    expect(screen.queryByText(/Contacto:/)).toBeNull();
    expect(screen.getByText('Dependencia: Admisiones')).toBeInTheDocument();
  });

  it('los mensajes de la persona usuaria nunca llevan contacto ni dependencia', () => {
    render(<ol><Burbuja mensaje={{ rol: 'usuario', texto: 'Mi pregunta', contacto: CONTACTO, dependencia: DEP }} /></ol>);
    expect(screen.queryByText(/Contacto:/)).toBeNull();
    expect(screen.queryByText(/Dependencia:/)).toBeNull();
  });
});

describe('el mismo formato en el chat y en las preguntas frecuentes', () => {
  it('el chat muestra la respuesta del API con su contacto y dependencia, y el escalamiento también', async () => {
    api.chat.mockResolvedValueOnce({ id_conversacion: 1, respuesta: 'Diligencia el formulario.', contacto: CONTACTO, dependencia: DEP, escalada: false });
    api.chat.mockResolvedValueOnce({ id_conversacion: 1, respuesta: 'No cuento con información suficiente. Te recomiendo comunicarte directamente con la dependencia indicada.', contacto: CONTACTO, dependencia: DEP, escalada: true });
    envolver(<Chat />);
    await userEvent.type(screen.getByLabelText('Escribe tu consulta'), 'Quiero inscribirme');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Diligencia el formulario.')).toBeInTheDocument();
    expect(screen.getByText('Contacto:').parentElement).toHaveTextContent(`Contacto: ${CONTACTO.texto}`);
    await userEvent.type(screen.getByLabelText('Escribe tu consulta'), 'otra cosa');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Escalamiento · caso registrado')).toBeInTheDocument();
    expect(screen.getAllByText('Dependencia: Admisiones')).toHaveLength(2);
    expect(screen.getAllByText(/Contacto:/)).toHaveLength(2);
  });

  it('una pregunta frecuente se muestra con el mismo formato (respuesta, contacto y dependencia)', async () => {
    api.consultarPregunta.mockResolvedValue({ id_faq: 1, pregunta: '¿Cómo me inscribo?', respuesta: 'Con el formulario en línea.', contacto: CONTACTO, dependencia: DEP });
    envolver(<Chat />);
    await userEvent.click(await screen.findByRole('button', { name: /¿Cómo me inscribo\?/ }));
    expect(await screen.findByText('Con el formulario en línea.')).toBeInTheDocument();
    expect(screen.getByText('Pregunta frecuente')).toBeInTheDocument();
    expect(screen.getByText('Dependencia: Admisiones')).toBeInTheDocument();
    expect(screen.getByText('Contacto:').parentElement).toHaveTextContent(CONTACTO.texto);
  });

  it('al retomar una conversación desde el historial conserva contacto y dependencia de cada respuesta', async () => {
    window.history.replaceState(null, '', '/chat?c=5');
    api.conversacion.mockResolvedValue({
      id_conversacion: 5, fecha_inicio: '2026-11-01T10:00:00',
      mensajes: [
        { id_mensaje: 1, emisor: 'usuario', contenido: 'Requisitos', fecha: 'x' },
        { id_mensaje: 2, emisor: 'asistente', contenido: 'Sube tus documentos.', contacto: CONTACTO, dependencia: DEP, fecha: 'x' },
      ],
    });
    envolver(<Chat />);
    expect(await screen.findByText('Sube tus documentos.')).toBeInTheDocument();
    expect(screen.getByText('Dependencia: Admisiones')).toBeInTheDocument();
    expect(screen.getByText('Contacto:').parentElement).toHaveTextContent(CONTACTO.texto);
  });
});

describe('el mismo formato en los historiales', () => {
  const MENSAJES = [
    { id_mensaje: 1, emisor: 'usuario', contenido: 'Requisitos de inscripción', fecha: '2026-11-01T10:00:00' },
    { id_mensaje: 2, emisor: 'asistente', contenido: 'Sube tus documentos.', contacto: CONTACTO, dependencia: DEP, fecha: '2026-11-01T10:00:02' },
    { id_mensaje: 3, emisor: 'usuario', contenido: 'Gracias', fecha: '2026-11-01T10:01:00' },
    { id_mensaje: 4, emisor: 'asistente', contenido: '¡Con gusto!', contacto: null, dependencia: null, fecha: '2026-11-01T10:01:02' },
  ];

  it('«Mi historial» muestra cada respuesta con su contacto y dependencia (y el saludo sin ellos)', async () => {
    api.conversacion.mockResolvedValue({ id_conversacion: 5, fecha_inicio: '2026-11-01T10:00:00', mensajes: MENSAJES });
    envolver(<DetalleConversacion id="5" />);
    expect(await screen.findByText('Sube tus documentos.')).toBeInTheDocument();
    expect(screen.getAllByText(/Contacto:/)).toHaveLength(1);
    expect(screen.getAllByText(/Dependencia:/)).toHaveLength(1);
    expect(screen.getByText('Dependencia: Admisiones')).toBeInTheDocument();
  });

  it('el historial del administrador usa el mismo formato', async () => {
    guardarSesion({ token: 't', cuenta: { tipo: 'administrador', alcance_admin: 'global', id_dependencia: null, nombre_usuario: 'admin' } });
    api.adminConversacion.mockResolvedValue({
      id_conversacion: 5, fecha_inicio: '2026-11-01T10:00:00', mensajes: MENSAJES,
      consultas: [{ id_consulta: 1, id_mensaje: 1, fecha: 'x', dependencia: 'Admisiones', clasificacion: 'inscripcion', tiempo_respuesta_ms: 1200, estado: 'resuelta', motivo_escalamiento: null }],
    });
    envolver(<ConversacionAdmin id="5" />);
    const lista = await screen.findByRole('list', { name: 'Mensajes de la conversación' });
    const respuesta = within(lista).getByText('Sube tus documentos.').closest('li');
    expect(within(respuesta).getByText('Contacto:').parentElement).toHaveTextContent(CONTACTO.texto);
    expect(within(respuesta).getByText('Dependencia: Admisiones')).toBeInTheDocument();
    expect(within(lista).getAllByText(/Contacto:/)).toHaveLength(1);
  });
});
