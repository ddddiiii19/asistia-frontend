// Gráficas de los reportes (Q7 y ajuste final): datos, exportación a CSV y a imagen PNG.
import { celdaCsv, formatearDia, formatearDuracion, formatearPorcentaje, porcentajeDe } from './reportes';

export const VISTAS_DONA = [
  { id: 'dependencia', etiqueta: 'Por dependencia', titulo: 'Consultas por dependencia' },
  { id: 'estado', etiqueta: 'Por estado', titulo: 'Consultas por estado' },
];

// Colores fijos (no variables CSS) para que la imagen descargada se vea igual que en pantalla.
const PALETA = ['#1f3864', '#2f80c9', '#e0a100', '#2e9f6b', '#8e5bd0', '#d9534f', '#00a5a8', '#b45f06'];
const COLOR_SIN_IDENTIFICAR = '#94a3b8';
const COLOR_RESUELTAS = '#2e9f6b';
const COLOR_ESCALADAS = '#e0a100';

export function tituloVista(vista) {
  return (VISTAS_DONA.find((v) => v.id === vista) || VISTAS_DONA[0]).titulo;
}

// Segmentos de la dona a partir del resumen de /reportes/resumen. Los que no tienen consultas se omiten.
export function segmentosDona(resumen, vista) {
  if (!resumen || !resumen.total) return [];
  let base;
  if (vista === 'estado') {
    base = [
      { nombre: 'Resueltas', valor: resumen.resueltas, color: COLOR_RESUELTAS },
      { nombre: 'Escaladas a una persona', valor: resumen.escaladas, color: COLOR_ESCALADAS },
    ];
  } else {
    let i = 0;
    base = (resumen.por_dependencia || []).map((d) => ({
      nombre: d.dependencia,
      valor: d.total,
      color: d.dependencia === 'Sin identificar' ? COLOR_SIN_IDENTIFICAR : PALETA[i++ % PALETA.length],
    }));
  }
  return base
    .filter((s) => Number(s.valor) > 0)
    .map((s) => ({ ...s, porcentaje: porcentajeDe(s.valor, resumen.total) }));
}

// "2026-10-01" + "2026-10-31" -> "Periodo: 01/10/2026 a 31/10/2026".
function ddmmaaaa(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}
export function textoPeriodo({ desde, hasta } = {}) {
  const d = ddmmaaaa(desde);
  const h = ddmmaaaa(hasta);
  if (d && h) return `Periodo: ${d} a ${h}`;
  if (d) return `Periodo: desde ${d}`;
  if (h) return `Periodo: hasta ${h}`;
  return 'Periodo: todas las fechas';
}

// Datos de la gráfica en CSV (separador ";" y BOM UTF-8, igual que la exportación de interacciones).
export function segmentosACsv(segmentos, vista) {
  const total = segmentos.reduce((suma, s) => suma + s.valor, 0);
  const coma = (n) => String(n).replace('.', ',');
  const lineas = [['Vista', 'Segmento', 'Consultas', 'Porcentaje (%)'].join(';')];
  for (const s of segmentos) {
    lineas.push([celdaCsv(tituloVista(vista)), celdaCsv(s.nombre), s.valor, coma(s.porcentaje)].join(';'));
  }
  lineas.push([celdaCsv(tituloVista(vista)), 'Total', total, coma(total ? 100 : 0)].join(';'));
  return `\uFEFF${lineas.join('\r\n')}\r\n`;
}

export function nombreArchivo(vista, extension, fecha = new Date()) {
  return `asistia-${vista === 'estado' ? 'consultas-por-estado' : 'consultas-por-dependencia'}-${fecha.toISOString().slice(0, 10)}.${extension}`;
}

