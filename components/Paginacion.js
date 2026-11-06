import { Boton } from '@/components/ui';

// Paginación sin total: la lista pide una fila de más para saber si existe otra página.
export function Paginacion({ etiqueta, pagina, hayMas, cargando, onCambiar }) {
  return (
    <nav aria-label={etiqueta} className="mt-3 flex items-center justify-between gap-3">
      <Boton variante="secundario" onClick={() => onCambiar(Math.max(0, pagina - 1))} disabled={pagina === 0 || cargando}>Anterior</Boton>
      <span className="text-sm text-slate-600">Página {pagina + 1}</span>
      <Boton variante="secundario" onClick={() => onCambiar(pagina + 1)} disabled={!hayMas || cargando}>Siguiente</Boton>
    </nav>
  );
}
