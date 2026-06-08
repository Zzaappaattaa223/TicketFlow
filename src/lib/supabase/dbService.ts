import { Venue, Event, Zone, Seat, Order, Ticket, User, SeatLock, OrderStatus, TicketStatus, UserRoleAssignment } from '@/types';

export interface IDbService {
  // Venues
  getVenues(): Promise<Venue[]>;
  getVenueById(id: string): Promise<Venue | null>;
  createVenue(venue: Omit<Venue, 'id'>): Promise<Venue>;
  updateVenue(id: string, venue: Partial<Venue>): Promise<Venue>;
  deleteVenue(id: string): Promise<boolean>;

  // Events
  getEvents(): Promise<Event[]>;
  getEventById(id: string): Promise<Event | null>;
  createEvent(event: Omit<Event, 'id' | 'createdAt'>): Promise<Event>;
  updateEvent(id: string, event: Partial<Event>): Promise<Event>;
  deleteEvent(id: string): Promise<boolean>;

  // Zones (para eventos sin numeración)
  getZonesForEvent(eventId: string): Promise<Zone[]>;
  createZone(eventId: string, zone: Omit<Zone, 'id'>): Promise<Zone>;
  updateZone(eventId: string, zoneId: string, zone: Partial<Zone>): Promise<Zone>;

  // Seats (para eventos numerados - Fase 2)
  getSeatsForEvent(eventId: string, fecha: string): Promise<Seat[]>;
  lockSeats(eventId: string, fecha: string, seatIds: string[], userIdOrSessionId: string): Promise<boolean>;
  unlockSeats(eventId: string, fecha: string, seatIds: string[], userIdOrSessionId: string): Promise<boolean>;

  // Locks para Zonas Libres (Fase 1)
  lockZoneCapacity(eventId: string, fecha: string, zoneId: string, cantidad: number, userIdOrSessionId: string): Promise<boolean>;
  unlockZoneCapacity(eventId: string, fecha: string, zoneId: string, userIdOrSessionId: string): Promise<boolean>;
  getActiveLocks(userIdOrSessionId: string): Promise<SeatLock[]>;

  // Orders
  createOrder(order: Omit<Order, 'id' | 'createdAt' | 'estado'>): Promise<Order>;
  getOrderById(id: string): Promise<Order | null>;
  getOrders(): Promise<Order[]>;
  getOrdersByUserId(userId: string): Promise<Order[]>;
  updateOrderStatus(id: string, estado: OrderStatus, stripePaymentId?: string): Promise<Order>;
  refundOrder(id: string): Promise<Order>;

  // Tickets
  createTicket(ticket: Omit<Ticket, 'id' | 'estado'>): Promise<Ticket>;
  getTicketsByOrderId(orderId: string): Promise<Ticket[]>;
  getTicketByQR(qrCode: string): Promise<Ticket | null>;
  validateTicket(qrCode: string, porteroName: string): Promise<{ success: boolean; error?: string; ticket?: Ticket }>;
  getTicketsByEventId(eventId: string): Promise<Ticket[]>;

  // Users
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(user: User): Promise<User>;
  updateUserRole(id: string, rol: User['rol'], venueIds?: string[], eventIds?: string[]): Promise<User>;
  updateUserRoleAssignments(id: string, assignments: UserRoleAssignment[]): Promise<User>;
  getUsers(): Promise<User[]>;

  // Helpers para simulación / reinicio
  seedDb(): Promise<void>;
}
