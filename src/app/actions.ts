'use server';

import { dbService } from '@db/index';
import { authService } from '@/lib/auth';
import { User, Event, Venue, Zone, Seat, Order, Ticket, OrderStatus, UserRole, UserRoleAssignment } from '@/types';
import { generateImageFromPrompt } from '@/lib/ai/imageGenerator';
import { mercadoPagoService } from '@/lib/payments';
import { notificationService } from '@/lib/notifications';
import { getTicketEmailTemplate } from '@/lib/notifications/emailTemplates';
import { z } from 'zod';
import { cookies, headers } from 'next/headers';

const imageSchema = z.string().refine((val) => {
  return val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:image/');
}, {
  message: 'La imagen debe ser una URL válida o formato Base64 (data:image/)'
});

const venueSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  slug: z.string().min(1, 'El slug es requerido'),
  ciudad: z.string().min(1, 'La ciudad es requerida'),
  capacidad: z.number().int().positive('La capacidad debe ser un número positivo'),
  imagen: imageSchema.optional(),
  planoSVG: z.string().optional(),
  zonas: z.array(z.object({
    id: z.string(),
    nombre: z.string(),
    capacidad: z.number(),
    precio: z.number(),
    tipo: z.enum(['General', 'VIP', 'Descuento', 'Cortesía'])
  })).min(1, 'Debe configurar al menos una zona')
});

const eventSchema = z.object({
  venueId: z.string().min(1, 'La sala es requerida'),
  título: z.string().min(1, 'El título es requerido'),
  descripción: z.string().min(1, 'La descripción es requerida'),
  fechas: z.array(z.string()).min(1, 'Debe configurar al menos una fecha'),
  imágenes: z.array(imageSchema).min(1, 'Debe incluir al menos una imagen'),
  categoría: z.enum(['teatro', 'danza', 'concierto', 'stand-up', 'cine', 'conferencia', 'taller']),
  estado: z.enum(['borrador', 'publicado', 'pausado', 'agotado', 'cancelado']),
  modo: z.enum(['numerado', 'libre']),
  cargoServicio: z.number().nonnegative('El cargo de servicio no puede ser negativo'),
  tipoCargo: z.enum(['porcentaje', 'fijo'])
});

// --- ACCIONES DE AUTENTICACIÓN ---

export async function loginAction(email: string): Promise<{ success: boolean; user?: User | null; error?: string }> {
  try {
    const user = await authService.login(email);
    if (!user) {
      return { success: false, error: 'Usuario no registrado' };
    }
    return { success: true, user };
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al iniciar sesión' };
  }
}

export async function loginWithGoogleAction(email: string, nombre: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const user = await authService.loginWithGoogle(email, nombre);
    return { success: true, user };
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al iniciar sesión con Google' };
  }
}

