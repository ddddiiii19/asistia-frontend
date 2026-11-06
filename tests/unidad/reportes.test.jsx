import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const replace = vi.fn();
const router = { replace, push: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/admin/reportes' }));

vi.mock('@/lib/api', async (original) => {
  const real = await original();
  return { ...real, api: { reporteResumen: vi.fn(), reporteInteracciones: vi.fn(), dependencias: vi.fn() } };
});

import { api, ApiError, crearCliente } from '@/lib/api';
import { AuthProvider } from '@/components/AuthProvider';
import { PanelReportes } from '@/components/reportes/PanelReportes';
import { guardarSesion } from '@/lib/sesion';
import {
  celdaCsv, formatearDia, formatearDuracion, formatearPorcentaje, interaccionesACsv, porcentajeDe, textoMotivo, validarFiltros,
} from '@/lib/reportes';

const RESUMEN = {
  total: 240, resueltas: 190, escaladas: 50, tasa_resolucion: 79.2, tiempo_promedio_ms: 3387,
  por_dependencia: [
    { id_dependencia: 2, dependencia: 'Registro y Control', total: 90, resueltas: 80, escaladas: 10, tiempo_promedio_ms: 3555 },
    { id_dependencia: null, dependencia: 'Sin identificar', total: 12, resueltas: 0, escaladas: 12, tiempo_promedio_ms: 3783 },
  ],
  temas_mas_consultados: [{ tema: 'certificado de notas', total: 33 }],
  preguntas_mas_frecuentes: [{ pregunta: '¿Cómo solicito un certificado de notas?', total: 33, dependencia: 'Registro y Control' }],
  faq_mas_consultadas: [],
  consultas_por_dia: [{ dia: '2026-10-20', total: 10, escaladas: 2 }, { dia: '2026-10-21', total: 14, escaladas: 3 }],
};
const FILA = (n, extra = {}) => ({
  id_consulta: n, id_conversacion: n, fecha: '2026-10-21T10:00:00', consulta: `Consulta ${n}`, dependencia: 'Registro y Control',
  clasificacion: 'tema', tiempo_respuesta_ms: 2500, estado: 'resuelta', motivo_escalamiento: null, ...extra,
});

const admin = (alcance = 'global') => guardarSesion({
  token: 't', cuenta: { tipo: 'administrador', alcance_admin: alcance, id_dependencia: alcance === 'dependencia' ? 2 : null, nombre_usuario: 'admin' },
});
const montar = () => render(<AuthProvider><PanelReportes /></AuthProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  api.dependencias.mockResolvedValue([{ id_dependencia: 1, nombre: 'Admisiones' }, { id_dependencia: 2, nombre: 'Registro y Control' }]);
  api.reporteResumen.mockResolvedValue(RESUMEN);
  api.reporteInteracciones.mockResolvedValue([FILA(1), FILA(2, { estado: 'escalada', dependencia: null, motivo_escalamiento: 'dependencia_no_identificada' })]);
});

