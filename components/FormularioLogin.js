'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import { mensajeError } from '@/lib/errores';
import { rutaInicio } from '@/lib/rutas';
import { Alerta, Boton, Campo, CampoContrasena } from '@/components/ui';

export function FormularioLogin() {
  const router = useRouter();
  const { listo, cuenta, iniciarSesion } = useAuth();
  const [identificador, setIdentificador] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('expirada')) setAviso('Tu sesión expiró o dejó de ser válida. Inicia sesión nuevamente.');
    else if (p.get('reset')) setAviso('Contraseña actualizada. Inicia sesión con la nueva contraseña.');
  }, []);

  // Si ya hay una sesión en esta pestaña, se va a la pantalla de inicio (allí se confirma con el backend).
  useEffect(() => {
    if (listo && cuenta) router.replace(rutaInicio(cuenta.tipo));
  }, [listo, cuenta, router]);

  async function enviar(evento) {
    evento.preventDefault();
    setError('');
    if (!identificador.trim() || !contrasena) {
      setError('Ingresa tu usuario o correo y tu contraseña.');
      return;
    }
    setEnviando(true);
    try {
      const datos = await api.login(identificador.trim(), contrasena);
      iniciarSesion({ token: datos.token, cuenta: datos.cuenta });
      // El destino depende del tipo de cuenta que devuelve el backend, no de una elección en el formulario.
      router.replace(rutaInicio(datos.cuenta.tipo));
    } catch (err) {
      setError(mensajeError(err));
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <h1 className="text-xl font-semibold text-marca">Iniciar sesión</h1>
      <p className="text-sm text-slate-600">Ingresa con tu cuenta de usuario o de administrador.</p>
      {aviso ? <Alerta tipo="info">{aviso}</Alerta> : null}
      {error ? <Alerta tipo="error">{error}</Alerta> : null}
      <Campo
        etiqueta="Usuario o correo"
        name="identificador"
        autoComplete="username"
        value={identificador}
        onChange={(e) => setIdentificador(e.target.value)}
        maxLength={254}
      />
      <CampoContrasena
        etiqueta="Contraseña"
        name="contrasena"
        autoComplete="current-password"
        value={contrasena}
        onChange={(e) => setContrasena(e.target.value)}
        maxLength={200}
      />
      <Boton type="submit" className="w-full" disabled={enviando}>
        {enviando ? 'Ingresando…' : 'Ingresar'}
      </Boton>
      <p className="text-center text-sm">
        <Link href="/olvide-contrasena" className="text-marca underline underline-offset-2">¿Olvidaste tu contraseña?</Link>
      </p>
    </form>
  );
}