export async function logoutAction(): Promise<{ success: boolean }> {
  try {
    await authService.logout();
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function getCurrentUserAction(): Promise<User | null> {
  try {
    return await authService.getCurrentUser();
  } catch (error) {
    return null;
  }
}

export async function registerAction(nombre: string, email: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const user = await authService.register(nombre, email, 'Comprador');
    return { success: true, user };
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al registrarse' };
  }
}

// --- ACCIONES DE BASE DE DATOS Y EVENTOS ---

export async function getEventsAction(): Promise<Event[]> {
  const events = await dbService.getEvents();
  const permissions = await getActiveRoleAndPermissions();
  if (permissions.isRestricted) {
    return events.filter(e => {
      const matchesVenue = permissions.venueIds.length === 0 || permissions.venueIds.includes(e.venueId);
      const matchesEvent = permissions.eventIds.length === 0 || permissions.eventIds.includes(e.id);
      return matchesVenue && matchesEvent;
    });
  }
  return events;
}

export async function getEventByIdAction(id: string): Promise<Event | null> {
  const event = await dbService.getEventById(id);
  if (!event) return null;
  const permissions = await getActiveRoleAndPermissions();
  if (permissions.isRestricted) {
    const matchesVenue = permissions.venueIds.length === 0 || permissions.venueIds.includes(event.venueId);
    const matchesEvent = permissions.eventIds.length === 0 || permissions.eventIds.includes(event.id);
    if (!matchesVenue || !matchesEvent) return null;
  }
  return event;
}

export async function getVenueByIdAction(id: string): Promise<Venue | null> {
  const venue = await dbService.getVenueById(id);
  if (!venue) return null;
  const permissions = await getActiveRoleAndPermissions();
  if (permissions.isRestricted && permissions.venueIds.length > 0 && !permissions.venueIds.includes(id)) {
    return null;
  }
  return venue;
}

export async function getZonesForEventAction(eventId: string): Promise<Zone[]> {
  return await dbService.getZonesForEvent(eventId);
}

export async function getVenuesAction(): Promise<Venue[]> {
  const venues = await dbService.getVenues();
  const permissions = await getActiveRoleAndPermissions();
  if (permissions.isRestricted) {
    return venues.filter(v => permissions.venueIds.length === 0 || permissions.venueIds.includes(v.id));
  }
  return venues;
}

// --- ACCIONES DE BLOQUEO Y COMPRA ---

export async function lockZoneCapacityAction(
  eventId: string,
  fecha: string,
  zoneId: string,
  cantidad: number,
  sessionId: string
): Promise<boolean> {
  return await dbService.lockZoneCapacity(eventId, fecha, zoneId, cantidad, sessionId);
}

export async function unlockZoneCapacityAction(
  eventId: string,
  fecha: string,
  zoneId: string,
  sessionId: string
): Promise<boolean> {
  return await dbService.unlockZoneCapacity(eventId, fecha, zoneId, sessionId);
}

export async function getActiveLocksAction(sessionId: string) {
  return await dbService.getActiveLocks(sessionId);
}

export async function lockSeatsAction(
  eventId: string,
  fecha: string,
  seatIds: string[],
  userIdOrSessionId: string
): Promise<boolean> {
  return await dbService.lockSeats(eventId, fecha, seatIds, userIdOrSessionId);
}

export async function getSeatsForEventAction(eventId: string, fecha: string): Promise<Seat[]> {
  return await dbService.getSeatsForEvent(eventId, fecha);
}

export async function unlockSeatsAction(
  eventId: string,
  fecha: string,
  seatIds: string[],
  userIdOrSessionId: string
): Promise<boolean> {
  return await dbService.unlockSeats(eventId, fecha, seatIds, userIdOrSessionId);
}

export async function createOrderAction(orderData: Omit<Order, 'id' | 'createdAt' | 'estado'>): Promise<{ success: boolean; order?: Order; error?: string }> {
  try {
    // Validaciones extra de capacidad final en servidor
    const zones = await dbService.getZonesForEvent(orderData.eventId);
    if (orderData.zonaLibre) {
      const zone = zones.find(z => z.nombre === orderData.zonaLibre?.nombre);
      if (!zone) return { success: false, error: 'Zona no válida' };
      
      // Calcular capacidad vendida
      const tickets = await dbService.getTicketsByEventId(orderData.eventId);
      const soldCount = tickets.filter(t => t.funcionFecha === orderData.funcionFecha && t.zona === zone.nombre && t.estado !== 'cancelado').length;
      
      if (orderData.zonaLibre.cantidad > (zone.capacidad - soldCount)) {
        return { success: false, error: 'Lo sentimos, ya no hay suficientes entradas disponibles en esta zona' };
      }
    }

    const order = await dbService.createOrder(orderData);
    return { success: true, order };
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al procesar la reserva' };
  }
}

export async function sendOrderTicketsNotifications(orderId: string) {
  try {
    const order = await dbService.getOrderById(orderId);
    if (!order || order.estado !== 'pagado') return;

    const event = await dbService.getEventById(order.eventId);
    if (!event) return;

    const venue = await dbService.getVenueById(event.venueId);
    const tickets = await dbService.getTicketsByOrderId(orderId);

    for (const ticket of tickets) {
      // 1. Email (Resend)
      const emailHtml = getTicketEmailTemplate(ticket, event, venue, order.compradorNombre);
      const emailSubject = `Tus entradas para: ${event.título} 🎟️`;
      await notificationService.sendEmail(order.compradorEmail, emailSubject, emailHtml);

      // 2. WhatsApp (Twilio)
      const seatInfo = ticket.zona || `Fila ${ticket.fila}, Asiento ${ticket.número}`;
      const d = new Date(ticket.funcionFecha);
      const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const formattedFecha = `${d.getDate()} de ${meses[d.getMonth()]} a las ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const wsBody = `¡Hola ${order.compradorNombre}! Tu entrada para "${event.título}" el ${formattedFecha} HS en ${venue?.nombre} (${seatInfo}) ha sido confirmada.\n\nUsa este enlace para ver tu código QR de acceso:\nhttps://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticket.qrCode)}\n\n¡Que disfrutes del show! 🎟️`;
      
      if (order.compradorTeléfono) {
        await notificationService.sendWhatsApp(order.compradorTeléfono, wsBody);
      }
    }
  } catch (error) {
    console.error('Error al enviar notificaciones de tickets:', error);
  }
}

export async function updateOrderStatusAction(
  orderId: string,
  estado: OrderStatus,
  stripePaymentId?: string
): Promise<{ success: boolean; order?: Order; error?: string }> {
  try {
    const order = await dbService.updateOrderStatus(orderId, estado, stripePaymentId);
    
    if (estado === 'pagado') {
      sendOrderTicketsNotifications(orderId).catch(err => 
        console.error('Error enviando notificaciones asíncronas:', err)
      );
    }
    
    return { success: true, order };
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al actualizar el pago' };
  }
}

export async function getOrderByIdAction(id: string): Promise<Order | null> {
  return await dbService.getOrderById(id);
}

// --- ACCIONES DE SCANNER Y TICKETS ---

export async function validateTicketAction(
  qrCode: string,
  porteroName: string
): Promise<{ success: boolean; error?: string; ticket?: Ticket }> {
  return await dbService.validateTicket(qrCode, porteroName);
}

export async function getTicketsByOrderIdAction(orderId: string): Promise<Ticket[]> {
  return await dbService.getTicketsByOrderId(orderId);
}

export async function getTicketsByEventIdAction(eventId: string): Promise<Ticket[]> {
  const permissions = await getActiveRoleAndPermissions();
  if (permissions.isRestricted) {
    const event = await dbService.getEventById(eventId);
    if (!event) return [];
    const matchesVenue = permissions.venueIds.length === 0 || permissions.venueIds.includes(event.venueId);
    const matchesEvent = permissions.eventIds.length === 0 || permissions.eventIds.includes(event.id);
    if (!matchesVenue || !matchesEvent) return [];
  }
  return await dbService.getTicketsByEventId(eventId);
}

// --- ACCIONES ADMINISTRATIVAS ---

export async function getOrdersAction(): Promise<Order[]> {
  const rawOrders = await dbService.getOrders();
  const permissions = await getActiveRoleAndPermissions();
  if (permissions.isRestricted) {
    const allowedEvents = await getEventsAction();
    const allowedEventIds = new Set(allowedEvents.map(e => e.id));
    return rawOrders.filter(o => allowedEventIds.has(o.eventId));
  }
  return rawOrders;
}

export async function getUsersAction(): Promise<User[]> {
  return await dbService.getUsers();
}

export async function updateUserRoleAction(
  userId: string,
  rol: UserRole,
  venueIds?: string[],
  eventIds?: string[]
): Promise<User> {
  const currentUser = await authService.getCurrentUser();
  if (!currentUser || currentUser.rol !== 'Super Admin') {
    throw new Error('No autorizado. Solo Super Admin puede gestionar roles y permisos.');
  }
  return await dbService.updateUserRole(userId, rol, venueIds, eventIds);
}

export async function updateUserRoleAssignmentsAction(
  userId: string,
  assignments: UserRoleAssignment[]
): Promise<User> {
  const currentUser = await authService.getCurrentUser();
  if (!currentUser || currentUser.rol !== 'Super Admin') {
    throw new Error('No autorizado. Solo Super Admin puede gestionar asignaciones granulares de roles.');
  }
  return await dbService.updateUserRoleAssignments(userId, assignments);
}

export async function getActiveRoleAndPermissions(): Promise<{
  rol: UserRole;
  venueIds: string[];
  eventIds: string[];
  fecha?: string;
  isRestricted: boolean;
  user: User | null;
}> {
  const user = await authService.getCurrentUser();
  if (!user) {
    return { rol: 'Comprador', venueIds: [], eventIds: [], isRestricted: true, user: null };
  }

  if (user.rol === 'Super Admin') {
    return {
      rol: 'Super Admin',
      venueIds: [],
      eventIds: [],
      isRestricted: false,
      user
    };
  }

  // Leer la asignación activa desde la cookie
  const cookieStore = await cookies();
  const activeAssignmentId = cookieStore.get('ticketflow_active_assignment')?.value;

  if (activeAssignmentId && user.roleAssignments) {
    const assignment = user.roleAssignments.find(a => a.id === activeAssignmentId);
    if (assignment) {
      // Si el rol está acotado a un evento, podemos deducir la sala
      let eventVenueIds: string[] = [];
      if (assignment.eventId) {
        const event = await dbService.getEventById(assignment.eventId);
        if (event) {
          eventVenueIds = [event.venueId];
        }
      }

      return {
        rol: assignment.rol,
        venueIds: assignment.venueId ? [assignment.venueId] : eventVenueIds,
        eventIds: assignment.eventId ? [assignment.eventId] : [],
        fecha: assignment.fecha,
        isRestricted: true,
        user
      };
    }
  }

  // Fallback a los datos base del usuario
  return {
    rol: user.rol,
    venueIds: user.venueIds || [],
    eventIds: user.eventIds || [],
    isRestricted: true,
    user
  };
}

export async function setActiveRoleAssignmentAction(assignmentId: string): Promise<{ success: boolean }> {
  const cookieStore = await cookies();
  if (!assignmentId) {
    cookieStore.delete('ticketflow_active_assignment');
  } else {
    cookieStore.set('ticketflow_active_assignment', assignmentId, {
      httpOnly: false, // Permitir que sea accesible en el cliente
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 semana
      path: '/'
    });
  }
  return { success: true };
}

export async function createVenueAction(venue: Omit<Venue, 'id'>): Promise<Venue> {
  const currentUser = await authService.getCurrentUser();
  if (!currentUser || currentUser.rol !== 'Super Admin') {
    throw new Error('No autorizado. Solo Super Admin puede crear salas.');
  }

  const result = venueSchema.safeParse(venue);
  if (!result.success) {
    throw new Error(`Validación fallida: ${result.error.issues.map(e => e.message).join(', ')}`);
  }
  return await dbService.createVenue(result.data);
}

export async function updateVenueAction(id: string, venue: Partial<Venue>): Promise<Venue> {
  const currentUser = await authService.getCurrentUser();
  const hasVenueAccess = currentUser?.venueIds?.includes(id);
  if (!currentUser || (currentUser.rol !== 'Super Admin' && !(currentUser.rol === 'Admin de Sala' && hasVenueAccess))) {
    throw new Error('No autorizado para modificar esta sala.');
  }

  const result = venueSchema.partial().safeParse(venue);
  if (!result.success) {
    throw new Error(`Validación fallida: ${result.error.issues.map(e => e.message).join(', ')}`);
  }
  return await dbService.updateVenue(id, result.data);
}

export async function deleteVenueAction(id: string): Promise<boolean> {
  const currentUser = await authService.getCurrentUser();
  if (!currentUser || currentUser.rol !== 'Super Admin') {
    throw new Error('No autorizado. Solo Super Admin puede eliminar salas.');
  }
  return await dbService.deleteVenue(id);
}

export async function createEventAction(event: Omit<Event, 'id' | 'createdAt'>): Promise<Event> {
  const permissions = await getActiveRoleAndPermissions();
  const hasVenueAccess = permissions.venueIds.length === 0 || permissions.venueIds.includes(event.venueId);
  if (!permissions.user || (!['Super Admin', 'Admin de Sala', 'Productor'].includes(permissions.rol) || !hasVenueAccess)) {
    throw new Error('No autorizado para crear espectáculos en esta sala.');
  }

  const result = eventSchema.safeParse(event);
  if (!result.success) {
    throw new Error(`Validación fallida: ${result.error.issues.map(e => e.message).join(', ')}`);
  }
  return await dbService.createEvent(result.data);
}

export async function updateEventAction(id: string, event: Partial<Event>): Promise<Event> {
  const permissions = await getActiveRoleAndPermissions();
  const dbEvent = await dbService.getEventById(id);
  if (!dbEvent) throw new Error('Espectáculo no encontrado');

  const hasVenueAccess = permissions.venueIds.length === 0 || permissions.venueIds.includes(dbEvent.venueId);
  const hasEventAccess = permissions.eventIds.length === 0 || permissions.eventIds.includes(id);

  if (!permissions.user || (!['Super Admin', 'Admin de Sala', 'Productor'].includes(permissions.rol) || (!hasVenueAccess && !hasEventAccess))) {
    throw new Error('No autorizado para modificar este espectáculo.');
  }

  // Si no es Super Admin, bloquear cambios en cargos
  if (permissions.rol !== 'Super Admin' && (event.cargoServicio !== undefined || event.tipoCargo !== undefined)) {
    if (event.cargoServicio !== dbEvent.cargoServicio || event.tipoCargo !== dbEvent.tipoCargo) {
      throw new Error('No autorizado. El cargo de servicio solo puede ser modificado por el Super Admin.');
    }
  }

  const result = eventSchema.partial().safeParse(event);
  if (!result.success) {
    throw new Error(`Validación fallida: ${result.error.issues.map(e => e.message).join(', ')}`);
  }
  return await dbService.updateEvent(id, result.data);
}

export async function deleteEventAction(id: string): Promise<boolean> {
  const permissions = await getActiveRoleAndPermissions();
  const dbEvent = await dbService.getEventById(id);
  if (!dbEvent) throw new Error('Espectáculo no encontrado');

  const hasVenueAccess = permissions.venueIds.length === 0 || permissions.venueIds.includes(dbEvent.venueId);
  const hasEventAccess = permissions.eventIds.length === 0 || permissions.eventIds.includes(id);

  if (!permissions.user || (!['Super Admin', 'Admin de Sala', 'Productor'].includes(permissions.rol) || (!hasVenueAccess && !hasEventAccess))) {
    throw new Error('No autorizado para eliminar este espectáculo.');
  }
  return await dbService.deleteEvent(id);
}

export async function generateImageAction(
  prompt: string,
  type: 'venue' | 'event'
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const url = await generateImageFromPrompt(prompt, type);
    return { success: true, url };
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al generar la imagen' };
  }
}

