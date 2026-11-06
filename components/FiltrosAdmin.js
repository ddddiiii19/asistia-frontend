'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { validarFiltros } from '@/lib/reportes';
import { Boton, Campo, Selector } from '@/components/ui';

export const SIN_FILTROS = { dependencia: '', desde: '', hasta: '' };

// Filtros compartidos por los módulos del panel (reportes e historial): dependencia (solo administrador global)
// y periodo. El backend decide siempre el alcance real; ocultar el filtro es solo una cuestión de claridad.
// Llama a `onAplicar` con { dependencia, desde, hasta } cuando los filtros son válidos.
export function FiltrosAdmin({ etiqueta, esGlobal, onAplicar }) {
  const [dependencias, setDependencias] = useState([]);
  const [borrador, setBorrador] = useState(SIN_FILTROS);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!esGlobal) return undefined;
    let activo = true;
    api.dependencias()
      .then((lista) => { if (activo) setDependencias(lista); })
      .catch(() => { /* sin la lista, el filtro por dependencia simplemente no ofrece opciones */ });
    return () => { activo = false; };
  }, [esGlobal]);

  function aplicar(evento) {
    evento.preventDefault();
    const problema = validarFiltros(borrador);
    setError(problema);
    if (!problema) onAplicar({ ...borrador });
  }

  function limpiar() {
    setBorrador(SIN_FILTROS);
    setError('');
    onAplicar(SIN_FILTROS);
  }

  return (
    <form onSubmit={aplicar} noValidate aria-label={etiqueta} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        {esGlobal ? (
          <Selector etiqueta="Dependencia" value={borrador.dependencia} onChange={(e) => setBorrador({ ...borrador, dependencia: e.target.value })}>
            <option value="">Todas las dependencias</option>
            {dependencias.map((d) => <option key={d.id_dependencia} value={d.id_dependencia}>{d.nombre}</option>)}
          </Selector>
        ) : null}
        <Campo etiqueta="Desde" type="date" value={borrador.desde} onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })} />
        <Campo etiqueta="Hasta" type="date" value={borrador.hasta} onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })} />
        <div className="flex gap-2">
          <Boton type="submit">Aplicar</Boton>
          <Boton type="button" variante="secundario" onClick={limpiar}>Limpiar</Boton>
        </div>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
