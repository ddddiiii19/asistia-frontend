// Gráfica de dona de los reportes (Q7): datos, exportación a CSV y a imagen PNG.
import { celdaCsv, porcentajeDe } from './reportes';

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
