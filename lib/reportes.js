// Utilidades del módulo de reportes (Q6): formato de cifras, validación de filtros y exportación a CSV.

export const GUION = '—';

// 3387 -> "3,4 s"; 850 -> "850 ms"; sin dato -> "—".
export function formatearDuracion(ms) {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return GUION;
  const n = Number(ms);
  if (n < 1000) return `${Math.round(n)} ms`;
  return `${(n / 1000).toFixed(1).replace('.', ',')} s`;
}

// 62.9 -> "62,9 %"; sin dato -> "—".
export function formatearPorcentaje(valor) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return GUION;
  return `${String(Number(valor)).replace('.', ',')} %`;
}

// Porcentaje de una parte sobre un total, con un decimal (0 si no hay total).
export function porcentajeDe(parte, total) {
  if (!total) return 0;
  return Math.round((parte / total) * 1000) / 10;
}

// Mensaje de error de los filtros de periodo o cadena vacía si son válidos (formato AAAA-MM-DD).
export function validarFiltros({ desde, hasta }) {
  const RE = /^\d{4}-\d{2}-\d{2}$/;
  if (desde && !RE.test(desde)) return "La fecha 'desde' no es válida.";
  if (hasta && !RE.test(hasta)) return "La fecha 'hasta' no es válida.";
  if (desde && hasta && desde > hasta) return "La fecha 'desde' no puede ser posterior a 'hasta'.";
  return '';
}

const MOTIVOS = {
  dependencia_no_identificada: 'No se identificó la dependencia',
  informacion_insuficiente: 'Información institucional insuficiente',
  sin_informacion_institucional: 'Sin información cargada para la dependencia',
  respaldo_no_verificable: 'Respuesta sin respaldo verificable',
};

export function textoMotivo(codigo) {
  if (!codigo) return GUION;
  return MOTIVOS[codigo] || codigo;
}

// "2026-10-22" -> "22 oct" (se arma a mano para no desplazar el día por la zona horaria).
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function formatearDia(dia) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia || '');
  if (!m) return '';
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1]}`;
}

// Una celda de CSV. Se neutralizan las fórmulas (=, +, -, @) para que Excel no ejecute contenido escrito
// por usuarios (inyección de fórmulas) y se escapan comillas, separadores y saltos de línea.
export function celdaCsv(valor) {
  let texto = valor === null || valor === undefined ? '' : String(valor);
  // También se neutralizan las celdas con espacios (incluido el espacio duro) antes del carácter de fórmula.
  if (/^(\s*[=+\-@]|[\t\r])/.test(texto)) texto = `'${texto}`;
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const COLUMNAS_CSV = [
  ['Fecha', (f) => f.fecha],
  ['Consulta', (f) => f.consulta],
  ['Dependencia', (f) => f.dependencia || 'Sin identificar'],
  ['Tema', (f) => f.clasificacion],
  ['Estado', (f) => f.estado],
  ['Tiempo de respuesta (ms)', (f) => f.tiempo_respuesta_ms],
  ['Motivo de escalamiento', (f) => (f.motivo_escalamiento ? textoMotivo(f.motivo_escalamiento) : '')],
];

// Separador ";" y BOM UTF-8: es lo que Excel en configuración regional española abre correctamente.
export function interaccionesACsv(filas) {
  const lineas = [COLUMNAS_CSV.map(([titulo]) => titulo).join(';')];
  for (const fila of filas) lineas.push(COLUMNAS_CSV.map(([, leer]) => celdaCsv(leer(fila))).join(';'));
  return `\uFEFF${lineas.join('\r\n')}\r\n`;
}

export function descargarCsv(nombre, contenido) {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
