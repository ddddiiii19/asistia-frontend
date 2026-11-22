// Ajuste final — Descarga (PNG y CSV) de las gráficas de barras por dependencia, consultas por día y temas.
// Pruebas nuevas: no modifican las de entregas anteriores.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const router = { replace: vi.fn(), push: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/admin/reportes' }));
vi.mock('@/lib/api', async (original) => {
  const real = await original();
  return { ...real, api: { reporteResumen: vi.fn(), reporteInteracciones: vi.fn(), dependencias: vi.fn() } };
});
vi.mock('@/lib/graficas', async (original) => ({ ...(await original()), descargarPng: vi.fn() }));
vi.mock('@/lib/reportes', async (original) => ({ ...(await original()), descargarCsv: vi.fn() }));

import { api } from '@/lib/api';
import { AuthProvider } from '@/components/AuthProvider';
import { PanelReportes } from '@/components/reportes/PanelReportes';
import { guardarSesion } from '@/lib/sesion';
import { descargarCsv } from '@/lib/reportes';
import {
  descargarPng, dependenciasACsv, filasDependencias, filasSerie, filasTemas, imagenDependencias, imagenSerie, imagenTemas,
  nombreArchivoGrafica, serieACsv, temasACsv,
} from '@/lib/graficas';

const RESUMEN = {
  total: 240, resueltas: 190, escaladas: 50, tasa_resolucion: 79.2, tiempo_promedio_ms: 3387, tiempo_p95_ms: 7100,
  por_dependencia: [
    { id_dependencia: 2, dependencia: 'Registro y Control', total: 90, resueltas: 80, escaladas: 10, tiempo_promedio_ms: 3555 },
    { id_dependencia: 1, dependencia: 'Admisiones', total: 120, resueltas: 100, escaladas: 20, tiempo_promedio_ms: 3200.5 },
    { id_dependencia: null, dependencia: 'Sin identificar', total: 30, resueltas: 0, escaladas: 30, tiempo_promedio_ms: null },
  ],
  temas_mas_consultados: [{ tema: 'certificado de notas', total: 33 }, { tema: '=HYPERLINK("x")', total: 5 }, { tema: 'Tom & <Jerry>', total: 2 }],
  preguntas_mas_frecuentes: [], faq_mas_consultadas: [],
  consultas_por_dia: [{ dia: '2026-10-20', total: 10, escaladas: 2 }, { dia: '2026-10-21', total: 14, escaladas: 3 }],
};

function svgValido(svg) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return doc.getElementsByTagName('parsererror').length === 0;
}

