'use client';

import { useParams } from 'next/navigation';
import { DetalleConversacion } from '@/components/Historial';

export default function PaginaDetalle() {
  const { id } = useParams();
  return <DetalleConversacion id={id} />;
}
