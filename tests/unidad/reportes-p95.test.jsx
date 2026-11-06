// Q7 — Indicador de tiempo de respuesta p95 en el panel de reportes (prueba nueva; no modifica las pruebas de Q6).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

const router = { replace: vi.fn(), push: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/admin/reportes' }));

vi.mock('@/lib/api', async (original) => {
  const real = await original();
  return { ...real, api: { reporteResumen: vi.fn(), reporteInteracciones: vi.fn(), dependencias: vi.fn() } };
});

import { api } from '@/lib/api';
import { AuthProvider } from '@/components/AuthProvider';
import { PanelReportes } from '@/components/reportes/PanelReportes';
import { guardarSesion } from '@/lib/sesion';

const RESUMEN = {
  total: 240, resueltas: 190, escaladas: 50, tasa_resolucion: 79.2,
  tiempo_promedio_ms: 3387, tiempo_p95_ms: 8120,
  por_dependencia: [], temas_mas_consultados: [], preguntas_mas_frecuentes: [], faq_mas_consultadas: [],
  consultas_por_dia: [{ dia: '2026-10-21', total: 14, escaladas: 3 }],
};

const montar = () => render(<AuthProvider><PanelReportes /></AuthProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  guardarSesion({ token: 't', cuenta: { tipo: 'administrador', alcance_admin: 'global', id_dependencia: null, nombre_usuario: 'admin' } });
  api.dependencias.mockResolvedValue([]);
  api.reporteInteracciones.mockResolvedValue([]);
});

describe('indicador p95 del panel de reportes', () => {
  it('muestra el promedio y el p95 que entrega el backend, en formato legible', async () => {
    api.reporteResumen.mockResolvedValue(RESUMEN);
    montar();
    const ind = await screen.findByRole('region', { name: 'Indicadores principales' });
    expect(within(ind).getByText('Tiempo promedio de respuesta')).toBeInTheDocument();
    expect(within(ind).getByText('3,4 s')).toBeInTheDocument();
    expect(within(ind).getByText('Tiempo de respuesta p95')).toBeInTheDocument();
    expect(within(ind).getByText('8,1 s')).toBeInTheDocument();
  });

  it('muestra milisegundos cuando el p95 es menor a un segundo', async () => {
    api.reporteResumen.mockResolvedValue({ ...RESUMEN, tiempo_promedio_ms: 400, tiempo_p95_ms: 850 });
    montar();
    const ind = await screen.findByRole('region', { name: 'Indicadores principales' });
    expect(within(ind).getByText('850 ms')).toBeInTheDocument();
  });

  it('si el p95 es null o no viene en la respuesta muestra un guion y no genera errores', async () => {
    api.reporteResumen.mockResolvedValue({ ...RESUMEN, tiempo_p95_ms: null });
    const { unmount } = montar();
    let ind = await screen.findByRole('region', { name: 'Indicadores principales' });
    expect(within(ind).getByText('Tiempo de respuesta p95')).toBeInTheDocument();
    expect(within(ind).getByText('—')).toBeInTheDocument();
    unmount();

    const { tiempo_p95_ms, ...sinP95 } = RESUMEN;
    api.reporteResumen.mockResolvedValue(sinP95);
    montar();
    ind = await screen.findByRole('region', { name: 'Indicadores principales' });
    expect(within(ind).getByText('—')).toBeInTheDocument();
  });
});
