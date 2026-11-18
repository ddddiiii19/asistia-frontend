'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import { mensajeError } from '@/lib/errores';
import { formatearFecha } from '@/lib/fechas';
import { Alerta, Boton } from '@/components/ui';
import { FiltrosAdmin, SIN_FILTROS } from '@/components/FiltrosAdmin';
import { EncabezadoModulo } from '@/components/EncabezadoModulo';
import { Paginacion } from '@/components/Paginacion';

const POR_PAGINA = 15;

// Historial administrativo (RF-13): conversaciones de los usuarios con el asistente. El administrador de
// dependencia solo ve las de su dependencia; el backend decide siempre el alcance.
export function HistorialAdmin() {
  const { cuenta } = useAuth();
  const esGlobal = cuenta ? cuenta.alcance_admin === 'global' : false;
  const [filtros, setFiltros] = useState(SIN_FILTROS);
  const [pagina, setPagina] = useState(0);
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState({ cargando: true, error: '', filas: [], hayMas: false });

  useEffect(() => {
    if (!cuenta) return undefined;
    let activo = true;
    setEstado((e) => ({ ...e, cargando: true, error: '' }));
    // Se pide una fila de más para saber si existe página siguiente sin necesitar un total.
    api.adminConversaciones({ ...filtros, limite: POR_PAGINA + 1, desplazamiento: pagina * POR_PAGINA })
      .then((filas) => {
        if (activo) setEstado({ cargando: false, error: '', filas: filas.slice(0, POR_PAGINA), hayMas: filas.length > POR_PAGINA });
      })
      .catch((err) => {
        if (activo && err.estado !== 401) setEstado({ cargando: false, error: mensajeError(err), filas: [], hayMas: false });
      });
    return () => { activo = false; };
  }, [cuenta, filtros, pagina, intento]);

  // Al cambiar los filtros se vuelve a la primera página.
  const aplicar = useCallback((nuevos) => { setFiltros(nuevos); setPagina(0); }, []);
  if (!cuenta) return null;

  return (
    <div className="space-y-6">
      <EncabezadoModulo
        modulo="historial"
        id="titulo-historial-admin"
        titulo="Historial de conversaciones"
        volver
        descripcion={esGlobal
          ? 'Conversaciones de los usuarios con el asistente, de la más reciente a la más antigua.'
          : 'Conversaciones de los usuarios dirigidas a tu dependencia (solo consulta).'}
      />

      <FiltrosAdmin etiqueta="Filtros del historial" esGlobal={esGlobal} onAplicar={aplicar} />

      <section aria-labelledby="titulo-lista-conversaciones">
        <h2 id="titulo-lista-conversaciones" className="sr-only">Lista de conversaciones</h2>
        {estado.cargando ? <p role="status" className="text-sm text-slate-600">{estado.filas.length > 0 ? 'Actualizando…' : 'Cargando…'}</p> : null}
        {estado.error ? (
          <div className="space-y-2">
            <Alerta tipo="error">{estado.error}</Alerta>
            <Boton variante="secundario" onClick={() => setIntento((n) => n + 1)}>Reintentar</Boton>
          </div>
        ) : null}
        {!estado.cargando && !estado.error && estado.filas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
            No hay conversaciones para los filtros seleccionados.
          </div>
        ) : null}

        {estado.filas.length > 0 ? (
          <ul aria-busy={estado.cargando} className={`space-y-3 ${estado.cargando ? 'opacity-60 transition-opacity' : ''}`}>
            {estado.filas.map((c) => (
              <li key={c.id_conversacion}>
                <Link
                  href={`/admin/historial/${c.id_conversacion}`}
                  className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-marca"
                >
                  <span className="block text-xs text-slate-500">{formatearFecha(c.fecha_inicio)}</span>
                  <span className="mt-1 line-clamp-2 break-words font-medium text-slate-900">{c.primera_consulta || 'Conversación sin consulta registrada'}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-marca-claro px-2.5 py-0.5 font-medium text-marca">{c.dependencia || 'Sin identificar'}</span>
                    {c.escalada ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-medium text-amber-900"><span aria-hidden="true">↑&nbsp;</span>Escalada</span>
                    ) : (
                      <span className="rounded-full bg-green-50 px-2.5 py-0.5 font-medium text-green-800"><span aria-hidden="true">✓&nbsp;</span>Resuelta</span>
                    )}
                    <span className="text-slate-500">{c.mensajes} {c.mensajes === 1 ? 'mensaje' : 'mensajes'}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <Paginacion etiqueta="Paginación del historial" pagina={pagina} hayMas={estado.hayMas} cargando={estado.cargando} onCambiar={setPagina} />
      </section>
    </div>
  );
}
