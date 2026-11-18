'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import { mensajeError } from '@/lib/errores';
import { Alerta, Boton, Campo, CampoContrasena, CampoTexto, Selector } from '@/components/ui';
import { EditarDependencia } from '@/components/admin/EditarDependencia';
import { EncabezadoModulo, IconoModulo } from '@/components/EncabezadoModulo';
import { MODULOS_UI } from '@/lib/modulos';
import { contrasenaValida, correoValido, dividirCorreos, errorCorreosContacto, telefonoValido } from '@/lib/validacion';

// Módulos del panel administrativo (todos disponibles). Cada uno tiene su color e ícono, los mismos de su pantalla.
const MODULOS = [
  { id: 'reportes', titulo: 'Reportes y estadísticas', descripcion: 'Consultas, tiempos de respuesta, gráficas, preguntas frecuentes y dependencias.', href: '/admin/reportes' },
  { id: 'informacion', titulo: 'Información institucional', descripcion: 'Textos por dependencia que el asistente usa para responder.', href: '/admin/informacion' },
  { id: 'faq', titulo: 'Preguntas frecuentes', descripcion: 'Preguntas y respuestas por dependencia, con las veces que se abrieron.', href: '/admin/faq' },
  { id: 'historial', titulo: 'Historial de conversaciones', descripcion: 'Conversaciones de los usuarios con el asistente, con su dependencia y estado.', href: '/admin/historial' },
];

function textoAlcance(cuenta, nombreDependencia) {
  if (cuenta.alcance_admin === 'global') return 'Global (todas las dependencias)';
  if (cuenta.alcance_admin === 'dependencia') return `Dependencia: ${nombreDependencia || `n.º ${cuenta.id_dependencia}`}`;
  return '';
}

