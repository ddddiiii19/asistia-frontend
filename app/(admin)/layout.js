'use client';

import { RequiereRol } from '@/components/RequiereRol';
import { Encabezado, Pie } from '@/components/Encabezado';

const ENLACES = [
  { href: '/admin/reportes', texto: 'Reportes' },
  { href: '/admin/historial', texto: 'Historial' },
];

export default function LayoutAdmin({ children }) {
  return (
    <RequiereRol rol="administrador">
      <Encabezado enlaces={[{ href: '/admin', texto: 'Panel', exacto: true }, ...ENLACES]} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <Pie />
    </RequiereRol>
  );
}
