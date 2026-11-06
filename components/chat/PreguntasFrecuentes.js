'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { mensajeError } from '@/lib/errores';
import { Alerta, Boton } from '@/components/ui';

export function PreguntasFrecuentes({ onSeleccionar, deshabilitado }) {
  const [estado, setEstado] = useState({ cargando: true, error: '', lista: [] });

  const cargar = useCallback(async () => {
    setEstado({ cargando: true, error: '', lista: [] });
    try {
      const lista = await api.preguntasFrecuentes();
      setEstado({ cargando: false, error: '', lista });
    } catch (err) {
      if (err.estado === 401) return; // la sesión inválida ya se gestiona globalmente
      setEstado({ cargando: false, error: mensajeError(err), lista: [] });
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <aside aria-labelledby="titulo-faq" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 id="titulo-faq" className="text-base font-semibold text-marca">Preguntas frecuentes</h2>
      <p className="mt-1 text-xs text-slate-500">Selecciona una para ver su respuesta. No se guardan en tu historial.</p>
      <div className="mt-3">
        {estado.cargando ? <p role="status" className="text-sm text-slate-600">Cargando…</p> : null}
        {estado.error ? (
          <div className="space-y-2">
            <Alerta tipo="error">{estado.error}</Alerta>
            <Boton variante="secundario" onClick={cargar}>Reintentar</Boton>
          </div>
        ) : null}
        {!estado.cargando && !estado.error && estado.lista.length === 0 ? (
          <p className="text-sm text-slate-600">Aún no hay preguntas frecuentes registradas.</p>
        ) : null}
        <ul className="max-h-60 space-y-2 overflow-y-auto lg:max-h-[28rem]">
          {estado.lista.map((f) => (
            <li key={f.id_faq}>
              <button
                type="button"
                disabled={deshabilitado}
                onClick={() => onSeleccionar(f)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:border-marca hover:bg-marca-claro disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="block">{f.pregunta}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{f.dependencia}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
