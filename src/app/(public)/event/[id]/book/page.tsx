import React from 'react';
import { getEventByIdAction, getZonesForEventAction, getVenueByIdAction } from '@/app/actions';
import ZoneSelector from '@/components/ZoneSelector';
import SeatMapClient from '@/components/SeatMapClient';
import { notFound } from 'next/navigation';

interface BookPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fecha?: string }>;
}

export const revalidate = 0;

export default async function BookPage({ params, searchParams }: BookPageProps) {
  const { id } = await params;
  const { fecha } = await searchParams;

  if (!fecha) {
    notFound();
  }

  const event = await getEventByIdAction(id);
  if (!event) {
    notFound();
  }

  const venue = await getVenueByIdAction(event.venueId);
  const zones = await getZonesForEventAction(event.id);

  const isNumerado = event.modo === 'numerado';

  return (
    <div className={`mx-auto px-4 sm:px-6 lg:px-8 py-10 ${isNumerado ? 'max-w-7xl' : 'max-w-4xl'}`}>
      {isNumerado ? (
        <SeatMapClient event={event} venue={venue} fecha={fecha} />
      ) : (
        <ZoneSelector event={event} venue={venue} zones={zones} fecha={fecha} />
      )}
    </div>
  );
}