export async function createMercadoPagoPreferenceAction(
  orderId: string
): Promise<{ success: boolean; initPoint?: string; error?: string }> {
  try {
    const order = await dbService.getOrderById(orderId);
    if (!order) return { success: false, error: 'Orden no encontrada' };

    const event = await dbService.getEventById(order.eventId);
    if (!event) return { success: false, error: 'Espectáculo no encontrado' };

    const quantity = order.zonaLibre ? order.zonaLibre.cantidad : (order.seats?.length || 0);
    const title = `Entradas: ${event.título}`;
    const unitPrice = Math.round(order.total / quantity);

    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
    const dynamicBaseUrl = `${protocol}://${host}`;

    const { initPoint } = await mercadoPagoService.createPreference(
      title,
      unitPrice,
      quantity,
      orderId,
      dynamicBaseUrl
    );

    return { success: true, initPoint };
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al generar preferencia de Mercado Pago' };
  }
}

export async function createPresentialOrderAction(
  orderData: Omit<Order, 'id' | 'createdAt' | 'estado'>,
  metodoPago: 'efectivo' | 'tarjeta_presencial' | 'transferencia' | 'cortesia'
): Promise<{ success: boolean; order?: Order; error?: string }> {
  try {
    // 1. Validar autenticación
    const currentUser = await authService.getCurrentUser();
    if (!currentUser || !['Super Admin', 'Admin de Sala', 'Productor', 'Boletería'].includes(currentUser.rol)) {
      return { success: false, error: 'No autorizado. Se requieren permisos de gestión.' };
    }

    // 2. Si es productor o admin de sala, verificar si tiene acceso al venue del evento
    const event = await dbService.getEventById(orderData.eventId);
    if (!event) return { success: false, error: 'Espectáculo no encontrado' };
    
    if (currentUser.rol === 'Admin de Sala' && !currentUser.venueIds?.includes(event.venueId)) {
      return { success: false, error: 'No autorizado para esta sala.' };
    }
    if (currentUser.rol === 'Productor' && !currentUser.venueIds?.includes(event.venueId) && !currentUser.eventIds?.includes(event.id)) {
      return { success: false, error: 'No autorizado para este espectáculo.' };
    }

    // 3. Modificaciones si es cortesía (costo $0)
    const finalOrderData = { ...orderData };
    if (metodoPago === 'cortesia') {
      finalOrderData.subtotal = 0;
      finalOrderData.cargoServicio = 0;
      finalOrderData.total = 0;
      if (finalOrderData.zonaLibre) {
        finalOrderData.zonaLibre = {
          ...finalOrderData.zonaLibre,
          precioUnitario: 0
        };
      }
      if (finalOrderData.seats) {
        finalOrderData.seats = finalOrderData.seats.map(s => ({ ...s, precio: 0 }));
      }
    }

    // 4. Validaciones extra de capacidad
    const zones = await dbService.getZonesForEvent(finalOrderData.eventId);
    if (finalOrderData.zonaLibre) {
      const zone = zones.find(z => z.nombre === finalOrderData.zonaLibre?.nombre);
      if (!zone) return { success: false, error: 'Zona no válida' };
      
      const tickets = await dbService.getTicketsByEventId(finalOrderData.eventId);
      const soldCount = tickets.filter(t => t.funcionFecha === finalOrderData.funcionFecha && t.zona === zone.nombre && t.estado !== 'cancelado').length;
      
      if (finalOrderData.zonaLibre.cantidad > (zone.capacidad - soldCount)) {
        return { success: false, error: 'Lo sentimos, ya no hay suficientes entradas disponibles en esta zona' };
      }
    } else if (finalOrderData.seats) {
      const seats = await dbService.getSeatsForEvent(finalOrderData.eventId, finalOrderData.funcionFecha);
      const invalidSeats = finalOrderData.seats.filter(s => {
        const dbSeat = seats.find(st => st.fila === s.fila && st.número === s.número);
        return !dbSeat || dbSeat.estado === 'vendido';
      });
      if (invalidSeats.length > 0) {
        return { success: false, error: 'Algunas de las butacas seleccionadas ya han sido vendidas.' };
      }
    }

    // 5. Crear la orden y pasarla a 'pagado'
    const order = await dbService.createOrder(finalOrderData);
    const updatedOrder = await dbService.updateOrderStatus(order.id, 'pagado', `presencial_${metodoPago}`);

    // Enviar notificaciones asíncronamente
    sendOrderTicketsNotifications(order.id).catch(err => 
      console.error('Error enviando notificaciones boletería:', err)
    );

    return { success: true, order: updatedOrder };
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al procesar la venta presencial.' };
  }
}

