'use client';

import { useMemo, useState } from 'react';
import { descargarCsv, formatearPorcentaje } from '@/lib/reportes';
import {
  VISTAS_DONA, arcosDona, descargarPng, nombreArchivo, segmentosACsv, segmentosDona,
  svgGraficaDona, textoPeriodo, tituloVista,
} from '@/lib/graficas';
import { Alerta, Boton } from '@/components/ui';

// Gráfica de dona de las consultas, con dos vistas (por dependencia y por estado).
// Se puede descargar como imagen PNG y sus datos como CSV.
export function GraficaDona({ resumen, filtros }) {
  const [vista, setVista] = useState('dependencia');
  const [error, setError] = useState('');
  const [generando, setGenerando] = useState(false);
  const segmentos = useMemo(() => segmentosDona(resumen, vista), [resumen, vista]);
  const arcos = useMemo(() => arcosDona(segmentos), [segmentos]);
  const total = segmentos.reduce((suma, s) => suma + s.valor, 0);
  const resumenTexto = `${tituloVista(vista)}: ${segmentos.map((s) => `${s.nombre} ${s.valor} (${formatearPorcentaje(s.porcentaje)})`).join('; ')}.`;

  async function bajarPng() {
    setError('');
    setGenerando(true);
    try {
      const imagen = svgGraficaDona({ segmentos, vista, subtitulo: textoPeriodo(filtros) });
      await descargarPng(nombreArchivo(vista, 'png'), imagen);
    } catch {
      setError('No fue posible generar la imagen de la gráfica.');
    } finally {
      setGenerando(false);
    }
  }

  function bajarCsv() {
    setError('');
    descargarCsv(nombreArchivo(vista, 'csv'), segmentosACsv(segmentos, vista));
  }

  return (
    <div>
      <div role="group" aria-label="Vista de la gráfica" className="flex flex-wrap gap-2">
        {VISTAS_DONA.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={vista === v.id}
            onClick={() => setVista(v.id)}
            className={`rounded-full border px-3 py-1 text-sm font-medium ${vista === v.id ? 'border-marca bg-marca text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
          >
            {v.etiqueta}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <svg viewBox="0 0 42 42" role="img" aria-label={resumenTexto} className="h-44 w-44 shrink-0">
          {arcos.map((a) => (
            <circle key={a.nombre} cx="21" cy="21" r="15.9155" fill="none" stroke={a.color} strokeWidth="6" strokeDasharray={`${a.largo} ${100 - a.largo}`} strokeDashoffset={a.desfase}>
              <title>{`${a.nombre}: ${a.valor} (${formatearPorcentaje(a.porcentaje)})`}</title>
            </circle>
          ))}
          <text x="21" y="21.6" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#1f3864">{total}</text>
          <text x="21" y="26.5" textAnchor="middle" fontSize="2.6" fill="#475569">{total === 1 ? 'consulta' : 'consultas'}</text>
        </svg>
        {/* La leyenda repite los valores como texto: la gráfica no depende solo del color. */}
        <ul className="min-w-0 flex-1 space-y-2 text-sm">
          {segmentos.map((s) => (
            <li key={s.nombre} className="flex items-baseline gap-2">
              <span aria-hidden="true" className="mt-1 inline-block h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="min-w-0 flex-1 break-words text-slate-900">{s.nombre}</span>
              <span className="shrink-0 text-slate-700">{s.valor} ({formatearPorcentaje(s.porcentaje)})</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Boton variante="secundario" onClick={bajarPng} disabled={generando || segmentos.length === 0}>
          {generando ? 'Generando…' : 'Descargar gráfica (PNG)'}
        </Boton>
        <Boton variante="secundario" onClick={bajarCsv} disabled={segmentos.length === 0}>Descargar datos (CSV)</Boton>
      </div>
      {error ? <div className="mt-3"><Alerta tipo="error">{error}</Alerta></div> : null}
    </div>
  );
}
