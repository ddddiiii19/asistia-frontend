// Q7 — Componente de la gráfica de dona en el panel de reportes.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/graficas', async (original) => ({ ...(await original()), descargarPng: vi.fn() }));
vi.mock('@/lib/reportes', async (original) => ({ ...(await original()), descargarCsv: vi.fn() }));

import { descargarPng } from '@/lib/graficas';
import { descargarCsv } from '@/lib/reportes';
import { GraficaDona } from '@/components/reportes/GraficaDona';

const RESUMEN = {
  total: 240, resueltas: 190, escaladas: 50,
  por_dependencia: [
    { dependencia: 'Admisiones', total: 120 },
    { dependencia: 'Registro y Control', total: 90 },
    { dependencia: 'Sin identificar', total: 30 },
  ],
};

beforeEach(() => { vi.clearAllMocks(); descargarPng.mockResolvedValue(undefined); });

describe('gráfica de dona', () => {
  it('muestra por defecto la vista por dependencia con la leyenda en texto', () => {
    render(<GraficaDona resumen={RESUMEN} filtros={{}} />);
    const grafica = screen.getByRole('img');
    expect(grafica).toHaveAttribute('aria-label', expect.stringContaining('Admisiones 120'));
    expect(screen.getByText('Admisiones')).toBeInTheDocument();
    expect(screen.getByText('120 (50 %)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Por dependencia' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('cambia a la vista por estado', async () => {
    render(<GraficaDona resumen={RESUMEN} filtros={{}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Por estado' }));
    expect(screen.getByRole('button', { name: 'Por estado' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Resueltas')).toBeInTheDocument();
    expect(screen.getByText('Escaladas a una persona')).toBeInTheDocument();
    expect(screen.queryByText('Admisiones')).toBeNull();
    expect(screen.getByText('190 (79,2 %)')).toBeInTheDocument();
  });

  it('descarga los datos en CSV con el nombre y contenido de la vista activa', async () => {
    render(<GraficaDona resumen={RESUMEN} filtros={{}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Descargar datos (CSV)' }));
    expect(descargarCsv).toHaveBeenCalledTimes(1);
    const [nombre, contenido] = descargarCsv.mock.calls[0];
    expect(nombre).toMatch(/^asistia-consultas-por-dependencia-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(contenido).toContain('Registro y Control;90;37,5');
    expect(contenido).toContain('Total;240;100');
  });

  it('descarga la gráfica como PNG incluyendo el periodo en la imagen', async () => {
    render(<GraficaDona resumen={RESUMEN} filtros={{ desde: '2026-10-01', hasta: '2026-10-31' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Descargar gráfica (PNG)' }));
    expect(descargarPng).toHaveBeenCalledTimes(1);
    const [nombre, imagen] = descargarPng.mock.calls[0];
    expect(nombre).toMatch(/\.png$/);
    expect(imagen.svg).toContain('Periodo: 01/10/2026 a 31/10/2026');
    expect(imagen.svg).toContain('Admisiones: 120 (50 %)');
  });

  it('si no se puede generar la imagen avisa sin romper la pantalla', async () => {
    descargarPng.mockRejectedValue(new Error('x'));
    render(<GraficaDona resumen={RESUMEN} filtros={{}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Descargar gráfica (PNG)' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No fue posible generar la imagen');
    expect(screen.getByRole('button', { name: 'Descargar gráfica (PNG)' })).toBeEnabled();
  });

  it('sin consultas deshabilita las descargas', () => {
    render(<GraficaDona resumen={{ total: 0, resueltas: 0, escaladas: 0, por_dependencia: [] }} filtros={{}} />);
    expect(screen.getByRole('button', { name: 'Descargar gráfica (PNG)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descargar datos (CSV)' })).toBeDisabled();
  });
});
