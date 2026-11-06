'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { guardarSesion, leerSesion, limpiarSesion } from '@/lib/sesion';
import { registrarAlSesionInvalida } from '@/lib/api';

const Contexto = createContext(null);

export function AuthProvider({ children }) {
  const router = useRouter();
  const [estado, setEstado] = useState({ listo: false, sesion: null });

  // La sesión vive en sessionStorage, que solo existe en el navegador: se lee tras montar.
  useEffect(() => {
    setEstado({ listo: true, sesion: leerSesion() });
  }, []);

  const cerrarSesion = useCallback((motivo) => {
    limpiarSesion();
    setEstado({ listo: true, sesion: null });
    router.replace(motivo ? `/login?${motivo}=1` : '/login');
  }, [router]);

  // Si el backend informa que el JWT dejó de ser válido, se cierra la sesión local.
  useEffect(() => registrarAlSesionInvalida(() => cerrarSesion('expirada')), [cerrarSesion]);

  const iniciarSesion = useCallback(({ token, cuenta }) => {
    guardarSesion({ token, cuenta });
    setEstado({ listo: true, sesion: leerSesion() });
  }, []);

  const valor = useMemo(() => ({
    listo: estado.listo,
    cuenta: estado.sesion ? estado.sesion.cuenta : null,
    iniciarSesion,
    cerrarSesion,
  }), [estado, iniciarSesion, cerrarSesion]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useAuth debe usarse dentro de AuthProvider.');
  return valor;
}
