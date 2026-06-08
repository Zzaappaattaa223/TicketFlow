import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { LocalDbService } from '../localDb';
import fs from 'fs';
import path from 'path';

describe('LocalDbService - Unidad y Lógica de Reserva', () => {
  let db: LocalDbService;

  beforeAll(async () => {
    const mockFilePath = path.join(process.cwd(), 'src/lib/supabase/db-mock.json');
    if (fs.existsSync(mockFilePath)) {
      fs.unlinkSync(mockFilePath);
    }
    db = new LocalDbService();
    await db.seedDb();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debe inicializar y traer los venues semilla', async () => {
    const venues = await db.getVenues();
    expect(venues.length).toBeGreaterThan(0);
    expect(venues.some(v => v.nombre === 'Teatro Colón')).toBe(true);
  });

  it('debe inicializar y traer los eventos semilla publicados', async () => {
    const events = await db.getEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(events.some(e => e.título === 'El Lago de los Cisnes')).toBe(true);
  });

  it('debe permitir bloquear la capacidad de una zona si hay disponibilidad', async () => {
    const events = await db.getEvents();
    const event = events[0];
    const zones = await db.getZonesForEvent(event.id);
    const zone = zones[0];

    const success = await db.lockZoneCapacity(
      event.id,
      event.fechas[0],
      zone.id,
      5,
      'test_user_session'
    );

    expect(success).toBe(true);
  });

  it('no debe permitir bloquear más capacidad que la disponible en la zona', async () => {
    const events = await db.getEvents();
    const event = events[0];
    const zones = await db.getZonesForEvent(event.id);
    const zone = zones[0];

    const success = await db.lockZoneCapacity(
      event.id,
      event.fechas[0],
      zone.id,
      9999, // Excede capacidad
      'test_user_session_overflow'
    );

    expect(success).toBe(false);
  });

  it('debe emitir tickets correctos y descontar capacidad cuando la orden es pagada', async () => {
    const events = await db.getEvents();
    const event = events[0];
    const zones = await db.getZonesForEvent(event.id);
    const zone = zones[0];
    
    const capacidadAntes = zone.capacidadRestante;

    // Crear orden pendiente
    const order = await db.createOrder({
      compradorEmail: 'test@cliente.com',
      compradorNombre: 'Test Cliente',
      eventId: event.id,
      funcionFecha: event.fechas[0],
      zonaLibre: {
        nombre: zone.nombre,
        cantidad: 2,
        precioUnitario: zone.precio
      },
      subtotal: zone.precio * 2,
      cargoServicio: 100,
      total: (zone.precio * 2) + 100
    });

    expect(order.estado).toBe('pendiente');

    // Pagar orden
    const paidOrder = await db.updateOrderStatus(order.id, 'pagado', 'stripe_tx_123');
    expect(paidOrder.estado).toBe('pagado');

    // Verificar emisión de tickets
    const tickets = await db.getTicketsByOrderId(order.id);
    expect(tickets.length).toBe(2);
    expect(tickets[0].qrCode).toBeDefined();
    expect(tickets[0].estado).toBe('activo');

    // Verificar capacidad reducida
    const updatedZones = await db.getZonesForEvent(event.id);
    const updatedZone = updatedZones.find(z => z.id === zone.id);
    expect(updatedZone?.capacidadRestante).toBe(capacidadAntes - 2);
  });

  it('debe validar y quemar (marcar usado) un ticket por QR code', async () => {
    const events = await db.getEvents();
    const event = events[0];
    const zones = await db.getZonesForEvent(event.id);
    const zone = zones[0];

    // Crear otra orden pagada
    const order = await db.createOrder({
      compradorEmail: 'test2@cliente.com',
      compradorNombre: 'Test Cliente 2',
      eventId: event.id,
      funcionFecha: event.fechas[0],
      zonaLibre: {
        nombre: zone.nombre,
        cantidad: 1,
        precioUnitario: zone.precio
      },
      subtotal: zone.precio,
      cargoServicio: 50,
      total: zone.precio + 50
    });
    
    await db.updateOrderStatus(order.id, 'pagado');
    const tickets = await db.getTicketsByOrderId(order.id);
    const qrCode = tickets[0].qrCode;

    // Primera validación (éxito)
    const scan1 = await db.validateTicket(qrCode, 'Controlador Juan');
    expect(scan1.success).toBe(true);
    expect(scan1.ticket?.estado).toBe('usado');
    expect(scan1.ticket?.validadoEn).toBeDefined();

    // Segunda validación (ya usado)
    const scan2 = await db.validateTicket(qrCode, 'Controlador Juan');
    expect(scan2.success).toBe(false);
    expect(scan2.error).toContain('ya fue validada');
  });

  it('debe gestionar bloqueos concurrentes de butacas por sesiones distintas', async () => {
    const events = await db.getEvents();
    const event = events.find(e => e.modo === 'numerado');
    expect(event).toBeDefined();
    const eventId = event!.id;
    const fecha = event!.fechas[0];
    
    const seats = await db.getSeatsForEvent(eventId, fecha);
    expect(seats.length).toBeGreaterThan(0);
    const seatId = seats[0].id;

    // Sesión A bloquea asiento
    const lockA = await db.lockSeats(eventId, fecha, [seatId], 'sesion_a');
    expect(lockA).toBe(true);

    // Sesión B intenta bloquear el mismo asiento y debe fallar
    const lockB = await db.lockSeats(eventId, fecha, [seatId], 'sesion_b');
    expect(lockB).toBe(false);

    // Sesión A libera asiento
    const unlockA = await db.unlockSeats(eventId, fecha, [seatId], 'sesion_a');
    expect(unlockA).toBe(true);

    // Sesión B ahora debería poder bloquear el asiento
    const lockBRetry = await db.lockSeats(eventId, fecha, [seatId], 'sesion_b');
    expect(lockBRetry).toBe(true);

    // Limpieza
    await db.unlockSeats(eventId, fecha, [seatId], 'sesion_b');
  });

  it('debe expirar automáticamente los bloqueos de butacas tras 10 minutos', async () => {
    const events = await db.getEvents();
    const event = events.find(e => e.modo === 'numerado');
    expect(event).toBeDefined();
    const eventId = event!.id;
    const fecha = event!.fechas[0];
    
    const seats = await db.getSeatsForEvent(eventId, fecha);
    const seatId = seats[1].id;

    // Usar fake timers
    vi.useFakeTimers();

    // Sesión A bloquea el asiento
    const lockA = await db.lockSeats(eventId, fecha, [seatId], 'sesion_a');
    expect(lockA).toBe(true);

    // Avanzar el reloj virtual 11 minutos (excede los 10 minutos de expiración)
    vi.advanceTimersByTime(11 * 60 * 1000);

    // Sesión B intenta bloquear el asiento. Debería funcionar porque el bloqueo de A ya expiró
    const lockB = await db.lockSeats(eventId, fecha, [seatId], 'sesion_b');
    expect(lockB).toBe(true);

    // Limpieza
    vi.useRealTimers();
    await db.unlockSeats(eventId, fecha, [seatId], 'sesion_b');
  });

  it('debe reembolsar correctamente una orden de zona libre, marcando tickets como cancelados y restaurando capacidad', async () => {
    const events = await db.getEvents();
    const event = events[0]; // libre
    const zones = await db.getZonesForEvent(event.id);
    const zone = zones[0];
    
    // Crear y pagar una orden
    const order = await db.createOrder({
      compradorEmail: 'test_refund@cliente.com',
      compradorNombre: 'Test Refund Client',
      eventId: event.id,
      funcionFecha: event.fechas[0],
      zonaLibre: {
        nombre: zone.nombre,
        cantidad: 3,
        precioUnitario: zone.precio
      },
      subtotal: zone.precio * 3,
      cargoServicio: 150,
      total: (zone.precio * 3) + 150
    });

    const capacidadAntesPago = (await db.getZonesForEvent(event.id)).find(z => z.id === zone.id)!.capacidadRestante;
    
    await db.updateOrderStatus(order.id, 'pagado');
    
    const capacidadDespuesPago = (await db.getZonesForEvent(event.id)).find(z => z.id === zone.id)!.capacidadRestante;
    expect(capacidadDespuesPago).toBe(capacidadAntesPago - 3);

    const ticketsAntes = await db.getTicketsByOrderId(order.id);
    expect(ticketsAntes.every(t => t.estado === 'activo')).toBe(true);

    // Reembolsar la orden
    const refundedOrder = await db.refundOrder(order.id);
    expect(refundedOrder.estado).toBe('reembolsado');

    // Verificar restauración de capacidad
    const capacidadDespuesReembolso = (await db.getZonesForEvent(event.id)).find(z => z.id === zone.id)!.capacidadRestante;
    expect(capacidadDespuesReembolso).toBe(capacidadAntesPago); // Debe volver a la capacidad original antes del pago

    // Verificar tickets cancelados
    const ticketsDespues = await db.getTicketsByOrderId(order.id);
    expect(ticketsDespues.length).toBe(3);
    expect(ticketsDespues.every(t => t.estado === 'cancelado')).toBe(true);
  });

  it('debe reembolsar correctamente una orden numerada, marcando tickets como cancelados y liberando las butacas', async () => {
    const events = await db.getEvents();
    const event = events.find(e => e.modo === 'numerado')!;
    const fecha = event.fechas[0];
    const seats = await db.getSeatsForEvent(event.id, fecha);
    const freeSeats = seats.filter(s => s.estado === 'libre');
    
    const seat1 = freeSeats[0];
    const seat2 = freeSeats[1];

    // Crear y pagar la orden
    const order = await db.createOrder({
      compradorEmail: 'test_refund_num@cliente.com',
      compradorNombre: 'Test Refund Num Client',
      eventId: event.id,
      funcionFecha: fecha,
      seats: [
        { fila: seat1.fila, número: seat1.número, zona: seat1.zona, precio: seat1.precio },
        { fila: seat2.fila, número: seat2.número, zona: seat2.zona, precio: seat2.precio }
      ],
      subtotal: seat1.precio + seat2.precio,
      cargoServicio: 200,
      total: seat1.precio + seat2.precio + 200
    });

    await db.updateOrderStatus(order.id, 'pagado');

    // Verificar que los asientos están marcados como vendidos
    const seatsDespuesPago = await db.getSeatsForEvent(event.id, fecha);
    const s1 = seatsDespuesPago.find(s => s.fila === seat1.fila && s.número === seat1.número)!;
    const s2 = seatsDespuesPago.find(s => s.fila === seat2.fila && s.número === seat2.número)!;
    expect(s1.estado).toBe('vendido');
    expect(s2.estado).toBe('vendido');

    // Reembolsar orden
    await db.refundOrder(order.id);

    // Verificar que los asientos vuelven a estar libres
    const seatsDespuesReembolso = await db.getSeatsForEvent(event.id, fecha);
    const s1Free = seatsDespuesReembolso.find(s => s.fila === seat1.fila && s.número === seat1.número)!;
    const s2Free = seatsDespuesReembolso.find(s => s.fila === seat2.fila && s.número === seat2.número)!;
    expect(s1Free.estado).toBe('libre');
    expect(s2Free.estado).toBe('libre');

    // Verificar tickets cancelados
    const tickets = await db.getTicketsByOrderId(order.id);
    expect(tickets.every(t => t.estado === 'cancelado')).toBe(true);
  });
});
