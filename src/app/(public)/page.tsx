import React from 'react';
import { getEventsAction, getVenuesAction } from '@/app/actions';
import EventList from '@/components/EventList';
import { Calendar, MapPin, Sparkles } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0; // Evitar almacenamiento en caché para datos en tiempo real

export default async function HomePage() {
  const events = await getEventsAction();
  const venues = await getVenuesAction();

  // Filtrar eventos publicados
  const publishedEvents = events.filter(e => e.estado === 'publicado');

  // Elegir el primer evento como destacado
  const featuredEvent = publishedEvents[0];
  const featuredVenue = featuredEvent
    ? venues.find(v => v.id === featuredEvent.venueId)
    : null;

  return (
    <div className="pb-16">
      {/* Sección Hero Destacado */}
      {featuredEvent && (
        <section className="relative w-full h-[70vh] min-h-[450px] flex items-end overflow-hidden">
          {/* Imagen de Fondo */}
          <div 
            className="absolute inset-0 bg-cover bg-center z-0 transform scale-105 transition-transform duration-10000 ease-out"
            style={{ backgroundImage: `url(${featuredEvent.imágenes[0]})` }}
          />
          {/* Capas de degradado para inmersión cinematográfica */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent z-10" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-transparent to-transparent z-10" />

          {/* Información del Evento */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pb-12 z-20 relative">
            <div className="max-w-2xl space-y-4">
              <span className="inline-flex items-center space-x-1.5 bg-primary/20 border border-primary/30 text-primary text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                <Sparkles className="h-3 w-3" />
                <span>Destacado de la Semana</span>
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
                {featuredEvent.título}
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base line-clamp-3">
                {featuredEvent.descripción}
              </p>
              
              <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-foreground/80 py-2">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 text-primary mr-1.5" />
                  <span>{new Date(featuredEvent.fechas[0]).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                </div>
                {featuredVenue && (
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 text-primary mr-1.5" />
                    <span>{featuredVenue.nombre} ({featuredVenue.ciudad})</span>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Link 
                  href={`/event/${featuredEvent.id}`}
                  className="glow-button inline-flex items-center justify-center bg-primary hover:bg-primary-hover text-white text-sm font-bold px-6 py-3 rounded-lg transition-colors duration-300"
                >
                  Adquirir Entradas
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Listado y Filtros Interactivos */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight">Cartelera de Espectáculos</h2>
          <p className="text-muted-foreground text-sm">Explora las funciones disponibles y reserva tu butaca.</p>
        </div>
        <EventList initialEvents={publishedEvents} venues={venues} />
      </section>
    </div>
  );
}
