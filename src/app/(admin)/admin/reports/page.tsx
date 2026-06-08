import React from 'react';
import { dbService } from '@db/index';
import { authService } from '@/lib/auth';
import ReportsDashboard from '@/components/ReportsDashboard';

export const revalidate = 0;

export default async function AdminReportsPage() {
  const currentUser = await authService.getCurrentUser();

  const rawOrders = await dbService.getOrders();
  const rawEvents = await dbService.getEvents();
  const rawVenues = await dbService.getVenues();
  const rawTickets = await dbService.getTicketsByEventId(''); // obtener todos

  // Filtrado de permisos finos
  const isRestricted = currentUser && (currentUser.rol === 'Admin de Sala' || currentUser.rol === 'Productor');
  const allowedVenueIds = currentUser?.venueIds || [];

  const venues = isRestricted 
    ? rawVenues.filter(v => allowedVenueIds.includes(v.id))
    : rawVenues;

  const events = isRestricted
    ? rawEvents.filter(e => allowedVenueIds.includes(e.venueId))
    : rawEvents;

  const orders = isRestricted
    ? rawOrders.filter(o => events.some(e => e.id === o.eventId))
    : rawOrders;

  const tickets = isRestricted
    ? rawTickets.filter(t => events.some(e => e.id === t.eventId))
    : rawTickets;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">Reportes y Analíticas</h1>
        <p className="text-sm text-muted-foreground">Analiza el rendimiento comercial, facturación y exportación de auditorías.</p>
      </div>

      <ReportsDashboard orders={orders} events={events} venues={venues} tickets={tickets} />
    </div>
  );
}