describe('datos y archivos de las gráficas', () => {
  it('nombres de archivo distintos por gráfica y con la fecha', () => {
    const f = new Date('2026-11-20T12:00:00Z');
    expect(nombreArchivoGrafica('dependencias', 'png', f)).toBe('asistia-direccionamiento-por-dependencia-2026-11-20.png');
    expect(nombreArchivoGrafica('serie', 'csv', f)).toBe('asistia-consultas-por-dia-2026-11-20.csv');
    expect(nombreArchivoGrafica('temas', 'png', f)).toBe('asistia-temas-mas-consultados-2026-11-20.png');
  });

  it('sin consultas no hay filas', () => {
    const vacio = { total: 0, por_dependencia: [], temas_mas_consultados: [], consultas_por_dia: [] };
    expect(filasDependencias(vacio)).toEqual([]);
    expect(filasTemas(vacio)).toEqual([]);
    expect(filasSerie(vacio)).toEqual([]);
    expect(filasSerie(null)).toEqual([]);
  });

  it('CSV de dependencias: porcentajes con coma, totales y celdas vacías si no hay dato', () => {
    const csv = dependenciasACsv(filasDependencias(RESUMEN));
    expect(csv.startsWith('\uFEFFDependencia;Consultas;Porcentaje (%);Resueltas;Escaladas;Tiempo promedio (ms)\r\n')).toBe(true);
    expect(csv).toContain('Admisiones;120;50;100;20;3200,5');
    expect(csv).toContain('Registro y Control;90;37,5;80;10;3555');
    expect(csv).toContain('Sin identificar;30;12,5;0;30;\r\n');
    expect(csv).toContain('Total;240;100;180;60;\r\n');
  });

  it('CSV de temas neutraliza fórmulas y de la serie incluye totales', () => {
    const temas = temasACsv(filasTemas(RESUMEN));
    expect(temas).toContain('certificado de notas;33');
    expect(temas).toContain("'=HYPERLINK(\"\"x\"\")") ;
    expect(temas).not.toMatch(/;=HYPERLINK|^=HYPERLINK/m);
    const serie = serieACsv(filasSerie(RESUMEN));
    expect(serie).toContain('Fecha;Consultas;Escaladas');
    expect(serie).toContain('2026-10-21;14;3');
    expect(serie).toContain('Total;24;5');
  });

  it('las imágenes son SVG válidos con título, periodo, valores y texto escapado', () => {
    const sub = 'Periodo: todas las fechas';
    const deps = imagenDependencias({ filas: filasDependencias(RESUMEN), subtitulo: sub });
    expect(svgValido(deps.svg)).toBe(true);
    expect(deps.svg).toContain('Dependencias a las que se direccionan las consultas');
    expect(deps.svg).toContain(sub);
    expect(deps.svg).toContain('Admisiones');
    expect(deps.svg).toContain('120 (50 %)');
    expect(deps.svg).toContain('Resueltas: 100 · Escaladas: 20 · Tiempo promedio: 3,2 s');
    expect(deps.ancho).toBe(760);

    const temas = imagenTemas({ filas: filasTemas(RESUMEN), subtitulo: sub });
    expect(svgValido(temas.svg)).toBe(true);
    expect(temas.svg).toContain('Tom &amp; &lt;Jerry&gt;');
    expect(temas.svg).not.toContain('Tom & <Jerry>');

    const serie = imagenSerie({ filas: filasSerie(RESUMEN), subtitulo: sub });
    expect(svgValido(serie.svg)).toBe(true);
    expect(serie.svg).toContain('Consultas por día');
    expect(serie.svg).toContain('2 días con consultas; el máximo fue de 14 el 21 oct.');
  });

  it('la serie soporta un solo día y 90 días sin romperse', () => {
    const uno = imagenSerie({ filas: [{ dia: '2026-10-20', valor: 3, escaladas: 0 }] });
    expect(svgValido(uno.svg)).toBe(true);
    expect(uno.svg).toContain('1 día con consultas');
    const muchos = Array.from({ length: 90 }, (_, i) => ({ dia: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`, valor: (i % 7) + 1, escaladas: 0 }));
    const img = imagenSerie({ filas: muchos });
    expect(svgValido(img.svg)).toBe(true);
    expect(img.svg).not.toMatch(/NaN|undefined/);
  });

  it('un nombre muy largo se recorta para no salirse de la imagen', () => {
    const largo = 'x'.repeat(200);
    const img = imagenTemas({ filas: [{ nombre: largo, valor: 1 }] });
    expect(img.svg).not.toContain(largo);
    expect(img.svg).toContain('…');
  });
});

describe('botones de descarga en el panel de reportes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    descargarPng.mockResolvedValue(undefined);
    api.dependencias.mockResolvedValue([]);
    api.reporteResumen.mockResolvedValue(RESUMEN);
    api.reporteInteracciones.mockResolvedValue([]);
    guardarSesion({ token: 't', cuenta: { tipo: 'administrador', alcance_admin: 'global', id_dependencia: null, nombre_usuario: 'admin' } });
  });
  const montar = () => render(<AuthProvider><PanelReportes /></AuthProvider>);

  it('cada gráfica tiene sus dos botones y los de la dona siguen intactos', async () => {
    montar();
    await screen.findByText('Distribución de las consultas');
    expect(screen.getByRole('button', { name: 'Descargar gráfica (PNG)' })).toBeInTheDocument(); // dona
    for (const sufijo of ['de dependencias a las que se direccionan las consultas', 'de consultas por día', 'de temas más consultados']) {
      expect(screen.getByRole('button', { name: `Descargar gráfica (PNG) ${sufijo}` })).toBeEnabled();
      expect(screen.getByRole('button', { name: `Descargar datos (CSV) ${sufijo}` })).toBeEnabled();
    }
  });

  it('descarga la imagen y el CSV de cada gráfica con su nombre de archivo', async () => {
    montar();
    await screen.findByText('Distribución de las consultas');
    await userEvent.click(screen.getByRole('button', { name: 'Descargar gráfica (PNG) de dependencias a las que se direccionan las consultas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Descargar gráfica (PNG) de consultas por día' }));
    await userEvent.click(screen.getByRole('button', { name: 'Descargar gráfica (PNG) de temas más consultados' }));
    expect(descargarPng).toHaveBeenCalledTimes(3);
    expect(descargarPng.mock.calls.map((c) => c[0])).toEqual([
      expect.stringMatching(/^asistia-direccionamiento-por-dependencia-\d{4}-\d{2}-\d{2}\.png$/),
      expect.stringMatching(/^asistia-consultas-por-dia-\d{4}-\d{2}-\d{2}\.png$/),
      expect.stringMatching(/^asistia-temas-mas-consultados-\d{4}-\d{2}-\d{2}\.png$/),
    ]);
    expect(descargarPng.mock.calls[0][1].svg).toContain('Admisiones');
    expect(descargarPng.mock.calls[1][1].svg).toContain('Consultas por día');
    expect(descargarPng.mock.calls[2][1].svg).toContain('certificado de notas');

    await userEvent.click(screen.getByRole('button', { name: 'Descargar datos (CSV) de dependencias a las que se direccionan las consultas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Descargar datos (CSV) de consultas por día' }));
    await userEvent.click(screen.getByRole('button', { name: 'Descargar datos (CSV) de temas más consultados' }));
    expect(descargarCsv).toHaveBeenCalledTimes(3);
    expect(descargarCsv.mock.calls[0][1]).toContain('Admisiones;120;50');
    expect(descargarCsv.mock.calls[1][1]).toContain('2026-10-20;10;2');
    expect(descargarCsv.mock.calls[2][1]).toContain('certificado de notas;33');
  });

  it('el periodo filtrado aparece en la imagen', async () => {
    montar();
    await screen.findByText('Distribución de las consultas');
    await userEvent.click(screen.getByRole('button', { name: 'Descargar gráfica (PNG) de consultas por día' }));
    expect(descargarPng.mock.calls[0][1].svg).toContain('Periodo: todas las fechas');
  });

  it('si falla la generación de la imagen avisa y el botón vuelve a estar disponible', async () => {
    descargarPng.mockRejectedValue(new Error('x'));
    montar();
    await screen.findByText('Distribución de las consultas');
    const boton = screen.getByRole('button', { name: 'Descargar gráfica (PNG) de temas más consultados' });
    await userEvent.click(boton);
    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible generar la imagen');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Descargar gráfica (PNG) de temas más consultados' })).toBeEnabled());
  });

  it('sin consultas no se muestran las gráficas ni sus botones', async () => {
    api.reporteResumen.mockResolvedValue({ ...RESUMEN, total: 0, por_dependencia: [], temas_mas_consultados: [], consultas_por_dia: [] });
    montar();
    await screen.findByText(/No hay consultas registradas/);
    expect(screen.queryByRole('button', { name: /Descargar gráfica \(PNG\) de/ })).toBeNull();
  });
});