export function PanelAdmin() {
  const { cuenta } = useAuth();
  const [nombreDependencia, setNombreDependencia] = useState('');

  useEffect(() => {
    if (!cuenta || cuenta.alcance_admin !== 'dependencia') return undefined;
    let activo = true;
    api.dependencias()
      .then((lista) => {
        const d = lista.find((x) => x.id_dependencia === cuenta.id_dependencia);
        if (activo && d) setNombreDependencia(d.nombre);
      })
      .catch(() => { /* el nombre es informativo: se muestra el número de dependencia */ });
    return () => { activo = false; };
  }, [cuenta]);

  if (!cuenta) return null;
  const esGlobal = cuenta.alcance_admin === 'global';

  return (
    <div className="space-y-6">
      <EncabezadoModulo modulo="panel" id="titulo-panel" titulo="Panel administrativo">
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="font-medium text-slate-600">Cuenta</dt>
          <dd>{cuenta.nombre_usuario}</dd>
          <dt className="font-medium text-slate-600">Alcance</dt>
          <dd>{textoAlcance(cuenta, nombreDependencia)}</dd>
        </dl>
      </EncabezadoModulo>

      <section aria-labelledby="titulo-modulos">
        <h2 id="titulo-modulos" className="text-base font-semibold text-marca">Módulos</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map((m) => {
            const estilo = MODULOS_UI[m.id];
            return (
              <li key={m.id}>
                <Link href={m.href} className={`flex h-full items-start gap-3 rounded-lg border border-t-4 border-slate-200 ${estilo.tarjeta} bg-white p-4 shadow-sm hover:shadow-md`}>
                  <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${estilo.insignia}`}>
                    <IconoModulo nombre={estilo.icono} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className={`block font-medium ${estilo.titulo}`}>{m.titulo}</span>
                    <span className="mt-1 block text-xs text-slate-600">{m.descripcion}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <EditarDependencia />

      {esGlobal ? <CrearCuentaUsuario /> : null}
    </div>
  );
}

// Alta de cuentas (no hay registro público). El backend permite esta acción solo al administrador global.
// Q8: además de cuentas de Usuario, se crean cuentas de dependencia. El administrador global ESCRIBE el nombre de la
// dependencia (sin opciones predeterminadas) con su descripción y su contacto: el sistema crea la dependencia, sus
// apartados (información institucional, preguntas frecuentes, historial y reportes, limitados a ella) y su cuenta.
function CrearCuentaUsuario() {
  const [tipo, setTipo] = useState('usuario');
  const [dependencia, setDependencia] = useState({ nombre: '', descripcion: '', correos: '', telefono: '' });
  // «nueva»: el administrador global ESCRIBE el nombre (sin opciones predeterminadas). «existente»: otra cuenta para una
  // dependencia que ya existe; solo entonces se carga y se muestra la lista de dependencias.
  const [modoDependencia, setModoDependencia] = useState('nueva');
  const [existentes, setExistentes] = useState(null);
  const [errorExistentes, setErrorExistentes] = useState('');
  const [idExistente, setIdExistente] = useState('');
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (tipo !== 'dependencia' || modoDependencia !== 'existente' || existentes !== null) return undefined;
    let activo = true;
    setErrorExistentes('');
    Promise.resolve().then(() => api.dependencias())
      .then((lista) => { if (activo) setExistentes(lista); })
      .catch(() => { if (activo) { setExistentes([]); setErrorExistentes('No fue posible cargar las dependencias existentes.'); } });
    return () => { activo = false; };
  }, [tipo, modoDependencia, existentes]);

  async function enviar(evento) {
    evento.preventDefault();
    setError('');
    setExito('');
    const nuevos = {};
    if (!nombre.trim()) nuevos.nombre = 'Ingresa un nombre de usuario.';
    if (!correoValido(correo)) nuevos.correo = 'Ingresa un correo válido.';
    if (!contrasenaValida(contrasena)) nuevos.contrasena = 'La contraseña no cumple todos los requisitos indicados.';
    if (tipo === 'dependencia' && modoDependencia === 'existente') {
      if (!idExistente) nuevos.dependenciaExistente = 'Selecciona la dependencia a la que pertenece la cuenta.';
    }
    if (tipo === 'dependencia' && modoDependencia === 'nueva') {
      if (dependencia.nombre.trim().length < 3) nuevos.dependencia = 'Escribe el nombre de la dependencia (al menos 3 caracteres).';
      if (!dependencia.descripcion.trim()) nuevos.descripcion = 'Escribe una descripción: el asistente la usa para dirigir las consultas.';
      const errorCorreos = errorCorreosContacto(dependencia.correos);
      if (errorCorreos) nuevos.correos = errorCorreos;
      if (!telefonoValido(dependencia.telefono)) nuevos.telefono = 'Ingresa un teléfono válido (al menos 7 dígitos), por ejemplo 601 743 32 00.';
    }
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;
    setEnviando(true);
    try {
      if (tipo === 'dependencia' && modoDependencia === 'existente') {
        const r = await api.crearAdministradorDependencia({
          nombreUsuario: nombre.trim(), correo: correo.trim(), contrasena, idDependencia: Number(idExistente),
        });
        setExito(`Cuenta «${r.cuenta.nombre_usuario}» creada para la dependencia ${r.cuenta.dependencia}.`);
        setIdExistente('');
      } else if (tipo === 'dependencia') {
        const r = await api.crearAdministradorDependencia({
          nombreUsuario: nombre.trim(), correo: correo.trim(), contrasena,
          nombreDependencia: dependencia.nombre.trim(), descripcion: dependencia.descripcion.trim(),
          correos: dividirCorreos(dependencia.correos), telefono: dependencia.telefono.trim(),
        });
        setExito(`Cuenta «${r.cuenta.nombre_usuario}» creada para la dependencia ${r.cuenta.dependencia}. La dependencia empieza sin contenido: sus consultas se escalan hasta que cargue información institucional o preguntas frecuentes.`);
        setDependencia({ nombre: '', descripcion: '', correos: '', telefono: '' });
      } else {
        const r = await api.crearCuentaUsuario({ nombreUsuario: nombre.trim(), correo: correo.trim(), contrasena });
        setExito(`Cuenta de usuario «${r.cuenta.nombre_usuario}» creada.`);
      }
      setNombre('');
      setCorreo('');
      setContrasena('');
    } catch (err) {
      const base = mensajeError(err);
      setError(err && err.codigo === 'dependencia_existente'
        ? `${base} Para crear otra cuenta de esa dependencia, elige «Dependencia existente».`
        : base);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section aria-labelledby="titulo-cuenta" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 id="titulo-cuenta" className="text-base font-semibold text-marca">Crear cuenta de usuario</h2>
      <p className="mt-1 text-sm text-slate-600">No existe registro público: las cuentas las crea el administrador global.</p>
      <form onSubmit={enviar} noValidate className="mt-4 max-w-md space-y-4">
        {exito ? <Alerta tipo="exito">{exito}</Alerta> : null}
        {error ? <Alerta tipo="error">{error}</Alerta> : null}
        <Selector etiqueta="Tipo de cuenta" name="tipo_cuenta" value={tipo} onChange={(e) => { setTipo(e.target.value); setErrores({}); setExito(''); }}>
          <option value="usuario">Usuario (consulta al asistente)</option>
          <option value="dependencia">Administrador de dependencia</option>
        </Selector>
        {tipo === 'dependencia' ? (
          <fieldset className="space-y-4 rounded-md border border-slate-200 p-3">
            <legend className="px-1 text-sm font-medium text-slate-700">Dependencia de la cuenta</legend>
            <div className="space-y-2 text-sm text-slate-800">
              <label className="flex items-start gap-2">
                <input type="radio" name="modo_dependencia" value="nueva" checked={modoDependencia === 'nueva'} onChange={() => { setModoDependencia('nueva'); setErrores({}); setExito(''); }} className="mt-1" />
                <span>Dependencia nueva (escribo su nombre)</span>
              </label>
              <label className="flex items-start gap-2">
                <input type="radio" name="modo_dependencia" value="existente" checked={modoDependencia === 'existente'} onChange={() => { setModoDependencia('existente'); setErrores({}); setExito(''); }} className="mt-1" />
                <span>Dependencia existente (otra cuenta de una dependencia ya creada)</span>
              </label>
            </div>
            {modoDependencia === 'nueva' ? (
              <>
                <p className="text-xs text-slate-500">
                  Se crea la dependencia con esta cuenta, que solo podrá gestionar la información, las preguntas frecuentes, el historial y los reportes de esa dependencia.
                </p>
                <Campo etiqueta="Nombre de la dependencia" name="nombre_dependencia" value={dependencia.nombre} onChange={(e) => setDependencia({ ...dependencia, nombre: e.target.value })} error={errores.dependencia} maxLength={100} autoComplete="off" />
                <CampoTexto etiqueta="Descripción de la dependencia" name="descripcion_dependencia" value={dependencia.descripcion} onChange={(e) => setDependencia({ ...dependencia, descripcion: e.target.value })} error={errores.descripcion} ayuda="El asistente la usa para dirigir las consultas a esta dependencia." maxLength={500} />
                <Campo etiqueta="Correos de contacto" name="correos_contacto" value={dependencia.correos} onChange={(e) => setDependencia({ ...dependencia, correos: e.target.value })} error={errores.correos} ayuda="Se muestran en las respuestas. Separa varios con una coma." autoComplete="off" />
                <Campo etiqueta="Teléfono de contacto" name="telefono_contacto" value={dependencia.telefono} onChange={(e) => setDependencia({ ...dependencia, telefono: e.target.value })} error={errores.telefono} ayuda="Opcional. Por ejemplo: 601 743 32 00." maxLength={100} autoComplete="off" />
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500">La cuenta nueva podrá gestionar solo lo de la dependencia elegida; sus datos de contacto no cambian.</p>
                {errorExistentes ? <p className="text-sm text-red-700">{errorExistentes}</p> : null}
                {existentes === null ? <p className="text-sm text-slate-600">Cargando dependencias…</p> : (
                  <div>
                    <Selector etiqueta="Dependencia existente" name="dependencia_existente" value={idExistente} onChange={(e) => setIdExistente(e.target.value)} aria-invalid={errores.dependenciaExistente ? 'true' : undefined}>
                      <option value="">Selecciona una dependencia</option>
                      {existentes.map((d) => <option key={d.id_dependencia} value={d.id_dependencia}>{d.nombre}</option>)}
                    </Selector>
                    {errores.dependenciaExistente ? <p className="mt-1 text-sm text-red-700">{errores.dependenciaExistente}</p> : null}
                  </div>
                )}
              </>
            )}
          </fieldset>
        ) : null}
        <Campo etiqueta="Nombre de usuario" name="nombre_usuario" value={nombre} onChange={(e) => setNombre(e.target.value)} error={errores.nombre} maxLength={50} autoComplete="off" />
        <Campo etiqueta="Correo electrónico" type="email" name="correo" value={correo} onChange={(e) => setCorreo(e.target.value)} error={errores.correo} maxLength={254} autoComplete="off" />
        <CampoContrasena etiqueta="Contraseña inicial" name="contrasena" value={contrasena} onChange={(e) => setContrasena(e.target.value)} error={errores.contrasena} mostrarRequisitos autoComplete="new-password" />
        <Boton type="submit" disabled={enviando}>{enviando ? 'Creando…' : 'Crear cuenta'}</Boton>
      </form>
    </section>
  );
}
