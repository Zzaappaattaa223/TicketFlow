export type UserRole = 'Super Admin' | 'Admin de Sala' | 'Productor' | 'Boletería' | 'Controlador de Acceso' | 'Comprador';

export interface UserRoleAssignment {
  id: string;
  rol: UserRole;
  venueId?: string; // ID de la sala
  eventId?: string; // ID del espectáculo/evento
  fecha?: string;   // Función/Fecha específica
}

export interface User {
  id: string;
  email: string;
  nombre: string;
  rol: UserRole;
  venueIds?: string[]; // Para administradores o personal acotado a ciertos venues
  eventIds?: string[]; // Para porteros u operadores asociados a shows específicos
  roleAssignments?: UserRoleAssignment[]; // Asignaciones de roles granulares
  createdAt: string;
}

export interface Zone {
  id: string;
  nombre: string;
  capacidad: number;
  capacidadRestante: number;
  precio: number;
  tipo: 'General' | 'VIP' | 'Descuento' | 'Cortesía';
}

export interface Venue {
  id: string;
  nombre: string;
  slug: string;
  ciudad: string;
  capacidad: number;
  imagen?: string;
  planoSVG?: string;
  zonas: Omit<Zone, 'capacidadRestante'>[]; // Zonas predeterminadas del venue sin estado de función
}

export type EventCategory = 'teatro' | 'danza' | 'concierto' | 'stand-up' | 'cine' | 'conferencia' | 'taller';
export type EventStatus = 'borrador' | 'publicado' | 'pausado' | 'agotado' | 'cancelado';
export type EventMode = 'numerado' | 'libre';

export interface Event {
  id: string;
  venueId: string;
  título: string;
  descripción: string;
  fechas: string[]; // ISO strings de las funciones
  imágenes: string[];
  categoría: EventCategory;
  estado: EventStatus;
  modo: EventMode;
  cargoServicio: number; // Porcentaje (ej. 10 para 10%) o monto fijo
  tipoCargo: 'porcentaje' | 'fijo';
  createdAt: string;
}

export type SeatStatus = 'libre' | 'bloqueado' | 'reservado' | 'vendido';

export interface Seat {
  id: string;
  eventId: string;
  funcionFecha: string; // La fecha de la función específica
  fila: string;
  número: number;
  zona: string;
  estado: SeatStatus;
  precio: number;
  tipo: 'General' | 'VIP' | 'Descuento' | 'Cortesía';
}

export type OrderStatus = 'pendiente' | 'pagado' | 'fallido' | 'reembolsado';

export interface Order {
  id: string;
  userId?: string; // Si está registrado
  compradorEmail: string; // Para guest y registros
  compradorNombre: string;
  compradorTeléfono?: string;
  eventId: string;
  funcionFecha: string;
  seats?: { fila: string; número: number; zona: string; precio: number }[]; // Para numerado
  zonaLibre?: { nombre: string; cantidad: number; precioUnitario: number }; // Para libre
  subtotal: number;
  cargoServicio: number;
  total: number;
  estado: OrderStatus;
  stripePaymentId?: string;
  createdAt: string;
}

export type TicketStatus = 'activo' | 'usado' | 'cancelado';

export interface Ticket {
  id: string;
  orderId: string;
  eventId: string;
  funcionFecha: string;
  seatId?: string; // Si es numerado
  zona?: string; // Si es libre
  fila?: string; // Si es numerado
  número?: number; // Si es numerado
  qrCode: string; // Hash único de verificación
  estado: TicketStatus;
  holderNombre: string;
  holderEmail: string;
  validadoEn?: string; // ISO string de cuándo se escaneó
}

export interface SeatLock {
  id: string; // seatId o eventId_zone (para libre)
  eventId: string;
  funcionFecha: string;
  userIdOrSessionId: string;
  cantidad?: number; // Para reservas de zonas libres
  lockedAt: string;
  expiresAt: string;
}
