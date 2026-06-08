'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Event, Venue } from '@/types';

// Carga dinámica del mapa de butacas interactivo desactivando SSR
const SeatMap = dynamic(() => import('@/components/SeatMap'), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-20 bg-slate-900/10 border border-border rounded-2xl h-[420px] items-center">
      <div className="text-center space-y-3">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-xs text-muted-foreground">Cargando plano interactivo del venue...</p>
      </div>
    </div>
  )
});

interface SeatMapClientProps {
  event: Event;
  venue: Venue | null;
  fecha: string;
}

export default function SeatMapClient({ event, venue, fecha }: SeatMapClientProps) {
  return <SeatMap event={event} venue={venue} fecha={fecha} />;
}
