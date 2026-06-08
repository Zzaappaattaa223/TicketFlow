import React from 'react';
import { authService } from '@/lib/auth';
import { dbService } from '@db/index';
import { Calendar, MapPin, Ticket, ShieldAlert, ArrowRight, Home, TicketIcon } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const revalidate = 0;

export default async function MisEntradasPage() {
  const user = await authService.getCurrentUser();

  if (!user) {
    // Si no está autenticado, redirigir al home
    redirect('/');
  }

  // Obtener órdenes del usuario
  const orders = await dbService.getOrdersByUserId(user.id);
  
  // Agrupar órdenes pagadas
  const paidOrders = orders.filter(o => o.estado === 'pagado').sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Obtener eventos para mapear info
  const events = await dbService.getEvents();
  const venues = await dbService.getVenues();

  const eventsMap = new Map(events.map(e => [e.id, e]));
  const venuesMap = new Map(venues.map(v => [v.id, v]));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white">Mis Entradas</h1>
        <p className="text-muted-foreground text-sm">Historial de tus reservas y compras de espectáculos.</p>
      </div>

      {paidOrders.length > 0 ? (
        <div className="space-y-4">
          {paidOrders.map(async (order) => {
            const event = eventsMap.get(order.eventId);
            if (!event) return null;
            const venue = venuesMap.get(event.venueId);
            const tickets = await dbService.getTicketsByOrderId(order.id);

            const formattedDate = new Date(order.funcionFecha).toLocaleDateString('es-AR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div 
                key={order.id}
                className="glass-panel border border-border rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:border-primary/20 transition-all duration-300"
              >
                {/* Info Evento */}
                <div className="flex space-x-4">
                  <img 
                    src={event.imágenes[0]} 
                    alt={event.título} 
                    className="w-24 aspect-video object-cover rounded-lg border border-border"
                  />
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white leading-tight">{event.título}</h2>
                    <p className="text-[10px] text-primary font-bold uppercase tracking-wider">{event.categoría}</p>
                    
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground pt-1">
                      <span className="flex items-center">
                        <Calendar className="h-3.5 w-3.5 mr-1.5 text-primary/80" />
                        {formattedDate} HS
                      </span>
                      {venue && (
                        <span className="flex items-center">
                          <MapPin className="h-3.5 w-3.5 mr-1.5 text-primary/80" />
                          {venue.nombre} ({venue.ciudad})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Info Ticket y CTA */}
                <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-4 md:gap-2 border-t md:border-t-0 border-border/40 pt-4 md:pt-0">
                  <div className="text-left md:text-right space-y-0.5">
                    <span className="inline-flex items-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full mb-1">
                      Completado
                    </span>
                    <p className="text-sm font-semibold text-white">
                      {tickets.length} {tickets.length === 1 ? 'entrada' : 'entradas'}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">Orden: {order.id.substring(6, 15).toUpperCase()}</p>
                  </div>

                  <Link 
                    href={`/confirmation/${order.id}`}
                    className="flex items-center space-x-1 bg-secondary hover:bg-secondary-hover text-secondary-foreground text-xs font-semibold px-4 py-2.5 rounded-lg border border-border hover:border-primary/20 transition-all duration-300"
                  >
                    <span>Ver Entradas (QR)</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel border border-border/40 border-dashed rounded-2xl py-16 text-center space-y-4 max-w-lg mx-auto">
          <div className="h-12 w-12 bg-white/5 rounded-full flex items-center justify-center mx-auto text-muted-foreground">
            <TicketIcon className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">No tienes entradas adquiridas</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Aún no has comprado entradas para ningún espectáculo. ¡Explora las próximas funciones!
            </p>
          </div>
          <Link 
            href="/"
            className="inline-flex bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
          >
            Ver Cartelera
          </Link>
        </div>
      )}
    </div>
  );
}
