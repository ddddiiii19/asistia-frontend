import Link from 'next/link';
import { MODULOS_UI } from '@/lib/modulos';

// Íconos sencillos en SVG (decorativos: el nombre del módulo siempre está escrito en el título).
export function IconoModulo({ nombre, className = 'h-5 w-5' }) {
  const comun = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', className, 'aria-hidden': 'true' };
  switch (nombre) {
    case 'reportes':
      return <svg {...comun}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
    case 'historial':
      return <svg {...comun}><path d="M4 5h16v11H9l-5 4z" /></svg>;
    case 'informacion':
      return <svg {...comun}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.01" /></svg>;
    case 'faq':
      return <svg {...comun}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.01" /></svg>;
    case 'chat':
      return <svg {...comun}><path d="M4 5h16v11H9l-5 4z" /><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" /></svg>;
    default:
      return <svg {...comun}><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></svg>;
  }
}

// Cabecera de cada módulo: franja de color, ícono y título. Mantiene el <h1> con el id que recibe.
export function EncabezadoModulo({ modulo, id, titulo, descripcion, volver = false, region = true, children }) {
  const m = MODULOS_UI[modulo] || MODULOS_UI.panel;
  const Envoltorio = region ? 'section' : 'div';
  return (
    <Envoltorio aria-labelledby={region ? id : undefined} className={`rounded-lg border border-l-8 border-slate-200 ${m.borde} ${m.fondo} p-4 shadow-sm`}>
      {volver ? <Link href="/admin" className="text-sm text-marca underline underline-offset-2">← Volver al panel</Link> : null}
      <div className={`flex items-start gap-3 ${volver ? 'mt-2' : ''}`}>
        <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${m.insignia}`}>
          <IconoModulo nombre={m.icono} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 id={id} className={`text-xl font-semibold ${m.titulo}`}>{titulo}</h1>
          {descripcion ? <p className="mt-1 text-sm text-slate-700">{descripcion}</p> : null}
          {children}
        </div>
      </div>
    </Envoltorio>
  );
}