export function escaparXml(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Arcos de la dona (técnica del círculo con trazo discontinuo: circunferencia = 100 unidades).
// Se usa tanto en pantalla como en la imagen descargada.
export function arcosDona(segmentos) {
  const total = segmentos.reduce((suma, s) => suma + s.valor, 0) || 1;
  let acumulado = 0;
  return segmentos.map((s) => {
    const largo = (s.valor / total) * 100;
    const arco = { ...s, largo, desfase: 25 - acumulado };
    acumulado += largo;
    return arco;
  });
}

const FUENTE = 'Arial, Helvetica, sans-serif';

// SVG autónomo (con fondo blanco, título, dona y leyenda) para descargar la gráfica como imagen.
export function svgGraficaDona({ segmentos, vista, subtitulo = '', fecha = new Date() }) {
  const total = segmentos.reduce((suma, s) => suma + s.valor, 0);
  const ancho = 760;
  const alto = Math.max(375, 130 + segmentos.length * 32 + 50);
  const arcos = arcosDona(segmentos)
    .map((a) => `<circle cx="21" cy="21" r="15.9155" fill="none" stroke="${a.color}" stroke-width="6" stroke-dasharray="${a.largo.toFixed(3)} ${(100 - a.largo).toFixed(3)}" stroke-dashoffset="${a.desfase.toFixed(3)}"/>`)
    .join('');
  const leyenda = segmentos
    .map((s, i) => {
      const y = 130 + i * 32;
      const texto = `${s.nombre}: ${s.valor} (${String(s.porcentaje).replace('.', ',')} %)`;
      return `<rect x="300" y="${y - 12}" width="16" height="16" rx="3" fill="${s.color}"/><text x="326" y="${y + 1}" font-size="15" fill="#0f172a">${escaparXml(texto)}</text>`;
    })
    .join('');
  const generado = fecha.toISOString().slice(0, 10);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" font-family="${FUENTE}">`
    + `<rect width="100%" height="100%" fill="#ffffff"/>`
    + `<text x="28" y="42" font-size="22" font-weight="bold" fill="#1f3864">${escaparXml(tituloVista(vista))}</text>`
    + `<text x="28" y="68" font-size="14" fill="#475569">${escaparXml(subtitulo)}</text>`
    + `<svg x="28" y="92" width="240" height="240" viewBox="0 0 42 42">${arcos}`
    + `<text x="21" y="21.6" text-anchor="middle" font-size="6.5" font-weight="bold" fill="#1f3864">${total}</text>`
    + `<text x="21" y="26.5" text-anchor="middle" font-size="2.6" fill="#475569">${total === 1 ? 'consulta' : 'consultas'}</text></svg>`
    + leyenda
    + `<text x="28" y="${alto - 14}" font-size="11" fill="#64748b">AsistIA · TEINCO · Generado el ${generado}</text>`
    + `</svg>`;
  return { svg, ancho, alto };
}

function bajar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

// Convierte el SVG en PNG (con el doble de resolución) y lo descarga. Se resuelve cuando el archivo se entregó.
export function descargarPng(nombre, { svg, ancho, alto }, escala = 2) {
  return new Promise((resolver, rechazar) => {
    const imagen = new Image();
    imagen.onload = () => {
      try {
        const lienzo = document.createElement('canvas');
        lienzo.width = ancho * escala;
        lienzo.height = alto * escala;
        const ctx = lienzo.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, lienzo.width, lienzo.height);
        ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
        lienzo.toBlob((blob) => {
          if (!blob) { rechazar(new Error('No se pudo generar la imagen.')); return; }
          bajar(blob, nombre);
          resolver();
        }, 'image/png');
      } catch (e) {
        rechazar(e);
      }
    };
    imagen.onerror = () => rechazar(new Error('No se pudo generar la imagen.'));
    imagen.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Descarga de las demás gráficas del panel de reportes (barras por dependencia, consultas por día y temas más
// consultados): imagen PNG y datos en CSV, igual que la gráfica de dona.
// ---------------------------------------------------------------------------------------------------------------

export const GRAFICAS_REPORTE = {
  dependencias: { titulo: 'Dependencias a las que se direccionan las consultas', archivo: 'direccionamiento-por-dependencia' },
  serie: { titulo: 'Consultas por día', archivo: 'consultas-por-dia' },
  temas: { titulo: 'Temas más consultados', archivo: 'temas-mas-consultados' },
};

export function nombreArchivoGrafica(clave, extension, fecha = new Date()) {
  const g = GRAFICAS_REPORTE[clave] || GRAFICAS_REPORTE.dependencias;
  return `asistia-${g.archivo}-${fecha.toISOString().slice(0, 10)}.${extension}`;
}

// --- Datos (los mismos que se dibujan en pantalla) ---

export function filasDependencias(resumen) {
  if (!resumen || !resumen.total) return [];
  return (Array.isArray(resumen.por_dependencia) ? resumen.por_dependencia : []).map((f) => ({
    nombre: f.dependencia,
    valor: Number(f.total) || 0,
    porcentaje: porcentajeDe(f.total, resumen.total),
    resueltas: f.resueltas,
    escaladas: f.escaladas,
    tiempo_promedio_ms: f.tiempo_promedio_ms,
  }));
}

export function filasTemas(resumen) {
  if (!resumen || !resumen.total) return [];
  return (Array.isArray(resumen.temas_mas_consultados) ? resumen.temas_mas_consultados : [])
    .map((t) => ({ nombre: t.tema, valor: Number(t.total) || 0 }));
}

export function filasSerie(resumen) {
  if (!resumen || !resumen.total) return [];
  return (Array.isArray(resumen.consultas_por_dia) ? resumen.consultas_por_dia : [])
    .map((d) => ({ dia: d.dia, valor: Number(d.total) || 0, escaladas: Number(d.escaladas) || 0 }));
}

// --- CSV (separador ";" y BOM UTF-8, igual que las demás exportaciones) ---

const numeroCsv = (n) => (n === null || n === undefined || n === '' ? '' : String(n).replace('.', ','));
const unirCsv = (lineas) => `\uFEFF${lineas.join('\r\n')}\r\n`;

export function dependenciasACsv(filas) {
  const lineas = [['Dependencia', 'Consultas', 'Porcentaje (%)', 'Resueltas', 'Escaladas', 'Tiempo promedio (ms)'].join(';')];
  let total = 0;
  let resueltas = 0;
  let escaladas = 0;
  for (const f of filas) {
    total += f.valor;
    resueltas += Number(f.resueltas) || 0;
    escaladas += Number(f.escaladas) || 0;
    lineas.push([celdaCsv(f.nombre), f.valor, numeroCsv(f.porcentaje), numeroCsv(f.resueltas), numeroCsv(f.escaladas), numeroCsv(f.tiempo_promedio_ms)].join(';'));
  }
  lineas.push(['Total', total, numeroCsv(total ? 100 : 0), resueltas, escaladas, ''].join(';'));
  return unirCsv(lineas);
}

export function temasACsv(filas) {
  const lineas = [['Tema', 'Consultas'].join(';')];
  for (const f of filas) lineas.push([celdaCsv(f.nombre), f.valor].join(';'));
  return unirCsv(lineas);
}

export function serieACsv(filas) {
  const lineas = [['Fecha', 'Consultas', 'Escaladas'].join(';')];
  let total = 0;
  let escaladas = 0;
  for (const f of filas) {
    total += f.valor;
    escaladas += f.escaladas;
    lineas.push([celdaCsv(f.dia), f.valor, f.escaladas].join(';'));
  }
  lineas.push(['Total', total, escaladas].join(';'));
  return unirCsv(lineas);
}

// --- Imágenes (SVG autónomo con fondo blanco; se convierte a PNG con descargarPng) ---

function recortar(texto, maximo) {
  const t = String(texto === null || texto === undefined ? '' : texto);
  return t.length > maximo ? `${t.slice(0, maximo - 1)}…` : t;
}

function marcoGrafica({ ancho, alto, titulo, subtitulo, cuerpo, fecha }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" font-family="${FUENTE}">`
    + `<rect width="100%" height="100%" fill="#ffffff"/>`
    + `<text x="28" y="42" font-size="22" font-weight="bold" fill="#1f3864">${escaparXml(titulo)}</text>`
    + `<text x="28" y="68" font-size="14" fill="#475569">${escaparXml(subtitulo)}</text>`
    + cuerpo
    + `<text x="28" y="${alto - 14}" font-size="11" fill="#64748b">AsistIA · TEINCO · Generado el ${fecha.toISOString().slice(0, 10)}</text>`
    + `</svg>`;
}

// Barras horizontales: cada fila trae nombre, valor, valorTexto (texto a la derecha) y, opcionalmente, detalle (línea pequeña).
export function svgGraficaBarras({ titulo, subtitulo = '', filas, fecha = new Date() }) {
  const ancho = 760;
  const maximo = Math.max(...filas.map((f) => f.valor), 1);
  const hayDetalle = filas.some((f) => f.detalle);
  const altoFila = hayDetalle ? 62 : 48;
  const alto = Math.max(240, 100 + filas.length * altoFila + 36);
  const cuerpo = filas.map((f, i) => {
    const y = 110 + i * altoFila;
    const largo = Math.max(2, Math.min(100, (f.valor / maximo) * 100)) / 100 * 704;
    return `<text x="28" y="${y}" font-size="15" fill="#0f172a">${escaparXml(recortar(f.nombre, 60))}</text>`
      + `<text x="732" y="${y}" font-size="15" text-anchor="end" fill="#334155">${escaparXml(f.valorTexto)}</text>`
      + `<rect x="28" y="${y + 10}" width="704" height="10" rx="5" fill="#e8edf6"/>`
      + `<rect x="28" y="${y + 10}" width="${largo.toFixed(2)}" height="10" rx="5" fill="#1f3864"/>`
      + (f.detalle ? `<text x="28" y="${y + 38}" font-size="12" fill="#64748b">${escaparXml(recortar(f.detalle, 110))}</text>` : '');
  }).join('');
  return { svg: marcoGrafica({ ancho, alto, titulo, subtitulo, cuerpo, fecha }), ancho, alto };
}

export function imagenDependencias({ filas, subtitulo = '', fecha = new Date() }) {
  const detalleDe = (f) => `Resueltas: ${f.resueltas ?? 0} · Escaladas: ${f.escaladas ?? 0} · Tiempo promedio: ${formatearDuracion(f.tiempo_promedio_ms)}`;
  return svgGraficaBarras({
    titulo: GRAFICAS_REPORTE.dependencias.titulo,
    subtitulo,
    fecha,
    filas: filas.map((f) => ({ nombre: f.nombre, valor: f.valor, valorTexto: `${f.valor} (${formatearPorcentaje(f.porcentaje)})`, detalle: detalleDe(f) })),
  });
}

export function imagenTemas({ filas, subtitulo = '', fecha = new Date() }) {
  return svgGraficaBarras({
    titulo: GRAFICAS_REPORTE.temas.titulo,
    subtitulo,
    fecha,
    filas: filas.map((f) => ({ nombre: f.nombre, valor: f.valor, valorTexto: String(f.valor) })),
  });
}

// Barras verticales de las consultas por día, con eje de valores, fechas de referencia y resumen en texto.
export function imagenSerie({ filas, subtitulo = '', fecha = new Date() }) {
  const ancho = 760;
  const alto = 410;
  const izquierda = 64;
  const derecha = 732;
  const base = 330;
  const altoGrafica = 210;
  const n = filas.length;
  const maximo = Math.max(...filas.map((f) => f.valor), 1);
  const paso = (derecha - izquierda) / Math.max(n, 1);
  const ticks = [...new Set([0, ...(maximo >= 4 ? [Math.round(maximo / 2)] : []), maximo])];

  const guias = ticks.map((t) => {
    const y = base - (t / maximo) * altoGrafica;
    return `<line x1="${izquierda}" y1="${y.toFixed(2)}" x2="${derecha}" y2="${y.toFixed(2)}" stroke="#e2e8f0" stroke-width="1"/>`
      + `<text x="${izquierda - 8}" y="${(y + 4).toFixed(2)}" font-size="11" text-anchor="end" fill="#64748b">${t}</text>`;
  }).join('');

  const conValores = n <= 31;
  const barras = filas.map((f, i) => {
    const h = (f.valor / maximo) * altoGrafica;
    const x = izquierda + i * paso + paso * 0.12;
    const w = Math.max(1, paso * 0.76);
    return `<rect x="${x.toFixed(2)}" y="${(base - h).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="1.5" fill="#1f3864"/>`
      + (conValores && f.valor > 0 ? `<text x="${(x + w / 2).toFixed(2)}" y="${(base - h - 4).toFixed(2)}" font-size="10" text-anchor="middle" fill="#334155">${f.valor}</text>` : '');
  }).join('');

  const indices = n <= 8
    ? filas.map((_, i) => i)
    : [...new Set([0, 1, 2, 3, 4, 5].map((k) => Math.round((k * (n - 1)) / 5)))];
  const fechas = indices.map((i) => {
    const centro = izquierda + i * paso + paso / 2;
    const ancla = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
    const x = i === 0 ? izquierda : i === n - 1 ? derecha : centro;
    return `<text x="${x.toFixed(2)}" y="${base + 20}" font-size="11" text-anchor="${ancla}" fill="#475569">${escaparXml(formatearDia(filas[i].dia))}</text>`;
  }).join('');

  const diaMax = filas.find((f) => f.valor === maximo) || filas[0];
  const resumen = n > 0
    ? `${n} ${n === 1 ? 'día' : 'días'} con consultas; el máximo fue de ${maximo} el ${formatearDia(diaMax.dia)}.`
    : '';
  const cuerpo = guias + barras
    + `<line x1="${izquierda}" y1="${base}" x2="${derecha}" y2="${base}" stroke="#94a3b8" stroke-width="1"/>`
    + fechas
    + `<text x="28" y="${base + 46}" font-size="12" fill="#475569">${escaparXml(resumen)}</text>`;
  return { svg: marcoGrafica({ ancho, alto, titulo: GRAFICAS_REPORTE.serie.titulo, subtitulo, cuerpo, fecha }), ancho, alto };
}
