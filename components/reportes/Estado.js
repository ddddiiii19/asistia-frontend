import { GUION, textoMotivo } from '@/lib/reportes';

// El estado se distingue por texto y símbolo, no solo por color. `fila` trae { estado, motivo_escalamiento }.
export function Estado({ fila }) {
  if (fila.estado === 'resuelta') {
    return <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-800"><span aria-hidden="true">✓&nbsp;</span>Resuelta</span>;
  }
  return (
    <span>
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900"><span aria-hidden="true">↑&nbsp;</span>Escalada</span>
      <span className="mt-0.5 block text-xs text-slate-500">{fila.motivo_escalamiento ? textoMotivo(fila.motivo_escalamiento) : GUION}</span>
    </span>
  );
}
