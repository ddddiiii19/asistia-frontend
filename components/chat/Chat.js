'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { mensajeError } from '@/lib/errores';
import { obtenerIdSesion, reiniciarIdSesion } from '@/lib/sesion';
import { Alerta, Boton } from '@/components/ui';
import { Burbuja } from '@/components/chat/Burbuja';
import { PreguntasFrecuentes } from '@/components/chat/PreguntasFrecuentes';

const MAX_MENSAJE = 1000; // mismo límite que el backend (POST /api/chat)
let secuencia = 0;
const nuevoId = () => `local-${Date.now()}-${++secuencia}`;

export function Chat() {
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [idConversacion, setIdConversacion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const fin = useRef(null);

  // Si se llega desde el historial (?c=ID), se retoma esa conversación propia.
  useEffect(() => {
    let activo = true;
    const c = Number(new URLSearchParams(window.location.search).get('c'));
    if (!Number.isInteger(c) || c <= 0) {
      setCargando(false);
      return undefined;
    }
    api.conversacion(c)
      .then((conv) => {
        if (!activo) return;
        setIdConversacion(conv.id_conversacion);
        setMensajes(conv.mensajes.map((m) => ({
          id: `bd-${m.id_mensaje}`,
          rol: m.emisor === 'usuario' ? 'usuario' : 'asistente',
          texto: m.contenido,
          contacto: m.contacto,
          dependencia: m.dependencia,
        })));
      })
      .catch((err) => {
        if (activo && err.estado !== 401) setError(mensajeError(err));
      })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, []);

  useEffect(() => {
    if (fin.current && typeof fin.current.scrollIntoView === 'function') fin.current.scrollIntoView({ block: 'end' });
  }, [mensajes, enviando]);

  async function enviar(evento) {
    if (evento) evento.preventDefault();
    const mensaje = texto.trim();
    if (!mensaje || enviando || mensaje.length > MAX_MENSAJE) return;
    const idLocal = nuevoId();
    setError('');
    setEnviando(true);
    setMensajes((m) => [...m, { id: idLocal, rol: 'usuario', texto: mensaje }]);
    setTexto('');
    try {
      const r = await api.chat({ idSesion: obtenerIdSesion(), mensaje, idConversacion });
      setIdConversacion(r.id_conversacion);
      setMensajes((m) => [...m, {
        id: nuevoId(), rol: 'asistente', texto: r.respuesta, contacto: r.contacto, dependencia: r.dependencia, escalada: r.escalada,
      }]);
    } catch (err) {
      // Un fallo técnico (p. ej. 503) no se registra en el backend: se devuelve el texto para reintentar.
      setMensajes((m) => m.filter((x) => x.id !== idLocal));
      setTexto(mensaje);
      if (err.estado !== 401) setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  const seleccionarFaq = useCallback(async (faq) => {
    if (enviando) return;
    setError('');
    setEnviando(true);
    try {
      const r = await api.consultarPregunta(faq.id_faq);
      setMensajes((m) => [...m,
        { id: nuevoId(), rol: 'usuario', texto: r.pregunta, origen: 'faq' },
        { id: nuevoId(), rol: 'asistente', texto: r.respuesta, origen: 'faq', contacto: r.contacto, dependencia: r.dependencia || faq.dependencia },
      ]);
    } catch (err) {
      if (err.estado !== 401) setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }, [enviando]);

  function nuevaConversacion() {
    setMensajes([]);
    setIdConversacion(null);
    setError('');
    setTexto('');
    reiniciarIdSesion();
    window.history.replaceState(null, '', '/chat');
  }

  function alTeclear(evento) {
    if (evento.key === 'Enter' && !evento.shiftKey && !evento.nativeEvent.isComposing) {
      evento.preventDefault();
      enviar();
    }
  }

  const excedido = texto.length > MAX_MENSAJE;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-labelledby="titulo-chat" className="flex flex-col rounded-lg border border-t-4 border-slate-200 border-t-indigo-600 bg-slate-100 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <h1 id="titulo-chat" className="text-base font-semibold text-marca">Asistente</h1>
          <Boton variante="secundario" onClick={nuevaConversacion} disabled={enviando}>Nueva conversación</Boton>
        </div>

        <div className="h-[55vh] min-h-72 overflow-y-auto px-3 py-4 sm:px-4">
          {cargando ? <p role="status" className="text-sm text-slate-600">Cargando conversación…</p> : null}
          {!cargando && mensajes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-700">
              <p className="font-medium text-marca">Hola, soy AsistIA.</p>
              <p className="mt-1">
                Escribe tu consulta y te indicaré la dependencia de TEINCO que corresponde. También puedes elegir una pregunta frecuente.
              </p>
            </div>
          ) : null}
          <ol role="log" aria-live="polite" aria-label="Conversación" className="space-y-3">
            {mensajes.map((m) => <Burbuja key={m.id} mensaje={m} />)}
          </ol>
          {enviando ? <p role="status" className="mt-3 text-sm italic text-slate-500">AsistIA está respondiendo…</p> : null}
          <div ref={fin} />
        </div>

        <form onSubmit={enviar} className="border-t border-slate-200 bg-white p-3">
          {error ? <div className="mb-2"><Alerta tipo="error">{error}</Alerta></div> : null}
          <label htmlFor="mensaje" className="sr-only">Escribe tu consulta</label>
          <textarea
            id="mensaje"
            rows={2}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={alTeclear}
            placeholder="Escribe tu consulta…"
            aria-invalid={excedido ? 'true' : undefined}
            className="block w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-base focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/30"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className={`text-xs ${excedido ? 'text-red-700' : 'text-slate-500'}`}>{texto.length}/{MAX_MENSAJE}</span>
            <Boton type="submit" disabled={enviando || !texto.trim() || excedido}>Enviar</Boton>
          </div>
        </form>
      </section>

      <PreguntasFrecuentes onSeleccionar={seleccionarFaq} deshabilitado={enviando} />
    </div>
  );
}
