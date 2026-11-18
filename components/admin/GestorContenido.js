'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import { mensajeError } from '@/lib/errores';
import { formatearFecha } from '@/lib/fechas';
import { Alerta, Boton, Campo, CampoTexto, Selector } from '@/components/ui';
import { EncabezadoModulo } from '@/components/EncabezadoModulo';

// Los dos módulos de contenido del asistente comparten pantalla; solo cambian textos, campos y llamadas al API.
const CONFIG = {
  informacion: {
    modulo: 'informacion',
    idTitulo: 'titulo-informacion',
    titulo: 'Información institucional',
    descripcion: 'Textos institucionales por dependencia. El asistente responde con base en este contenido.',
    nuevo: 'Nueva información',
    campoTitulo: 'titulo',
    etiquetaTitulo: 'Título',
    errorTitulo: 'Ingresa un título.',
    errorTexto: 'Ingresa el contenido.',
    maxTitulo: 150,
    campoTexto: 'contenido',
    etiquetaTexto: 'Contenido',
    vacio: 'No hay información registrada.',
    guardado: 'Información guardada.',
    eliminado: 'Información eliminada.',
    listar: (f) => api.adminInformacion(f),
    crear: (d) => api.crearInformacion(d),
    editar: (id, d) => api.editarInformacion(id, d),
    eliminar: (id) => api.eliminarInformacion(id),
    idFila: (f) => f.id_info,
    meta: (f) => `Actualizado: ${formatearFecha(f.fecha_actualizacion)}`,
  },
  faq: {
    modulo: 'faq',
    idTitulo: 'titulo-faq',
    titulo: 'Preguntas frecuentes',
    descripcion: 'Preguntas y respuestas por dependencia que el asistente ofrece a los usuarios.',
    nuevo: 'Nueva pregunta',
    campoTitulo: 'pregunta',
    etiquetaTitulo: 'Pregunta',
    errorTitulo: 'Ingresa la pregunta.',
    errorTexto: 'Ingresa la respuesta.',
    maxTitulo: 255,
    campoTexto: 'respuesta',
    etiquetaTexto: 'Respuesta',
    vacio: 'No hay preguntas frecuentes registradas.',
    guardado: 'Pregunta frecuente guardada.',
    eliminado: 'Pregunta frecuente eliminada.',
    listar: (f) => api.adminFaq(f),
    crear: (d) => api.crearFaq(d),
    editar: (id, d) => api.editarFaq(id, d),
    eliminar: (id) => api.eliminarFaq(id),
    idFila: (f) => f.id_faq,
    meta: (f) => `Abierta ${f.frecuencia} ${f.frecuencia === 1 ? 'vez' : 'veces'}`,
  },
};

const FORMULARIO_VACIO = { id: null, dependencia: '', titulo: '', texto: '' };

