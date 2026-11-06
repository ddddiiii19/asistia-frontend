'use client';

import { useParams } from 'next/navigation';
import { ConversacionAdmin } from '@/components/historial/ConversacionAdmin';

export default function PaginaConversacionAdmin() {
  const { id } = useParams();
  return <ConversacionAdmin id={id} />;
}