describe('utilidades de reportes', () => {
  it('formatea duración, porcentaje y días sin desplazarlos por zona horaria', () => {
    expect(formatearDuracion(3387)).toBe('3,4 s');
    expect(formatearDuracion(850)).toBe('850 ms');
    expect(formatearDuracion(null)).toBe('—');
    expect(formatearPorcentaje(62.9)).toBe('62,9 %');
    expect(formatearPorcentaje(null)).toBe('—');
    expect(porcentajeDe(1, 3)).toBe(33.3);
    expect(porcentajeDe(1, 0)).toBe(0);
    expect(formatearDia('2026-10-22')).toBe('22 oct');
    expect(textoMotivo('dependencia_no_identificada')).toBe('No se identificó la dependencia');
  });

  it('valida el periodo', () => {
    expect(validarFiltros({ desde: '', hasta: '' })).toBe('');
    expect(validarFiltros({ desde: '2026-02-01', hasta: '2026-01-01' })).toMatch(/posterior/);
    expect(validarFiltros({ desde: 'ayer', hasta: '' })).toMatch(/no es válida/);
  });

  it('el CSV neutraliza fórmulas, escapa comillas y separadores y usa BOM', () => {
    expect(celdaCsv('=1+1')).toBe("'=1+1");
    expect(celdaCsv('@usuario')).toBe("'@usuario");
    // También con espacios (normales o duros) o tabulación antes del carácter de fórmula
    expect(celdaCsv(' =1+1')).toBe("' =1+1");
    expect(celdaCsv('   @cmd')).toBe("'   @cmd");
    expect(celdaCsv('\u00a0+SUMA(A1)')).toBe("'\u00a0+SUMA(A1)");
    expect(celdaCsv('\t=1')).toBe("'\t=1");
    // El texto normal no se altera, aunque contenga esos caracteres en otra posición
    expect(celdaCsv('precio = 5 - 2')).toBe('precio = 5 - 2');
    expect(celdaCsv('Cómo solicito un certificado')).toBe('Cómo solicito un certificado');
    expect(celdaCsv('a;b')).toBe('"a;b"');
    expect(celdaCsv('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(celdaCsv('dijo ";hola"')).toBe('"dijo "";hola"""');
    expect(celdaCsv(null)).toBe('');
    const csv = interaccionesACsv([FILA(1, { consulta: '=cmd', dependencia: null })]);
    expect(csv.startsWith('\uFEFFFecha;Consulta')).toBe(true);
    expect(csv).toContain("'=cmd;Sin identificar");
  });
});

describe('cliente de API de reportes', () => {
  it('envía los filtros y omite los vacíos', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    const c = crearCliente({ baseUrl: 'http://api', obtenerToken: () => 'tok', fetchImpl });
    await c.reporteResumen({ dependencia: '2', desde: '2026-10-01', hasta: '' });
    expect(fetchImpl.mock.calls[0][0]).toBe('http://api/api/admin/reportes/resumen?dependencia=2&desde=2026-10-01');
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
    await c.reporteInteracciones({ limite: 16, desplazamiento: 0 });
    expect(fetchImpl.mock.calls[1][0]).toBe('http://api/api/admin/reportes/interacciones?limite=16&desplazamiento=0');
    await c.reporteResumen();
    expect(fetchImpl.mock.calls[2][0]).toBe('http://api/api/admin/reportes/resumen');
  });
});

describe('panel de reportes', () => {
  it('el administrador global ve indicadores, rankings y puede filtrar por dependencia', async () => {
    admin('global');
    montar();
    const indicadores = await screen.findByRole('region', { name: 'Indicadores principales' });
    expect(within(indicadores).getByText('240')).toBeInTheDocument();
    expect(within(indicadores).getByText('190')).toBeInTheDocument();
    expect(within(indicadores).getByText('3,4 s')).toBeInTheDocument();
    expect(within(indicadores).getByText('79,2 % del total · sin escalamiento a una persona')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Preguntas más frecuentes' })).toBeInTheDocument();
    expect(screen.getByText('¿Cómo solicito un certificado de notas?')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Consultas por día\. 2 días con consultas; el máximo fue de 14 el 21 oct/ })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Admisiones' })).toBeInTheDocument();
    expect(api.reporteResumen).toHaveBeenCalledWith({ dependencia: '', desde: '', hasta: '' });
  });

  it('el administrador de dependencia no ve el filtro por dependencia ni pide la lista', async () => {
    admin('dependencia');
    montar();
    await screen.findByRole('region', { name: 'Indicadores principales' });
    expect(screen.queryByLabelText('Dependencia')).toBeNull();
    expect(api.dependencias).not.toHaveBeenCalled();
    expect(screen.getByText(/solo consulta/)).toBeInTheDocument();
  });

  it('un periodo inválido se avisa y no consulta la API; uno válido sí', async () => {
    admin('global');
    montar();
    await screen.findByRole('region', { name: 'Indicadores principales' });
    api.reporteResumen.mockClear();
    await userEvent.type(screen.getByLabelText('Desde'), '2026-10-20');
    await userEvent.type(screen.getByLabelText('Hasta'), '2026-10-01');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('posterior');
    expect(api.reporteResumen).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText('Hasta'));
    await userEvent.type(screen.getByLabelText('Hasta'), '2026-10-25');
    await userEvent.selectOptions(screen.getByLabelText('Dependencia'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    await waitFor(() => expect(api.reporteResumen).toHaveBeenCalledWith({ dependencia: '2', desde: '2026-10-20', hasta: '2026-10-25' }));
  });

  it('al cambiar los filtros conserva los datos anteriores (marcados como actualizando) hasta que llegan los nuevos', async () => {
    admin('global');
    montar();
    await screen.findByRole('region', { name: 'Indicadores principales' });
    let resolver;
    api.reporteResumen.mockReturnValueOnce(new Promise((r) => { resolver = r; }));
    await userEvent.selectOptions(await screen.findByLabelText('Dependencia'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(await screen.findByText('Actualizando reporte…')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Indicadores principales' })).toBeInTheDocument(); // no desaparece
    resolver({ ...RESUMEN, total: 9, resueltas: 8, escaladas: 1, tasa_resolucion: 88.9 });
    await waitFor(() => expect(screen.queryByText('Actualizando reporte…')).toBeNull());
    expect(within(screen.getByRole('region', { name: 'Indicadores principales' })).getByText('9')).toBeInTheDocument();
  });

  it('avisa que la gráfica muestra solo los 90 días más recientes cuando se alcanza ese límite', async () => {
    admin('global');
    const noventa = Array.from({ length: 90 }, (_, i) => ({ dia: `2026-07-${String((i % 28) + 1).padStart(2, '0')}`, total: i + 1, escaladas: 0 }));
    api.reporteResumen.mockResolvedValue({ ...RESUMEN, consultas_por_dia: noventa });
    const { unmount } = montar();
    expect(await screen.findByText('Se muestran los 90 días más recientes del periodo.')).toBeInTheDocument();
    unmount();
    api.reporteResumen.mockResolvedValue(RESUMEN); // 2 días: sin aviso
    montar();
    await screen.findByRole('region', { name: 'Indicadores principales' });
    expect(screen.queryByText(/90 días más recientes/)).toBeNull();
  });

  it('indica en pantallas pequeñas que la tabla se desplaza horizontalmente', async () => {
    admin('global');
    montar();
    await screen.findByRole('table', { name: /Interacciones registradas/ });
    expect(screen.getByText('Desliza la tabla hacia los lados para ver todas las columnas.')).toBeInTheDocument();
  });

  it('sin consultas muestra un estado vacío en lugar de ceros y gráficas vacías', async () => {
    admin('global');
    api.reporteResumen.mockResolvedValue({ ...RESUMEN, total: 0, resueltas: 0, escaladas: 0, tasa_resolucion: null, tiempo_promedio_ms: null, por_dependencia: [], temas_mas_consultados: [], preguntas_mas_frecuentes: [], consultas_por_dia: [] });
    montar();
    expect(await screen.findByText(/No hay consultas registradas para los filtros/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Indicadores principales' })).toBeNull();
  });

  it('ante un error muestra el aviso y permite reintentar', async () => {
    admin('global');
    api.reporteResumen.mockRejectedValueOnce(new ApiError(0, 'sin_conexion', 'x'));
    montar();
    expect(await screen.findByText(/No fue posible conectar/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('region', { name: 'Indicadores principales' })).toBeInTheDocument();
  });

  it('un 401 no muestra error en pantalla (la sesión inválida la gestiona el AuthProvider)', async () => {
    admin('global');
    api.reporteResumen.mockRejectedValue(new ApiError(401, 'sesion_revocada', 'x'));
    api.reporteInteracciones.mockRejectedValue(new ApiError(401, 'sesion_revocada', 'x'));
    montar();
    await waitFor(() => expect(api.reporteResumen).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('la tabla distingue resueltas de escaladas con texto y muestra el motivo', async () => {
    admin('global');
    montar();
    const tabla = await screen.findByRole('table', { name: /Interacciones registradas/ });
    expect(within(tabla).getByText('Resuelta')).toBeInTheDocument();
    expect(within(tabla).getByText('Escalada')).toBeInTheDocument();
    expect(within(tabla).getByText('No se identificó la dependencia')).toBeInTheDocument();
    expect(within(tabla).getByText('Sin identificar')).toBeInTheDocument();
  });

  it('cada fila enlaza con su conversación en el historial administrativo', async () => {
    admin('global');
    montar();
    // Se busca dentro de la tabla: consultar por nombre accesible en toda la página es lento en jsdom.
    const tabla = await screen.findByRole('table', { name: /Interacciones registradas/ });
    const enlace = within(tabla).getByRole('link', { name: /Ver la conversación de la consulta 1/ });
    expect(enlace).toHaveAttribute('href', '/admin/historial/1');
  });

  it('pagina pidiendo una fila de más para saber si hay página siguiente', async () => {
    admin('global');
    const quince = Array.from({ length: 16 }, (_, i) => FILA(i + 1)); // 16 = hay otra página
    api.reporteInteracciones.mockResolvedValueOnce(quince).mockResolvedValue([FILA(99)]);
    montar();
    await screen.findByRole('table');
    expect(api.reporteInteracciones).toHaveBeenCalledWith({ dependencia: '', desde: '', hasta: '', limite: 16, desplazamiento: 0 });
    expect(screen.getAllByRole('row')).toHaveLength(16); // 15 filas + encabezado
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(api.reporteInteracciones).toHaveBeenCalledWith({ dependencia: '', desde: '', hasta: '', limite: 16, desplazamiento: 15 }));
    expect(await screen.findByText('Página 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });

  it('exporta a CSV con los filtros aplicados, pidiendo hasta 500 registros', async () => {
    admin('global');
    const crear = vi.fn(() => 'blob:x');
    URL.createObjectURL = crear;
    URL.revokeObjectURL = vi.fn();
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    montar();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }));
    await waitFor(() => expect(crear).toHaveBeenCalled());
    expect(api.reporteInteracciones).toHaveBeenLastCalledWith({ dependencia: '', desde: '', hasta: '', limite: 500, desplazamiento: 0 });
    expect(clic).toHaveBeenCalled();
    clic.mockRestore();
  });
});
