'use client';

import { RequiereRol } from '@/components/RequiereRol';
import { Encabezado, Pie } from '@/components/Encabezado';

const ENLACES = [
  { href: '/admin', texto: 'Panel', exacto: true, modulo: 'panel' },
  { href: '/admin/reportes', texto: 'Reportes', modulo: 'reportes' },
  { href: '/admin/informacion', texto: 'Información', modulo: 'informacion' },
  { href: '/admin/faq', texto: 'Preguntas frecuentes', modulo: 'faq' },
  { href: '/admin/historial', texto: 'Historial', modulo: 'historial' },
];

export default function LayoutAdmin({ children }) {
  return (
    <RequiereRol rol="administrador">
      <Encabezado enlaces={ENLACES} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <Pie />
    </RequiereRol>
  );
}
