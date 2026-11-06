const formato = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

export function formatearFecha(valor) {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? '' : formato.format(fecha);
}
