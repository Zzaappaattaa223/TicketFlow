import fs from 'fs';
import path from 'path';
import { IDbService } from './dbService';
import { Venue, Event, Zone, Seat, Order, Ticket, User, UserRoleAssignment, SeatLock, OrderStatus, TicketStatus } from '@/types';

const MOCK_FILE_PATH = path.join(process.cwd(), 'src/lib/supabase/db-mock.json');

interface DbState {
  venues: Venue[];
  events: Event[];
  zones: { [eventId: string]: Zone[] };
  seats: Seat[];
  orders: Order[];
  tickets: Ticket[];
  users: User[];
  locks: SeatLock[];
}

export class LocalDbService implements IDbService {
  private getDbState(): DbState {
    if (!fs.existsSync(MOCK_FILE_PATH)) {
      const dir = path.dirname(MOCK_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const initialState: DbState = {
        venues: [],
        events: [],
        zones: {},
        seats: [],
        orders: [],
        tickets: [],
        users: [],
        locks: []
      };
      fs.writeFileSync(MOCK_FILE_PATH, JSON.stringify(initialState, null, 2), 'utf-8');
      return initialState;
    }

    try {
      const content = fs.readFileSync(MOCK_FILE_PATH, 'utf-8');
      if (!content.trim()) {
        return {
          venues: [],
          events: [],
          zones: {},
          seats: [],
          orders: [],
          tickets: [],
          users: [],
          locks: []
        };
      }
      return JSON.parse(content) as DbState;
    } catch (error) {
      if (error instanceof SyntaxError) {
        return {
          venues: [],
          events: [],
          zones: {},
          seats: [],
          orders: [],
          tickets: [],
          users: [],
          locks: []
        };
      }
      console.error('Error al leer db-mock.json, inicializando vacío:', error);
      return {
        venues: [],
        events: [],
        zones: {},
        seats: [],
        orders: [],
        tickets: [],
        users: [],
        locks: []
      };
    }
  }

  private saveDbState(state: DbState): void {
    fs.writeFileSync(MOCK_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  }

  // Venues
  async getVenues(): Promise<Venue[]> {
    return this.getDbState().venues;
  }

  async getVenueById(id: string): Promise<Venue | null> {
    const venue = this.getDbState().venues.find(v => v.id === id);
    return venue || null;
  }

  async createVenue(venue: Omit<Venue, 'id'>): Promise<Venue> {
    const state = this.getDbState();
    const newVenue: Venue = {
      ...venue,
      id: `venue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    state.venues.push(newVenue);
    this.saveDbState(state);
    return newVenue;
  }

  async updateVenue(id: string, venue: Partial<Venue>): Promise<Venue> {
    const state = this.getDbState();
    const idx = state.venues.findIndex(v => v.id === id);
    if (idx === -1) throw new Error('Venue no encontrado');
    state.venues[idx] = { ...state.venues[idx], ...venue };
    this.saveDbState(state);
    return state.venues[idx];
  }

  async deleteVenue(id: string): Promise<boolean> {
    const state = this.getDbState();
    
    // Bloquear si la sala tiene espectáculos programados activos
    const hasActiveEvents = state.events.some(e => e.venueId === id && e.estado !== 'cancelado');
    if (hasActiveEvents) {
      throw new Error('No se puede eliminar esta sala porque tiene espectáculos programados activos. Cancela o elimina los espectáculos asociados primero.');
    }

    const lengthBefore = state.venues.length;
    state.venues = state.venues.filter(v => v.id !== id);
    this.saveDbState(state);
    return state.venues.length < lengthBefore;
  }

  // Events
  async getEvents(): Promise<Event[]> {
    return this.getDbState().events;
  }

  async getEventById(id: string): Promise<Event | null> {
    const event = this.getDbState().events.find(e => e.id === id);
    return event || null;
  }

  async createEvent(event: Omit<Event, 'id' | 'createdAt'>): Promise<Event> {
    const state = this.getDbState();
    const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newEvent: Event = {
      ...event,
      id: eventId,
      createdAt: new Date().toISOString()
    };
    state.events.push(newEvent);

    // Buscar el venue para copiar sus zonas por defecto
    const venue = state.venues.find(v => v.id === event.venueId);
    if (venue) {
      state.zones[eventId] = venue.zonas.map(z => ({
        id: `zone_${eventId}_${z.nombre.toLowerCase().replace(/\s+/g, '_')}`,
        nombre: z.nombre,
        capacidad: z.capacidad,
        capacidadRestante: z.capacidad,
        precio: z.precio,
        tipo: z.tipo
      }));
    } else {
      // Zona por defecto si no hay venue o no tiene zonas
      state.zones[eventId] = [{
        id: `zone_${eventId}_general`,
        nombre: 'General',
        capacidad: 500,
        capacidadRestante: 500,
        precio: 2500,
        tipo: 'General'
      }];
    }

    this.saveDbState(state);
    return newEvent;
  }

  async updateEvent(id: string, event: Partial<Event>): Promise<Event> {
    const state = this.getDbState();
    const idx = state.events.findIndex(e => e.id === id);
    if (idx === -1) throw new Error('Evento no encontrado');
    state.events[idx] = { ...state.events[idx], ...event };
    this.saveDbState(state);
    return state.events[idx];
  }

  async deleteEvent(id: string): Promise<boolean> {
    const state = this.getDbState();

    // Bloquear si el espectáculo tiene tickets activos o usados
    const hasActiveTickets = state.tickets.some(t => t.eventId === id && t.estado !== 'cancelado');
    if (hasActiveTickets) {
      throw new Error('No se puede eliminar este espectáculo porque ya tiene entradas activas o usadas. Debes realizar una cancelación explícita en su estado antes de proceder.');
    }

    const lengthBefore = state.events.length;
    state.events = state.events.filter(e => e.id !== id);
    delete state.zones[id];
    this.saveDbState(state);
    return state.events.length < lengthBefore;
  }

  // Zones
  async getZonesForEvent(eventId: string): Promise<Zone[]> {
    return this.getDbState().zones[eventId] || [];
  }

  async createZone(eventId: string, zone: Omit<Zone, 'id'>): Promise<Zone> {
    const state = this.getDbState();
    if (!state.zones[eventId]) state.zones[eventId] = [];
    const newZone: Zone = {
      ...zone,
      id: `zone_${eventId}_${Date.now()}`
    };
    state.zones[eventId].push(newZone);
    this.saveDbState(state);
    return newZone;
  }

  async updateZone(eventId: string, zoneId: string, zone: Partial<Zone>): Promise<Zone> {
    const state = this.getDbState();
    const eventZones = state.zones[eventId] || [];
    const idx = eventZones.findIndex(z => z.id === zoneId);
    if (idx === -1) throw new Error('Zona no encontrada');
    eventZones[idx] = { ...eventZones[idx], ...zone };
    state.zones[eventId] = eventZones;
    this.saveDbState(state);
    return eventZones[idx];
  }

  // Seats (Numerado - Reservado para Fase 2)
  async getSeatsForEvent(eventId: string, fecha: string): Promise<Seat[]> {
    const state = this.getDbState();
    const now = new Date();
    const activeLocks = state.locks.filter(l => l.eventId === eventId && l.funcionFecha === fecha && new Date(l.expiresAt) > now);

    return state.seats
      .filter(s => s.eventId === eventId && s.funcionFecha === fecha)
      .map(s => {
        const isLocked = activeLocks.some(l => l.id === s.id);
        if (isLocked && s.estado !== 'vendido') {
          return { ...s, estado: 'bloqueado' as const };
        }
        return s;
      });
  }

  async lockSeats(eventId: string, fecha: string, seatIds: string[], userIdOrSessionId: string): Promise<boolean> {
    const state = this.getDbState();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 10 min TTL

    // Limpiar locks expirados
    state.locks = state.locks.filter(l => new Date(l.expiresAt) > now);

    // Verificar si alguna butaca ya está bloqueada o vendida
    for (const seatId of seatIds) {
      const isLocked = state.locks.some(l => l.id === seatId && l.userIdOrSessionId !== userIdOrSessionId);
      const seat = state.seats.find(s => s.id === seatId);
      if (isLocked || (seat && seat.estado === 'vendido')) {
        return false;
      }
    }

    // Registrar locks
    seatIds.forEach(seatId => {
      const idx = state.locks.findIndex(l => l.id === seatId);
      if (idx !== -1) {
        state.locks[idx].expiresAt = expiresAt;
      } else {
        state.locks.push({
          id: seatId,
          eventId,
          funcionFecha: fecha,
          userIdOrSessionId,
          lockedAt: now.toISOString(),
          expiresAt
        });
      }
    });

    this.saveDbState(state);
    return true;
  }

  async unlockSeats(eventId: string, fecha: string, seatIds: string[], userIdOrSessionId: string): Promise<boolean> {
    const state = this.getDbState();
    state.locks = state.locks.filter(l => !(seatIds.includes(l.id) && l.userIdOrSessionId === userIdOrSessionId));
    this.saveDbState(state);
    return true;
  }

  // Locks para Zonas Libres (Fase 1)
  async lockZoneCapacity(eventId: string, fecha: string, zoneId: string, cantidad: number, userIdOrSessionId: string): Promise<boolean> {
    const state = this.getDbState();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 10 mins

    // Limpiar locks expirados antes de calcular capacidad disponible
    const activeLocksBefore = [...state.locks];
    state.locks = state.locks.filter(l => new Date(l.expiresAt) > now);

    // Calcular capacidad restante real considerando ventas y locks activos
    const zones = state.zones[eventId] || [];
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return false;

    // Calcular cuántos tickets ya se han vendido para esta zona y fecha
    const soldCount = state.tickets.filter(t => t.eventId === eventId && t.funcionFecha === fecha && t.zona === zone.nombre && t.estado !== 'cancelado').length;

    // Calcular cantidad bloqueada por otros usuarios
    const lockedCountByOthers = state.locks
      .filter(l => l.eventId === eventId && l.funcionFecha === fecha && l.id === zoneId && l.userIdOrSessionId !== userIdOrSessionId)
      .reduce((sum, l) => sum + (l.cantidad || 0), 0);

    const available = zone.capacidad - soldCount - lockedCountByOthers;

    if (cantidad > available) {
      return false; // No hay suficiente capacidad
    }

    // Registrar o actualizar lock
    const lockId = `${zoneId}_${userIdOrSessionId}`;
    const idx = state.locks.findIndex(l => l.id === lockId);
    if (idx !== -1) {
      state.locks[idx].cantidad = cantidad;
      state.locks[idx].expiresAt = expiresAt;
    } else {
      state.locks.push({
        id: lockId, // usar id único por usuario-zona
        eventId,
        funcionFecha: fecha,
        userIdOrSessionId,
        cantidad,
        lockedAt: now.toISOString(),
        expiresAt
      });
    }

    this.saveDbState(state);
    return true;
  }

  async unlockZoneCapacity(eventId: string, fecha: string, zoneId: string, userIdOrSessionId: string): Promise<boolean> {
    const state = this.getDbState();
    const lockId = `${zoneId}_${userIdOrSessionId}`;
    state.locks = state.locks.filter(l => l.id !== lockId);
    this.saveDbState(state);
    return true;
  }

  async getActiveLocks(userIdOrSessionId: string): Promise<SeatLock[]> {
    const now = new Date();
    // Filtrar expirados y devolver activos para el usuario
    return this.getDbState().locks.filter(l => l.userIdOrSessionId === userIdOrSessionId && new Date(l.expiresAt) > now);
  }

  // Orders
  async createOrder(order: Omit<Order, 'id' | 'createdAt' | 'estado'>): Promise<Order> {
    const state = this.getDbState();
    const newOrder: Order = {
      ...order,
      id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      estado: 'pendiente',
      createdAt: new Date().toISOString()
    };
    state.orders.push(newOrder);
    this.saveDbState(state);
    return newOrder;
  }

  async getOrderById(id: string): Promise<Order | null> {
    const order = this.getDbState().orders.find(o => o.id === id);
    return order || null;
  }

  async getOrders(): Promise<Order[]> {
    return this.getDbState().orders;
  }

  async getOrdersByUserId(userId: string): Promise<Order[]> {
    return this.getDbState().orders.filter(o => o.userId === userId);
  }

  async updateOrderStatus(id: string, estado: OrderStatus, stripePaymentId?: string): Promise<Order> {
    const state = this.getDbState();
    const idx = state.orders.findIndex(o => o.id === id);
    if (idx === -1) throw new Error('Orden no encontrada');
    
    state.orders[idx].estado = estado;
    if (stripePaymentId) {
      state.orders[idx].stripePaymentId = stripePaymentId;
    }

    // Si la orden cambia a pagado, generamos los tickets asociados y disminuimos la capacidad real de la zona
    if (estado === 'pagado') {
      const order = state.orders[idx];
      const eventId = order.eventId;
      const fecha = order.funcionFecha;

      if (order.zonaLibre) {
        const zoneName = order.zonaLibre.nombre;
        const qty = order.zonaLibre.cantidad;

        // Descontar la capacidad restante en la zona
        if (state.zones[eventId]) {
          const zoneIdx = state.zones[eventId].findIndex(z => z.nombre === zoneName);
          if (zoneIdx !== -1) {
            state.zones[eventId][zoneIdx].capacidadRestante = Math.max(
              0,
              state.zones[eventId][zoneIdx].capacidadRestante - qty
            );
          }
        }

        // Crear los tickets
        for (let i = 0; i < qty; i++) {
          const ticketId = `ticket_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`;
          const qrHash = `qr_${eventId.substring(6, 12)}_${ticketId.substring(7)}_${Math.random().toString(36).substr(2, 5)}`;
          state.tickets.push({
            id: ticketId,
            orderId: order.id,
            eventId,
            funcionFecha: fecha,
            zona: zoneName,
            qrCode: qrHash,
            estado: 'activo',
            holderNombre: order.compradorNombre,
            holderEmail: order.compradorEmail
          });
        }

        // Remover locks de este usuario para esta zona
        const lockId = `${state.zones[eventId]?.find(z => z.nombre === zoneName)?.id}_${order.userId || order.compradorEmail}`;
        state.locks = state.locks.filter(l => l.id !== lockId);
      } else if (order.seats) {
        // Asignación de butacas numeradas
        order.seats.forEach((s) => {
          // Buscar el asiento en la base de datos
          const seatIdx = state.seats.findIndex(
            st => st.eventId === eventId && st.funcionFecha === fecha && st.fila === s.fila && st.número === s.número
          );
          if (seatIdx !== -1) {
            state.seats[seatIdx].estado = 'vendido';
          }

          // Crear ticket
          const ticketId = `ticket_${Date.now()}_seat_${s.fila}_${s.número}_${Math.random().toString(36).substr(2, 5)}`;
          const qrHash = `qr_${eventId.substring(6, 12)}_${ticketId.substring(7)}_${Math.random().toString(36).substr(2, 5)}`;
          state.tickets.push({
            id: ticketId,
            orderId: order.id,
            eventId,
            funcionFecha: fecha,
            seatId: state.seats[seatIdx]?.id || `seat_${s.fila}_${s.número}`,
            fila: s.fila,
            número: s.número,
            zona: s.zona,
            qrCode: qrHash,
            estado: 'activo',
            holderNombre: order.compradorNombre,
            holderEmail: order.compradorEmail
          });

          // Remover lock de la butaca
          const lockId = state.seats[seatIdx]?.id || `seat_${s.fila}_${s.número}`;
          state.locks = state.locks.filter(l => l.id !== lockId);
        });
      }
    }

    this.saveDbState(state);
    return state.orders[idx];
  }

  async refundOrder(id: string): Promise<Order> {
    const state = this.getDbState();
    const idx = state.orders.findIndex(o => o.id === id);
    if (idx === -1) throw new Error('Orden no encontrada');

    const order = state.orders[idx];
    if (order.estado === 'reembolsado') {
      return order;
    }

    state.orders[idx].estado = 'reembolsado';
    const eventId = order.eventId;
    const fecha = order.funcionFecha;

    // 1. Cancelar los tickets correspondientes a esta orden
    state.tickets = state.tickets.map(t => {
      if (t.orderId === id) {
        return { ...t, estado: 'cancelado' as const };
      }
      return t;
    });

    // 2. Liberar capacidad
    if (order.zonaLibre) {
      const zoneName = order.zonaLibre.nombre;
      const qty = order.zonaLibre.cantidad;

      if (state.zones[eventId]) {
        const zoneIdx = state.zones[eventId].findIndex(z => z.nombre === zoneName);
        if (zoneIdx !== -1) {
          state.zones[eventId][zoneIdx].capacidadRestante = 
            state.zones[eventId][zoneIdx].capacidadRestante + qty;
        }
      }
    } else if (order.seats) {
      order.seats.forEach((s) => {
        const seatIdx = state.seats.findIndex(
          st => st.eventId === eventId && st.funcionFecha === fecha && st.fila === s.fila && st.número === s.número
        );
        if (seatIdx !== -1) {
          state.seats[seatIdx].estado = 'libre';
        }
      });
    }

    this.saveDbState(state);
    return state.orders[idx];
  }

  // Tickets
  async createTicket(ticket: Omit<Ticket, 'id' | 'estado'>): Promise<Ticket> {
    const state = this.getDbState();
    const newTicket: Ticket = {
      ...ticket,
      id: `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      estado: 'activo'
    };
    state.tickets.push(newTicket);
    this.saveDbState(state);
    return newTicket;
  }

  async getTicketsByOrderId(orderId: string): Promise<Ticket[]> {
    return this.getDbState().tickets.filter(t => t.orderId === orderId);
  }

  async getTicketByQR(qrCode: string): Promise<Ticket | null> {
    const ticket = this.getDbState().tickets.find(t => t.qrCode === qrCode);
    return ticket || null;
  }

  async validateTicket(qrCode: string, porteroName: string): Promise<{ success: boolean; error?: string; ticket?: Ticket }> {
    const state = this.getDbState();
    const idx = state.tickets.findIndex(t => t.qrCode === qrCode);
    if (idx === -1) {
      return { success: false, error: 'Código QR no reconocido. Entrada inválida.' };
    }

    const ticket = state.tickets[idx];
    if (ticket.estado === 'usado') {
      const vDate = new Date(ticket.validadoEn || '');
      const pad = (n: number) => String(n).padStart(2, '0');
      const formattedDate = `${vDate.getFullYear()}-${pad(vDate.getMonth() + 1)}-${pad(vDate.getDate())} ${pad(vDate.getHours())}:${pad(vDate.getMinutes())}`;
      return { 
        success: false, 
        error: `Esta entrada ya fue validada el ${formattedDate}`,
        ticket 
      };
    }

    if (ticket.estado === 'cancelado') {
      return { success: false, error: 'Esta entrada ha sido cancelada por administración.', ticket };
    }

    // Éxito: Marcar como usado y registrar hora
    state.tickets[idx].estado = 'usado';
    state.tickets[idx].validadoEn = new Date().toISOString();
    this.saveDbState(state);

    return { success: true, ticket: state.tickets[idx] };
  }

  async getTicketsByEventId(eventId: string): Promise<Ticket[]> {
    return this.getDbState().tickets.filter(t => t.eventId === eventId);
  }

  // Users
  async getUserById(id: string): Promise<User | null> {
    const user = this.getDbState().users.find(u => u.id === id);
    return user || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = this.getDbState().users.find(u => u.email.toLowerCase() === email.toLowerCase());
    return user || null;
  }

  async createUser(user: User): Promise<User> {
    const state = this.getDbState();
    const exists = state.users.some(u => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
    if (exists) {
      throw new Error('El usuario ya existe en el sistema');
    }
    state.users.push(user);
    this.saveDbState(state);
    return user;
  }

  async updateUserRole(id: string, rol: User['rol'], venueIds?: string[], eventIds?: string[]): Promise<User> {
    const state = this.getDbState();
    const idx = state.users.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('Usuario no encontrado');
    state.users[idx].rol = rol;
    if (venueIds !== undefined) {
      state.users[idx].venueIds = venueIds;
    }
    if (eventIds !== undefined) {
      state.users[idx].eventIds = eventIds;
    }
    this.saveDbState(state);
    return state.users[idx];
  }

  async updateUserRoleAssignments(id: string, assignments: UserRoleAssignment[]): Promise<User> {
    const state = this.getDbState();
    const idx = state.users.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('Usuario no encontrado');
    state.users[idx].roleAssignments = assignments;
    this.saveDbState(state);
    return state.users[idx];
  }

  async getUsers(): Promise<User[]> {
    return this.getDbState().users;
  }

  // Seed DB with mock data
  async seedDb(): Promise<void> {
    const state = this.getDbState();

    // Solo seed si está vacío
    if (state.venues.length > 0) return;

    // 1. Creación de Venues
    const venueColon: Venue = {
      id: 'venue_colon',
      nombre: 'Teatro Colón',
      slug: 'teatro-colon',
      ciudad: 'Buenos Aires',
      capacidad: 2400,
      imagen: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&q=80&w=1000',
      zonas: [
        { id: 'venue_colon_platea_premium', nombre: 'Platea Premium', capacidad: 400, precio: 15000, tipo: 'VIP' },
        { id: 'venue_colon_platea_alta', nombre: 'Platea Alta', capacidad: 600, precio: 9500, tipo: 'General' },
        { id: 'venue_colon_palcos', nombre: 'Palcos', capacidad: 400, precio: 18000, tipo: 'VIP' },
        { id: 'venue_colon_tertulia', nombre: 'Tertulia', capacidad: 1000, precio: 4500, tipo: 'Descuento' }
      ]
    };

    const venueRex: Venue = {
      id: 'venue_rex',
      nombre: 'Teatro Gran Rex',
      slug: 'teatro-gran-rex',
      ciudad: 'Buenos Aires',
      capacidad: 3200,
      imagen: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=1000',
      zonas: [
        { id: 'venue_rex_vip_platinum', nombre: 'VIP Platinum', capacidad: 500, precio: 25000, tipo: 'VIP' },
        { id: 'venue_rex_platea_gold', nombre: 'Platea Gold', capacidad: 1000, precio: 18000, tipo: 'General' },
        { id: 'venue_rex_super_pullman', nombre: 'Super Pullman', capacidad: 700, precio: 12000, tipo: 'General' },
        { id: 'venue_rex_pullman', nombre: 'Pullman', capacidad: 1000, precio: 8000, tipo: 'Descuento' }
      ]
    };

    state.venues.push(venueColon, venueRex);

    // 2. Creación de Eventos
    const date1 = new Date();
    date1.setDate(date1.getDate() + 5);
    const date2 = new Date();
    date2.setDate(date2.getDate() + 12);
    const date3 = new Date();
    date3.setDate(date3.getDate() + 20);

    const eventCisnes: Event = {
      id: 'event_cisnes',
      venueId: 'venue_colon',
      título: 'El Lago de los Cisnes',
      descripción: 'El prestigioso Ballet Estable del Teatro Colón presenta la obra cumbre del ballet clásico, musicalizada por la partitura inolvidable de Pyotr Ilyich Tchaikovsky y dirigida por destacados coreógrafos internacionales.',
      fechas: [date1.toISOString(), date2.toISOString()],
      imágenes: ['https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&q=80&w=1000'],
      categoría: 'danza',
      estado: 'publicado',
      modo: 'numerado',
      cargoServicio: 10,
      tipoCargo: 'porcentaje',
      createdAt: new Date().toISOString()
    };

    const eventSoda: Event = {
      id: 'event_soda',
      venueId: 'venue_rex',
      título: 'Soda Stereo: Tributo Sinfónico',
      descripción: 'Un recorrido emocionante por las canciones más icónicas de la banda más grande de Latinoamérica, interpretadas por una orquesta filarmónica de 60 músicos y destacados cantantes de la escena rockera.',
      fechas: [date3.toISOString()],
      imágenes: ['https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=1000'],
      categoría: 'concierto',
      estado: 'publicado',
      modo: 'libre',
      cargoServicio: 1500,
      tipoCargo: 'fijo',
      createdAt: new Date().toISOString()
    };

    state.events.push(eventCisnes, eventSoda);

    // Configurar zonas de eventos copiando las de los venues
    state.zones[eventCisnes.id] = venueColon.zonas.map(z => ({
      id: `zone_cisnes_${z.nombre.toLowerCase().replace(/\s+/g, '_')}`,
      nombre: z.nombre,
      capacidad: z.capacidad,
      capacidadRestante: z.capacidad,
      precio: z.precio,
      tipo: z.tipo
    }));

    state.zones[eventSoda.id] = venueRex.zonas.map(z => ({
      id: `zone_soda_${z.nombre.toLowerCase().replace(/\s+/g, '_')}`,
      nombre: z.nombre,
      capacidad: z.capacidad,
      capacidadRestante: z.capacidad,
      precio: z.precio,
      tipo: z.tipo
    }));

    // Generar butacas numeradas para las funciones de El Lago de los Cisnes
    const filas = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const nums = [1, 2, 3, 4, 5, 6, 7, 8];

    eventCisnes.fechas.forEach((fecha) => {
      filas.forEach((fila) => {
        nums.forEach((num) => {
          const esPremium = ['A', 'B', 'C', 'D'].includes(fila);
          const zonaName = esPremium ? 'Platea Premium' : 'Platea Alta';
          const precio = esPremium ? 15000 : 9500;
          const tipo = esPremium ? 'VIP' : 'General';
          
          state.seats.push({
            id: `seat_cisnes_${fecha.substring(0, 10)}_${fila}_${num}`,
            eventId: eventCisnes.id,
            funcionFecha: fecha,
            fila,
            número: num,
            zona: zonaName,
            estado: 'libre',
            precio,
            tipo
          });
        });
      });
    });

    // 3. Creación de Usuarios
    const adminUser: User = {
      id: 'user_admin',
      email: 'admin@ticketflow.com',
      nombre: 'Administrador Principal',
      rol: 'Super Admin',
      createdAt: new Date().toISOString()
    };

    const porteroUser: User = {
      id: 'user_portero',
      email: 'portero@ticketflow.com',
      nombre: 'Controlador Acceso Rex',
      rol: 'Controlador de Acceso',
      venueIds: ['venue_rex'],
      createdAt: new Date().toISOString()
    };

    const staffUser: User = {
      id: 'user_staff',
      email: 'staff@ticketflow.com',
      nombre: 'Staff Multitarea',
      rol: 'Comprador',
      roleAssignments: [
        {
          id: 'assign_1',
          rol: 'Admin de Sala',
          venueId: 'venue_colon'
        },
        {
          id: 'assign_2',
          rol: 'Boletería',
          venueId: 'venue_rex'
        },
        {
          id: 'assign_3',
          rol: 'Productor',
          eventId: 'event_soda'
        },
        {
          id: 'assign_4',
          rol: 'Controlador de Acceso',
          eventId: 'event_cisnes',
          fecha: date1.toISOString()
        }
      ],
      createdAt: new Date().toISOString()
    };

    state.users.push(adminUser, porteroUser, staffUser);

    this.saveDbState(state);
  }
}
