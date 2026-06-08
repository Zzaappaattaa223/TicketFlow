import { supabase } from './supabaseClient';
import { IDbService } from './dbService';
import { Venue, Event, Zone, Seat, Order, Ticket, User, UserRoleAssignment, SeatLock, OrderStatus, TicketStatus } from '@/types';

export class SupabaseDbService implements IDbService {
  // Venues
  async getVenues(): Promise<Venue[]> {
    const { data, error } = await supabase!.from('venues').select('*');
    if (error) throw error;
    return (data || []) as Venue[];
  }

  async getVenueById(id: string): Promise<Venue | null> {
    const { data, error } = await supabase!.from('venues').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as Venue | null;
  }

  private async uploadBase64Image(base64Str: string): Promise<string> {
    if (!base64Str || !base64Str.startsWith('data:image/')) {
      return base64Str; // Si ya es una URL HTTP o no es base64, retornarla tal cual
    }

    try {
      const mimeMatch = base64Str.match(/^data:([^;]+);base64,(.+)$/);
      if (!mimeMatch) return base64Str;

      const contentType = mimeMatch[1];
      const base64Data = mimeMatch[2];
      
      const buffer = Buffer.from(base64Data, 'base64');
      
      const fileExtension = contentType.split('/')[1] || 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExtension}`;

      const { error } = await supabase!.storage
        .from('images')
        .upload(fileName, buffer, {
          contentType,
          upsert: true
        });

      if (error) {
        console.error('Error de Supabase Storage en subida:', error);
        return base64Str; // Fallback
      }

      const { data: { publicUrl } } = supabase!.storage.from('images').getPublicUrl(fileName);
      return publicUrl;
    } catch (err) {
      console.error('Error al procesar la subida del Base64:', err);
      return base64Str; // Fallback elegante
    }
  }

  async createVenue(venue: Omit<Venue, 'id'>): Promise<Venue> {
    const uploadedImagen = venue.imagen ? await this.uploadBase64Image(venue.imagen) : venue.imagen;
    const newVenue: Venue = {
      ...venue,
      imagen: uploadedImagen,
      id: `venue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    const { error } = await supabase!.from('venues').insert(newVenue);
    if (error) throw error;
    return newVenue;
  }

  async updateVenue(id: string, venue: Partial<Venue>): Promise<Venue> {
    const updatedFields: Partial<Venue> = { ...venue };
    if (venue.imagen) {
      updatedFields.imagen = await this.uploadBase64Image(venue.imagen);
    }
    const { data, error } = await supabase!.from('venues').update(updatedFields).eq('id', id).select().single();
    if (error) throw error;
    return data as Venue;
  }

