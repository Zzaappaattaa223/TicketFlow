'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Event, Venue, Zone } from '@/types';
import { Calendar, MapPin, Clock, ShieldAlert, Sparkles, ArrowRight, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';

interface EventDetailProps {
  event: Event;
  venue: Venue | null;
  initialZones: Zone[];
  source?: string;
}

export default function EventDetail({ event, venue, initialZones, source }: EventDetailProps) {
  const router = useRouter();
  // Por defecto, seleccionar la primera fecha
  const [selectedFecha, setSelectedFecha] = useState(event.fechas[0]);

  const formattedFecha = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleBookingRedirect = () => {
    // Redirigir al selector de entradas por zona con la fecha elegida
    router.push(`/event/${event.id}/book?fecha=${encodeURIComponent(selectedFecha)}`);
  };

  const showVenueFirst = source === 'venue' && venue;

  return (
    <div className="space-y-8">
      {showVenueFirst ? (
        /* VISTA PRIORIZANDO LA SALA */
        <div className="space-y-8">
          {/* Banner de la Sala */}
          <div className="relative rounded-3xl overflow-hidden glass-panel border border-border">
            <div className="grid grid-cols-1 lg:grid-cols-12">
              {/* Imagen izquierda (Sala) */}
              <div className="lg:col-span-5 relative aspect-video lg:aspect-auto min-h-[250px]">
                <img 
                  src={venue.imagen || 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&q=80&w=1000'} 
                  alt={venue.nombre} 
                  className="object-cover w-full h-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-l from-[#060913] via-transparent to-transparent" />
              </div>

              {/* Información de la Sala */}
              <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <span className="inline-flex items-center space-x-1.5 bg-accent/20 border border-accent/30 text-accent text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                    <span>Sala de Teatro</span>
                  </span>
                  <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                    {venue.nombre}
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground flex items-center">
                    <MapPin className="h-4 w-4 mr-1.5 text-primary shrink-0" />
                    <span>{venue.ciudad} · Capacidad: {venue.capacidad} espectadores</span>
                  </p>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Bienvenido a la página oficial de accesos de la sala. A continuación, puedes ver y reservar tus entradas para el espectáculo programado.
                </p>
              </div>
            </div>
          </div>

          {/* Información del Evento Destacado Secundario */}
          <div className="bg-[#0b101d]/60 border border-border/80 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-center">
            {/* Mini Imagen del Evento */}
            <div className="h-28 w-28 sm:h-36 sm:w-36 rounded-2xl overflow-hidden shrink-0 border border-border/50">
              <img src={event.imágenes[0]} alt={event.título} className="object-cover h-full w-full" />
            </div>
            {/* Info del show */}
            <div className="space-y-3 flex-grow text-center sm:text-left">
              <div className="space-y-1">
                <span className="inline-block bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                  Espectáculo Destacado
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">{event.título}</h2>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{event.descripción}</p>
              <div className="flex flex-wrap gap-4 justify-center sm:justify-start text-[10px] font-bold text-muted-foreground">
                <span className="capitalize">Categoría: {event.categoría}</span>
                <span>Modo: {event.modo === 'libre' ? 'Zonas Libres' : 'Butacas Numeradas'}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* VISTA TRADICIONAL PRIORIZANDO EL EVENTO */
        <div className="relative rounded-3xl overflow-hidden glass-panel border border-border">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Imagen izquierda */}
            <div className="lg:col-span-5 relative aspect-video lg:aspect-auto min-h-[300px]">
              <img 
                src={event.imágenes[0]} 
                alt={event.título} 
                className="object-cover w-full h-full"
              />
              <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-l from-[#060913] via-transparent to-transparent" />
            </div>

            {/* Información principal derecha */}
            <div className="lg:col-span-7 p-8 flex flex-col justify-center space-y-6">
              <div className="space-y-3">
                <span className="inline-flex items-center space-x-1.5 bg-primary/20 border border-primary/30 text-primary text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                  <Sparkles className="h-3 w-3" />
                  <span>{event.categoría}</span>
                </span>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                  {event.título}
                </h1>
                {venue && (
                  <div className="flex items-center text-muted-foreground text-sm sm:text-base">
                    <MapPin className="h-4.5 w-4.5 mr-2 text-primary" />
                    <span>{venue.nombre} — {venue.ciudad}</span>
                  </div>
                )}
              </div>

              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                {event.descripción}
              </p>

              <div className="flex flex-wrap gap-6 text-xs sm:text-sm text-foreground/80 border-t border-border/50 pt-4">
                <div className="flex items-center">
                  <Clock className="h-4.5 w-4.5 text-primary mr-2" />
                  <span>Duración: 120 mins aprox.</span>
                </div>
                <div className="flex items-center">
                  <ShieldAlert className="h-4.5 w-4.5 text-primary mr-2" />
                  <span>Clasificación: ATP</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selector de Fechas y Precios */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Columna Izquierda: Seleccionar Función */}
        <div className="lg:col-span-1 space-y-6">
          <h2 className="text-2xl font-bold border-b border-border/50 pb-2">1. Elige tu Función</h2>
          
          <div className="space-y-3">
            {event.fechas.map((fecha) => {
              const isSelected = selectedFecha === fecha;
              const dateObj = new Date(fecha);
              
              return (
                <button
                  key={fecha}
                  onClick={() => setSelectedFecha(fecha)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-300 cursor-pointer flex justify-between items-center ${
                    isSelected
                      ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5'
                      : 'bg-slate-900/40 border-border hover:border-muted'
                  }`}
                >
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wider font-semibold text-primary">
                      {dateObj.toLocaleDateString('es-AR', { weekday: 'long' })}
                    </p>
                    <p className="text-base font-bold text-white">
                      {dateObj.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Horario: {dateObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} HS
                    </p>
                  </div>
                  {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Columna Derecha: Precios y CTA */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-2xl font-bold border-b border-border/50 pb-2">2. Precios por Zona</h2>
          
          <div className="glass-panel border border-border rounded-2xl p-6 space-y-6">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Función seleccionada: <span className="font-semibold text-white">{formattedFecha(selectedFecha)}</span>
              </p>

              <div className="space-y-3">
                {initialZones.map((zone) => {
                  const isVip = zone.tipo === 'VIP';
                  return (
                    <div 
                      key={zone.id} 
                      className="flex items-center justify-between p-4 rounded-xl bg-slate-900/40 border border-border/60"
                    >
                      <div className="space-y-0.5">
                        <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full mb-1 ${
                          isVip 
                            ? 'bg-accent/10 text-accent border border-accent/20' 
                            : 'bg-white/5 text-muted-foreground'
                        }`}>
                          {zone.tipo}
                        </span>
                        <p className="text-base font-bold text-white">{zone.nombre}</p>
                        <p className="text-xs text-muted-foreground">Capacidad disponible: {zone.capacidadRestante} ubicaciones</p>
                      </div>

                      <div className="text-right">
                        <span className="text-xl font-black text-white">
                          ${zone.precio.toLocaleString('es-AR')}
                        </span>
                        <p className="text-[10px] text-muted-foreground">Arancel base</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-border/50 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-left text-xs text-muted-foreground max-w-xs">
                * Las compras están sujetas a un cargo de servicio del {event.cargoServicio}% sobre el total de las entradas.
              </div>
              
              <button 
                onClick={handleBookingRedirect}
                className="w-full sm:w-auto glow-button bg-primary hover:bg-primary-hover text-white font-bold px-8 py-3.5 rounded-xl transition flex items-center justify-center space-x-2 text-base cursor-pointer"
              >
                <span>Reservar Entradas</span>
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
