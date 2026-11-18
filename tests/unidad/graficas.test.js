// Q7 — Gráfica de dona: datos, CSV, imagen SVG/PNG. Pruebas nuevas; no modifican las de entregas anteriores.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { segmentosDona, segmentosACsv, svgGraficaDona, arcosDona, textoPeriodo, nombreArchivo, escaparXml, descargarPng } from '@/lib/graficas';

const RESUMEN = {
  total: 100, resueltas: 76, escaladas: 24,
  por_dependencia: [
    { dependencia: 'Admisiones', total: 40 },
    { dependencia: 'Registro y Control', total: 35 },
    { dependencia: 'Bienestar', total: 0 },
    { dependencia: 'Sin identificar', total: 25 },
  ],
};

describe('datos de la dona', () => {
  it('por dependencia omite las que no tienen consultas y calcula porcentajes sobre el total', () => {
    const s = segmentosDona(RESUMEN, 'dependencia');
    expect(s.map((x) => x.nombre)).toEqual(['Admisiones', 'Registro y Control', 'Sin identificar']);
    expect(s.map((x) => x.valor)).toEqual([40, 35, 25]);
    expect(s.map((x) => x.porcentaje)).toEqual([40, 35, 25]);
    expect(s[2].color).toBe('#94a3b8'); // "Sin identificar" en gris
  });

  it('por estado muestra resueltas y escaladas', () => {
    const s = segmentosDona(RESUMEN, 'estado');
    expect(s.map((x) => [x.nombre, x.valor])).toEqual([['Resueltas', 76], ['Escaladas a una persona', 24]]);
  });

  it('sin consultas no hay segmentos', () => {
    expect(segmentosDona({ total: 0, resueltas: 0, escaladas: 0, por_dependencia: [] }, 'dependencia')).toEqual([]);
    expect(segmentosDona(null, 'estado')).toEqual([]);
  });

  it('los arcos suman 100 y cada uno empieza donde termina el anterior', () => {
    const arcos = arcosDona(segmentosDona(RESUMEN, 'dependencia'));
    expect(arcos.reduce((a, x) => a + x.largo, 0)).toBeCloseTo(100, 5);
    expect(arcos[0].desfase).toBe(25);
    expect(arcos[1].desfase).toBeCloseTo(25 - arcos[0].largo, 5);
  });
});

describe('CSV de la gráfica', () => {
  it('usa ; como separador, BOM UTF-8, porcentaje con coma y fila de total', () => {
    const csv = segmentosACsv(segmentosDona(RESUMEN, 'estado'), 'estado');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const lineas = csv.replace('\uFEFF', '').trim().split('\r\n');
    expect(lineas[0]).toBe('Vista;Segmento;Consultas;Porcentaje (%)');
    expect(lineas[1]).toBe('Consultas por estado;Resueltas;76;76');
    expect(lineas[2]).toBe('Consultas por estado;Escaladas a una persona;24;24');
    expect(lineas[3]).toBe('Consultas por estado;Total;100;100');
  });

  it('protege nombres con separador o comillas', () => {
    const csv = segmentosACsv([{ nombre: 'Área; "A"', valor: 1, porcentaje: 33.3, color: '#000' }], 'dependencia');
    expect(csv).toContain('"Área; ""A"""');
    expect(csv).toContain(';1;33,3');
  });
});

describe('imagen de la gráfica', () => {
  it('genera un SVG autónomo con título, periodo, total y leyenda con valores', () => {
    const { svg, ancho, alto } = svgGraficaDona({ segmentos: segmentosDona(RESUMEN, 'dependencia'), vista: 'dependencia', subtitulo: 'Periodo: todas las fechas', fecha: new Date('2026-11-06T10:00:00Z') });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('Consultas por dependencia');
    expect(svg).toContain('Periodo: todas las fechas');
    expect(svg).toContain('Admisiones: 40 (40 %)');
    expect(svg).toContain('Generado el 2026-11-06');
    expect(svg).not.toContain('var(--'); // sin variables CSS: la imagen no depende de la página
    expect(ancho).toBe(760);
    expect(alto).toBeGreaterThanOrEqual(340);
  });

  it('escapa caracteres especiales en los nombres', () => {
    expect(escaparXml('A & B <c> "d"')).toBe('A &amp; B &lt;c&gt; &quot;d&quot;');
    const { svg } = svgGraficaDona({ segmentos: [{ nombre: 'A & B', valor: 1, porcentaje: 100, color: '#111111' }], vista: 'dependencia' });
    expect(svg).toContain('A &amp; B: 1');
    expect(svg).toContain('>consulta<');
  });
});

describe('textos auxiliares', () => {
  it('describe el periodo y nombra los archivos', () => {
    expect(textoPeriodo({})).toBe('Periodo: todas las fechas');
    expect(textoPeriodo({ desde: '2026-10-01', hasta: '2026-10-31' })).toBe('Periodo: 01/10/2026 a 31/10/2026');
    expect(textoPeriodo({ desde: '2026-10-01' })).toBe('Periodo: desde 01/10/2026');
    expect(textoPeriodo({ hasta: '2026-10-31' })).toBe('Periodo: hasta 31/10/2026');
    const f = new Date('2026-11-06T10:00:00Z');
    expect(nombreArchivo('dependencia', 'png', f)).toBe('asistia-consultas-por-dependencia-2026-11-06.png');
    expect(nombreArchivo('estado', 'csv', f)).toBe('asistia-consultas-por-estado-2026-11-06.csv');
  });
});

describe('descarga del PNG', () => {
  const originales = {};
  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.Image = originales.Image;
  });

  function preparar({ falla = false, blobNulo = false } = {}) {
    originales.Image = globalThis.Image;
    globalThis.Image = class {
      set src(v) { this._src = v; setTimeout(() => (falla ? this.onerror() : this.onload()), 0); }
      get src() { return this._src; }
    };
    const dibujos = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect: vi.fn(), drawImage: (...a) => dibujos.push(a), set fillStyle(v) {} });
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(blobNulo ? null : new Blob(['png'], { type: 'image/png' })));
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const clics = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function clic() { clics.push(this.download); });
    return { dibujos, clics };
  }

  it('dibuja la imagen en un lienzo al doble de tamaño y descarga el archivo', async () => {
    const { dibujos, clics } = preparar();
    await descargarPng('grafica.png', { svg: '<svg/>', ancho: 760, alto: 340 });
    expect(dibujos).toHaveLength(1);
    expect(dibujos[0][3]).toBe(1520);
    expect(dibujos[0][4]).toBe(680);
    expect(clics).toEqual(['grafica.png']);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('rechaza si la imagen no carga o el lienzo no entrega el archivo', async () => {
    preparar({ falla: true });
    await expect(descargarPng('a.png', { svg: '<svg/>', ancho: 10, alto: 10 })).rejects.toThrow();
    vi.restoreAllMocks();
    preparar({ blobNulo: true });
    await expect(descargarPng('a.png', { svg: '<svg/>', ancho: 10, alto: 10 })).rejects.toThrow();
  });
});
