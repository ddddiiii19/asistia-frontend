// Mensaje individual del chat. Q8: toda respuesta de una dependencia se muestra en tres bloques, en este orden:
// (1) el mensaje, (2) «Contacto: correo · teléfono» y (3) «Dependencia: X». Contacto y dependencia vienen del backend
// en campos propios y no se repiten dentro del texto. El estado de escalamiento también lo informa el backend.
// `nombreUsuario` es lo que anuncia un lector de pantalla para los mensajes de la persona usuaria: "Tú" en su propio
// chat e historial; "Usuario" cuando un administrador revisa la conversación de otra persona.
export function Burbuja({ mensaje, nombreUsuario = 'Tú' }) {
  const esUsuario = mensaje.rol === 'usuario';
  const escalada = !esUsuario && mensaje.escalada;
  const clases = esUsuario
    ? 'bg-marca text-white'
    : escalada
      ? 'border border-amber-300 bg-amber-50 text-amber-950'
      : 'border border-slate-200 bg-white text-slate-900';
  const nombreDependencia = mensaje.dependencia
    ? (typeof mensaje.dependencia === 'string' ? mensaje.dependencia : mensaje.dependencia.nombre)
    : null;
  const textoContacto = !esUsuario && mensaje.contacto
    ? (typeof mensaje.contacto === 'string' ? mensaje.contacto : mensaje.contacto.texto)
    : null;

  return (
    <li className={`flex ${esUsuario ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm sm:max-w-[75%] ${clases}`}>
        <span className="sr-only">{esUsuario ? `${nombreUsuario}: ` : 'AsistIA: '}</span>
        {escalada ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">Escalamiento · caso registrado</p>
        ) : null}
        {mensaje.origen === 'faq' && !esUsuario ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Pregunta frecuente</p>
        ) : null}
        <p className="whitespace-pre-wrap break-words">{mensaje.texto}</p>
        {textoContacto ? (
          <p className="mt-2 break-words text-xs text-slate-700">
            <span className="font-semibold">Contacto:</span> {textoContacto}
          </p>
        ) : null}
        {nombreDependencia && !esUsuario ? (
          <p className="mt-2 inline-block rounded-full bg-marca-claro px-2.5 py-0.5 text-xs font-medium text-marca">
            Dependencia: {nombreDependencia}
          </p>
        ) : null}
      </div>
    </li>
  );
}
