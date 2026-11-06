'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { mensajeError } from '@/lib/errores';
import { contrasenaValida } from '@/lib/validacion';
import { Alerta, Boton, CampoContrasena } from '@/components/ui';

export function FormularioRestablecer() {
  const router = useRouter();
  // null = aún no se lee la URL; '' = no hay token. El token solo vive en este estado (memoria):
  // no se guarda en localStorage, sessionStorage ni cookies, y se retira de la URL al leerlo.
  const [token, setToken] = useState(null);
  const leido = useRef(false);
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errorCampo, setErrorCampo] = useState('');
  const [error, setError] = useState('');
  const [enlaceInvalido, setEnlaceInvalido] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (leido.current) return;
    leido.current = true;
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') || '');
    if (params.has('token')) {
      params.delete('token');
      const resto = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (resto ? `?${resto}` : ''));
    }
  }, []);

  async function enviar(evento) {
    evento.preventDefault();
    setError('');
    setErrorCampo('');
    if (!contrasenaValida(nueva)) {
      setErrorCampo('La contraseña no cumple todos los requisitos indicados.');
      return;
    }
    if (nueva !== confirmacion) {
      setErrorCampo('Las contraseñas no coinciden.');
      return;
    }
    setEnviando(true);
    try {
      await api.restablecerContrasena(token, nueva);
      setToken('');
      router.replace('/login?reset=1');
    } catch (err) {
      if (err.codigo === 'token_recuperacion_invalido') {
        // Enlace vencido, ya utilizado o alterado: se pide uno nuevo.
        setEnlaceInvalido(true);
      } else if (err.codigo === 'contrasena_insegura') {
        setErrorCampo(err.message);
      } else {
        setError(mensajeError(err));
      }
      setEnviando(false);
    }
  }

  if (token === null) return <p role="status" className="text-sm text-slate-600">Cargando…</p>;

  if (!token || enlaceInvalido) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-marca">Enlace no válido</h1>
        <Alerta tipo="error">
          {enlaceInvalido
            ? 'El enlace de recuperación no es válido o ya venció. Solicita uno nuevo.'
            : 'Falta el enlace de recuperación. Abre el enlace que recibiste por correo o solicita uno nuevo.'}
        </Alerta>
        <p className="text-sm">
          <Link href="/olvide-contrasena" className="text-marca underline underline-offset-2">Solicitar un enlace nuevo</Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <h1 className="text-xl font-semibold text-marca">Restablecer contraseña</h1>
      <p className="text-sm text-slate-600">Define una contraseña nueva para tu cuenta.</p>
      {error ? <Alerta tipo="error">{error}</Alerta> : null}
      <CampoContrasena
        etiqueta="Contraseña nueva"
        name="nueva_contrasena"
        autoComplete="new-password"
        value={nueva}
        onChange={(e) => setNueva(e.target.value)}
        mostrarRequisitos
      />
      <CampoContrasena
        etiqueta="Confirmar contraseña"
        name="confirmacion"
        autoComplete="new-password"
        value={confirmacion}
        onChange={(e) => setConfirmacion(e.target.value)}
        error={errorCampo}
      />
      <Boton type="submit" className="w-full" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar contraseña'}
      </Boton>
    </form>
  );
}
