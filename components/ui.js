'use client';

import { useId, useState } from 'react';
import { requisitosContrasena } from '@/lib/validacion';

const claseEntrada =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/30 disabled:bg-slate-100 aria-[invalid=true]:border-red-600';

export function Campo({ etiqueta, error, ayuda, id: idExterno, ...resto }) {
  const idAuto = useId();
  const id = idExterno || idAuto;
  const descritoPor = [error ? `${id}-error` : null, ayuda ? `${id}-ayuda` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{etiqueta}</label>
      <input id={id} className={claseEntrada} aria-invalid={error ? 'true' : undefined} aria-describedby={descritoPor} {...resto} />
      {ayuda ? <p id={`${id}-ayuda`} className="mt-1 text-xs text-slate-500">{ayuda}</p> : null}
      {error ? <p id={`${id}-error`} className="mt-1 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

export function CampoTexto({ etiqueta, error, ayuda, id: idExterno, ...resto }) {
  const idAuto = useId();
  const id = idExterno || idAuto;
  const descritoPor = [error ? `${id}-error` : null, ayuda ? `${id}-ayuda` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{etiqueta}</label>
      <textarea id={id} rows={5} className={claseEntrada} aria-invalid={error ? 'true' : undefined} aria-describedby={descritoPor} {...resto} />
      {ayuda ? <p id={`${id}-ayuda`} className="mt-1 text-xs text-slate-500">{ayuda}</p> : null}
      {error ? <p id={`${id}-error`} className="mt-1 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

export function Selector({ etiqueta, id: idExterno, children, ...resto }) {
  const idAuto = useId();
  const id = idExterno || idAuto;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{etiqueta}</label>
      <select id={id} className={claseEntrada} {...resto}>{children}</select>
    </div>
  );
}

export function CampoContrasena({ etiqueta, error, mostrarRequisitos = false, value, ...resto }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const requisitos = mostrarRequisitos ? requisitosContrasena(value) : [];
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{etiqueta}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          className={`${claseEntrada} pr-20`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={[error ? `${id}-error` : null, mostrarRequisitos ? `${id}-req` : null].filter(Boolean).join(' ') || undefined}
          {...resto}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-marca hover:underline"
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      {mostrarRequisitos ? (
        <ul id={`${id}-req`} className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
          {requisitos.map((r) => (
            <li key={r.id} className={r.cumple ? 'text-green-700' : 'text-slate-500'}>
              <span aria-hidden="true">{r.cumple ? '✓' : '○'}</span> {r.texto}
              <span className="sr-only">{r.cumple ? ' (cumplido)' : ' (pendiente)'}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p id={`${id}-error`} className="mt-1 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

const variantes = {
  exito: 'border-green-300 bg-green-50 text-green-900',
  error: 'border-red-300 bg-red-50 text-red-900',
  info: 'border-marca/30 bg-marca-claro text-marca-oscuro',
};

export function Alerta({ tipo = 'info', children, ...resto }) {
  const rol = tipo === 'error' ? 'alert' : 'status';
  return (
    <div role={rol} className={`rounded-md border px-3 py-2 text-sm ${variantes[tipo]}`} {...resto}>
      {children}
    </div>
  );
}

export function Boton({ variante = 'primario', className = '', ...resto }) {
  const base = 'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-60';
  const estilos = variante === 'primario'
    ? 'bg-marca text-white hover:bg-marca-oscuro'
    : variante === 'peligro'
      ? 'bg-red-700 text-white hover:bg-red-800'
      : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100';
  return <button className={`${base} ${estilos} ${className}`} {...resto} />;
}
