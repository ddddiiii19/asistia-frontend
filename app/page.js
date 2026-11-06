'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { rutaInicio } from '@/lib/rutas';

// Punto de entrada: dirige según la sesión. La verificación real del rol ocurre en el grupo de rutas.
export default function Inicio() {
  const router = useRouter();
  const { listo, cuenta } = useAuth();
  useEffect(() => {
    if (!listo) return;
    router.replace(cuenta ? rutaInicio(cuenta.tipo) : '/login');
  }, [listo, cuenta, router]);
  return <p role="status" className="p-6 text-center text-slate-600">Cargando…</p>;
}
