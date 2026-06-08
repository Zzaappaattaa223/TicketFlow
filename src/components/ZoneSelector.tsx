'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Event, Venue, Zone } from '@/types';
import { Calendar, MapPin, Plus, Minus, ArrowLeft, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface ZoneSelectorProps {
  event: Event;
  venue: Venue | null;
  zones: Zone[];
  fecha: string;
}

export default function ZoneSelector({ event, venue, zones, fecha }: ZoneSelectorProps) {
  const router = useRouter();
  const { addToCart, sessionId } = useApp();
  
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const formattedFecha = new Date(fecha).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  });

  const handleSelectZone = (zone: Zone) => {
    setSelectedZone(zone);
    setQuantity(1);
    setError('');
  };

  const incrementQty = () => {
    if (!selectedZone) return;
    if (quantity >= 10) {
      setError('Límite máximo de 10 entradas por compra alcanzado.');
      return;
    }
    if (quantity >= selectedZone.capacidadRestante) {
      setError(`No hay más capacidad disponible en la zona ${selectedZone.nombre}.`);
      return;
    }
    setQuantity(prev => prev + 1);
    setError('');
  };

  const decrementQty = () => {
    if (quantity <= 1) return;
    setQuantity(prev => prev - 1);
    setError('');
  };

  const handleProcederPago = async () => {
    if (!selectedZone) return;
    setIsLoading(true);
    setError('');

    try {
      const lockSuccess = await addToCart(event, fecha, selectedZone, quantity);
      if (lockSuccess) {
        // Bloqueo exitoso, redirigir al checkout
        router.push('/checkout');
      } else {
        setError('No se pudo reservar la capacidad solicitada. Es posible que las entradas se hayan agotado o estén bloqueadas temporalmente por otro usuario. Por favor, intenta de nuevo o elige otra zona.');
      }
    } catch (e) {
      setError('Ocurrió un error inesperado al intentar reservar tus entradas.');
    } finally {
      setIsLoading(false);
    }
  };

  // Cálculos en tiempo real para pre-resumen
  const subtotal = selectedZone ? selectedZone.precio * quantity : 0;
  const cargo = selectedZone 
    ? event.tipoCargo === 'porcentaje' 
      ? (subtotal * event.cargoServicio) / 100 
      : event.cargoServicio * quantity
    : 0;
  const total = subtotal + cargo;

  return (
    <div className="space-y-6">
      {/* Botón Volver */}
      <Link 
        href={`/event/${event.id}`}
        className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition space-x-1"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Volver a detalles del espectáculo</span>
      </Link>

      {/* Encabezado */}
      <div className="bg-slate-900/20 border border-border/50 rounded-2xl p-6">
        <span className="text-xs uppercase font-semibold text-primary">{event.categoría}</span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">{event.título}</h1>
        <div className="flex flex-col sm:flex-row gap-4 text-xs text-muted-foreground mt-3">
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-1 text-primary" />
            <span>{formattedFecha}</span>
          </div>
          {venue && (
            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-1 text-primary" />
              <span>{venue.nombre} ({venue.ciudad})</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Columna Izquierda: Listado de Zonas */}
        <div className="md:col-span-7 space-y-4">
          <h2 className="text-xl font-bold text-white">Selecciona tu Zona</h2>
          
          <div className="space-y-3">
            {zones.map((zone) => {
              const isSelected = selectedZone?.id === zone.id;
              const isAgotado = zone.capacidadRestante <= 0;
              const isVip = zone.tipo === 'VIP';

              return (
                <button
                  key={zone.id}
                  disabled={isAgotado}
                  onClick={() => handleSelectZone(zone)}
                  className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 flex items-center justify-between cursor-pointer ${
                    isAgotado 
                      ? 'bg-slate-900/10 border-border/40 opacity-50 cursor-not-allowed'
                      : isSelected
                        ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5'
                        : 'bg-slate-900/40 border-border/80 hover:border-muted'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isVip ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-white/5 text-muted-foreground'
                      }`}>
                        {zone.tipo}
                      </span>
                      {isAgotado && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          Agotado
                        </span>
                      )}
                    </div>
                    <p className="text-base font-extrabold text-white">{zone.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      Ubicaciones libres: <span className="font-semibold text-foreground">{zone.capacidadRestante}</span>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-lg font-black text-white">${zone.precio.toLocaleString('es-AR')}</span>
                    <p className="text-[9px] text-muted-foreground">cada una</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Columna Derecha: Configuración Stepper y Resumen */}
        <div className="md:col-span-5 space-y-4">
          <h2 className="text-xl font-bold text-white">Resumen y Cantidad</h2>

          {selectedZone ? (
            <div className="glass-panel border border-border rounded-2xl p-6 space-y-6">
              {/* Stepper */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
                  ¿Cuántas entradas deseas?
                </p>
                <div className="flex items-center justify-center space-x-6">
                  <button
                    onClick={decrementQty}
                    className="h-10 w-10 rounded-full border border-border bg-slate-900 flex items-center justify-center hover:bg-slate-800 text-foreground transition active:scale-95"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  
                  <span className="text-3xl font-black text-white w-12 text-center">{quantity}</span>
                  
                  <button
                    onClick={incrementQty}
                    className="h-10 w-10 rounded-full border border-border bg-slate-900 flex items-center justify-center hover:bg-slate-800 text-foreground transition active:scale-95"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-[10px] text-center text-muted-foreground">Máximo 10 por compra</p>
              </div>

              {/* Detalle de precios */}
              <div className="border-t border-border/50 pt-4 space-y-2.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Ubicación:</span>
                  <span className="text-white font-semibold">{selectedZone.nombre} ({quantity}x)</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="text-white">${subtotal.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Cargo por Servicio:</span>
                  <span className="text-white">${cargo.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between text-lg font-black border-t border-border/50 pt-3 text-white">
                  <span>Total estimado:</span>
                  <span className="text-primary">${total.toLocaleString('es-AR')}</span>
                </div>
              </div>

              {error && (
                <div className="flex items-start space-x-2 text-xs text-primary bg-primary/10 border border-primary/20 rounded-lg p-3">
                  <AlertCircle className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleProcederPago}
                disabled={isLoading}
                className="w-full glow-button bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center space-x-2 text-base cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Reservando...</span>
                  </>
                ) : (
                  <>
                    <span>Confirmar Reserva</span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="glass-panel border border-border/40 border-dashed rounded-2xl p-10 text-center flex flex-col items-center justify-center h-48">
              <p className="text-muted-foreground text-sm">Por favor, selecciona una zona de la lista para continuar.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
