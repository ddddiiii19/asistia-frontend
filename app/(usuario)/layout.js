'use client';

import { RequiereRol } from '@/components/RequiereRol';
import { Encabezado, Pie } from '@/components/Encabezado';

const ENLACES = [
  { href: '/chat', texto: 'Asistente', modulo: 'chat' },
  { href: '/historial', texto: 'Mi historial', modulo: 'historial' },
];

export default function LayoutUsuario({ children }) {
  return (
    <RequiereRol rol="usuario">
      <Encabezado enlaces={ENLACES} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <Pie />
    </RequiereRol>
  );
}
