'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Event, Venue, EventCategory } from '@/types';
import { Calendar, MapPin, Search, Music, Sparkles, Film, Mic, BookOpen, Users, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EventListProps {
  initialEvents: Event[];
  venues: Venue[];
}

const CATEGORIES: { value: EventCategory | 'all'; label: string; icon: any }[] = [
  { value: 'all', label: 'Todos', icon: Compass },
  { value: 'concierto', label: 'Conciertos', icon: Music },
  { value: 'teatro', label: 'Teatro', icon: Sparkles },
  { value: 'danza', label: 'Danza', icon: Users },
  { value: 'stand-up', label: 'Stand-Up', icon: Mic },
  { value: 'cine', label: 'Cine', icon: Film },
  { value: 'conferencia', label: 'Conferencias', icon: BookOpen },
  { value: 'taller', label: 'Talleres', icon: BookOpen },
];

export default function EventList({ initialEvents, venues }: EventListProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'all'>('all');
  const [selectedVenueId, setSelectedVenueId] = useState<string>('all');

  const venuesMap = useMemo(() => {
    return new Map(venues.map(v => [v.id, v]));
  }, [venues]);

  const filteredEvents = useMemo(() => {
    return initialEvents.filter(event => {
      const matchesSearch = event.título.toLowerCase().includes(search.toLowerCase()) ||
                            event.descripción.toLowerCase().includes(search.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || event.categoría === selectedCategory;
      const matchesVenue = selectedVenueId === 'all' || event.venueId === selectedVenueId;

      return matchesSearch && matchesCategory && matchesVenue;
    });
  }, [initialEvents, search, selectedCategory, selectedVenueId]);

  return (
    <div className="space-y-8">
      {/* Controles de Filtrado */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Buscador */}
        <div className="relative flex-grow max-w-md">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Buscar espectáculos, artistas..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/60 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-300 placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Selector de Venue */}
        <div className="flex items-center space-x-2">
          <MapPin className="h-4 w-4 text-primary" />
          <select 
            value={selectedVenueId}
            onChange={(e) => setSelectedVenueId(e.target.value)}
            className="bg-slate-900 border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition"
          >
            <option value="all">Todos los Venues</option>
            {venues.map(v => (
              <option key={v.id} value={v.id}>{v.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Categorías (Scroll Horizontal en Móviles) */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition-all duration-200 cursor-pointer ${
                isSelected 
                  ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                  : 'bg-slate-900/60 border-border text-muted-foreground hover:text-foreground hover:border-muted'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Grilla de Eventos */}
      {filteredEvents.length > 0 ? (
        <motion.div 
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <AnimatePresence mode="popLayout">
            {filteredEvents.map((event) => {
              const venue = venuesMap.get(event.venueId);
              const formattedDate = new Date(event.fechas[0]).toLocaleDateString('es-AR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              });

              return (
                <motion.div
                  key={event.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="group flex flex-col bg-slate-900/40 border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 h-full"
                >
                  {/* Contenedor de Imagen */}
                  <Link href={`/event/${event.id}`} className="relative aspect-video w-full overflow-hidden block">
                    <img 
                      src={event.imágenes[0]} 
                      alt={event.título} 
                      className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-primary border border-white/5">
                      {event.categoría}
                    </div>
                  </Link>

                  {/* Detalle */}
                  <div className="p-5 flex flex-col flex-grow space-y-4">
                    <div className="space-y-1.5 flex-grow">
                      <h3 className="text-xl font-bold leading-tight group-hover:text-primary transition-colors line-clamp-1">
                        <Link href={`/event/${event.id}`}>{event.título}</Link>
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {event.descripción}
                      </p>
                    </div>

                    {/* Fecha y Venue */}
                    <div className="space-y-2 text-xs border-t border-border/40 pt-4">
                      <div className="flex items-center text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 mr-2 text-primary/80" />
                        <span>{formattedDate} ({event.fechas.length > 1 ? `${event.fechas.length} funciones` : 'Única función'})</span>
                      </div>
                      {venue && (
                        <div className="flex items-center text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 mr-2 text-primary/80" />
                          <span>{venue.nombre} — {venue.ciudad}</span>
                        </div>
                      )}
                    </div>

                    {/* Botón y Precio */}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-muted-foreground">
                        Modo:{' '}
                        <span className="font-semibold text-foreground">
                          {event.modo === 'libre' ? 'Zona Libre' : 'Butaca Numerada'}
                        </span>
                      </span>
                      
                      <Link 
                        href={`/event/${event.id}`}
                        className="bg-secondary hover:bg-secondary-hover text-secondary-foreground text-xs font-semibold px-4 py-2 rounded-lg border border-border hover:border-primary/30 transition-all duration-300"
                      >
                        Ver Detalles
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="text-center py-16 bg-slate-900/10 border border-dashed border-border rounded-2xl">
          <p className="text-muted-foreground">No se encontraron espectáculos con los filtros seleccionados.</p>
        </div>
      )}
    </div>
  );
}
