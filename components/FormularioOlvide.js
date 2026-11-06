'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { mensajeError } from '@/lib/errores';
import { correoValido } from '@/lib/validacion';
import { Alerta, Boton, Campo } from '@/components/ui';

export function FormularioOlvide() {
  const [correo, setCorreo] = useState('');
  const [errorCampo, setErrorCampo] = useState('');
  const [error, setError] = useState('');
  const [respuesta, setRespuesta] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setError('');
    setRespuesta('');
    if (!correoValido(correo)) {
      setErrorCampo('Ingresa un correo válido.');
      return;
    }
    setErrorCampo('');
    setEnviando(true);
    try {
      // El backend responde siempre con el mismo mensaje, exista o no la cuenta.
      const datos = await api.olvideContrasena(correo.trim());
      setRespuesta(datos && datos.mensaje ? datos.mensaje : 'Si existe una cuenta asociada a ese correo, recibirás instrucciones para restablecer la contraseña.');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <h1 className="text-xl font-semibold text-marca">Recuperar contraseña</h1>
      <p className="text-sm text-slate-600">
        Escribe el correo asociado a tu cuenta. Si existe, te enviaremos un enlace de un solo uso y de corta duración para definir una contraseña nueva.
      </p>
      {respuesta ? <Alerta tipo="exito">{respuesta}</Alerta> : null}
      {error ? <Alerta tipo="error">{error}</Alerta> : null}
      <Campo
        etiqueta="Correo electrónico"
        type="email"
        name="correo"
        autoComplete="email"
        value={correo}
        onChange={(e) => setCorreo(e.target.value)}
        error={errorCampo}
        maxLength={254}
      />
      <Boton type="submit" className="w-full" disabled={enviando}>
        {enviando ? 'Enviando…' : 'Enviar enlace de recuperación'}
      </Boton>
      <p className="text-center text-sm">
        <Link href="/login" className="text-marca underline underline-offset-2">Volver a iniciar sesión</Link>
      </p>
    </form>
  );
}
