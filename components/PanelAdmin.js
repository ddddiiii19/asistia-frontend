'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import { mensajeError } from '@/lib/errores';
import { Alerta, Boton, Campo, CampoContrasena } from '@/components/ui';
import { contrasenaValida, correoValido } from '@/lib/validacion';

// Módulos del panel administrativo. Los que tienen `href` ya están disponibles (Q6: reportes e historial de conversaciones);
// los demás se integran en fases posteriores.
const MODULOS = [
  { id: 'reportes', titulo: 'Reportes y estadísticas', descripcion: 'Consultas, tiempos de respuesta, preguntas frecuentes y dependencias.', href: '/admin/reportes' },
  { id: 'informacion', titulo: 'Información institucional' },
  { id: 'faq', titulo: 'Preguntas frecuentes' },
  { id: 'historial', titulo: 'Historial de conversaciones', descripcion: 'Conversaciones de los usuarios con el asistente, con su dependencia y estado.', href: '/admin/historial' },
];

function textoAlcance(cuenta, nombreDependencia) {
  if (cuenta.alcance_admin === 'global') return 'Global (todas las dependencias)';
  if (cuenta.alcance_admin === 'dependencia') return `Dependencia: ${nombreDependencia || `n.º ${cuenta.id_dependencia}`} (solo consulta)`;
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
      <section aria-labelledby="titulo-panel">
        <h1 id="titulo-panel" className="text-xl font-semibold text-marca">Panel administrativo</h1>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="font-medium text-slate-600">Cuenta</dt>
          <dd>{cuenta.nombre_usuario}</dd>
          <dt className="font-medium text-slate-600">Alcance</dt>
          <dd>{textoAlcance(cuenta, nombreDependencia)}</dd>
        </dl>
      </section>

      <section aria-labelledby="titulo-modulos">
        <h2 id="titulo-modulos" className="text-base font-semibold text-marca">Módulos</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map((m) => (m.href ? (
            <li key={m.id}>
              <Link href={m.href} className="block h-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-marca">
                <span className="block font-medium text-marca">{m.titulo}</span>
                <span className="mt-1 block text-xs text-slate-600">{m.descripcion}</span>
              </Link>
            </li>
          ) : (
            <li key={m.id} aria-disabled="true" className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-slate-500">
              <p className="font-medium">{m.titulo}</p>
              <p className="mt-1 text-xs">Próximamente</p>
            </li>
          )))}
        </ul>
      </section>

      {esGlobal ? <CrearCuentaUsuario /> : null}
    </div>
  );
}

// Alta de cuentas del rol Usuario (no hay registro público). El backend permite esta acción solo al administrador global.
function CrearCuentaUsuario() {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setError('');
    setExito('');
    const nuevos = {};
    if (!nombre.trim()) nuevos.nombre = 'Ingresa un nombre de usuario.';
    if (!correoValido(correo)) nuevos.correo = 'Ingresa un correo válido.';
    if (!contrasenaValida(contrasena)) nuevos.contrasena = 'La contraseña no cumple todos los requisitos indicados.';
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;
    setEnviando(true);
    try {
      const r = await api.crearCuentaUsuario({ nombreUsuario: nombre.trim(), correo: correo.trim(), contrasena });
      setExito(`Cuenta de usuario «${r.cuenta.nombre_usuario}» creada.`);
      setNombre('');
      setCorreo('');
      setContrasena('');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section aria-labelledby="titulo-cuenta" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 id="titulo-cuenta" className="text-base font-semibold text-marca">Crear cuenta de usuario</h2>
      <p className="mt-1 text-sm text-slate-600">No existe registro público: las cuentas del rol Usuario las crea el administrador global.</p>
      <form onSubmit={enviar} noValidate className="mt-4 max-w-md space-y-4">
        {exito ? <Alerta tipo="exito">{exito}</Alerta> : null}
        {error ? <Alerta tipo="error">{error}</Alerta> : null}
        <Campo etiqueta="Nombre de usuario" name="nombre_usuario" value={nombre} onChange={(e) => setNombre(e.target.value)} error={errores.nombre} maxLength={50} autoComplete="off" />
        <Campo etiqueta="Correo electrónico" type="email" name="correo" value={correo} onChange={(e) => setCorreo(e.target.value)} error={errores.correo} maxLength={254} autoComplete="off" />
        <CampoContrasena etiqueta="Contraseña inicial" name="contrasena" value={contrasena} onChange={(e) => setContrasena(e.target.value)} error={errores.contrasena} mostrarRequisitos autoComplete="new-password" />
        <Boton type="submit" disabled={enviando}>{enviando ? 'Creando…' : 'Crear cuenta'}</Boton>
      </form>
    </section>
  );
}