export async function refundOrderAction(orderId: string): Promise<{ success: boolean; order?: Order; error?: string }> {
  try {
    // 1. Validar autenticación
    const currentUser = await authService.getCurrentUser();
    if (!currentUser || !['Super Admin', 'Admin de Sala', 'Productor'].includes(currentUser.rol)) {
      return { success: false, error: 'No autorizado. Se requieren permisos administrativos para reembolsar.' };
    }

    // 2. Si es productor o admin de sala, verificar si tiene acceso al venue del evento
    const order = await dbService.getOrderById(orderId);
    if (!order) return { success: false, error: 'Orden no encontrada' };

    const event = await dbService.getEventById(order.eventId);
    if (!event) return { success: false, error: 'Espectáculo no encontrado' };

    if (currentUser.rol === 'Admin de Sala' && !currentUser.venueIds?.includes(event.venueId)) {
      return { success: false, error: 'No autorizado para esta sala.' };
    }
    if (currentUser.rol === 'Productor' && !currentUser.venueIds?.includes(event.venueId) && !currentUser.eventIds?.includes(event.id)) {
      return { success: false, error: 'No autorizado para este espectáculo.' };
    }

    // 3. Procesar el reembolso
    const updatedOrder = await dbService.refundOrder(orderId);

    return { success: true, order: updatedOrder };
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al procesar el reembolso.' };
  }
}
