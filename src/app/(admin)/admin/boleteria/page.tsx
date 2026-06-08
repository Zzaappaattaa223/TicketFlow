'use client';

import React, { useState, useEffect } from 'react';
import { getEventsAction, getVenueByIdAction, getZonesForEventAction, getSeatsForEventAction, createPresentialOrderAction } from '@/app/actions';
import { Event, Venue, Zone, Seat, Order } from '@/types';
import { Calendar, MapPin, User, CreditCard, Printer, ArrowLeft, CheckCircle, Ticket, Plus, Minus, Info, Users, DollarSign, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import QRCode from 'react-qr-code';

export default function BoleteriaPage() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Datos del backend
  const [events, setEvents] = useState<Event[]>([]);
  const [venues, setVenues] = useState<Record<string, Venue>>({});
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  // Selección de Evento y Fecha
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedFecha, setSelectedFecha] = useState<string>('');

  // Selección de Localidades
  const [eventZones, setEventZones] = useState<Zone[]>([]);
  const [eventSeats, setEventSeats] = useState<Seat[]>([]);
  const [isLoadingLocalidades, setIsLoadingLocalidades] = useState(false);
  
  // Selección - Modo Libre
  const [zoneQuantities, setZoneQuantities] = useState<Record<string, number>>({});
  
  // Selección - Modo Numerado
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);

  // Detalles del Cliente
  const [compradorNombre, setCompradorNombre] = useState('');
  const [compradorEmail, setCompradorEmail] = useState('');
  const [compradorTelefono, setCompradorTelefono] = useState('');

  // Método de Pago / Canal
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'tarjeta_presencial' | 'transferencia' | 'cortesia'>('efectivo');

  // Formato de Pase físico (QR o normal)
  const [formatoPase, setFormatoPase] = useState<'qr_normal' | 'sin_qr' | 'qr_sala'>('qr_normal');

  // Resultado de Venta
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [createdTickets, setCreatedTickets] = useState<any[]>([]); // Tickets creados

  // Cargar eventos activos al inicio
  useEffect(() => {
    async function loadEvents() {
      setIsLoadingEvents(true);
      try {
        const data = await getEventsAction();
        // Filtrar espectáculos no cancelados
        setEvents(data.filter(e => e.estado !== 'cancelado'));
      } catch (err) {
        console.error('Error al cargar espectáculos:', err);
      } finally {
        setIsLoadingEvents(false);
      }
    }
    loadEvents();
  }, []);

  // Cargar venue al seleccionar espectáculo
  useEffect(() => {
    if (!selectedEvent) return;
    const vId = selectedEvent.venueId;
    if (venues[vId]) return; // ya cargada

    async function loadVenue() {
      try {
        const data = await getVenueByIdAction(vId);
        if (data) {
          setVenues(prev => ({ ...prev, [vId]: data }));
        }
      } catch (err) {
        console.error('Error al cargar sala:', err);
      }
    }
    loadVenue();
  }, [selectedEvent, venues]);

  // Cargar localidades al seleccionar fecha
  useEffect(() => {
    if (!selectedEvent || !selectedFecha) return;
    const event = selectedEvent;
    
    async function loadLocalidades() {
      setIsLoadingLocalidades(true);
      setError(null);
      setSelectedSeats([]);
      setZoneQuantities({});
      
      try {
        if (event.modo === 'libre') {
          const zones = await getZonesForEventAction(event.id);
          setEventZones(zones);
        } else {
          const seats = await getSeatsForEventAction(event.id, selectedFecha);
          setEventSeats(seats);
        }
      } catch (err) {
        console.error('Error cargando localidades:', err);
        setError('No se pudieron cargar las localidades para la función.');
      } finally {
        setIsLoadingLocalidades(false);
      }
    }
    
    loadLocalidades();
  }, [selectedEvent, selectedFecha]);

  const activeVenue = selectedEvent ? venues[selectedEvent.venueId] : null;

  // Manejar cambio de cantidades en libre
  const handleQtyChange = (zoneName: string, delta: number, maxAvailable: number) => {
    setZoneQuantities(prev => {
      const current = prev[zoneName] || 0;
      const next = Math.max(0, current + delta);
      if (next > maxAvailable) return prev;
      if (next > 10) return prev; // Límite por operación boletería
      return { ...prev, [zoneName]: next };
    });
  };

  // Manejar clic en butaca
  const handleSeatClick = (seat: Seat) => {
    if (seat.estado === 'vendido' || seat.estado === 'bloqueado') return;
    
    setSelectedSeats(prev => {
      const isSelected = prev.some(s => s.id === seat.id);
      if (isSelected) {
        return prev.filter(s => s.id !== seat.id);
      } else {
        if (prev.length >= 10) {
          setError('Límite de 10 butacas por operación.');
          return prev;
        }
        return [...prev, seat];
      }
    });
  };

  // Calcular precios y totales
  const calculateCosts = () => {
    let subtotal = 0;
    let totalItems = 0;

    if (selectedEvent?.modo === 'libre') {
      eventZones.forEach(z => {
        const qty = zoneQuantities[z.nombre] || 0;
        subtotal += z.precio * qty;
        totalItems += qty;
      });
    } else {
      subtotal = selectedSeats.reduce((sum, s) => sum + s.precio, 0);
      totalItems = selectedSeats.length;
    }

    // El cargo por servicio no aplica a cortesías, y en boletería es configurable o normal
    const serviceFeePercent = selectedEvent?.tipoCargo === 'porcentaje' ? selectedEvent.cargoServicio : 0;
    const serviceFeeFixed = selectedEvent?.tipoCargo === 'fijo' ? selectedEvent.cargoServicio : 0;
    
    const cargo = metodoPago === 'cortesia' ? 0 : (
      selectedEvent?.tipoCargo === 'porcentaje' 
        ? (subtotal * serviceFeePercent) / 100 
        : serviceFeeFixed * totalItems
    );

    const total = subtotal + cargo;

    return { subtotal, cargo, total, totalItems };
  };

  const { subtotal, cargo, total, totalItems } = calculateCosts();

  // Avanzar pasos del wizard
  const nextStep = () => {
    setError(null);
    if (step === 1) {
      if (!selectedEvent || !selectedFecha) {
        setError('Por favor, selecciona un espectáculo y una función.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (selectedEvent?.modo === 'libre') {
        const totalQty = Object.values(zoneQuantities).reduce((a, b) => a + b, 0);
        if (totalQty === 0) {
          setError('Por favor, selecciona al menos una entrada.');
          return;
        }
      } else {
        if (selectedSeats.length === 0) {
          setError('Por favor, selecciona al menos una butaca libre.');
          return;
        }
      }
      setStep(3);
    } else if (step === 3) {
      if (!compradorNombre.trim() || !compradorEmail.trim()) {
        setError('El nombre y el correo electrónico del cliente son requeridos.');
        return;
      }
      // Validar formato de email simple
      if (!compradorEmail.includes('@')) {
        setError('Ingresa un correo electrónico válido.');
        return;
      }
      setStep(4);
    }
  };

  const prevStep = () => {
    setError(null);
    setStep(prev => Math.max(1, prev - 1));
  };

  // Confirmar Venta / Cortesía
  const handleFinalize = async () => {
    setIsSubmitting(true);
    setError(null);

    const orderData: any = {
      compradorNombre,
      compradorEmail,
      compradorTeléfono: compradorTelefono || undefined,
      eventId: selectedEvent!.id,
      funcionFecha: selectedFecha,
      subtotal,
      cargoServicio: cargo,
      total,
    };

    if (selectedEvent?.modo === 'libre') {
      // Tomamos la primera zona que tiene cantidad > 0 (por simplicidad se compra una sola zona a la vez en presencial)
      const activeZone = eventZones.find(z => (zoneQuantities[z.nombre] || 0) > 0);
      if (activeZone) {
        orderData.zonaLibre = {
          nombre: activeZone.nombre,
          cantidad: zoneQuantities[activeZone.nombre],
          precioUnitario: metodoPago === 'cortesia' ? 0 : activeZone.precio
        };
      }
    } else {
      orderData.seats = selectedSeats.map(s => ({
        fila: s.fila,
        número: s.número,
        zona: s.zona,
        precio: metodoPago === 'cortesia' ? 0 : s.precio
      }));
    }

    try {
      const res = await createPresentialOrderAction(orderData, metodoPago);
      if (res.success && res.order) {
        const order = res.order;
        setCreatedOrder(order);
        
        // Simular obtención de tickets creados (se pueden consultar en dbService o mock)
        // En una base de datos real o mock, los tickets de esta orden tendrán orderId = order.id
        // Para no hacer otra llamada pesada, los simulamos a partir del orden. Pero para ser exactos,
        // podemos consultar los tickets de esta orden.
        // Haremos un timeout y simularemos los tickets con el hash QR esperado.
        const mockTickets = [];
        const isLibre = !!order.zonaLibre;
        const eventIdPart = order.eventId.substring(6, 12);
        
        if (isLibre) {
          const qty = order.zonaLibre!.cantidad;
          for (let i = 0; i < qty; i++) {
            mockTickets.push({
              id: `ticket_mock_${i}`,
              qrCode: `qr_${eventIdPart}_mock_${order.id.substring(8, 14)}_${i}`,
              zona: order.zonaLibre!.nombre,
              holderNombre: order.compradorNombre
            });
          }
        } else {
          order.seats?.forEach((s, idx) => {
            mockTickets.push({
              id: `ticket_mock_${idx}`,
              qrCode: `qr_${eventIdPart}_mock_${order.id.substring(8, 14)}_${idx}`,
              zona: s.zona,
              fila: s.fila,
              número: s.número,
              holderNombre: order.compradorNombre
            });
          });
        }
        setCreatedTickets(mockTickets);
        setStep(5);
      } else {
        setError(res.error || 'Error al procesar la operación de boletería.');
      }
    } catch (err: any) {
      setError(err.message || 'Error de red al registrar la venta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reiniciar todo para una nueva venta
  const handleReset = () => {
    setStep(1);
    setSelectedEvent(null);
    setSelectedFecha('');
    setSelectedSeats([]);
    setZoneQuantities({});
    setCompradorNombre('');
    setCompradorEmail('');
    setCompradorTelefono('');
    setMetodoPago('efectivo');
    setCreatedOrder(null);
    setCreatedTickets([]);
    setError(null);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:bg-white print:text-black">
      
      {/* Botón Volver y Cabecera */}
      <div className="flex items-center justify-between border-b border-border/80 pb-4 print:hidden">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-white">Boletería y Emisión</h1>
          <p className="text-sm text-muted-foreground">Registro de venta física presencial y emisión de invitaciones/cortesías.</p>
        </div>
        
        {step < 5 && (
          <div className="flex items-center space-x-1.5 bg-[#0e1626] border border-border px-4 py-2 rounded-2xl">
            <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-muted-foreground font-semibold">Paso {step} de 4</span>
          </div>
        )}
      </div>

      {error && step < 5 && (
        <div className="bg-primary/10 border border-primary/25 text-primary rounded-2xl p-4 flex items-start gap-2.5 text-xs animate-in fade-in duration-200 print:hidden">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="space-y-1">
            <span className="font-bold">Atención</span>
            <p className="opacity-90">{error}</p>
          </div>
        </div>
      )}

      {/* --- PASO 1: SELECCIÓN DE EVENTO Y FECHA --- */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 print:hidden animate-in fade-in duration-300">
          {/* Espectáculos */}
          <div className="lg:col-span-8 space-y-4">
            <h3 className="text-sm font-black uppercase text-primary tracking-wider">1. Selecciona Espectáculo</h3>
            
            {isLoadingEvents ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {events.map((event) => {
                  const isSelected = selectedEvent?.id === event.id;
                  return (
                    <button
                      key={event.id}
                      onClick={() => {
                        setSelectedEvent(event);
                        setSelectedFecha('');
                      }}
                      className={`flex flex-col text-left border rounded-2xl overflow-hidden transition group ${
                        isSelected 
                          ? 'bg-primary/5 border-primary shadow-lg ring-1 ring-primary' 
                          : 'bg-[#0b101d]/60 border-border hover:border-border/80'
                      }`}
                    >
                      {/* Banner */}
                      <div className="h-32 w-full bg-slate-950 relative overflow-hidden shrink-0">
                        {event.imágenes?.[0] ? (
                          <img 
                            src={event.imágenes[0]} 
                            alt={event.título} 
                            className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">Sin imagen</div>
                        )}
                        <span className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold uppercase text-primary border border-white/5">
                          {event.categoría}
                        </span>
                      </div>
                      
                      {/* Detalles */}
                      <div className="p-4 flex-grow flex flex-col justify-between space-y-3">
                        <div>
                          <p className="font-extrabold text-white text-base leading-tight truncate">{event.título}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{event.descripción}</p>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground pt-1 border-t border-border/40">
                          <span>Modo: {event.modo === 'libre' ? 'Zonas Libres' : 'Butaca Numerada'}</span>
                          <span className="text-white capitalize">{event.estado}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {events.length === 0 && (
                  <p className="text-muted-foreground text-sm col-span-2 py-8 text-center">No hay espectáculos programados en cartelera.</p>
                )}
              </div>
            )}
          </div>

          {/* Fechas / Funciones */}
          <div className="lg:col-span-4 space-y-4">
            <h3 className="text-sm font-black uppercase text-primary tracking-wider">2. Selecciona Función</h3>
            
            {selectedEvent ? (
              <div className="glass-panel border border-border rounded-2xl p-5 space-y-4">
                <div className="space-y-1.5 border-b border-border/60 pb-3">
                  <p className="text-xs uppercase font-semibold text-primary">{selectedEvent.categoría}</p>
                  <h4 className="text-lg font-bold text-white leading-tight">{selectedEvent.título}</h4>
                  {activeVenue && (
                    <p className="text-xs text-muted-foreground flex items-center mt-1">
                      <MapPin className="h-3.5 w-3.5 mr-1 text-primary shrink-0" />
                      <span>{activeVenue.nombre} ({activeVenue.ciudad})</span>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Funciones Disponibles
                  </label>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {selectedEvent.fechas.map((fecha) => {
                      const isSelected = selectedFecha === fecha;
                      const fText = new Date(fecha).toLocaleDateString('es-AR', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      });

                      return (
                        <button
                          key={fecha}
                          onClick={() => setSelectedFecha(fecha)}
                          className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                            isSelected 
                              ? 'bg-primary/10 border-primary text-white' 
                              : 'bg-slate-900/40 border-border text-muted-foreground hover:border-border/80'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-primary shrink-0" />
                            <span>{fText} HS</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={nextStep}
                  disabled={!selectedFecha}
                  className="w-full bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white text-xs font-bold py-3 rounded-xl transition cursor-pointer flex items-center justify-center space-x-1"
                >
                  <span>Continuar Selección</span>
                </button>
              </div>
            ) : (
              <div className="border border-border/40 border-dashed rounded-2xl p-10 text-center flex flex-col items-center justify-center h-48">
                <Info className="h-8 w-8 text-muted-foreground/60 mb-2" />
                <p className="text-muted-foreground text-xs">Selecciona un espectáculo de la izquierda para ver las fechas de función.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- PASO 2: SELECCIÓN DE UBICACIONES --- */}
      {step === 2 && selectedEvent && (
        <div className="print:hidden animate-in fade-in duration-300 space-y-6">
          <div className="flex items-center space-x-4 border-b border-border/60 pb-3">
            <button onClick={prevStep} className="p-1.5 border border-border/80 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition cursor-pointer">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <span className="text-xs uppercase font-semibold text-primary">Espectáculo: {selectedEvent.título}</span>
              <h3 className="text-lg font-bold text-white mt-0.5">Selecciona Ubicaciones</h3>
            </div>
          </div>

          {isLoadingLocalidades ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Selector de Localidades */}
              <div className="lg:col-span-8 space-y-4">
                
                {/* MODO LIBRE: Zonas Libres */}
                {selectedEvent.modo === 'libre' ? (
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase text-primary tracking-wider">Zonas y Precios (Modo Libre)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {eventZones.map(zone => {
                        const qty = zoneQuantities[zone.nombre] || 0;
                        const isSelected = qty > 0;
                        
                        return (
                          <div 
                            key={zone.id}
                            className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 transition ${
                              isSelected ? 'bg-primary/5 border-primary shadow-md' : 'bg-slate-900/30 border-border'
                            }`}
                          >
                            <div className="space-y-1">
                              <p className="font-extrabold text-white text-base">{zone.nombre}</p>
                              <span className="inline-block bg-slate-900 border border-border px-2 py-0.5 rounded text-[10px] font-bold uppercase text-primary">
                                {zone.tipo}
                              </span>
                              <div className="text-[10px] text-muted-foreground pt-1.5 flex items-center justify-between">
                                <span>Capacidad: {zone.capacidad}</span>
                                <span className={zone.capacidadRestante < 20 ? 'text-primary font-bold' : 'text-emerald-500 font-bold'}>
                                  Disponibles: {zone.capacidadRestante}
                                </span>
                              </div>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-border/40 gap-4">
                              <p className="text-lg font-black text-white font-mono">${zone.precio.toLocaleString('es-AR')}</p>
                              
                              <div className="flex items-center space-x-4 bg-slate-950 border border-border p-2 rounded-2xl">
                                <button
                                  type="button"
                                  onClick={() => handleQtyChange(zone.nombre, -1, zone.capacidadRestante)}
                                  disabled={qty === 0}
                                  className="w-12 h-12 flex items-center justify-center hover:text-primary transition rounded-xl hover:bg-white/5 cursor-pointer disabled:opacity-30 border border-border/40 text-lg font-bold"
                                >
                                  <Minus className="h-5 w-5" />
                                </button>
                                <span className="text-base font-black font-mono text-white w-6 text-center">{qty}</span>
                                <button
                                  type="button"
                                  onClick={() => handleQtyChange(zone.nombre, 1, zone.capacidadRestante)}
                                  disabled={qty >= zone.capacidadRestante}
                                  className="w-12 h-12 flex items-center justify-center hover:text-primary transition rounded-xl hover:bg-white/5 cursor-pointer disabled:opacity-30 border border-border/40 text-lg font-bold"
                                >
                                  <Plus className="h-5 w-5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* MODO NUMERADO: Cuadrícula interactiva 8x8 */
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-black uppercase text-primary tracking-wider">Plano de Butacas (Asignación Directa)</h4>
                      <div className="flex items-center space-x-1.5 text-[10px] text-muted-foreground">
                        <RefreshCw onClick={() => {
                          setIsLoadingLocalidades(true);
                          getSeatsForEventAction(selectedEvent.id, selectedFecha).then(d => {
                            setEventSeats(d);
                            setIsLoadingLocalidades(false);
                          });
                        }} className="h-3.5 w-3.5 text-primary cursor-pointer hover:rotate-180 transition duration-500 shrink-0" />
                        <span>Recargar butacas</span>
                      </div>
                    </div>

                    {/* Escenario */}
                    <div className="w-full bg-[#03060b] border border-border rounded-2xl p-6 flex flex-col items-center space-y-6 overflow-x-auto">
                      <div className="w-64 py-1.5 bg-slate-900/80 border border-primary/20 text-center rounded-lg text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0">
                        Escenario
                      </div>

                      {/* Cuadrícula */}
                      <div className="flex flex-col space-y-2 bg-slate-950/20 p-4 border border-border/30 rounded-xl select-none shrink-0">
                        {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((fila) => {
                          return (
                            <div key={fila} className="flex items-center space-x-2.5">
                              <span className="w-4 text-center text-[10px] font-bold text-muted-foreground">{fila}</span>
                              
                              <div className="flex space-x-2">
                                {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => {
                                  const seat = eventSeats.find(s => s.fila === fila && s.número === num);
                                  if (!seat) return <div key={num} className="h-10 w-10 rounded bg-transparent" />; // vacío
                                  
                                  const isSelected = selectedSeats.some(s => s.id === seat.id);
                                  const isVip = seat.tipo === 'VIP';
                                  const isSold = seat.estado === 'vendido';
                                  const isLocked = seat.estado === 'bloqueado';
                                  
                                  let btnClass = 'bg-emerald-500 text-[#050811] hover:scale-105';
                                  if (isVip) btnClass = 'bg-amber-500 text-[#050811] hover:scale-105';
                                  if (isLocked) btnClass = 'bg-slate-700 text-slate-400 cursor-not-allowed';
                                  if (isSold) btnClass = 'bg-slate-900 border border-border/30 text-muted-foreground cursor-not-allowed';
                                  if (isSelected) btnClass = 'bg-primary text-white scale-105 ring-1 ring-white';

                                  return (
                                    <button
                                      key={seat.id}
                                      onClick={() => handleSeatClick(seat)}
                                      disabled={isSold || isLocked}
                                      className={`h-10 w-10 rounded-xl text-xs font-extrabold flex items-center justify-center transition ${btnClass}`}
                                      title={`Fila ${fila} Seat ${num} - ${seat.zona} (${seat.tipo}) - $${seat.precio}`}
                                    >
                                      {num}
                                    </button>
                                  );
                                })}
                              </div>
                              
                              <span className="w-4 text-center text-[10px] font-bold text-muted-foreground">{fila}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Leyendas */}
                      <div className="flex gap-4 text-[9px] text-muted-foreground pt-1 justify-center flex-wrap">
                        <div className="flex items-center space-x-1">
                          <span className="h-2.5 w-2.5 rounded bg-emerald-500" />
                          <span>General</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="h-2.5 w-2.5 rounded bg-amber-500" />
                          <span>VIP</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="h-2.5 w-2.5 rounded bg-primary" />
                          <span>Seleccionada</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="h-2.5 w-2.5 rounded bg-slate-900 border border-border/30" />
                          <span>Vendida / Ocupada</span>
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar de Resumen */}
              <div className="lg:col-span-4 space-y-4">
                <h4 className="text-xs font-black uppercase text-primary tracking-wider">Detalle del Pedido</h4>
                
                <div className="glass-panel border border-border rounded-2xl p-5 space-y-6">
                  {totalItems > 0 ? (
                    <>
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-white">Ubicaciones Seleccionadas:</p>
                        <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                          {selectedEvent.modo === 'libre' ? (
                            eventZones.filter(z => (zoneQuantities[z.nombre] || 0) > 0).map(z => (
                              <div key={z.id} className="flex justify-between items-center p-3 bg-slate-900/40 border border-border/60 rounded-xl text-xs">
                                <div>
                                  <p className="font-extrabold text-white">{z.nombre}</p>
                                  <p className="text-[10px] text-muted-foreground">General x{zoneQuantities[z.nombre]}</p>
                                </div>
                                <span className="font-bold text-white">${(z.precio * zoneQuantities[z.nombre]).toLocaleString('es-AR')}</span>
                              </div>
                            ))
                          ) : (
                            selectedSeats.map(s => (
                              <div key={s.id} className="flex justify-between items-center p-3 bg-slate-900/40 border border-border/60 rounded-xl text-xs">
                                <div>
                                  <p className="font-extrabold text-white">Fila {s.fila} · Asiento {s.número}</p>
                                  <p className="text-[10px] text-muted-foreground">{s.zona}</p>
                                </div>
                                <span className="font-bold text-white">${s.precio.toLocaleString('es-AR')}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="border-t border-border/50 pt-4 space-y-2 text-xs">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Subtotal:</span>
                          <span className="text-white">${subtotal.toLocaleString('es-AR')}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Cargo por Servicio:</span>
                          <span className="text-white">${cargo.toLocaleString('es-AR')}</span>
                        </div>
                        <div className="flex justify-between text-base font-black border-t border-border/50 pt-3 text-white">
                          <span>Total Venta:</span>
                          <span className="text-primary">${total.toLocaleString('es-AR')}</span>
                        </div>
                      </div>

                      <button
                        onClick={nextStep}
                        className="w-full bg-primary hover:bg-primary-hover text-white text-xs font-bold py-3 rounded-xl transition cursor-pointer text-center"
                      >
                        Continuar a Datos del Cliente
                      </button>
                    </>
                  ) : (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      Haz clic sobre los asientos libres o ajusta las cantidades para agregar ubicaciones a la venta.
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* --- PASO 3: DETALLES DEL CLIENTE --- */}
      {step === 3 && selectedEvent && (
        <div className="max-w-xl mx-auto print:hidden animate-in fade-in duration-300 space-y-6">
          <div className="flex items-center space-x-4 border-b border-border/60 pb-3">
            <button onClick={prevStep} className="p-1.5 border border-border/80 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition cursor-pointer">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <span className="text-xs uppercase font-semibold text-primary">Espectáculo: {selectedEvent.título}</span>
              <h3 className="text-lg font-bold text-white mt-0.5">Identificación del Cliente</h3>
            </div>
          </div>

          <div className="glass-panel border border-border rounded-2xl p-6 space-y-5">
            <h4 className="text-xs font-black uppercase text-primary tracking-wider flex items-center space-x-1.5">
              <User className="h-4.5 w-4.5" />
              <span>Titular de las Entradas</span>
            </h4>

            {/* Venta Rápida / Comprador N/A */}
            <div className="flex justify-between items-center bg-slate-950 p-4 border border-dashed border-border/80 rounded-2xl">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-white">¿Venta rápida en boletería?</p>
                <p className="text-[10px] text-muted-foreground">Omite los datos personales y registra como anónimo.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCompradorNombre('Comprador Anónimo');
                  setCompradorEmail('anonimo@boleteria.com');
                  // Mantenemos el teléfono si se ingresó antes
                  setStep(4);
                }}
                className="bg-primary/20 hover:bg-primary/30 border border-primary/45 text-primary text-xs font-extrabold px-4 py-2 rounded-xl transition cursor-pointer"
              >
                Comprador N/A
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Nombre y Apellido del Cliente
                </label>
                <input 
                  type="text" 
                  placeholder="Ej. Juan Pérez" 
                  required
                  value={compradorNombre}
                  onChange={(e) => setCompradorNombre(e.target.value)}
                  className="w-full bg-slate-900 border border-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Correo Electrónico (Para envío de QRs)
                </label>
                <input 
                  type="email" 
                  placeholder="juan.perez@example.com" 
                  required
                  value={compradorEmail}
                  onChange={(e) => setCompradorEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary transition"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Se enviará automáticamente un correo electrónico con los tickets y los QRs de acceso a este buzón.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Teléfono / WhatsApp (Opcional)
                </label>
                <input 
                  type="text" 
                  placeholder="+5491112345678" 
                  value={compradorTelefono}
                  onChange={(e) => setCompradorTelefono(e.target.value)}
                  className="w-full bg-slate-900 border border-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary transition"
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-grow bg-slate-900 hover:bg-slate-800 border border-border text-white text-xs font-bold py-3 rounded-xl transition cursor-pointer text-center"
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  className="flex-grow bg-primary hover:bg-primary-hover text-white text-xs font-bold py-3 rounded-xl transition cursor-pointer text-center"
                >
                  Continuar al Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- PASO 4: SELECCIÓN DEL MÉTODO DE PAGO --- */}
      {step === 4 && selectedEvent && (
        <div className="max-w-xl mx-auto print:hidden animate-in fade-in duration-300 space-y-6">
          <div className="flex items-center space-x-4 border-b border-border/60 pb-3">
            <button onClick={prevStep} className="p-1.5 border border-border/80 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition cursor-pointer" disabled={isSubmitting}>
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <span className="text-xs uppercase font-semibold text-primary">Espectáculo: {selectedEvent.título}</span>
              <h3 className="text-lg font-bold text-white mt-0.5">Medio de Cobro / Emisión</h3>
            </div>
          </div>

          <div className="glass-panel border border-border rounded-2xl p-6 space-y-6">
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase text-primary tracking-wider flex items-center space-x-1.5">
                <CreditCard className="h-4.5 w-4.5" />
                <span>Registrar Tipo de Venta</span>
              </h4>

              {/* Selector de Medios de Pago */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMetodoPago('efectivo')}
                  className={`p-4 border rounded-xl flex flex-col items-center justify-center space-y-2 transition cursor-pointer ${
                    metodoPago === 'efectivo' 
                      ? 'bg-primary/10 border-primary text-white font-bold' 
                      : 'bg-slate-900/40 border-border text-muted-foreground hover:border-border/80'
                  }`}
                >
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                  <span className="text-xs">Efectivo</span>
                </button>

                <button
                  onClick={() => setMetodoPago('tarjeta_presencial')}
                  className={`p-4 border rounded-xl flex flex-col items-center justify-center space-y-2 transition cursor-pointer ${
                    metodoPago === 'tarjeta_presencial' 
                      ? 'bg-primary/10 border-primary text-white font-bold' 
                      : 'bg-slate-900/40 border-border text-muted-foreground hover:border-border/80'
                  }`}
                >
                  <CreditCard className="h-5 w-5 text-blue-500" />
                  <span className="text-xs">Tarjeta (Posnet)</span>
                </button>

                <button
                  onClick={() => setMetodoPago('transferencia')}
                  className={`p-4 border rounded-xl flex flex-col items-center justify-center space-y-2 transition cursor-pointer ${
                    metodoPago === 'transferencia' 
                      ? 'bg-primary/10 border-primary text-white font-bold' 
                      : 'bg-slate-900/40 border-border text-muted-foreground hover:border-border/80'
                  }`}
                >
                  <RefreshCw className="h-5 w-5 text-purple-500" />
                  <span className="text-xs">Transferencia</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMetodoPago('cortesia')}
                  className={`p-4 border rounded-xl flex flex-col items-center justify-center space-y-2 transition cursor-pointer ${
                    metodoPago === 'cortesia' 
                      ? 'bg-primary/10 border-primary text-white font-bold' 
                      : 'bg-slate-900/40 border-border text-muted-foreground hover:border-border/80'
                  }`}
                >
                  <Ticket className="h-5 w-5 text-amber-500" />
                  <span className="text-xs">Invitación / Cortesía</span>
                </button>
              </div>
            </div>

            {/* Formato de Pase */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-primary tracking-wider flex items-center space-x-1.5">
                <Printer className="h-4.5 w-4.5" />
                <span>Formato del Pase Físico</span>
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setFormatoPase('qr_normal')}
                  className={`p-3 border rounded-xl flex flex-col items-center justify-center space-y-1.5 transition cursor-pointer ${
                    formatoPase === 'qr_normal' 
                      ? 'bg-primary/10 border-primary text-white font-bold' 
                      : 'bg-slate-900/40 border-border text-muted-foreground hover:border-border/80'
                  }`}
                >
                  <span className="text-[10px] font-bold">Normal con QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormatoPase('sin_qr')}
                  className={`p-3 border rounded-xl flex flex-col items-center justify-center space-y-1.5 transition cursor-pointer ${
                    formatoPase === 'sin_qr' 
                      ? 'bg-primary/10 border-primary text-white font-bold' 
                      : 'bg-slate-900/40 border-border text-muted-foreground hover:border-border/80'
                  }`}
                >
                  <span className="text-[10px] font-bold">Sin QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormatoPase('qr_sala')}
                  className={`p-3 border rounded-xl flex flex-col items-center justify-center space-y-1.5 transition cursor-pointer ${
                    formatoPase === 'qr_sala' 
                      ? 'bg-primary/10 border-primary text-white font-bold' 
                      : 'bg-slate-900/40 border-border text-muted-foreground hover:border-border/80'
                  }`}
                >
                  <span className="text-[10px] font-bold">QR Sala</span>
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {formatoPase === 'qr_normal' && 'Cada entrada incluye su código QR único de validación individual.'}
                {formatoPase === 'sin_qr' && 'Las entradas se emiten sin código QR (útil para control de taquilla sin escáner).'}
                {formatoPase === 'qr_sala' && 'Las entradas muestran el código QR estático de la sala para simplificar la operatoria.'}
              </p>
            </div>

            {/* Resumen Final de Valores */}
            <div className="bg-slate-950 p-4 rounded-xl border border-border/80 space-y-2.5 text-xs">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-2">Desglose Final del Cobro</p>
              
              <div className="flex justify-between text-muted-foreground">
                <span>Cliente:</span>
                <span className="text-white font-semibold">{compradorNombre} ({compradorEmail})</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Ubicaciones:</span>
                <span className="text-white font-semibold">
                  {selectedEvent.modo === 'libre' 
                    ? `${eventZones.find(z => (zoneQuantities[z.nombre] || 0) > 0)?.nombre} (x${totalItems})` 
                    : `${selectedSeats.length} butacas`}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span className="text-white font-mono">${subtotal.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Cargo por Servicio:</span>
                <span className="text-white font-mono">${cargo.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-base font-black border-t border-border/50 pt-2.5 text-white">
                <span>Total a Cobrar:</span>
                <span className="text-primary font-mono">${total.toLocaleString('es-AR')}</span>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={prevStep}
                disabled={isSubmitting}
                className="flex-grow bg-slate-900 hover:bg-slate-800 border border-border text-white text-xs font-bold py-3 rounded-xl transition cursor-pointer text-center"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={handleFinalize}
                disabled={isSubmitting}
                className="flex-grow bg-primary hover:bg-primary-hover text-white text-xs font-bold py-3 rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Emitiendo...</span>
                  </>
                ) : (
                  <span>
                    {metodoPago === 'cortesia' ? 'Emitir Cortesía' : 'Confirmar Cobro y Emitir'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PASO 5: ÉXITO Y PASES IMPRIMIBLES --- */}
      {step === 5 && createdOrder && selectedEvent && (
        <div className="max-w-2xl mx-auto space-y-6 animate-in zoom-in-95 duration-200">
          
          {/* Alerta de Éxito en Pantalla */}
          <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 rounded-2xl p-6 flex flex-col items-center text-center space-y-3 print:hidden">
            <CheckCircle className="h-12 w-12 text-emerald-500 animate-bounce" />
            <div className="space-y-1">
              <h2 className="text-lg font-black uppercase tracking-wide">Venta Emitida Correctamente</h2>
              <p className="text-xs text-white/95">
                La orden <span className="font-bold font-mono">{createdOrder.id.substring(6, 12).toUpperCase()}</span> ha sido creada. Se envió el correo de tickets al titular.
              </p>
            </div>

            <div className="flex gap-3.5 pt-2">
              <button
                onClick={handlePrint}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4.5 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir Entradas</span>
              </button>
              <button
                onClick={handleReset}
                className="bg-slate-900 border border-border hover:bg-slate-800 text-white text-xs font-semibold px-4.5 py-2.5 rounded-xl transition cursor-pointer"
              >
                Nueva Venta
              </button>
            </div>
          </div>

          {/* VISTA DE IMPRESIÓN (ENTRADAS/PASES) */}
          <div className="space-y-6 print:space-y-8">
            <h3 className="text-sm font-black uppercase text-primary tracking-wider border-b border-border pb-2 print:hidden">
              Previsualización de Entradas Físicas
            </h3>

            {createdTickets.map((ticket, index) => {
              const formattedDate = new Date(createdOrder.funcionFecha).toLocaleDateString('es-AR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div 
                  key={index}
                  className="bg-[#0b0f19] border border-border/80 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-6 shadow-xl relative overflow-hidden print:border-black print:bg-white print:text-black print:shadow-none print:break-inside-avoid print:page-break-inside-avoid"
                  style={{ minHeight: '180px' }}
                >
                  {/* Cintillo izquierdo de show neón */}
                  <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-b from-primary to-accent print:hidden" />
                  
                  {/* Detalles del ticket */}
                  <div className="space-y-3.5 flex-grow text-center md:text-left print:pl-0">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-primary font-mono print:text-black">
                        Pase de Acceso - TicketFlow
                      </span>
                      <h4 className="text-xl font-black text-white leading-tight print:text-black">
                        {selectedEvent.título}
                      </h4>
                      {activeVenue && (
                        <p className="text-xs text-muted-foreground font-semibold flex items-center justify-center md:justify-start mt-1 print:text-black/85">
                          <MapPin className="h-3.5 w-3.5 mr-1 text-primary shrink-0 print:text-black" />
                          <span>{activeVenue.nombre} · {activeVenue.ciudad}</span>
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs pt-3 border-t border-border/40 print:border-black/20">
                      <div>
                        <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider print:text-black/70">Fecha y Hora</p>
                        <p className="font-semibold text-white capitalize print:text-black">{formattedDate} HS</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider print:text-black/70">Ubicación</p>
                        <p className="font-semibold text-white print:text-black">
                          {ticket.fila ? `Fila ${ticket.fila} - Asiento ${ticket.número}` : `${ticket.zona}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider print:text-black/70">Titular</p>
                        <p className="font-semibold text-white print:text-black">{ticket.holderNombre}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider print:text-black/70">Pase ID</p>
                        <p className="font-semibold text-white font-mono print:text-black">{ticket.qrCode.substring(3, 14).toUpperCase()}</p>
                      </div>
                    </div>
                  </div>

                  {/* QR Code o Alternativa según formato */}
                  {formatoPase !== 'sin_qr' ? (
                    <div className="bg-white p-3.5 rounded-xl flex flex-col items-center justify-center shrink-0 border border-white/10 print:border-black">
                      <QRCode 
                        value={formatoPase === 'qr_sala' && activeVenue ? `https://ticketflow.com/sala/${activeVenue.slug}` : ticket.qrCode} 
                        size={110} 
                      />
                      <span className="text-[8px] font-mono text-slate-800 mt-2 font-bold tracking-wider">
                        {formatoPase === 'qr_sala' ? 'QR GENERAL DE SALA' : ticket.qrCode}
                      </span>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl flex flex-col items-center justify-center shrink-0 border border-dashed border-border/40 text-center w-[138px] print:border-black">
                      <Ticket className="h-10 w-10 text-muted-foreground print:text-black mb-1" />
                      <span className="text-[8px] font-bold text-muted-foreground print:text-black uppercase tracking-wider">Acceso Directo</span>
                      <span className="text-[7px] text-muted-foreground/85 print:text-black/80">Sin control QR</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      )}

    </div>
  );
}
