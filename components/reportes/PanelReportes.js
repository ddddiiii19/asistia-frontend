'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import { mensajeError } from '@/lib/errores';
import { formatearFecha } from '@/lib/fechas';
import {
  descargarCsv, formatearDia, formatearDuracion, formatearPorcentaje, interaccionesACsv, porcentajeDe,
} from '@/lib/reportes';
import { Alerta, Boton } from '@/components/ui';
import { FiltrosAdmin, SIN_FILTROS } from '@/components/FiltrosAdmin';
import { Paginacion } from '@/components/Paginacion';
import { Estado } from '@/components/reportes/Estado';
import { GraficaDona } from '@/components/reportes/GraficaDona';
import { DescargaDependencias, DescargaSerie, DescargaTemas } from '@/components/reportes/DescargasGraficas';
import { EncabezadoModulo } from '@/components/EncabezadoModulo';

const POR_PAGINA = 15;
const LIMITE_EXPORTACION = 500; // máximo que acepta el backend por solicitud

export function PanelReportes() {
  const { cuenta } = useAuth();
  const esGlobal = cuenta ? cuenta.alcance_admin === 'global' : false;
  const [filtros, setFiltros] = useState(SIN_FILTROS); // filtros aplicados (los que consulta la API)
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState({ cargando: true, error: '', resumen: null });

  useEffect(() => {
    if (!cuenta) return undefined;
    let activo = true;
    // Se conservan los datos anteriores (atenuados) mientras llegan los nuevos, para evitar saltos en la pantalla.
    setEstado((e) => ({ ...e, cargando: true, error: '' }));
    api.reporteResumen(filtros)
      .then((resumen) => { if (activo) setEstado({ cargando: false, error: '', resumen }); })
      .catch((err) => {
        if (activo && err.estado !== 401) setEstado({ cargando: false, error: mensajeError(err), resumen: null });
      });
    return () => { activo = false; };
  }, [cuenta, filtros, intento]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);
  if (!cuenta) return null;
  const { resumen } = estado;

  return (
    <div className="space-y-6">
      <EncabezadoModulo
        modulo="reportes"
        id="titulo-reportes"
        titulo="Reportes y estadísticas"
        volver
        descripcion={esGlobal
          ? 'Uso del asistente en todas las dependencias de TEINCO.'
          : 'Uso del asistente en tu dependencia (solo consulta).'}
      />

      <FiltrosAdmin etiqueta="Filtros del reporte" esGlobal={esGlobal} onAplicar={setFiltros} />

      {estado.cargando ? <p role="status" className="text-sm text-slate-600">{resumen ? 'Actualizando reporte…' : 'Cargando reporte…'}</p> : null}
      {estado.error ? (
        <div className="space-y-2">
          <Alerta tipo="error">{estado.error}</Alerta>
          <Boton variante="secundario" onClick={reintentar}>Reintentar</Boton>
        </div>
      ) : null}

      {resumen ? (
        <div aria-busy={estado.cargando} className={estado.cargando ? 'space-y-6 opacity-60 transition-opacity' : 'space-y-6'}>
        {resumen.total === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
            No hay consultas registradas para los filtros seleccionados.
          </div>
        ) : (
          <>
            <Indicadores resumen={resumen} />
            <div className="grid gap-6 lg:grid-cols-2">
              <Tarjeta id="deps" titulo="Dependencias a las que se direccionan las consultas">
                <BarrasDependencias filas={resumen.por_dependencia} total={resumen.total} />
                <DescargaDependencias resumen={resumen} filtros={filtros} />
              </Tarjeta>
              <Tarjeta id="serie" titulo="Consultas por día">
                <SerieDiaria dias={resumen.consultas_por_dia} />
                <DescargaSerie resumen={resumen} filtros={filtros} />
              </Tarjeta>
              <Tarjeta id="preguntas" titulo="Preguntas más frecuentes">
                <ListaPreguntas filas={resumen.preguntas_mas_frecuentes} />
              </Tarjeta>
              <Tarjeta id="temas" titulo="Temas más consultados">
                <BarrasSimples filas={resumen.temas_mas_consultados.map((t) => ({ nombre: t.tema, total: t.total }))} />
                <DescargaTemas resumen={resumen} filtros={filtros} />
              </Tarjeta>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Tarjeta id="dona" titulo="Distribución de las consultas">
                <GraficaDona resumen={resumen} filtros={filtros} />
              </Tarjeta>
              <Tarjeta id="faq" titulo="Preguntas frecuentes del catálogo más abiertas">
                <p className="-mt-1 mb-2 text-xs text-slate-500">Contador acumulado del catálogo; no depende de las fechas seleccionadas.</p>
                <ListaFaq filas={resumen.faq_mas_consultadas} />
              </Tarjeta>
            </div>
          </>
        )}
        </div>
      ) : null}

      {/* La tabla se consulta aparte: sigue visible si el resumen falla y se pagina sin recalcular indicadores. */}
      <TablaInteracciones filtros={filtros} />
    </div>
  );
}

