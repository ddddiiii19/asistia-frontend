'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { rutaInicio } from '@/lib/rutas';
import { MODULOS_UI } from '@/lib/modulos';

export function Encabezado({ enlaces = [] }) {
  const { cuenta, cerrarSesion } = useAuth();
  const ruta = usePathname();
  return (
    <header className="bg-marca text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href={cuenta ? rutaInicio(cuenta.tipo) : '/login'} className="text-lg font-semibold tracking-tight">
          AsistIA
        </Link>
        <nav aria-label="Principal" className="order-last flex w-full flex-wrap gap-1 text-sm sm:order-none sm:w-auto">
          {enlaces.map((e) => {
            const activo = ruta === e.href || (!e.exacto && ruta.startsWith(`${e.href}/`));
            return (
              <Link
                key={e.href}
                href={e.href}
                aria-current={activo ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 ${activo ? 'bg-white font-semibold text-marca shadow-sm' : 'text-white hover:bg-white/15'}`}
              >
                {e.modulo && MODULOS_UI[e.modulo] ? <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${activo ? MODULOS_UI[e.modulo].insignia : MODULOS_UI[e.modulo].punto}`} /> : null}
                {e.texto}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="max-w-40 truncate" title={cuenta ? cuenta.nombre_usuario : ''}>{cuenta ? cuenta.nombre_usuario : ''}</span>
          <button
            type="button"
            onClick={() => cerrarSesion()}
            className="rounded-md border border-white/40 px-3 py-1.5 hover:bg-white/10"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}

export function Pie() {
  return (
    <footer className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-slate-500">
      AsistIA · Proyecto Productivo TEINCO · Versión de desarrollo
    </footer>
  );
}
