'use client';

import React from 'react';
import { Order, Event, Venue, Ticket as TicketType } from '@/types';
import { Check, Calendar, MapPin, Ticket, User, Printer, ArrowRight, Home, Clock, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import QRCode from 'react-qr-code';
import Link from 'next/link';

interface OrderConfirmationProps {
  order: Order;
  event: Event;
  venue: Venue | null;
  tickets: TicketType[];
}

export default function OrderConfirmation({ order, event, venue, tickets }: OrderConfirmationProps) {
  
  const isPending = order.estado === 'pendiente';

  const handlePrint = () => {
    window.print();
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const formattedFecha = new Date(order.funcionFecha).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="space-y-8 print:p-0">
      {/* Cabezal de Éxito / Pendiente - Ocultar en impresión */}
      <div className="text-center space-y-4 print:hidden">
        {isPending ? (
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="h-16 w-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center text-amber-500 mx-auto"
          >
            <Clock className="h-8 w-8 animate-pulse" />
          </motion.div>
        ) : (
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="h-16 w-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-500 mx-auto"
          >
            <Check className="h-8 w-8" />
          </motion.div>
        )}
        
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-white">
            {isPending ? 'Pago en Proceso / Pendiente' : '¡Compra Confirmada!'}
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {isPending ? (
              <span>Estamos esperando la confirmación de la pasarela de pago. Tus tickets y códigos QR se enviarán a <span className="text-white font-semibold">{order.compradorEmail}</span> tan pronto se acredite.</span>
            ) : (
              <span>Hemos procesado tu pago exitosamente. Tus tickets se enviaron por correo electrónico a <span className="text-white font-semibold">{order.compradorEmail}</span>.</span>
            )}
          </p>
        </div>

        <div className="flex justify-center gap-3 pt-2">
          {isPending ? (
            <button 
              onClick={handleRefresh}
              className="flex items-center space-x-2 bg-slate-900 border border-border rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-slate-800 transition text-white cursor-pointer"
            >
              <RefreshCw className="h-4.5 w-4.5 text-primary animate-spin" style={{ animationDuration: '6s' }} />
              <span>Verificar Acreditación</span>
            </button>
          ) : (
            <button 
              onClick={handlePrint}
              className="flex items-center space-x-2 bg-slate-900 border border-border rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-slate-800 transition text-white cursor-pointer"
            >
              <Printer className="h-4.5 w-4.5 text-primary" />
              <span>Imprimir / Descargar PDF</span>
            </button>
          )}
          
          <Link 
            href="/"
            className="flex items-center space-x-2 bg-primary hover:bg-primary-hover rounded-xl px-5 py-2.5 text-sm font-semibold transition text-white"
          >
            <Home className="h-4.5 w-4.5" />
            <span>Volver al Inicio</span>
          </Link>
        </div>
      </div>

      {/* Resumen de Transacción - Ocultar en impresión */}
      <div className="glass-panel border border-border rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm print:hidden">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">ID de la Orden</span>
          <p className="font-mono text-white font-bold">{order.id}</p>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Fecha del Pago</span>
          <p className="text-white font-bold">{new Date(order.createdAt).toLocaleString('es-AR')}</p>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Total Abonado</span>
          <p className="text-primary font-mono font-black text-base">${order.total.toLocaleString('es-AR')}</p>
        </div>
      </div>

      {/* Listado de Entradas Físicas (Estilo stub de ticket) */}
      {!isPending && tickets.length > 0 && (
        <div className="space-y-6 print:space-y-8">
          <h2 className="text-xl font-bold text-white print:hidden">Tus Entradas ({tickets.length})</h2>

          {tickets.map((ticket, index) => (
            <div 
              key={ticket.id}
              className="relative bg-slate-900/60 border border-border/80 rounded-2xl flex flex-col md:flex-row overflow-hidden shadow-xl print:bg-white print:text-black print:border-black print:border-2 print:shadow-none print:break-inside-avoid print:my-4"
            >
              {/* Cuerpo del Ticket (70%) */}
              <div className="flex-grow p-6 space-y-4 md:border-r md:border-dashed md:border-border/60 print:border-black print:border-r-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="inline-block bg-primary/20 text-primary print:bg-black print:text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded-full">
                      {ticket.zona ? 'Zona Libre' : 'Butaca'}
                    </span>
                    <h3 className="text-xl font-black text-white print:text-black leading-tight">
                      {event.título}
                    </h3>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono print:text-black">
                    #{index + 1} de {tickets.length}
                  </span>
                </div>

                {/* Detalles */}
                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground print:text-black">
                  <div className="space-y-1">
                    <span className="flex items-center">
                      <Calendar className="h-3.5 w-3.5 mr-1.5 text-primary print:text-black" />
                      Fecha & Hora
                    </span>
                    <p className="font-bold text-white print:text-black">{formattedFecha} HS</p>
                  </div>
                  <div className="space-y-1">
                    <span className="flex items-center">
                      <MapPin className="h-3.5 w-3.5 mr-1.5 text-primary print:text-black" />
                      Venue / Lugar
                    </span>
                    <p className="font-bold text-white print:text-black">{venue?.nombre} — {venue?.ciudad}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="flex items-center">
                      <Ticket className="h-3.5 w-3.5 mr-1.5 text-primary print:text-black" />
                      Sector / Ubicación
                    </span>
                    <p className="font-bold text-white print:text-black">{ticket.zona || 'General'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="flex items-center">
                      <User className="h-3.5 w-3.5 mr-1.5 text-primary print:text-black" />
                      Titular
                    </span>
                    <p className="font-bold text-white print:text-black">{ticket.holderNombre}</p>
                  </div>
                </div>

                <div className="text-[10px] text-muted-foreground/60 print:text-black/80 font-mono">
                  Código de Ticket: {ticket.id}
                </div>
              </div>

              {/* Talón de Control / QR (30%) */}
              <div className="w-full md:w-64 bg-slate-950/40 p-6 flex flex-col items-center justify-center space-y-4 shrink-0 print:bg-white print:text-black">
                {/* QR Code */}
                <div className="bg-white p-3.5 rounded-xl border border-white/10 print:border-black print:border-2">
                  <QRCode 
                    value={ticket.qrCode} 
                    size={120}
                    className="w-28 h-28"
                  />
                </div>

                <div className="text-center">
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider print:text-black">
                    Código de Validación QR
                  </p>
                  <p className="text-xs font-bold font-mono text-white print:text-black select-all">
                    {ticket.qrCode}
                  </p>
                </div>
              </div>

              {/* Muescas laterales del Ticket físico en desktop */}
              <div className="hidden md:block absolute top-1/2 left-0 -translate-y-1/2 w-4 h-8 bg-background border-r border-border rounded-r-full print:hidden" />
              <div className="hidden md:block absolute top-1/2 right-0 -translate-y-1/2 w-4 h-8 bg-background border-l border-border rounded-l-full print:hidden" />
              
              {/* Delineado de corte para impresión */}
              <div className="hidden md:block absolute top-1/2 left-[calc(100%-16rem)] -translate-y-1/2 w-4 h-8 bg-background border-r border-border rounded-r-full print:hidden" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
