import React from 'react';
import { getEventByIdAction, getVenueByIdAction, getZonesForEventAction } from '@/app/actions';
import EventDetail from '@/components/EventDetail';
import { notFound } from 'next/navigation';

interface EventPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string }>;
}

export const revalidate = 0;

export default async function EventPage({ params, searchParams }: EventPageProps) {
  const { id } = await params;
  const { source } = await searchParams;
  
  const event = await getEventByIdAction(id);
  if (!event) {
    notFound();
  }

  const venue = await getVenueByIdAction(event.venueId);
  const zones = await getZonesForEventAction(event.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <EventDetail event={event} venue={venue} initialZones={zones} source={source} />
    </div>
  );
}