  async deleteVenue(id: string): Promise<boolean> {
    // Bloquear si la sala tiene espectáculos programados activos
    const { data: activeEvents, error: evErr } = await supabase!
      .from('events')
      .select('id')
      .eq('venueId', id)
      .not('estado', 'eq', 'cancelado');
    if (evErr) throw evErr;

    if (activeEvents && activeEvents.length > 0) {
      throw new Error('No se puede eliminar esta sala porque tiene espectáculos programados activos. Cancela o elimina los espectáculos asociados primero.');
    }

    const { error } = await supabase!.from('venues').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  // Events
  async getEvents(): Promise<Event[]> {
    const { data, error } = await supabase!.from('events').select('*');
    if (error) throw error;
    return (data || []) as Event[];
  }

  async getEventById(id: string): Promise<Event | null> {
    const { data, error } = await supabase!.from('events').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as Event | null;
  }

  async createEvent(event: Omit<Event, 'id' | 'createdAt'>): Promise<Event> {
    const uploadedImágenes = event.imágenes 
      ? await Promise.all(event.imágenes.map(img => this.uploadBase64Image(img)))
      : [];
    const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newEvent: Event = {
      ...event,
      imágenes: uploadedImágenes,
      id: eventId,
      createdAt: new Date().toISOString()
    };
    const { error } = await supabase!.from('events').insert(newEvent);
    if (error) throw error;

    // Crear zonas por defecto del evento
    const venue = await this.getVenueById(event.venueId);
    let zonesToCreate: Omit<Zone, 'id'>[] = [];
    if (venue && venue.zonas && venue.zonas.length > 0) {
      zonesToCreate = venue.zonas.map(z => ({
        nombre: z.nombre,
        capacidad: z.capacidad,
        capacidadRestante: z.capacidad,
        precio: z.precio,
        tipo: z.tipo
      }));
    } else {
      zonesToCreate = [{
        nombre: 'General',
        capacidad: 500,
        capacidadRestante: 500,
        precio: 2500,
        tipo: 'General'
      }];
    }

    for (const z of zonesToCreate) {
      await this.createZone(eventId, z);
    }

    return newEvent;
  }

  async updateEvent(id: string, event: Partial<Event>): Promise<Event> {
    const updatedFields: Partial<Event> = { ...event };
    if (event.imágenes) {
      updatedFields.imágenes = await Promise.all(
        event.imágenes.map(img => this.uploadBase64Image(img))
      );
    }
    const { data, error } = await supabase!.from('events').update(updatedFields).eq('id', id).select().single();
    if (error) throw error;
    return data as Event;
  }

  async deleteEvent(id: string): Promise<boolean> {
    // Bloquear si el espectáculo tiene tickets activos o usados
    const { data: activeTickets, error: tkErr } = await supabase!
      .from('tickets')
      .select('id')
      .eq('eventId', id)
      .not('estado', 'eq', 'cancelado');
    if (tkErr) throw tkErr;

    if (activeTickets && activeTickets.length > 0) {
      throw new Error('No se puede eliminar este espectáculo porque ya tiene entradas activas o usadas. Debes realizar una cancelación explícita en su estado antes de proceder.');
    }

    const { error } = await supabase!.from('events').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  // Zones
  async getZonesForEvent(eventId: string): Promise<Zone[]> {
    const { data, error } = await supabase!.from('event_zones').select('*').eq('eventId', eventId);
    if (error) throw error;
    return (data || []) as Zone[];
  }

  async createZone(eventId: string, zone: Omit<Zone, 'id'>): Promise<Zone> {
    const newZone: Zone = {
      ...zone,
      id: `zone_${eventId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    };
    const { error } = await supabase!.from('event_zones').insert({
      id: newZone.id,
      eventId,
      nombre: newZone.nombre,
      capacidad: newZone.capacidad,
      capacidadRestante: newZone.capacidadRestante,
      precio: newZone.precio,
      tipo: newZone.tipo
    });
    if (error) throw error;
    return newZone;
  }

  async updateZone(eventId: string, zoneId: string, zone: Partial<Zone>): Promise<Zone> {
    const { data, error } = await supabase!
      .from('event_zones')
      .update(zone)
      .eq('id', zoneId)
      .select()
      .single();
    if (error) throw error;
    return data as Zone;
  }

  // Seats (Numerado)
  async getSeatsForEvent(eventId: string, fecha: string): Promise<Seat[]> {
    const nowStr = new Date().toISOString();
    // Limpiar expirados
    await supabase!.from('locks').delete().lt('expiresAt', nowStr);

    const { data: seats, error: sErr } = await supabase!
      .from('seats')
      .select('*')
      .eq('eventId', eventId)
      .eq('funcionFecha', fecha);
    if (sErr) throw sErr;

    const { data: locks, error: lErr } = await supabase!
      .from('locks')
      .select('*')
      .eq('eventId', eventId)
      .eq('funcionFecha', fecha);
    if (lErr) throw lErr;

    return (seats || []).map(s => {
      const isLocked = (locks || []).some(l => l.id === s.id);
      if (isLocked && s.estado !== 'vendido') {
        return { ...s, estado: 'bloqueado' as const };
      }
      return s;
    }) as Seat[];
  }

  async lockSeats(eventId: string, fecha: string, seatIds: string[], userIdOrSessionId: string): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

    // Limpiar expirados
    await supabase!.from('locks').delete().lt('expiresAt', now.toISOString());

    // Verificar si alguno ya está bloqueado por otro o vendido
    const { data: activeLocks, error: alErr } = await supabase!
      .from('locks')
      .select('id')
      .in('id', seatIds)
      .neq('userIdOrSessionId', userIdOrSessionId);
    if (alErr) throw alErr;
    if (activeLocks && activeLocks.length > 0) return false;

    const { data: soldSeats, error: ssErr } = await supabase!
      .from('seats')
      .select('id')
      .in('id', seatIds)
      .eq('estado', 'vendido');
    if (ssErr) throw ssErr;
    if (soldSeats && soldSeats.length > 0) return false;

    const lockRows = seatIds.map(seatId => ({
      id: seatId,
      eventId,
      funcionFecha: fecha,
      userIdOrSessionId,
      lockedAt: now.toISOString(),
      expiresAt
    }));

    const { error: insErr } = await supabase!.from('locks').upsert(lockRows);
    if (insErr) throw insErr;
    return true;
  }

  async unlockSeats(eventId: string, fecha: string, seatIds: string[], userIdOrSessionId: string): Promise<boolean> {
    const { error } = await supabase!
      .from('locks')
      .delete()
      .in('id', seatIds)
      .eq('userIdOrSessionId', userIdOrSessionId);
    if (error) throw error;
    return true;
  }

  // Locks para Zonas Libres
  async lockZoneCapacity(eventId: string, fecha: string, zoneId: string, cantidad: number, userIdOrSessionId: string): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

    // Limpiar expirados
    await supabase!.from('locks').delete().lt('expiresAt', now.toISOString());

    const { data: zone, error: zErr } = await supabase!.from('event_zones').select('*').eq('id', zoneId).single();
    if (zErr) throw zErr;

    // Calcular vendidos
    const { data: soldCountData, error: sdErr } = await supabase!
      .from('tickets')
      .select('id')
      .eq('eventId', eventId)
      .eq('funcionFecha', fecha)
      .eq('zona', zone.nombre)
      .neq('estado', 'cancelado');
    if (sdErr) throw sdErr;
    const soldCount = soldCountData?.length || 0;

    // Calcular bloqueados por otros
    const { data: locksData, error: lErr } = await supabase!
      .from('locks')
      .select('cantidad')
      .eq('eventId', eventId)
      .eq('funcionFecha', fecha)
      .neq('userIdOrSessionId', userIdOrSessionId)
      .like('id', `${zoneId}_%`);
    if (lErr) throw lErr;
    const lockedCountByOthers = (locksData || []).reduce((sum, l) => sum + (l.cantidad || 0), 0);

    const available = zone.capacidad - soldCount - lockedCountByOthers;
    if (cantidad > available) return false;

    const lockId = `${zoneId}_${userIdOrSessionId}`;
    const { error: upsErr } = await supabase!
      .from('locks')
      .upsert({
        id: lockId,
        eventId,
        funcionFecha: fecha,
        userIdOrSessionId,
        cantidad,
        lockedAt: now.toISOString(),
        expiresAt
      });
    if (upsErr) throw upsErr;
    return true;
  }

  async unlockZoneCapacity(eventId: string, fecha: string, zoneId: string, userIdOrSessionId: string): Promise<boolean> {
    const lockId = `${zoneId}_${userIdOrSessionId}`;
    const { error } = await supabase!.from('locks').delete().eq('id', lockId);
    if (error) throw error;
    return true;
  }

  async getActiveLocks(userIdOrSessionId: string): Promise<SeatLock[]> {
    const now = new Date().toISOString();
    const { data, error } = await supabase!
      .from('locks')
      .select('*')
      .eq('userIdOrSessionId', userIdOrSessionId)
      .gt('expiresAt', now);
    if (error) throw error;
    return (data || []) as SeatLock[];
  }

  // Orders
  async createOrder(order: Omit<Order, 'id' | 'createdAt' | 'estado'>): Promise<Order> {
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newOrder: Order = {
      ...order,
      id: orderId,
      estado: 'pendiente',
      createdAt: new Date().toISOString()
    };
    const { error } = await supabase!.from('orders').insert(newOrder);
    if (error) throw error;
    return newOrder;
  }

  async getOrderById(id: string): Promise<Order | null> {
    const { data, error } = await supabase!.from('orders').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as Order | null;
  }

  async getOrders(): Promise<Order[]> {
    const { data, error } = await supabase!.from('orders').select('*');
    if (error) throw error;
    return (data || []) as Order[];
  }

  async getOrdersByUserId(userId: string): Promise<Order[]> {
    const { data, error } = await supabase!.from('orders').select('*').eq('userId', userId);
    if (error) throw error;
    return (data || []) as Order[];
  }

  async updateOrderStatus(id: string, estado: OrderStatus, stripePaymentId?: string): Promise<Order> {
    const { data: order, error: oErr } = await supabase!
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();
    if (oErr) throw oErr;

    const updates: Partial<Order> = { estado };
    if (stripePaymentId) {
      updates.stripePaymentId = stripePaymentId;
    }

    const { data: updatedOrder, error: uErr } = await supabase!
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (uErr) throw uErr;

    if (estado === 'pagado') {
      const eventId = order.eventId;
      const fecha = order.funcionFecha;

      if (order.zonaLibre) {
        const zoneName = order.zonaLibre.nombre;
        const qty = order.zonaLibre.cantidad;

        // Descontar capacidad restante
        const { data: zones } = await supabase!
          .from('event_zones')
          .select('*')
          .eq('eventId', eventId)
          .eq('nombre', zoneName);
        
        if (zones && zones.length > 0) {
          const zone = zones[0];
          await supabase!
            .from('event_zones')
            .update({ capacidadRestante: Math.max(0, zone.capacidadRestante - qty) })
            .eq('id', zone.id);
        }

        // Crear tickets
        for (let i = 0; i < qty; i++) {
          const ticketId = `ticket_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`;
          const qrHash = `qr_${eventId.substring(6, 12)}_${ticketId.substring(7)}_${Math.random().toString(36).substr(2, 5)}`;
          await supabase!.from('tickets').insert({
            id: ticketId,
            orderId: id,
            eventId,
            funcionFecha: fecha,
            zona: zoneName,
            qrCode: qrHash,
            estado: 'activo',
            holderNombre: order.compradorNombre,
            holderEmail: order.compradorEmail
          });
        }

        // Limpiar locks de capacidad de zona libre
        if (zones && zones.length > 0) {
          const lockId = `${zones[0].id}_${order.userId || order.compradorEmail}`;
          await supabase!.from('locks').delete().eq('id', lockId);
        }
      } else if (order.seats) {
        // Reservar butacas numeradas
        for (const s of order.seats) {
          await supabase!
            .from('seats')
            .update({ estado: 'vendido' })
            .eq('eventId', eventId)
            .eq('funcionFecha', fecha)
            .eq('fila', s.fila)
            .eq('número', s.número);

          const ticketId = `ticket_${Date.now()}_seat_${s.fila}_${s.número}_${Math.random().toString(36).substr(2, 5)}`;
          const qrHash = `qr_${eventId.substring(6, 12)}_${ticketId.substring(7)}_${Math.random().toString(36).substr(2, 5)}`;
          
          const { data: seatRow } = await supabase!
            .from('seats')
            .select('id')
            .eq('eventId', eventId)
            .eq('funcionFecha', fecha)
            .eq('fila', s.fila)
            .eq('número', s.número)
            .single();

          await supabase!.from('tickets').insert({
            id: ticketId,
            orderId: id,
            eventId,
            funcionFecha: fecha,
            seatId: seatRow?.id || `seat_${s.fila}_${s.número}`,
            fila: s.fila,
            número: s.número,
            zona: s.zona,
            qrCode: qrHash,
            estado: 'activo',
            holderNombre: order.compradorNombre,
            holderEmail: order.compradorEmail
          });

          if (seatRow) {
            await supabase!.from('locks').delete().eq('id', seatRow.id);
          }
        }
      }
    }

    return updatedOrder as Order;
  }

  async refundOrder(id: string): Promise<Order> {
    const { data: order, error: oErr } = await supabase!
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();
    if (oErr) throw oErr;

    if (order.estado === 'reembolsado') {
      return order as Order;
    }

    // 1. Actualizar orden
    const { data: updatedOrder, error: uErr } = await supabase!
      .from('orders')
      .update({ estado: 'reembolsado' })
      .eq('id', id)
      .select()
      .single();
    if (uErr) throw uErr;

    const eventId = order.eventId;
    const fecha = order.funcionFecha;

    // 2. Cancelar tickets
    const { error: tErr } = await supabase!
      .from('tickets')
      .update({ estado: 'cancelado' })
      .eq('orderId', id);
    if (tErr) throw tErr;

    // 3. Liberar capacidad
    if (order.zonaLibre) {
      const zoneName = order.zonaLibre.nombre;
      const qty = order.zonaLibre.cantidad;

      const { data: zones } = await supabase!
        .from('event_zones')
        .select('*')
        .eq('eventId', eventId)
        .eq('nombre', zoneName);
      
      if (zones && zones.length > 0) {
        const zone = zones[0];
        await supabase!
          .from('event_zones')
          .update({ capacidadRestante: zone.capacidadRestante + qty })
          .eq('id', zone.id);
      }
    } else if (order.seats) {
      for (const s of order.seats) {
        await supabase!
          .from('seats')
          .update({ estado: 'libre' })
          .eq('eventId', eventId)
          .eq('funcionFecha', fecha)
          .eq('fila', s.fila)
          .eq('número', s.número);
      }
    }

    return updatedOrder as Order;
  }

  // Tickets
  async createTicket(ticket: Omit<Ticket, 'id' | 'estado'>): Promise<Ticket> {
    const newTicket: Ticket = {
      ...ticket,
      id: `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      estado: 'activo'
    };
    const { error } = await supabase!.from('tickets').insert(newTicket);
    if (error) throw error;
    return newTicket;
  }

  async getTicketsByOrderId(orderId: string): Promise<Ticket[]> {
    const { data, error } = await supabase!.from('tickets').select('*').eq('orderId', orderId);
    if (error) throw error;
    return (data || []) as Ticket[];
  }

  async getTicketByQR(qrCode: string): Promise<Ticket | null> {
    const { data, error } = await supabase!.from('tickets').select('*').eq('qrCode', qrCode).maybeSingle();
    if (error) throw error;
    return data as Ticket | null;
  }

  async validateTicket(qrCode: string, porteroName: string): Promise<{ success: boolean; error?: string; ticket?: Ticket }> {
    const ticket = await this.getTicketByQR(qrCode);
    if (!ticket) {
      return { success: false, error: 'Código QR no reconocido. Entrada inválida.' };
    }

    if (ticket.estado === 'usado') {
      return {
        success: false,
        error: `Esta entrada ya fue validada el ${new Date(ticket.validadoEn || '').toLocaleString('es-AR')}`,
        ticket
      };
    }

    if (ticket.estado === 'cancelado') {
      return { success: false, error: 'Esta entrada ha sido cancelada por administración.', ticket };
    }

    const { data: updated, error } = await supabase!
      .from('tickets')
      .update({ estado: 'usado', validadoEn: new Date().toISOString() })
      .eq('id', ticket.id)
      .select()
      .single();
    if (error) throw error;

    return { success: true, ticket: updated as Ticket };
  }

  async getTicketsByEventId(eventId: string): Promise<Ticket[]> {
    const { data, error } = await supabase!.from('tickets').select('*').eq('eventId', eventId);
    if (error) throw error;
    return (data || []) as Ticket[];
  }

  // Users
  async getUserById(id: string): Promise<User | null> {
    const { data, error } = await supabase!.from('users').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as User | null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase!.from('users').select('*').ilike('email', email).maybeSingle();
    if (error) throw error;
    return data as User | null;
  }

  async createUser(user: User): Promise<User> {
    const { error } = await supabase!.from('users').insert(user);
    if (error) throw error;
    return user;
  }

  async updateUserRole(id: string, rol: User['rol'], venueIds?: string[], eventIds?: string[]): Promise<User> {
    const updates: any = { rol };
    if (venueIds !== undefined) updates.venueIds = venueIds;
    if (eventIds !== undefined) updates.eventIds = eventIds;

    const { data, error } = await supabase!.from('users').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data as User;
  }

  async updateUserRoleAssignments(id: string, assignments: UserRoleAssignment[]): Promise<User> {
    const { data, error } = await supabase!
      .from('users')
      .update({ roleAssignments: assignments })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as User;
  }

  async getUsers(): Promise<User[]> {
    const { data, error } = await supabase!.from('users').select('*');
    if (error) throw error;
    return (data || []) as User[];
  }

  async seedDb(): Promise<void> {
    // El sembrado se realiza de manera idéntica que LocalDbService si las tablas estuvieran vacías
    const venues = await this.getVenues();
    if (venues.length > 0) return;

    // Teatro Colón
    const venueColon = await this.createVenue({
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
    });

    // Teatro Gran Rex
    const venueRex = await this.createVenue({
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
    });

    const date1 = new Date();
    date1.setDate(date1.getDate() + 5);
    const date2 = new Date();
    date2.setDate(date2.getDate() + 12);
    const date3 = new Date();
    date3.setDate(date3.getDate() + 20);

    const eventCisnes = await this.createEvent({
      venueId: venueColon.id,
      título: 'El Lago de los Cisnes',
      descripción: 'El prestigioso Ballet Estable del Teatro Colón presenta la obra cumbre del ballet clásico.',
      fechas: [date1.toISOString(), date2.toISOString()],
      imágenes: ['https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&q=80&w=1000'],
      categoría: 'danza',
      estado: 'publicado',
      modo: 'numerado',
      cargoServicio: 10,
      tipoCargo: 'porcentaje'
    });

    const eventSoda = await this.createEvent({
      venueId: venueRex.id,
      título: 'Soda Stereo: Tributo Sinfónico',
      descripción: 'Un recorrido emocionante por las canciones más icónicas de la banda más grande de Latinoamérica.',
      fechas: [date3.toISOString()],
      imágenes: ['https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=1000'],
      categoría: 'concierto',
      estado: 'publicado',
      modo: 'libre',
      cargoServicio: 1500,
      tipoCargo: 'fijo'
    });

    // Generar butacas numeradas
    const filas = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const nums = [1, 2, 3, 4, 5, 6, 7, 8];

    for (const fecha of eventCisnes.fechas) {
      for (const fila of filas) {
        for (const num of nums) {
          const esPremium = ['A', 'B', 'C', 'D'].includes(fila);
          const zonaName = esPremium ? 'Platea Premium' : 'Platea Alta';
          const precio = esPremium ? 15000 : 9500;
          const tipo = esPremium ? 'VIP' : 'General';

          await supabase!.from('seats').insert({
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
        }
      }
    }

    // Super Admin
    await this.createUser({
      id: 'user_admin',
      email: 'admin@ticketflow.com',
      nombre: 'Administrador Principal',
      rol: 'Super Admin',
      createdAt: new Date().toISOString()
    });

    // Controlador de Acceso
    await this.createUser({
      id: 'user_portero',
      email: 'portero@ticketflow.com',
      nombre: 'Controlador Acceso Rex',
      rol: 'Controlador de Acceso',
      venueIds: [venueRex.id],
      createdAt: new Date().toISOString()
    });
  }
}
