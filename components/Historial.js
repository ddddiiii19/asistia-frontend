'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { mensajeError } from '@/lib/errores';
import { formatearFecha } from '@/lib/fechas';
import { Alerta } from '@/components/ui';
import { Burbuja } from '@/components/chat/Burbuja';
import { EncabezadoModulo } from '@/components/EncabezadoModulo';

export function ListaHistorial() {
  const [estado, setEstado] = useState({ cargando: true, error: '', lista: [] });

  useEffect(() => {
    let activo = true;
    api.conversaciones()
      .then((lista) => { if (activo) setEstado({ cargando: false, error: '', lista }); })
      .catch((err) => {
        if (activo && err.estado !== 401) setEstado({ cargando: false, error: mensajeError(err), lista: [] });
      });
    return () => { activo = false; };
  }, []);

  return (
    <section aria-labelledby="titulo-historial">
      <EncabezadoModulo modulo="historial" id="titulo-historial" titulo="Mi historial" descripcion="Tus conversaciones anteriores con el asistente (las 50 más recientes)." region={false} />
      <div className="mt-4">
        {estado.cargando ? <p role="status" className="text-sm text-slate-600">Cargando…</p> : null}
        {estado.error ? <Alerta tipo="error">{estado.error}</Alerta> : null}
        {!estado.cargando && !estado.error && estado.lista.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
            Aún no tienes conversaciones. <Link href="/chat" className="text-marca underline underline-offset-2">Hacer una consulta</Link>
          </div>
        ) : null}
        <ul className="space-y-3">
          {estado.lista.map((c) => (
            <li key={c.id_conversacion}>
              <Link
                href={`/historial/${c.id_conversacion}`}
                className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-marca"
              >
                <span className="block text-xs text-slate-500">{formatearFecha(c.fecha_inicio)}</span>
                <span className="mt-1 block break-words font-medium text-slate-900">{c.primera_consulta || 'Conversación sin consulta registrada'}</span>
                {c.dependencia ? (
                  <span className="mt-2 inline-block rounded-full bg-marca-claro px-2.5 py-0.5 text-xs font-medium text-marca">{c.dependencia}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function DetalleConversacion({ id }) {
  const [estado, setEstado] = useState({ cargando: true, error: '', conv: null });

  useEffect(() => {
    let activo = true;
    api.conversacion(id)
      .then((conv) => { if (activo) setEstado({ cargando: false, error: '', conv }); })
      .catch((err) => {
        if (activo && err.estado !== 401) setEstado({ cargando: false, error: mensajeError(err), conv: null });
      });
    return () => { activo = false; };
  }, [id]);

  return (
    <section aria-labelledby="titulo-detalle">
      <Link href="/historial" className="text-sm text-marca underline underline-offset-2">← Volver al historial</Link>
      <h1 id="titulo-detalle" className="mt-2 text-xl font-semibold text-marca">Conversación</h1>
      {estado.conv ? <p className="text-sm text-slate-600">{formatearFecha(estado.conv.fecha_inicio)}</p> : null}
      <div className="mt-4">
        {estado.cargando ? <p role="status" className="text-sm text-slate-600">Cargando…</p> : null}
        {estado.error ? <Alerta tipo="error">{estado.error}</Alerta> : null}
        {estado.conv ? (
          <>
            <ol aria-label="Mensajes de la conversación" className="space-y-3 rounded-lg bg-slate-100 p-3 sm:p-4">
              {estado.conv.mensajes.map((m) => (
                <Burbuja
                  key={m.id_mensaje}
                  mensaje={{ rol: m.emisor === 'usuario' ? 'usuario' : 'asistente', texto: m.contenido, contacto: m.contacto, dependencia: m.dependencia }}
                />
              ))}
            </ol>
            <div className="mt-4">
              <Link
                href={`/chat?c=${estado.conv.id_conversacion}`}
                className="inline-flex rounded-md bg-marca px-4 py-2 text-sm font-semibold text-white hover:bg-marca-oscuro"
              >
                Continuar esta conversación
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