export function GestorContenido({ tipo }) {
  const cfg = CONFIG[tipo];
  const { cuenta } = useAuth();
  const esGlobal = cuenta ? cuenta.alcance_admin === 'global' : false;
  // Q8: el administrador de dependencia también crea, edita y elimina, pero solo el contenido de su dependencia.
  const idPropia = cuenta && !esGlobal && cuenta.id_dependencia ? String(cuenta.id_dependencia) : '';
  const [dependencias, setDependencias] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState({ cargando: true, error: '', filas: [] });
  const [formulario, setFormulario] = useState(null); // null = cerrado
  const [errores, setErrores] = useState({});
  const [errorApi, setErrorApi] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [porEliminar, setPorEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState('');
  const refTitulo = useRef(null);

  useEffect(() => {
    if (!esGlobal) return undefined;
    let activo = true;
    api.dependencias()
      .then((lista) => { if (activo) setDependencias(lista); })
      .catch(() => { /* sin la lista no se puede filtrar ni crear: el formulario lo avisa */ });
    return () => { activo = false; };
  }, [esGlobal]);

  useEffect(() => {
    if (!cuenta) return undefined;
    let activo = true;
    setEstado((e) => ({ ...e, cargando: true, error: '' }));
    cfg.listar({ dependencia: filtro })
      .then((filas) => { if (activo) setEstado({ cargando: false, error: '', filas }); })
      .catch((err) => { if (activo && err.estado !== 401) setEstado({ cargando: false, error: mensajeError(err), filas: [] }); });
    return () => { activo = false; };
  // `cfg` es constante para cada tipo de módulo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuenta, filtro, intento, tipo]);

  // El foco pasa al primer campo solo al abrir el formulario (no en cada tecla, que cambia `formulario`).
  const abierto = formulario !== null;
  const idFormulario = formulario ? formulario.id : undefined;
  useEffect(() => { if (abierto && refTitulo.current) refTitulo.current.focus(); }, [abierto, idFormulario]);

  const abrirNuevo = useCallback(() => {
    setAviso(''); setErrores({}); setErrorApi(''); setPorEliminar(null);
    setFormulario({ ...FORMULARIO_VACIO, dependencia: idPropia || filtro });
  }, [filtro, idPropia]);

  function abrirEditar(fila) {
    setAviso(''); setErrores({}); setErrorApi(''); setPorEliminar(null);
    setFormulario({ id: cfg.idFila(fila), dependencia: String(fila.id_dependencia), titulo: fila[cfg.campoTitulo], texto: fila[cfg.campoTexto] });
  }

  function cerrarFormulario() { setFormulario(null); setErrores({}); setErrorApi(''); }

  async function guardar(evento) {
    evento.preventDefault();
    setErrorApi('');
    const titulo = formulario.titulo.trim();
    const texto = formulario.texto.trim();
    const nuevos = {};
    const dependenciaElegida = idPropia || formulario.dependencia;
    if (!dependenciaElegida) nuevos.dependencia = 'Selecciona una dependencia.';
    if (!titulo) nuevos.titulo = cfg.errorTitulo;
    else if (titulo.length > cfg.maxTitulo) nuevos.titulo = `Máximo ${cfg.maxTitulo} caracteres.`;
    if (!texto) nuevos.texto = cfg.errorTexto;
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    const datos = { id_dependencia: Number(dependenciaElegida), [cfg.campoTitulo]: titulo, [cfg.campoTexto]: texto };
    setGuardando(true);
    try {
      if (formulario.id === null) await cfg.crear(datos);
      else await cfg.editar(formulario.id, datos);
      setFormulario(null);
      setAviso(cfg.guardado);
      setIntento((n) => n + 1);
    } catch (err) {
      if (err.estado !== 401) setErrorApi(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    setErrorEliminar('');
    setEliminando(true);
    try {
      await cfg.eliminar(porEliminar);
      setPorEliminar(null);
      setAviso(cfg.eliminado);
      setIntento((n) => n + 1);
    } catch (err) {
      if (err.estado !== 401) setErrorEliminar(mensajeError(err));
    } finally {
      setEliminando(false);
    }
  }

  if (!cuenta) return null;

  return (
    <div className="space-y-6">
      <EncabezadoModulo modulo={cfg.modulo} id={cfg.idTitulo} titulo={cfg.titulo} descripcion={cfg.descripcion} volver>
        {!esGlobal ? <p className="mt-2 text-sm text-slate-600">Puedes crear, editar y eliminar el contenido de tu dependencia; no puedes modificar el de otras.</p> : null}
      </EncabezadoModulo>

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {esGlobal ? (
          <div className="w-full sm:w-72">
            <Selector etiqueta="Dependencia" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
              <option value="">Todas las dependencias</option>
              {dependencias.map((d) => <option key={d.id_dependencia} value={d.id_dependencia}>{d.nombre}</option>)}
            </Selector>
          </div>
        ) : <span />}
        <Boton onClick={abrirNuevo} disabled={formulario !== null}>{cfg.nuevo}</Boton>
      </div>

      {aviso ? <Alerta tipo="exito">{aviso}</Alerta> : null}

      {formulario ? (
        <form onSubmit={guardar} noValidate aria-label={formulario.id === null ? cfg.nuevo : `Editar: ${cfg.titulo.toLowerCase()}`} className="space-y-4 rounded-lg border border-slate-200 border-t-4 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-marca">{formulario.id === null ? cfg.nuevo : `Editar ${cfg.titulo.toLowerCase()}`}</h2>
          {errorApi ? <Alerta tipo="error">{errorApi}</Alerta> : null}
          {esGlobal ? (
            <div className="max-w-sm">
              <Selector etiqueta="Dependencia" value={formulario.dependencia} onChange={(e) => setFormulario({ ...formulario, dependencia: e.target.value })} aria-invalid={errores.dependencia ? 'true' : undefined}>
                <option value="">Selecciona una dependencia</option>
                {dependencias.map((d) => <option key={d.id_dependencia} value={d.id_dependencia}>{d.nombre}</option>)}
              </Selector>
              {errores.dependencia ? <p className="mt-1 text-sm text-red-700">{errores.dependencia}</p> : null}
            </div>
          ) : null}
          <Campo
            etiqueta={cfg.etiquetaTitulo}
            ref={refTitulo}
            value={formulario.titulo}
            onChange={(e) => setFormulario({ ...formulario, titulo: e.target.value })}
            error={errores.titulo}
            maxLength={cfg.maxTitulo + 50}
            autoComplete="off"
          />
          <CampoTexto etiqueta={cfg.etiquetaTexto} value={formulario.texto} onChange={(e) => setFormulario({ ...formulario, texto: e.target.value })} error={errores.texto} />
          <div className="flex flex-wrap gap-2">
            <Boton type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Boton>
            <Boton type="button" variante="secundario" onClick={cerrarFormulario} disabled={guardando}>Cancelar</Boton>
          </div>
        </form>
      ) : null}

      <section aria-labelledby={`${cfg.idTitulo}-lista`}>
        <h2 id={`${cfg.idTitulo}-lista`} className="sr-only">Lista de {cfg.titulo.toLowerCase()}</h2>
        {estado.cargando ? <p role="status" className="text-sm text-slate-600">{estado.filas.length > 0 ? 'Actualizando…' : 'Cargando…'}</p> : null}
        {estado.error ? (
          <div className="space-y-2">
            <Alerta tipo="error">{estado.error}</Alerta>
            <Boton variante="secundario" onClick={() => setIntento((n) => n + 1)}>Reintentar</Boton>
          </div>
        ) : null}
        {!estado.cargando && !estado.error && estado.filas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
            <p>{cfg.vacio}</p>
            {!esGlobal ? <p className="mt-1">Sin información institucional ni preguntas frecuentes, las consultas dirigidas a tu dependencia se escalan.</p> : null}
          </div>
        ) : null}
        {estado.filas.length > 0 ? (
          <ul aria-busy={estado.cargando} className={`space-y-3 ${estado.cargando ? 'opacity-60 transition-opacity' : ''}`}>
            {estado.filas.map((f) => {
              const id = cfg.idFila(f);
              const confirmando = porEliminar === id;
              return (
                <li key={id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="min-w-0 break-words font-medium text-slate-900">{f[cfg.campoTitulo]}</h3>
                    <span className="shrink-0 rounded-full bg-marca-claro px-2.5 py-0.5 text-xs font-medium text-marca">{f.dependencia}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line break-words text-sm text-slate-700">{f[cfg.campoTexto]}</p>
                  <p className="mt-2 text-xs text-slate-500">{cfg.meta(f)}</p>
                  {cuenta ? (
                    <div className="mt-3">
                      {confirmando ? (
                        <div role="alertdialog" aria-label={`Confirmar eliminación de ${f[cfg.campoTitulo]}`} className="space-y-2 rounded-md border border-red-300 bg-red-50 p-3">
                          <p className="text-sm text-red-900">¿Eliminar «{f[cfg.campoTitulo]}»? Esta acción no se puede deshacer.</p>
                          {errorEliminar ? <Alerta tipo="error">{errorEliminar}</Alerta> : null}
                          <div className="flex gap-2">
                            <Boton variante="peligro" onClick={eliminar} disabled={eliminando}>{eliminando ? 'Eliminando…' : 'Sí, eliminar'}</Boton>
                            <Boton variante="secundario" onClick={() => { setPorEliminar(null); setErrorEliminar(''); }} disabled={eliminando}>Cancelar</Boton>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Boton variante="secundario" onClick={() => abrirEditar(f)} aria-label={`Editar ${f[cfg.campoTitulo]}`}>Editar</Boton>
                          <Boton variante="secundario" onClick={() => { setAviso(''); setErrorEliminar(''); setPorEliminar(id); }} aria-label={`Eliminar ${f[cfg.campoTitulo]}`}>Eliminar</Boton>
                        </div>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
