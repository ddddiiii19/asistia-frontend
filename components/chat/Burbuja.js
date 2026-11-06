// Mensaje individual del chat. El estado de escalamiento y la dependencia sugerida los informa el backend.
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
        {nombreDependencia ? (
          <p className="mt-2 inline-block rounded-full bg-marca-claro px-2.5 py-0.5 text-xs font-medium text-marca">
            Dependencia sugerida: {nombreDependencia}
          </p>
        ) : null}
      </div>
    </li>
  );
}
