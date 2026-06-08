'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Stage, Layer, Circle, Text, Group, Rect } from 'react-konva';
import { Event, Venue, Seat } from '@/types';
import { getSeatsForEventAction } from '@/app/actions';
import { useApp } from '@/context/AppContext';
import { Loader2, ArrowLeft, ZoomIn, ZoomOut, RotateCcw, HelpCircle, Check, Clock, AlertCircle, MapPin } from 'lucide-react';
import Link from 'next/link';

interface SeatMapProps {
  event: Event;
  venue: Venue | null;
  fecha: string;
}

export default function SeatMap({ event, venue, fecha }: SeatMapProps) {
  const router = useRouter();
  const { addToCartNumerado, sessionId, cart, cartTimeLeft } = useApp();

  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [error, setError] = useState('');
  
  // Estados de Hover/Tooltip
  const [hoveredSeat, setHoveredSeat] = useState<Seat | null>(null);

  // Estados de Canvas Zoom y Pan
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });

  const formattedFecha = new Date(fecha).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Ajustar tamaño del canvas responsivamente
  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.offsetWidth,
        height: 420
      });
    }
  }, []);

  // Cargar asientos y configurar Polling cada 5 segundos
  useEffect(() => {
    loadSeats();
    const interval = setInterval(loadSeats, 5000);
    return () => clearInterval(interval);
  }, [event.id, fecha]);

  const loadSeats = async () => {
    try {
      const data = await getSeatsForEventAction(event.id, fecha);
      setSeats(data);
      setIsLoading(false);
    } catch (e) {
      console.error('Error cargando asientos:', e);
    }
  };

  const handleSeatClick = (seat: Seat) => {
    setError('');
    
    // Ignorar si está vendido o bloqueado por otro usuario
    if (seat.estado === 'vendido' || seat.estado === 'bloqueado') return;

    const isSelected = selectedSeats.some(s => s.id === seat.id);

    if (isSelected) {
      setSelectedSeats(prev => prev.filter(s => s.id !== seat.id));
    } else {
      if (selectedSeats.length >= 10) {
        setError('Límite máximo de 10 butacas por compra.');
        return;
      }
      setSelectedSeats(prev => [...prev, seat]);
    }
  };

  // Zoom interactivo con rueda de mouse
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();

    const mousePointTo = {
      x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
      y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    
    // Limitar zoom entre 0.5 y 2.5
    const clampedScale = Math.max(0.5, Math.min(2.5, newScale));
    
    setScale(clampedScale);
    setPosition({
      x: (stage.getPointerPosition().x / clampedScale - mousePointTo.x) * clampedScale,
      y: (stage.getPointerPosition().y / clampedScale - mousePointTo.y) * clampedScale,
    });
  };

  const handleZoom = (factor: number) => {
    setScale(prev => Math.max(0.5, Math.min(2.5, prev * factor)));
  };

  const handleResetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleProcederPago = async () => {
    if (selectedSeats.length === 0) return;
    setIsBooking(true);
    setError('');

    // Estructurar asientos seleccionados para el AppContext
    const seatsToCart = selectedSeats.map(s => ({
      id: s.id,
      fila: s.fila,
      número: s.número,
      zona: s.zona,
      precio: s.precio
    }));

    try {
      const lockSuccess = await addToCartNumerado(event, fecha, seatsToCart);
      if (lockSuccess) {
        router.push('/checkout');
      } else {
        setError('No se pudo reservar algunas de las butacas elegidas. Es posible que hayan sido bloqueadas o compradas por otro usuario mientras decidías. Por favor, recarga y elige de nuevo.');
      }
    } catch (e) {
      setError('Ocurrió un error inesperado al reservar las butacas.');
    } finally {
      setIsBooking(false);
    }
  };

  // Precios y subtotales
  const subtotal = selectedSeats.reduce((sum, s) => sum + s.precio, 0);
  const cargo = event.tipoCargo === 'porcentaje'
    ? (subtotal * event.cargoServicio) / 100
    : event.cargoServicio * selectedSeats.length;
  const total = subtotal + cargo;

  // Renderizar butaca en Konva
  const renderSeatCircle = (seat: Seat) => {
    const isSelected = selectedSeats.some(s => s.id === seat.id);
    const isVip = seat.tipo === 'VIP';
    
    // Configurar color de estado
    let fillColor = '#10b981'; // Libre (Verde)
    if (isVip) fillColor = '#ffb800'; // VIP (Dorado)
    if (seat.estado === 'bloqueado') fillColor = '#475569'; // Bloqueado (Gris)
    if (seat.estado === 'vendido') fillColor = '#1e293b'; // Vendido (Gris oscuro)
    if (isSelected) fillColor = '#3b82f6'; // Seleccionado (Azul)

    // Coordenadas en cuadrícula de Konva
    const filasMap = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const rowIdx = filasMap.indexOf(seat.fila);
    const colIdx = seat.número - 1;

    // Ajustar posicionamiento en el canvas
    const xSpacing = 42;
    const ySpacing = 38;
    const startX = (dimensions.width - (8 * xSpacing)) / 2;
    const startY = 120; // Espacio para escenario

    const seatX = startX + colIdx * xSpacing;
    const seatY = startY + rowIdx * ySpacing;

    return (
      <Group key={seat.id}>
        <Circle
          x={seatX}
          y={seatY}
          radius={13}
          fill={fillColor}
          stroke={isSelected ? '#ffffff' : 'rgba(255,255,255,0.1)'}
          strokeWidth={isSelected ? 2 : 1}
          shadowColor="black"
          shadowBlur={isSelected ? 6 : 2}
          shadowOpacity={0.4}
          shadowOffset={{ x: 1, y: 1 }}
          cursor={(seat.estado === 'vendido' || seat.estado === 'bloqueado') ? 'not-allowed' : 'pointer'}
          onClick={() => handleSeatClick(seat)}
          onTap={() => handleSeatClick(seat)}
          onMouseEnter={(e) => {
            const stage = e.target.getStage();
            if (stage) {
              const container = stage.container();
              if (seat.estado !== 'vendido' && seat.estado !== 'bloqueado') {
                container.style.cursor = 'pointer';
              }
            }
            setHoveredSeat(seat);
          }}
          onMouseLeave={(e) => {
            const stage = e.target.getStage();
            if (stage) {
              stage.container().style.cursor = 'default';
            }
            setHoveredSeat(null);
          }}
        />
        {/* Número interior sutil si está libre/seleccionado */}
        {(seat.estado !== 'vendido' && seat.estado !== 'bloqueado') && (
          <Text
            x={seatX - 5}
            y={seatY - 4}
            text={seat.número.toString()}
            fontSize={9}
            fontStyle="bold"
            fill={isSelected ? '#ffffff' : '#060913'}
            listening={false}
          />
        )}
      </Group>
    );
  };

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
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Selecciona tus Butacas</h1>
        <div className="flex flex-col sm:flex-row gap-4 text-xs text-muted-foreground mt-3">
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-1 text-primary" />
            <span>{formattedFecha} HS</span>
          </div>
          {venue && (
            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-1 text-primary" />
              <span>{venue.nombre} ({venue.ciudad})</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Columna Izquierda: Mapa Konva Canvas (8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Arrastra para mover el mapa · Rueda de mouse o botones para zoom
            </span>

            {/* Controles de Canvas */}
            <div className="flex items-center space-x-2 bg-slate-900/80 border border-border px-2.5 py-1.5 rounded-lg">
              <button 
                onClick={() => handleZoom(1.15)} 
                className="p-1 hover:text-primary transition rounded" 
                title="Acercar"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button 
                onClick={() => handleZoom(0.85)} 
                className="p-1 hover:text-primary transition rounded" 
                title="Alejar"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button 
                onClick={handleResetView} 
                className="p-1 hover:text-primary transition rounded border-l border-border/50 pl-2 ml-1" 
                title="Restablecer"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Contenedor del Canvas */}
          <div 
            ref={containerRef}
            className="w-full bg-[#03060b]/90 border border-border rounded-2xl overflow-hidden relative cursor-grab active:cursor-grabbing"
            style={{ height: '420px' }}
          >
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Stage
                width={dimensions.width}
                height={dimensions.height}
                scaleX={scale}
                scaleY={scale}
                x={position.x}
                y={position.y}
                draggable
                onDragEnd={(e) => setPosition({ x: e.target.x(), y: e.target.y() })}
                onWheel={handleWheel}
              >
                <Layer>
                  {/* ESCENARIO */}
                  <Group>
                    {/* Fondo Escenario */}
                    <Rect
                      x={(dimensions.width - 280) / 2}
                      y={30}
                      width={280}
                      height={20}
                      fill="rgba(255, 255, 255, 0.08)"
                      stroke="rgba(255, 74, 90, 0.4)"
                      strokeWidth={1}
                      cornerRadius={6}
                    />
                    <Text
                      x={(dimensions.width - 70) / 2}
                      y={35}
                      text="ESCENARIO"
                      fontSize={11}
                      fontStyle="bold"
                      fill="rgba(255, 255, 255, 0.6)"
                      letterSpacing={3}
                    />
                  </Group>

                  {/* ETIQUETAS DE FILAS (Izquierda y Derecha) */}
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((fila, idx) => {
                    const ySpacing = 38;
                    const startY = 120;
                    const yPos = startY + idx * ySpacing - 4;
                    const xSpacing = 42;
                    const startX = (dimensions.width - (8 * xSpacing)) / 2;

                    return (
                      <Group key={fila}>
                        {/* Fila Izquierda */}
                        <Text
                          x={startX - 30}
                          y={yPos}
                          text={fila}
                          fontSize={11}
                          fontStyle="bold"
                          fill="#475569"
                        />
                        {/* Fila Derecha */}
                        <Text
                          x={startX + (8 * xSpacing) + 10}
                          y={yPos}
                          text={fila}
                          fontSize={11}
                          fontStyle="bold"
                          fill="#475569"
                        />
                      </Group>
                    );
                  })}

                  {/* DIBUJO DE BUTACAS */}
                  {seats.map(renderSeatCircle)}
                </Layer>
              </Stage>
            )}

            {/* Hover tooltip inline del Canvas */}
            {hoveredSeat && (
              <div className="absolute bottom-4 left-4 bg-slate-950/90 border border-border px-3.5 py-2 rounded-xl text-xs space-y-0.5 pointer-events-none shadow-xl">
                <p className="font-extrabold text-white">
                  Fila {hoveredSeat.fila} · Butaca {hoveredSeat.número}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Sector: {hoveredSeat.zona}
                </p>
                <p className="text-[11px] text-primary font-bold">
                  Precio: ${hoveredSeat.precio.toLocaleString('es-AR')}
                </p>
              </div>
            )}
          </div>

          {/* Leyenda de colores */}
          <div className="flex flex-wrap gap-4 text-xs bg-slate-900/10 border border-border p-4 rounded-xl justify-center">
            <div className="flex items-center space-x-1.5">
              <span className="h-3 w-3 rounded-full bg-[#10b981]" />
              <span className="text-muted-foreground">General</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-3 w-3 rounded-full bg-[#ffb800]" />
              <span className="text-muted-foreground">VIP / Premium</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-3 w-3 rounded-full bg-[#3b82f6]" />
              <span className="text-muted-foreground">Seleccionada</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-3 w-3 rounded-full bg-[#475569]" />
              <span className="text-muted-foreground">Reservada (Lock)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-3 w-3 rounded-full bg-[#1e293b]" />
              <span className="text-muted-foreground">Vendida</span>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Sidebar de Reserva (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <h2 className="text-xl font-bold text-white">Detalle de Selección</h2>

          {selectedSeats.length > 0 ? (
            <div className="glass-panel border border-border rounded-2xl p-6 space-y-6">
              {/* Temporizador del carrito si ya tiene lock en proceso */}
              {cart && cart.seats && (
                <div className="flex items-center space-x-2 text-xs text-primary bg-primary/10 border border-primary/20 rounded-lg p-2.5">
                  <Clock className="h-4 w-4 text-primary shrink-0 animate-spin" />
                  <span>
                    Butacas reservadas por 10 min.
                  </span>
                </div>
              )}

              {/* Lista scrollable de butacas seleccionadas */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">Butacas Elegidas:</p>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {selectedSeats.map((seat) => (
                    <div 
                      key={seat.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-border/60 text-xs"
                    >
                      <div>
                        <p className="font-extrabold text-white">Fila {seat.fila} · Asiento {seat.número}</p>
                        <p className="text-[10px] text-muted-foreground">{seat.zona}</p>
                      </div>
                      <span className="font-bold text-white">${seat.precio.toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sumatoria de costos */}
              <div className="border-t border-border/50 pt-4 space-y-2.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal ({selectedSeats.length}x):</span>
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
                disabled={isBooking}
                className="w-full glow-button bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center space-x-2 text-base cursor-pointer"
              >
                {isBooking ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Bloqueando...</span>
                  </>
                ) : (
                  <>
                    <span>Confirmar Selección</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="glass-panel border border-border/40 border-dashed rounded-2xl p-10 text-center flex flex-col items-center justify-center h-48">
              <p className="text-muted-foreground text-sm">Haz clic sobre las butacas libres en el mapa para agregarlas a tu reserva.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