function Tarjeta({ id, titulo, children }) {
  return (
    <section aria-labelledby={`t-${id}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 id={`t-${id}`} className="mb-3 text-base font-semibold text-marca">{titulo}</h2>
      {children}
    </section>
  );
}

function Indicadores({ resumen }) {
  const items = [
    { etiqueta: 'Consultas realizadas', valor: String(resumen.total), nota: 'En el periodo seleccionado' },
    { etiqueta: 'Consultas resueltas', valor: String(resumen.resueltas), nota: `${formatearPorcentaje(resumen.tasa_resolucion)} del total · sin escalamiento a una persona` },
    { etiqueta: 'Escaladas a una persona', valor: String(resumen.escaladas), nota: `${formatearPorcentaje(porcentajeDe(resumen.escaladas, resumen.total))} del total` },
    { etiqueta: 'Tiempo promedio de respuesta', valor: formatearDuracion(resumen.tiempo_promedio_ms), nota: 'Procesamiento del asistente' },
    { etiqueta: 'Tiempo de respuesta p95', valor: formatearDuracion(resumen.tiempo_p95_ms), nota: 'El 95 % de las respuestas tardó este tiempo o menos' },
  ];
  return (
    <section aria-label="Indicadores principales">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {items.map((i) => (
          <div key={i.etiqueta} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <dt className="text-sm font-medium text-slate-600">{i.etiqueta}</dt>
            <dd className="mt-1 text-2xl font-semibold text-marca">{i.valor}</dd>
            <dd className="mt-0.5 text-xs text-slate-500">{i.nota}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// Barra horizontal; el valor siempre aparece también como texto para no depender del color ni del ancho.
function Barra({ proporcion, relleno = 'bg-marca' }) {
  return (
    <div className="h-2.5 w-full rounded-full bg-marca-claro" aria-hidden="true">
      <div className={`h-2.5 rounded-full ${relleno}`} style={{ width: `${Math.max(2, Math.min(100, proporcion * 100))}%` }} />
    </div>
  );
}

function BarrasDependencias({ filas, total }) {
  const maximo = Math.max(...filas.map((f) => f.total), 1);
  return (
    <ul className="space-y-3">
      {filas.map((f) => (
        <li key={f.dependencia}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className="font-medium text-slate-900">{f.dependencia}</span>
            <span className="text-slate-700">{f.total} ({formatearPorcentaje(porcentajeDe(f.total, total))})</span>
          </div>
          <Barra proporcion={f.total / maximo} />
          <p className="mt-0.5 text-xs text-slate-500">
            Resueltas: {f.resueltas} · Escaladas: {f.escaladas} · Tiempo promedio: {formatearDuracion(f.tiempo_promedio_ms)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function BarrasSimples({ filas }) {
  const maximo = Math.max(...filas.map((f) => f.total), 1);
  return (
    <ul className="space-y-2.5">
      {filas.map((f) => (
        <li key={f.nombre}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="break-words text-slate-900">{f.nombre}</span>
            <span className="shrink-0 text-slate-700">{f.total}</span>
          </div>
          <Barra proporcion={f.total / maximo} />
        </li>
      ))}
    </ul>
  );
}

function ListaPreguntas({ filas }) {
  if (filas.length === 0) return <p className="text-sm text-slate-600">Sin datos.</p>;
  return (
    <ol className="space-y-2.5">
      {filas.map((f, i) => (
        <li key={`${i}-${f.pregunta}`} className="flex gap-3 text-sm">
          <span aria-hidden="true" className="w-5 shrink-0 text-right font-semibold text-marca">{i + 1}.</span>
          <span className="min-w-0 flex-1">
            <span className="block break-words text-slate-900">{f.pregunta}</span>
            <span className="text-xs text-slate-500">{f.total} {f.total === 1 ? 'vez' : 'veces'} · {f.dependencia}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function ListaFaq({ filas }) {
  if (filas.length === 0) {
    return <p className="text-sm text-slate-600">Aún no se han abierto preguntas frecuentes del catálogo desde el chat.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100 text-sm">
      {filas.map((f) => (
        <li key={f.id_faq} className="flex items-baseline justify-between gap-3 py-2">
          <span className="min-w-0 break-words text-slate-900">{f.pregunta} <span className="text-xs text-slate-500">· {f.dependencia}</span></span>
          <span className="shrink-0 font-medium text-slate-700">{f.frecuencia}</span>
        </li>
      ))}
    </ul>
  );
}

// Gráfica de barras verticales en SVG. El resumen en texto la hace utilizable con lector de pantalla.
function SerieDiaria({ dias }) {
  if (dias.length === 0) return <p className="text-sm text-slate-600">Sin datos.</p>;
  const maximo = Math.max(...dias.map((d) => d.total), 1);
  const dMax = dias.find((d) => d.total === maximo);
  const ancho = 600;
  const alto = 160;
  const paso = ancho / dias.length;
  const resumenTexto = `${dias.length} ${dias.length === 1 ? 'día' : 'días'} con consultas; el máximo fue de ${maximo} el ${formatearDia(dMax.dia)}.`;
  return (
    <div>
      <svg viewBox={`0 0 ${ancho} ${alto + 4}`} role="img" aria-label={`Consultas por día. ${resumenTexto}`} className="h-40 w-full">
        {dias.map((d, i) => {
          const h = (d.total / maximo) * alto;
          return (
            <rect key={d.dia} x={i * paso + paso * 0.12} y={alto - h + 2} width={Math.max(1, paso * 0.76)} height={h} rx="1.5" fill="var(--color-marca)">
              <title>{`${formatearDia(d.dia)}: ${d.total} ${d.total === 1 ? 'consulta' : 'consultas'}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-slate-500">
        <span>{formatearDia(dias[0].dia)}</span>
        <span>{resumenTexto}</span>
        <span>{formatearDia(dias[dias.length - 1].dia)}</span>
      </div>
      {dias.length >= 90 ? (
        <p className="mt-1 text-xs text-slate-500">Se muestran los 90 días más recientes del periodo.</p>
      ) : null}
    </div>
  );
}

function TablaInteracciones({ filtros }) {
  const [pagina, setPagina] = useState(0);
  const [estado, setEstado] = useState({ cargando: true, error: '', filas: [], hayMas: false });
  const [exportando, setExportando] = useState(false);
  const [errorExportar, setErrorExportar] = useState('');

  // Al cambiar los filtros se vuelve a la primera página.
  useEffect(() => { setPagina(0); }, [filtros]);

  useEffect(() => {
    let activo = true;
    setEstado((e) => ({ ...e, cargando: true, error: '' }));
    // Se pide una fila de más para saber si existe página siguiente sin necesitar un total.
    api.reporteInteracciones({ ...filtros, limite: POR_PAGINA + 1, desplazamiento: pagina * POR_PAGINA })
      .then((filas) => {
        if (activo) setEstado({ cargando: false, error: '', filas: filas.slice(0, POR_PAGINA), hayMas: filas.length > POR_PAGINA });
      })
      .catch((err) => {
        if (activo && err.estado !== 401) setEstado({ cargando: false, error: mensajeError(err), filas: [], hayMas: false });
      });
    return () => { activo = false; };
  }, [filtros, pagina]);

  async function exportar() {
    setExportando(true);
    setErrorExportar('');
    try {
      const filas = await api.reporteInteracciones({ ...filtros, limite: LIMITE_EXPORTACION, desplazamiento: 0 });
      descargarCsv(`asistia-interacciones-${new Date().toISOString().slice(0, 10)}.csv`, interaccionesACsv(filas));
    } catch (err) {
      if (err.estado !== 401) setErrorExportar(mensajeError(err));
    } finally {
      setExportando(false);
    }
  }

  return (
    <section aria-labelledby="titulo-interacciones" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-interacciones" className="text-base font-semibold text-marca">Detalle de interacciones</h2>
        <Boton variante="secundario" onClick={exportar} disabled={exportando || estado.filas.length === 0}>
          {exportando ? 'Exportando…' : `Exportar CSV (hasta ${LIMITE_EXPORTACION})`}
        </Boton>
      </div>
      {errorExportar ? <div className="mt-3"><Alerta tipo="error">{errorExportar}</Alerta></div> : null}
      {estado.error ? <div className="mt-3"><Alerta tipo="error">{estado.error}</Alerta></div> : null}
      {estado.cargando ? <p role="status" className="mt-3 text-sm text-slate-600">Cargando…</p> : null}
      {!estado.cargando && !estado.error && estado.filas.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">No hay interacciones para los filtros seleccionados.</p>
      ) : null}

      {estado.filas.length > 0 ? (
        <>
        <p className="mt-3 text-xs text-slate-500 md:hidden">Desliza la tabla hacia los lados para ver todas las columnas.</p>
        <div className="relative mt-1 overflow-x-auto md:mt-3">
          {/* `relative` mantiene dentro del recorte a los elementos `sr-only` (posición absoluta); sin él se desborda la página. */}
          <table className="w-full min-w-[44rem] text-left text-sm">
            <caption className="sr-only">Interacciones registradas, de la más reciente a la más antigua</caption>
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">Fecha</th>
                <th scope="col" className="py-2 pr-3 font-medium">Consulta</th>
                <th scope="col" className="py-2 pr-3 font-medium">Dependencia</th>
                <th scope="col" className="py-2 pr-3 font-medium">Estado</th>
                <th scope="col" className="py-2 pr-3 font-medium">Tiempo</th>
                <th scope="col" className="py-2 font-medium">Conversación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {estado.filas.map((f) => (
                <tr key={f.id_consulta} className="align-top">
                  <td className="whitespace-nowrap py-2 pr-3 text-slate-600">{formatearFecha(f.fecha)}</td>
                  <td className="py-2 pr-3 text-slate-900"><span className="line-clamp-2 break-words">{f.consulta}</span></td>
                  <td className="py-2 pr-3 text-slate-700">{f.dependencia || 'Sin identificar'}</td>
                  <td className="py-2 pr-3">
                    <Estado fila={f} />
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 text-slate-700">{formatearDuracion(f.tiempo_respuesta_ms)}</td>
                  <td className="whitespace-nowrap py-2">
                    <Link
                      href={`/admin/historial/${f.id_conversacion}`}
                      aria-label={`Ver la conversación de la consulta ${f.id_consulta}`}
                      className="text-marca underline underline-offset-2"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : null}

      <Paginacion etiqueta="Paginación de interacciones" pagina={pagina} hayMas={estado.hayMas} cargando={estado.cargando} onCambiar={setPagina} />
    </section>
  );
}
