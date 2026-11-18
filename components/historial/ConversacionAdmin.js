'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import { mensajeError } from '@/lib/errores';
import { formatearFecha } from '@/lib/fechas';
import { formatearDuracion } from '@/lib/reportes';
import { Alerta } from '@/components/ui';
import { Burbuja } from '@/components/chat/Burbuja';
import { Estado } from '@/components/reportes/Estado';

// Detalle de una conversación para el administrador: ficha de cada consulta (dependencia, tema, tiempo,
// estado) y los mensajes tal como los vio la persona usuaria. Es solo de lectura.
export function ConversacionAdmin({ id }) {
  const { cuenta } = useAuth();
  const esGlobal = cuenta ? cuenta.alcance_admin === 'global' : false;
  const [estado, setEstado] = useState({ cargando: true, error: '', conv: null });

  useEffect(() => {
    let activo = true;
    setEstado({ cargando: true, error: '', conv: null });
    api.adminConversacion(id)
      .then((conv) => { if (activo) setEstado({ cargando: false, error: '', conv }); })
      .catch((err) => {
        if (activo && err.estado !== 401) setEstado({ cargando: false, error: mensajeError(err), conv: null });
      });
    return () => { activo = false; };
  }, [id]);

  const { conv } = estado;
  return (
    <section aria-labelledby="titulo-conversacion-admin" className="space-y-5">
      <div>
        <Link href="/admin/historial" className="text-sm text-marca underline underline-offset-2">← Volver al historial</Link>
        <h1 id="titulo-conversacion-admin" className="mt-2 text-xl font-semibold text-marca">Conversación</h1>
        {conv ? <p className="text-sm text-slate-600">{formatearFecha(conv.fecha_inicio)}</p> : null}
      </div>

      {estado.cargando ? <p role="status" className="text-sm text-slate-600">Cargando…</p> : null}
      {estado.error ? <Alerta tipo="error">{estado.error}</Alerta> : null}

      {conv ? (
        <>
          <section aria-labelledby="titulo-consultas" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 id="titulo-consultas" className="mb-3 text-base font-semibold text-marca">
              {conv.consultas.length === 1 ? 'Consulta registrada' : 'Consultas registradas'}
            </h2>
            <ul className="divide-y divide-slate-100">
              {conv.consultas.map((c) => (
                <li key={c.id_consulta} className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-slate-500">Dependencia</p>
                    <p className="text-sm text-slate-900">{c.dependencia || 'Sin identificar'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Tema</p>
                    <p className="break-words text-sm text-slate-900">{c.clasificacion || 'Sin clasificar'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Tiempo de respuesta</p>
                    <p className="text-sm text-slate-900">{formatearDuracion(c.tiempo_respuesta_ms)}</p>
                  </div>
                  <div>
                    <p className="mb-0.5 text-xs text-slate-500">Estado</p>
                    <Estado fila={c} />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="titulo-mensajes">
            <h2 id="titulo-mensajes" className="mb-2 text-base font-semibold text-marca">Mensajes</h2>
            {cuenta && !esGlobal ? (
              <p className="mb-2 text-xs text-slate-600">
                Se muestran únicamente los mensajes de las consultas dirigidas a tu dependencia; la conversación puede incluir otras consultas que no te corresponden.
              </p>
            ) : null}
            <ol aria-label="Mensajes de la conversación" className="space-y-3 rounded-lg bg-slate-100 p-3 sm:p-4">
              {conv.mensajes.map((m) => (
                <Burbuja
                  key={m.id_mensaje}
                  nombreUsuario="Usuario"
                  mensaje={{ rol: m.emisor === 'usuario' ? 'usuario' : 'asistente', texto: m.contenido, contacto: m.contacto, dependencia: m.dependencia }}
                />
              ))}
            </ol>
            <p className="mt-3 text-xs text-slate-500">
              Este contenido pertenece a la conversación de un usuario: consúltalo solo para atender solicitudes y mejorar el servicio.
            </p>
          </section>
        </>
      ) : null}
    </section>
  );
}
