'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { createOrderAction, updateOrderStatusAction, getVenueByIdAction, createMercadoPagoPreferenceAction } from '@/app/actions';
import { ShoppingBag, CreditCard, Calendar, MapPin, Ticket, Clock, Loader2, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { User, Event, Zone, Venue } from '@/types';
import Link from 'next/link';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, cartTimeLeft, currentUser, sessionId, clearCart } = useApp();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  
  // Método de pago
  const [metodoPago, setMetodoPago] = useState<'tarjeta' | 'mercadopago'>('tarjeta');
  
  // Datos de pago
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Sincronizar datos si el usuario está registrado
  useEffect(() => {
    if (currentUser) {
      setNombre(currentUser.nombre);
      setEmail(currentUser.email);
    }
  }, [currentUser]);

  // Cargar información del Venue
  const [venue, setVenue] = useState<Venue | null>(null);
  useEffect(() => {
    if (cart?.event) {
      getVenueByIdAction(cart.event.venueId)
        .then(setVenue)
        .catch(err => console.error('Error cargando venue en checkout:', err));
    }
  }, [cart]);

  // Si el carrito está vacío, mostrar pantalla informativa
  if (!cart) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center flex flex-col items-center justify-center space-y-4">
        <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
          <ShoppingBag className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-white">Tu carrito está vacío</h1>
        <p className="text-sm text-muted-foreground">
          No tienes ninguna reserva temporal activa en este momento. Explora nuestra cartelera de espectáculos.
        </p>
        <Link 
          href="/" 
          className="glow-button inline-flex bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition"
        >
          Ver Cartelera
        </Link>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validaciones del comprador
    if (!nombre.trim()) {
      setError('El nombre del comprador es obligatorio.');
      setIsLoading(false);
      return;
    }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError('Por favor, ingresa un correo electrónico válido.');
      setIsLoading(false);
      return;
    }

    // Validaciones de tarjeta (solo si se selecciona tarjeta)
    if (metodoPago === 'tarjeta') {
      if (cardNumber.replace(/\s/g, '').length !== 16) {
        setError('Número de tarjeta inválido. Deben ser 16 dígitos.');
        setIsLoading(false);
        return;
      }
      if (!cardExpiry || !/^\d{2}\/\d{2}$/.test(cardExpiry)) {
        setError('Fecha de vencimiento inválida. Formato: MM/AA.');
        setIsLoading(false);
        return;
      }
      if (cardCvv.length !== 3) {
        setError('Código de seguridad (CVV) inválido. Deben ser 3 dígitos.');
        setIsLoading(false);
        return;
      }
    }
    
    if (!termsAccepted) {
      setError('Debes aceptar los términos y condiciones para continuar.');
      setIsLoading(false);
      return;
    }

    try {
      // 1. Crear Orden en el Servidor (pendiente)
      const orderRes = await createOrderAction({
        userId: currentUser?.id,
        compradorEmail: email,
        compradorNombre: nombre,
        compradorTeléfono: telefono || undefined,
        eventId: cart.event.id,
        funcionFecha: cart.fecha,
        zonaLibre: cart.seats ? undefined : (cart.zone ? {
          nombre: cart.zone.nombre,
          cantidad: cart.cantidad,
          precioUnitario: cart.zone.precio
        } : undefined),
        seats: cart.seats ? cart.seats.map(s => ({
          fila: s.fila,
          número: s.número,
          zona: s.zona,
          precio: s.precio
        })) : undefined,
        subtotal: cart.subtotal,
        cargoServicio: cart.cargoServicio,
        total: cart.total
      });

      if (!orderRes.success || !orderRes.order) {
        setError(orderRes.error || 'Ocurrió un error al intentar crear tu reserva.');
        setIsLoading(false);
        return;
      }

      const orderId = orderRes.order.id;

      if (metodoPago === 'mercadopago') {
        const mpRes = await createMercadoPagoPreferenceAction(orderId);
        if (mpRes.success && mpRes.initPoint) {
          localStorage.removeItem('ticketflow_cart');
          localStorage.removeItem('ticketflow_cart_expires');
          window.location.href = mpRes.initPoint;
        } else {
          setError(mpRes.error || 'Error al conectar con la pasarela de Mercado Pago.');
          setIsLoading(false);
        }
        return;
      }

      // 2. Simular el procesamiento del pago de Stripe
      // (Aquí llamamos a una simulación de 2 segundos)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simulamos éxito si la tarjeta no termina en 9999 (para pruebas de error)
      const isSuccess = !cardNumber.endsWith('9999');

      if (isSuccess) {
        // 3. Confirmar pago y liberar el Lock
        const confirmRes = await updateOrderStatusAction(orderId, 'pagado', `ch_${Date.now()}`);
        if (confirmRes.success) {
          // Limpiar el carrito localmente (elimina locks locales/sesiones)
          localStorage.removeItem('ticketflow_cart');
          localStorage.removeItem('ticketflow_cart_expires');
          
          // Redirigir a confirmación
          router.push(`/confirmation/${orderId}`);
        } else {
          setError('El pago fue aprobado por tu banco pero ocurrió un error al emitir tus tickets. Por favor, contacta a soporte.');
          setIsLoading(false);
        }
      } else {
        // Pago rechazado
        await updateOrderStatusAction(orderId, 'fallido');
        setError('El pago ha sido rechazado por el banco emisor. Por favor, intenta con otra tarjeta.');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Ocurrió un error inesperado al procesar el pago.');
      setIsLoading(false);
    }
  };

  const formattedFecha = new Date(cart.fecha).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Alerta de bloqueo temporal */}
      <div className="bg-primary/10 border border-primary/25 rounded-2xl p-4 flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <Clock className="h-5 w-5 text-primary animate-spin" style={{ animationDuration: '4s' }} />
          <div className="text-sm">
            <span className="font-extrabold text-white">Tus ubicaciones están reservadas.</span>
            <p className="text-muted-foreground text-xs">Completa el pago en este tiempo o se liberarán automáticamente.</p>
          </div>
        </div>
        <div className="text-xl font-mono font-black text-primary bg-background/50 px-4 py-1.5 rounded-lg border border-primary/20">
          {formatTime(cartTimeLeft)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Columna Izquierda: Formulario (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handlePayment} className="space-y-6">
            
            {/* Datos del comprador */}
            <div className="glass-panel border border-border rounded-2xl p-6 space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <span className="text-xs flex items-center justify-center h-5 w-5 rounded-full bg-primary text-white font-bold">1</span>
                <span>Información del Comprador</span>
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Nombre Completo
                  </label>
                  <input 
                    type="text" 
                    placeholder="Juan Pérez" 
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    disabled={currentUser !== null}
                    className="w-full bg-slate-900/60 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Correo Electrónico
                  </label>
                  <input 
                    type="email" 
                    placeholder="juan.perez@ejemplo.com" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={currentUser !== null}
                    className="w-full bg-slate-900/60 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Teléfono Celular
                  </label>
                  <input 
                    type="tel" 
                    placeholder="+54 9 11 1234 5678" 
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full bg-slate-900/60 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Requerido para alertas de WhatsApp.</p>
                </div>
              </div>
            </div>

            {/* Selector de Método de Pago */}
            <div className="glass-panel border border-border rounded-2xl p-6 space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <span className="text-xs flex items-center justify-center h-5 w-5 rounded-full bg-primary text-white font-bold">2</span>
                <span>Selecciona el Método de Pago</span>
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setMetodoPago('tarjeta')}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition cursor-pointer ${
                    metodoPago === 'tarjeta'
                      ? 'bg-primary/10 border-primary text-white font-bold'
                      : 'bg-slate-900/40 border-border text-muted-foreground hover:border-border/80'
                  }`}
                >
                  <CreditCard className="h-6 w-6 mb-2 text-primary" />
                  <span className="text-sm">Tarjeta de Crédito</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Stripe</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMetodoPago('mercadopago')}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition cursor-pointer ${
                    metodoPago === 'mercadopago'
                      ? 'bg-primary/10 border-primary text-white font-bold'
                      : 'bg-slate-900/40 border-border text-muted-foreground hover:border-border/80'
                  }`}
                >
                  <span className="text-xl font-black mb-1.5 text-primary tracking-tight">mp</span>
                  <span className="text-sm">Mercado Pago</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">LATAM Checkout</span>
                </button>
              </div>
            </div>

            {/* Datos de tarjeta (Solo si se selecciona tarjeta) */}
            {metodoPago === 'tarjeta' && (
              <div className="glass-panel border border-border rounded-2xl p-6 space-y-4 animate-in fade-in duration-200">
                <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                  <span className="text-xs flex items-center justify-center h-5 w-5 rounded-full bg-primary text-white font-bold">3</span>
                  <span>Datos de la Tarjeta</span>
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Nombre en la Tarjeta
                    </label>
                    <input 
                      type="text" 
                      placeholder="JUAN PEREZ" 
                      required={metodoPago === 'tarjeta'}
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                      className="w-full bg-slate-900/60 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition uppercase"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-3 sm:col-span-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Número de Tarjeta
                      </label>
                      <div className="relative">
                        <CreditCard className="absolute right-3.5 top-3 w-4.5 h-4.5 text-muted-foreground" />
                        <input 
                          type="text" 
                          maxLength={19}
                          placeholder="4517 6534 8922 4110" 
                          required={metodoPago === 'tarjeta'}
                          value={cardNumber}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
                            setCardNumber(v);
                          }}
                          className="w-full bg-slate-900/60 border border-border rounded-lg pl-4 pr-10 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition"
                        />
                      </div>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Vencimiento
                      </label>
                      <input 
                        type="text" 
                        maxLength={5}
                        placeholder="MM/AA" 
                        required={metodoPago === 'tarjeta'}
                        value={cardExpiry}
                        onChange={(e) => {
                          let v = e.target.value.replace(/\D/g, '');
                          if (v.length > 2) {
                            v = `${v.substring(0, 2)}/${v.substring(2, 4)}`;
                          }
                          setCardExpiry(v);
                        }}
                        className="w-full bg-slate-900/60 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition text-center"
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        CVV
                      </label>
                      <input 
                        type="password" 
                        maxLength={3}
                        placeholder="123" 
                        required={metodoPago === 'tarjeta'}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-slate-900/60 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition text-center"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Términos y Condiciones y Botón de Pago (Comunes a ambos métodos) */}
            <div className="glass-panel border border-border rounded-2xl p-6 space-y-4">
              <div className="flex items-start space-x-2.5">
                <input 
                  type="checkbox" 
                  id="terms" 
                  required
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 accent-primary"
                />
                <label htmlFor="terms" className="text-xs text-muted-foreground leading-normal cursor-pointer select-none">
                  Acepto las <span className="text-primary hover:underline">Políticas de Privacidad</span> y los <span className="text-primary hover:underline">Términos del Servicio</span> de TicketFlow. Las entradas no admiten devoluciones ni cambios después del pago.
                </label>
              </div>

              {error && (
                <div className="flex items-start space-x-2 text-xs text-primary bg-primary/10 border border-primary/20 rounded-lg p-3">
                  <AlertCircle className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full glow-button bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center space-x-2 text-base cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>{metodoPago === 'mercadopago' ? 'Redirigiendo a Mercado Pago...' : 'Procesando pago...'}</span>
                  </>
                ) : (
                  <>
                    <span>{metodoPago === 'mercadopago' ? 'Pagar con Mercado Pago' : `Pagar $${cart.total.toLocaleString('es-AR')}`}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Columna Derecha: Resumen del Pedido (5 cols) */}
        <div className="lg:col-span-5">
          <div className="glass-panel border border-border rounded-2xl p-6 space-y-6 sticky top-24">
            <h2 className="text-xl font-bold text-white border-b border-border/50 pb-2">Resumen de la Compra</h2>

            {/* Ficha Espectáculo */}
            <div className="flex space-x-4">
              <img 
                src={cart.event.imágenes[0]} 
                alt={cart.event.título} 
                className="w-20 aspect-video object-cover rounded-lg border border-border"
              />
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-white leading-tight line-clamp-1">{cart.event.título}</h3>
                <p className="text-[10px] text-primary font-bold uppercase">{cart.event.categoría}</p>
                <p className="text-xs text-muted-foreground flex items-center">
                  <MapPin className="h-3 w-3 mr-1 text-primary" />
                  <span>{venue?.nombre}</span>
                </p>
              </div>
            </div>

            {/* Detalles de la función */}
            <div className="bg-slate-900/50 rounded-xl p-4 space-y-2.5 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Función:</span>
                <span className="text-white font-semibold">{formattedFecha} HS</span>
              </div>
              <div className="flex justify-between">
                <span>Ubicación:</span>
                <span className="text-white font-semibold">
                  {cart.seats 
                    ? cart.seats.map(s => `${s.fila}-${s.número}`).join(', ') 
                    : (cart.zone?.nombre || 'General')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Entradas:</span>
                <span className="text-white font-semibold">{cart.cantidad} ubicaciones</span>
              </div>
            </div>

            {/* Liquidación de montos */}
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal ({cart.cantidad}x):</span>
                <span className="text-white font-semibold">${cart.subtotal.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Cargos de Servicio:</span>
                <span className="text-white font-semibold">${cart.cargoServicio.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-lg font-black border-t border-border/50 pt-3 text-white">
                <span>Total a Pagar:</span>
                <span className="text-primary font-mono">${cart.total.toLocaleString('es-AR')}</span>
              </div>
            </div>

            <div className="pt-2 text-center text-xs text-muted-foreground">
              Procesamiento cifrado SSL 256 bits y PCI-DSS via Stripe.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
