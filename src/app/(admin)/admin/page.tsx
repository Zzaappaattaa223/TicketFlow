import React from 'react';
import { dbService } from '@db/index';
import { authService } from '@/lib/auth';
import { Calendar, MapPin, DollarSign, Ticket, AlertTriangle, TrendingUp, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import RecentOrdersTable from '@/components/RecentOrdersTable';

export const revalidate = 0;

export default async function AdminDashboardPage() {
  const currentUser = await authService.getCurrentUser();
  
  const rawOrders = await dbService.getOrders();
  const rawEvents = await dbService.getEvents();
  const rawVenues = await dbService.getVenues();

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

  const venuesMap = new Map(venues.map(v => [v.id, v]));

  // Cálculos de métricas globales (sobre los datos ya filtrados)
  const paidOrders = orders.filter(o => o.estado === 'pagado');
  const totalIngresos = paidOrders.reduce((sum, o) => sum + o.total, 0);
  
  // Calcular cantidad total de tickets vendidos
  const totalTickets = paidOrders.reduce((sum, o) => {
    const qtyZone = o.zonaLibre?.cantidad || 0;
    const qtySeats = o.seats?.length || 0;
    return sum + qtyZone + qtySeats;
  }, 0);

  // Ventas del día (últimas 24h)
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const ordenesHoy = paidOrders.filter(o => new Date(o.createdAt) > hace24h);
  const ingresosHoy = ordenesHoy.reduce((sum, o) => sum + o.total, 0);
  const ticketsHoy = ordenesHoy.reduce((sum, o) => {
    const qtyZone = o.zonaLibre?.cantidad || 0;
    const qtySeats = o.seats?.length || 0;
    return sum + qtyZone + qtySeats;
  }, 0);

  // Ocupación por evento
  const occupancyList = await Promise.all(
    events.map(async (event) => {
      const eventZones = await dbService.getZonesForEvent(event.id);
      const totalCapacidad = eventZones.reduce((sum, z) => sum + z.capacidad, 0);
      const eventTickets = await dbService.getTicketsByEventId(event.id);
      
      const porc = totalCapacidad > 0 ? Math.round((eventTickets.length / totalCapacidad) * 100) : 0;
      
      return {
        id: event.id,
        título: event.título,
        categoria: event.categoría,
        capacidad: totalCapacidad,
        vendidos: eventTickets.length,
        porcentaje: porc
      };
    })
  );

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div>
        <h1 className="text-3xl font-black text-white">Dashboard de Control</h1>
        <p className="text-sm text-muted-foreground">
          {isRestricted 
            ? 'Métricas comerciales y de ocupación asociadas a tus salas.' 
            : 'Métricas comerciales y estado de ocupación global de las salas.'}
        </p>
      </div>

      {/* Grid de KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Facturación Total */}
        <div className="glass-panel border border-border rounded-2xl p-6 space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Ingresos Totales</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <DollarSign className="h-4.5 w-4.5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-white font-mono">${totalIngresos.toLocaleString('es-AR')}</p>
            <p className="text-xs text-emerald-500 mt-1 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" />
              <span>Acumulado Neto</span>
            </p>
          </div>
        </div>

        {/* Facturación Hoy */}
        <div className="glass-panel border border-border rounded-2xl p-6 space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Ventas de Hoy</span>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <DollarSign className="h-4.5 w-4.5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-white font-mono">${ingresosHoy.toLocaleString('es-AR')}</p>
            <p className="text-xs text-muted-foreground mt-1 font-semibold">
              {ordenesHoy.length} órdenes en las últimas 24hs
            </p>
          </div>
        </div>

        {/* Entradas Vendidas */}
        <div className="glass-panel border border-border rounded-2xl p-6 space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Entradas Emitidas</span>
            <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
              <Ticket className="h-4.5 w-4.5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-white">{totalTickets} <span className="text-xs text-muted-foreground">tickets</span></p>
            <p className="text-xs text-accent mt-1">
              +{ticketsHoy} hoy
            </p>
          </div>
        </div>

        {/* Total Eventos Activos */}
        <div className="glass-panel border border-border rounded-2xl p-6 space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Espectáculos</span>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Calendar className="h-4.5 w-4.5" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-white">{events.length} <span className="text-xs text-muted-foreground">activos</span></p>
            <p className="text-xs text-muted-foreground mt-1">
              En cartelera pública
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Columna Izquierda: Ocupación por Evento (7 cols) */}
        <div className="lg:col-span-7 glass-panel border border-border rounded-2xl p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">Ocupación de Funciones</h2>
            <span className="text-xs text-muted-foreground">Actualizado en tiempo real</span>
          </div>

          <div className="space-y-5">
            {occupancyList.map((occ) => (
              <div key={occ.id} className="space-y-2">
                <div className="flex justify-between items-end text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-white text-sm">{occ.título}</span>
                    <p className="text-[10px] text-muted-foreground uppercase">{occ.categoria}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-white font-semibold">{occ.vendidos}</span>
                    <span className="text-muted-foreground"> / {occ.capacidad} vendidos</span>
                    <span className="font-bold text-primary ml-2 font-mono">{occ.porcentaje}%</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500" 
                    style={{ width: `${occ.porcentaje}%` }}
                  />
                </div>
              </div>
            ))}

            {occupancyList.length === 0 && (
              <p className="text-muted-foreground text-center py-12">No hay espectáculos programados en tus salas.</p>
            )}
          </div>
        </div>

        {/* Columna Derecha: Alertas o Acciones Rápidas (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Alertas */}
          <div className="glass-panel border border-border rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Alertas Operativas</h2>
            
            <div className="space-y-3 text-xs">
              {occupancyList.filter(o => o.porcentaje >= 85).map(o => (
                <div key={o.id} className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 flex items-start space-x-2 text-amber-500">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                  <div>
                    <span className="font-bold text-white">Evento próximo a agotarse:</span>
                    <p className="text-muted-foreground mt-0.5">{o.título} superó el 85% de capacidad ({o.porcentaje}%).</p>
                  </div>
                </div>
              ))}

              {occupancyList.filter(o => o.porcentaje >= 85).length === 0 && (
                <p className="text-muted-foreground text-center py-4">No hay alertas activas en este momento.</p>
              )}
            </div>
          </div>

          {/* Accesos Rápidos */}
          <div className="glass-panel border border-border rounded-2xl p-6 space-y-3">
            <h2 className="text-lg font-bold text-white">Atajos Rápidos</h2>
            <div className="grid grid-cols-2 gap-3">
              {!isRestricted && (
                <Link 
                  href="/admin/salas"
                  className="bg-slate-900 border border-border/80 hover:border-primary/20 rounded-xl p-3 text-center space-y-1 text-xs text-muted-foreground hover:text-white transition"
                >
                  <MapPin className="h-5 w-5 text-primary mx-auto" />
                  <p className="font-bold">Nueva Sala</p>
                </Link>
              )}
              <Link 
                href="/admin/events"
                className={`bg-slate-900 border border-border/80 hover:border-primary/20 rounded-xl p-3 text-center space-y-1 text-xs text-muted-foreground hover:text-white transition`}
              >
                <Calendar className="h-5 w-5 text-primary mx-auto" />
                <p className="font-bold">Crear Evento</p>
              </Link>
              <Link 
                href="/admin/boleteria"
                className={`bg-slate-900 border border-border/80 hover:border-primary/20 rounded-xl p-3 text-center space-y-1 text-xs text-muted-foreground hover:text-white transition col-span-2`}
              >
                <ShoppingBag className="h-5 w-5 text-primary mx-auto" />
                <p className="font-bold">Ir a Boletería / Cortesías</p>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Historial de Órdenes Recientes */}
      <div className="glass-panel border border-border rounded-2xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">Ventas y Órdenes Recientes</h2>
          <span className="text-xs text-muted-foreground">Total: {orders.length} órdenes registradas</span>
        </div>

        <RecentOrdersTable initialOrders={orders} events={events} />
      </div>
    </div>
  );
}
