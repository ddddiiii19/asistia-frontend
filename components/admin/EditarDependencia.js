'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import { mensajeError } from '@/lib/errores';
import { Alerta, Boton, Campo, CampoTexto, Selector } from '@/components/ui';
import { dividirCorreos, errorCorreosContacto, telefonoValido } from '@/lib/validacion';

// Q8: datos de la dependencia. Solo se edita la descripción (la usa la IA para clasificar las consultas) y el contacto
// (correos y teléfono, que se muestran en las respuestas). El nombre no cambia y la dependencia no se elimina.
// El administrador global elige la dependencia; el de una dependencia edita únicamente la suya.
// También avisa cuando la dependencia aún no tiene contenido: sus consultas se escalan hasta que se cargue información.
export function EditarDependencia() {
  const { cuenta } = useAuth();
  const esGlobal = cuenta ? cuenta.alcance_admin === 'global' : false;
  const [dependencias, setDependencias] = useState(null); // null = cargando
  const [errorCarga, setErrorCarga] = useState('');
  const [idElegido, setIdElegido] = useState('');
  const [form, setForm] = useState({ descripcion: '', correos: '', telefono: '' });
  const [errores, setErrores] = useState({});
  const [errorApi, setErrorApi] = useState('');
  const [exito, setExito] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!cuenta) return undefined;
    let activo = true;
    // Promise.resolve().then: un fallo al llamar al API se trata como cualquier otro error de carga.
    Promise.resolve().then(() => api.adminDependencias())
      .then((lista) => {
        if (!activo) return;
        setDependencias(lista);
        if (lista.length > 0) {
          const inicial = esGlobal ? lista[0] : lista.find((d) => d.id_dependencia === cuenta.id_dependencia) || lista[0];
          setIdElegido(String(inicial.id_dependencia));
        }
      })
      .catch((err) => { if (activo && err.estado !== 401) { setErrorCarga('No fue posible cargar los datos de la dependencia.'); setDependencias([]); } });
    return () => { activo = false; };
  }, [cuenta, esGlobal]);

  const elegida = (dependencias || []).find((d) => String(d.id_dependencia) === idElegido) || null;

  // Al cambiar de dependencia se cargan sus datos en el formulario.
  useEffect(() => {
    if (!elegida) return;
    setForm({ descripcion: elegida.descripcion || '', correos: (elegida.correos || []).join(', '), telefono: elegida.telefono || '' });
    setErrores({}); setErrorApi(''); setExito('');
  // Solo depende de la dependencia elegida (no de cada actualización de la lista).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idElegido, dependencias === null]);

  if (!cuenta) return null;
  if (dependencias === null) return <p className="text-sm text-slate-600">Cargando datos de la dependencia…</p>;
  if (errorCarga) return <p className="text-sm text-red-700">{errorCarga}</p>;
  if (!elegida) return null;

  const sinContenido = (elegida.total_informacion || 0) + (elegida.total_faq || 0) === 0;

  async function guardar(evento) {
    evento.preventDefault();
    setErrorApi(''); setExito('');
    const nuevos = {};
    if (!form.descripcion.trim()) nuevos.descripcion = 'Ingresa la descripción de la dependencia.';
    const errorCorreos = errorCorreosContacto(form.correos);
    if (errorCorreos) nuevos.correos = errorCorreos;
    if (!telefonoValido(form.telefono)) nuevos.telefono = 'Ingresa un teléfono válido (al menos 7 dígitos), por ejemplo 601 743 32 00.';
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;
    setGuardando(true);
    try {
      const actualizada = await api.editarDependencia(elegida.id_dependencia, {
        descripcion: form.descripcion.trim(), correos: dividirCorreos(form.correos), telefono: form.telefono.trim(),
      });
      setDependencias((lista) => lista.map((d) => (d.id_dependencia === actualizada.id_dependencia ? { ...d, ...actualizada } : d)));
      setExito('Datos de la dependencia guardados.');
    } catch (err) {
      if (err.estado !== 401) setErrorApi(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section aria-labelledby="titulo-datos-dependencia" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 id="titulo-datos-dependencia" className="text-base font-semibold text-marca">Datos de la dependencia</h2>
      <p className="mt-1 text-sm text-slate-600">
        La descripción ayuda al asistente a dirigir las consultas; el contacto (correos y teléfono) se muestra en las respuestas.
        El nombre no se puede cambiar.
      </p>
      {sinContenido ? (
        <div className="mt-3">
          <Alerta tipo="info">
            {esGlobal ? `${elegida.nombre} aún no tiene` : 'Tu dependencia aún no tiene'} información institucional ni preguntas frecuentes: sus consultas se escalan hasta que se cargue contenido.
          </Alerta>
        </div>
      ) : null}
      <form onSubmit={guardar} noValidate className="mt-4 max-w-xl space-y-4">
        {exito ? <Alerta tipo="exito">{exito}</Alerta> : null}
        {errorApi ? <Alerta tipo="error">{errorApi}</Alerta> : null}
        {esGlobal ? (
          <Selector etiqueta="Dependencia" value={idElegido} onChange={(e) => setIdElegido(e.target.value)}>
            {dependencias.map((d) => <option key={d.id_dependencia} value={d.id_dependencia}>{d.nombre}</option>)}
          </Selector>
        ) : (
          <p className="text-sm"><span className="font-medium text-slate-600">Dependencia: </span>{elegida.nombre}</p>
        )}
        <CampoTexto etiqueta="Descripción de la dependencia" name="descripcion_dependencia" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} error={errores.descripcion} maxLength={500} />
        <Campo etiqueta="Correos de contacto" name="correos_contacto" value={form.correos} onChange={(e) => setForm({ ...form, correos: e.target.value })} error={errores.correos} ayuda="Separa varios correos con una coma." autoComplete="off" />
        <Campo etiqueta="Teléfono de contacto" name="telefono_contacto" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} error={errores.telefono} ayuda="Opcional. Por ejemplo: 601 743 32 00." maxLength={100} autoComplete="off" />
        <Boton type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar datos'}</Boton>
      </form>
    </section>
  );
}
