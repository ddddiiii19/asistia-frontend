'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import { mensajeError } from '@/lib/errores';
import { rutaInicio } from '@/lib/rutas';
import { Alerta, Boton } from '@/components/ui';

// Protege un grupo de rutas. La interfaz no decide el rol por sí sola: se confirma con GET /api/auth/me
// y, además, el backend vuelve a verificar firma, vigencia y rol en cada solicitud.
export function RequiereRol({ rol, children }) {
  const router = useRouter();
  const { listo, cuenta, cerrarSesion } = useAuth();
  const [verificado, setVerificado] = useState(false);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const tipoLocal = cuenta ? cuenta.tipo : null;
  // Si la sesión desaparece estando en pantalla (cierre o expiración), la redirección la hace el
  // AuthProvider, con su aviso. Este guardia solo redirige cuando se entra sin sesión.
  const tuvoSesion = useRef(false);

  useEffect(() => {
    if (!listo) return undefined;
    if (!tipoLocal) {
      if (!tuvoSesion.current) router.replace('/login');
      return undefined;
    }
    tuvoSesion.current = true;
    let activo = true;
    setError('');
    api.me()
      .then(({ cuenta: sesion }) => {
        if (!activo) return;
        if (sesion.tipo !== rol) {
          router.replace(rutaInicio(sesion.tipo));
          return;
        }
        setVerificado(true);
      })
      .catch((err) => {
        // Si la sesión fue invalidada, el AuthProvider ya redirige al inicio de sesión.
        if (activo && err.estado !== 401) setError(mensajeError(err));
      });
    return () => { activo = false; };
  }, [listo, tipoLocal, rol, router, intento]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  if (error) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Alerta tipo="error">{error}</Alerta>
        <div className="mt-4 flex gap-3">
          <Boton onClick={reintentar}>Reintentar</Boton>
          <Boton variante="secundario" onClick={() => cerrarSesion()}>Cerrar sesión</Boton>
        </div>
      </div>
    );
  }
  if (!verificado) {
    return <p role="status" className="p-6 text-center text-slate-600">Verificando sesión…</p>;
  }
  return children;
}
