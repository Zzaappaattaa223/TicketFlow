// Desactivar la verificación de TLS
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.ikoqkklyznnciwgauyvr:Supabase223%23@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require';

// ----------------------------------------------------
// DATASET DEFINITION
// ----------------------------------------------------

const users = [
  { id: 'user_admin', email: 'admin@ticketflow.com', nombre: 'Administrador Principal', rol: 'Super Admin', venueIds: [], eventIds: [], createdAt: new Date().toISOString() },
  { id: 'user_admin_municipal', email: 'admin_municipal@ticketflow.com', nombre: 'Admin Teatro Municipal', rol: 'Admin de Sala', venueIds: ['venue_municipal_sf'], eventIds: [], createdAt: new Date().toISOString() },
  { id: 'user_portero_ccp', email: 'portero_ccp@ticketflow.com', nombre: 'Controlador Paco Urondo', rol: 'Controlador de Acceso', venueIds: ['venue_ccp_sf'], eventIds: [], createdAt: new Date().toISOString() },
  { id: 'user_comprador_1', email: 'juan.perez@example.com', nombre: 'Juan Pérez', rol: 'Comprador', venueIds: [], eventIds: [], createdAt: new Date().toISOString() },
  { id: 'user_comprador_2', email: 'maria.gomez@example.com', nombre: 'María Gómez', rol: 'Comprador', venueIds: [], eventIds: [], createdAt: new Date().toISOString() }
];

const venues = [
  {
    id: 'venue_colon',
    nombre: 'Teatro Colón',
    slug: 'teatro-colon',
    ciudad: 'Buenos Aires',
    capacidad: 2400,
    imagen: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&q=80&w=1000',
    planoSVG: null,
    zonas: [
      { id: 'venue_colon_platea_premium', nombre: 'Platea Premium', capacidad: 400, precio: 15000, tipo: 'VIP' },
      { id: 'venue_colon_platea_alta', nombre: 'Platea Alta', capacidad: 600, precio: 9500, tipo: 'General' },
      { id: 'venue_colon_palcos', nombre: 'Palcos', capacidad: 400, precio: 18000, tipo: 'VIP' },
      { id: 'venue_colon_tertulia', nombre: 'Tertulia', capacidad: 1000, precio: 4500, tipo: 'Descuento' }
    ]
  },
  {
    id: 'venue_rex',
    nombre: 'Teatro Gran Rex',
    slug: 'teatro-gran-rex',
    ciudad: 'Buenos Aires',
    capacidad: 3200,
    imagen: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=1000',
    planoSVG: null,
    zonas: [
      { id: 'venue_rex_vip_platinum', nombre: 'VIP Platinum', capacidad: 500, precio: 25000, tipo: 'VIP' },
      { id: 'venue_rex_platea_gold', nombre: 'Platea Gold', capacidad: 1000, precio: 18000, tipo: 'General' },
      { id: 'venue_rex_super_pullman', nombre: 'Super Pullman', capacidad: 700, precio: 12000, tipo: 'General' },
      { id: 'venue_rex_pullman', nombre: 'Pullman', capacidad: 1000, precio: 8000, tipo: 'Descuento' }
    ]
  },
  {
    id: 'venue_municipal_sf',
    nombre: 'Teatro Municipal 1° de Mayo',
    slug: 'teatro-municipal-1-de-mayo',
    ciudad: 'Santa Fe',
    capacidad: 800,
    imagen: 'https://images.unsplash.com/photo-1503095391755-14144af640f5?auto=format&fit=crop&q=80&w=1000',
    planoSVG: null,
    zonas: [
      { id: 'zone_mun_platea', nombre: 'Platea Baja', capacidad: 300, precio: 12000, tipo: 'VIP' },
      { id: 'zone_mun_pullman', nombre: 'Pullman', capacidad: 300, precio: 8000, tipo: 'General' },
      { id: 'zone_mun_palcos', nombre: 'Palcos', capacidad: 200, precio: 15000, tipo: 'VIP' }
    ]
  },
  {
    id: 'venue_ccp_sf',
    nombre: 'Centro Cultural Provincial Paco Urondo',
    slug: 'centro-cultural-provincial-paco-urondo',
    ciudad: 'Santa Fe',
    capacidad: 600,
    imagen: 'https://images.unsplash.com/photo-1513106580091-1d82408b8cd6?auto=format&fit=crop&q=80&w=1000',
    planoSVG: null,
    zonas: [
      { id: 'zone_ccp_mayor', nombre: 'Sala Mayor', capacidad: 400, precio: 7000, tipo: 'General' },
      { id: 'zone_ccp_foyer', nombre: 'Sala Foyer', capacidad: 200, precio: 5000, tipo: 'General' }
    ]
  }
];

// FECHAS
const now = new Date();
const datePastShow = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 dias atras
const dateFuture1 = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 dias adelante
const dateFuture2 = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 dias adelante
const dateFuture3 = new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000); // 25 dias adelante

const events = [
  {
    id: 'event_cisnes',
    venueId: 'venue_colon',
    título: 'El Lago de los Cisnes',
    descripción: 'El prestigioso Ballet Estable del Teatro Colón presenta la obra cumbre del ballet clásico.',
    fechas: [dateFuture1.toISOString(), dateFuture2.toISOString()],
    imágenes: ['https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&q=80&w=1000'],
    categoría: 'danza',
    estado: 'publicado',
    modo: 'numerado',
    cargoServicio: 10,
    tipoCargo: 'porcentaje',
    createdAt: new Date().toISOString()
  },
  {
    id: 'event_soda',
    venueId: 'venue_rex',
    título: 'Soda Stereo: Tributo Sinfónico',
    descripción: 'Un recorrido emocionante por las canciones más icónicas de la banda más grande de Latinoamérica.',
    fechas: [dateFuture3.toISOString()],
    imágenes: ['https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=1000'],
    categoría: 'concierto',
    estado: 'publicado',
    modo: 'libre',
    cargoServicio: 1500,
    tipoCargo: 'fijo',
    createdAt: new Date().toISOString()
  },
  {
    id: 'event_contorno_sf',
    venueId: 'venue_municipal_sf',
    título: 'El Contorno de lo Invisible',
    descripción: 'La aclamada obra experimental de la Comedia UNL en su temporada 2026. Una experiencia escénica única sobre lo imperceptible.',
    fechas: [datePastShow.toISOString(), dateFuture2.toISOString()],
    imágenes: ['https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&q=80&w=1000'],
    categoría: 'teatro',
    estado: 'publicado',
    modo: 'numerado',
    cargoServicio: 10,
    tipoCargo: 'porcentaje',
    createdAt: new Date().toISOString()
  },
  {
    id: 'event_viento_sf',
    venueId: 'venue_ccp_sf',
    título: 'Donde el viento hace buñuelos',
    descripción: 'Una poética obra teatral que recorre los encuentros y recuerdos de dos mujeres en un viaje inolvidable.',
    fechas: [dateFuture3.toISOString()],
    imágenes: ['https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=1000'],
    categoría: 'teatro',
    estado: 'publicado',
    modo: 'libre',
    cargoServicio: 800,
    tipoCargo: 'fijo',
    createdAt: new Date().toISOString()
  },
  {
    id: 'event_broadway_sf',
    venueId: 'venue_ccp_sf',
    título: 'Broadway Stars',
    descripción: 'Espectáculo musical deslumbrante con coreografías y canciones del teatro de Broadway en su gira por el CCP de Santa Fe.',
    fechas: [datePastShow.toISOString()],
    imágenes: ['https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=1000'],
    categoría: 'concierto',
    estado: 'publicado',
    modo: 'libre',
    cargoServicio: 1200,
    tipoCargo: 'fijo',
    createdAt: new Date().toISOString()
  }
];

const event_zones = [
  // Cisnes (Colon)
  { id: 'ez_cisnes_platea', eventId: 'event_cisnes', nombre: 'Platea Premium', capacidad: 400, capacidadRestante: 400, precio: 15000, tipo: 'VIP' },
  { id: 'ez_cisnes_alta', eventId: 'event_cisnes', nombre: 'Platea Alta', capacidad: 600, capacidadRestante: 600, precio: 9500, tipo: 'General' },
  { id: 'ez_cisnes_palcos', eventId: 'event_cisnes', nombre: 'Palcos', capacidad: 400, capacidadRestante: 400, precio: 18000, tipo: 'VIP' },
  { id: 'ez_cisnes_tertulia', eventId: 'event_cisnes', nombre: 'Tertulia', capacidad: 1000, capacidadRestante: 1000, precio: 4500, tipo: 'Descuento' },
  
  // Soda (Gran Rex)
  { id: 'ez_soda_platinum', eventId: 'event_soda', nombre: 'VIP Platinum', capacidad: 500, capacidadRestante: 500, precio: 25000, tipo: 'VIP' },
  { id: 'ez_soda_gold', eventId: 'event_soda', nombre: 'Platea Gold', capacidad: 1000, capacidadRestante: 1000, precio: 18000, tipo: 'General' },
  { id: 'ez_soda_super', eventId: 'event_soda', nombre: 'Super Pullman', capacidad: 700, capacidadRestante: 700, precio: 12000, tipo: 'General' },
  { id: 'ez_soda_pullman', eventId: 'event_soda', nombre: 'Pullman', capacidad: 1000, capacidadRestante: 1000, precio: 8000, tipo: 'Descuento' },

  // Contorno (Municipal SF)
  { id: 'ez_contorno_platea', eventId: 'event_contorno_sf', nombre: 'Platea Baja', capacidad: 300, capacidadRestante: 298, precio: 12000, tipo: 'VIP' },
  { id: 'ez_contorno_pullman', eventId: 'event_contorno_sf', nombre: 'Pullman', capacidad: 300, capacidadRestante: 300, precio: 8000, tipo: 'General' },
  { id: 'ez_contorno_palcos', eventId: 'event_contorno_sf', nombre: 'Palcos', capacidad: 200, capacidadRestante: 200, precio: 15000, tipo: 'VIP' },

  // Viento (CCP SF)
  { id: 'ez_viento_mayor', eventId: 'event_viento_sf', nombre: 'Sala Mayor', capacidad: 400, capacidadRestante: 399, precio: 7000, tipo: 'General' },
  { id: 'ez_viento_foyer', eventId: 'event_viento_sf', nombre: 'Sala Foyer', capacidad: 200, capacidadRestante: 200, precio: 5000, tipo: 'General' },

  // Broadway (CCP SF)
  { id: 'ez_broadway_mayor', eventId: 'event_broadway_sf', nombre: 'Sala Mayor', capacidad: 400, capacidadRestante: 398, precio: 5000, tipo: 'General' }
];

const seats = [];
const filas = ['A', 'B', 'C'];
const numeros = [1, 2, 3, 4, 5];

// 1. Cisnes (Colon)
for (const fecha of ['2026-06-20T21:00:00.000Z']) {
  for (const fila of filas) {
    for (const num of numeros) {
      seats.push({
        id: `seat_cisnes_${fila}_${num}`,
        eventId: 'event_cisnes',
        funcionFecha: fecha,
        fila,
        número: num,
        zona: fila === 'A' ? 'Platea Premium' : 'Platea Alta',
        estado: 'libre',
        precio: fila === 'A' ? 15000 : 9500,
        tipo: fila === 'A' ? 'VIP' : 'General'
      });
    }
  }
}

// 2. Contorno (Teatro Municipal SF)
for (const fecha of [datePastShow.toISOString(), dateFuture2.toISOString()]) {
  const isPast = fecha === datePastShow.toISOString();
  for (const fila of filas) {
    for (const num of numeros) {
      const esA3oA4 = fila === 'A' && (num === 3 || num === 4);
      const esA1oA2 = fila === 'A' && (num === 1 || num === 2);
      let estado = 'libre';
      if (!isPast && esA3oA4) {
        estado = 'vendido';
      }
      if (isPast && esA1oA2) {
        estado = 'vendido';
      }

      seats.push({
        id: `seat_contorno_${isPast ? 'past' : 'fut'}_${fila}_${num}`,
        eventId: 'event_contorno_sf',
        funcionFecha: fecha,
        fila,
        número: num,
        zona: fila === 'A' ? 'Platea Baja' : 'Pullman',
        estado,
        precio: fila === 'A' ? 12000 : 8000,
        tipo: fila === 'A' ? 'VIP' : 'General'
      });
    }
  }
}

// ORDERS
const orders = [
  // 1. Orden pasada de Broadway Stars (CCP SF) - Pagada y Terminada
  {
    id: 'order_past_1',
    userId: 'user_comprador_1',
    compradorEmail: 'juan.perez@example.com',
    compradorNombre: 'Juan Pérez',
    compradorTeléfono: '+549342123456',
    eventId: 'event_broadway_sf',
    funcionFecha: datePastShow.toISOString(),
    seats: null,
    zonaLibre: { nombre: 'Sala Mayor', cantidad: 2, precioUnitario: 5000 },
    subtotal: 10000,
    cargoServicio: 2400,
    total: 12400,
    estado: 'pagado',
    stripePaymentId: 'ch_past_mock_123',
    createdAt: new Date(datePastShow.getTime() - 1 * 60 * 60 * 1000).toISOString()
  },
  // 2. Orden pasada de Contorno (Teatro Municipal SF) - Pagada y Terminada
  {
    id: 'order_past_2',
    userId: 'user_comprador_2',
    compradorEmail: 'maria.gomez@example.com',
    compradorNombre: 'María Gómez',
    compradorTeléfono: '+549342654321',
    eventId: 'event_contorno_sf',
    funcionFecha: datePastShow.toISOString(),
    seats: [
      { fila: 'A', número: 1, zona: 'Platea Baja', precio: 12000 },
      { fila: 'A', número: 2, zona: 'Platea Baja', precio: 12000 }
    ],
    zonaLibre: null,
    subtotal: 24000,
    cargoServicio: 2400,
    total: 26400,
    estado: 'pagado',
    stripePaymentId: 'ch_past_mock_456',
    createdAt: new Date(datePastShow.getTime() - 2 * 60 * 60 * 1000).toISOString()
  },
  // 3. Orden futura de Contorno (Teatro Municipal SF) - Pagada (entradas activas)
  {
    id: 'order_future_1',
    userId: 'user_comprador_2',
    compradorEmail: 'maria.gomez@example.com',
    compradorNombre: 'María Gómez',
    compradorTeléfono: '+549342654321',
    eventId: 'event_contorno_sf',
    funcionFecha: dateFuture2.toISOString(),
    seats: [
      { fila: 'A', número: 3, zona: 'Platea Baja', precio: 12000 },
      { fila: 'A', número: 4, zona: 'Platea Baja', precio: 12000 }
    ],
    zonaLibre: null,
    subtotal: 24000,
    cargoServicio: 2400,
    total: 26400,
    estado: 'pagado',
    stripePaymentId: 'ch_future_mock_789',
    createdAt: new Date().toISOString()
  },
  // 4. Orden futura de Donde el viento hace buñuelos (CCP) - Pendiente
  {
    id: 'order_future_2',
    userId: 'user_comprador_1',
    compradorEmail: 'juan.perez@example.com',
    compradorNombre: 'Juan Pérez',
    compradorTeléfono: '+549342123456',
    eventId: 'event_viento_sf',
    funcionFecha: dateFuture3.toISOString(),
    seats: null,
    zonaLibre: { nombre: 'Sala Mayor', cantidad: 1, precioUnitario: 7000 },
    subtotal: 7000,
    cargoServicio: 800,
    total: 7800,
    estado: 'pendiente',
    stripePaymentId: null,
    createdAt: new Date().toISOString()
  },
  // 5. Orden futura de Contorno (Teatro Municipal SF) - Fallida
  {
    id: 'order_future_3',
    userId: 'user_comprador_1',
    compradorEmail: 'juan.perez@example.com',
    compradorNombre: 'Juan Pérez',
    compradorTeléfono: '+549342123456',
    eventId: 'event_contorno_sf',
    funcionFecha: dateFuture2.toISOString(),
    seats: [
      { fila: 'B', número: 1, zona: 'Pullman', precio: 8000 }
    ],
    zonaLibre: null,
    subtotal: 8000,
    cargoServicio: 800,
    total: 8800,
    estado: 'fallido',
    stripePaymentId: null,
    createdAt: new Date().toISOString()
  }
];

// TICKETS
const tickets = [
  // 1. Tickets pasados (Broadway Stars - CCP) - Usados (Escaneados)
  {
    id: 'ticket_past_1a',
    orderId: 'order_past_1',
    eventId: 'event_broadway_sf',
    funcionFecha: datePastShow.toISOString(),
    seatId: null,
    zona: 'Sala Mayor',
    fila: null,
    número: null,
    qrCode: 'qr_broadway_past_1a',
    estado: 'usado',
    holderNombre: 'Juan Pérez',
    holderEmail: 'juan.perez@example.com',
    validadoEn: datePastShow.toISOString()
  },
  {
    id: 'ticket_past_1b',
    orderId: 'order_past_1',
    eventId: 'event_broadway_sf',
    funcionFecha: datePastShow.toISOString(),
    seatId: null,
    zona: 'Sala Mayor',
    fila: null,
    número: null,
    qrCode: 'qr_broadway_past_1b',
    estado: 'usado',
    holderNombre: 'Acompañante Juan',
    holderEmail: 'juan.perez@example.com',
    validadoEn: datePastShow.toISOString()
  },
  // 2. Tickets pasados (Contorno - Municipal SF) - Usados
  {
    id: 'ticket_past_2a',
    orderId: 'order_past_2',
    eventId: 'event_contorno_sf',
    funcionFecha: datePastShow.toISOString(),
    seatId: `seat_contorno_past_A_1`,
    zona: 'Platea Baja',
    fila: 'A',
    número: 1,
    qrCode: 'qr_contorno_past_2a',
    estado: 'usado',
    holderNombre: 'María Gómez',
    holderEmail: 'maria.gomez@example.com',
    validadoEn: datePastShow.toISOString()
  },
  {
    id: 'ticket_past_2b',
    orderId: 'order_past_2',
    eventId: 'event_contorno_sf',
    funcionFecha: datePastShow.toISOString(),
    seatId: `seat_contorno_past_A_2`,
    zona: 'Platea Baja',
    fila: 'A',
    número: 2,
    qrCode: 'qr_contorno_past_2b',
    estado: 'usado',
    holderNombre: 'Acompañante María',
    holderEmail: 'maria.gomez@example.com',
    validadoEn: datePastShow.toISOString()
  },
  // 3. Tickets futuros (Contorno - Municipal SF) - Activos
  {
    id: 'ticket_fut_1a',
    orderId: 'order_future_1',
    eventId: 'event_contorno_sf',
    funcionFecha: dateFuture2.toISOString(),
    seatId: `seat_contorno_fut_A_3`,
    zona: 'Platea Baja',
    fila: 'A',
    número: 3,
    qrCode: 'qr_contorno_fut_1a_maria',
    estado: 'activo',
    holderNombre: 'María Gómez',
    holderEmail: 'maria.gomez@example.com',
    validadoEn: null
  },
  {
    id: 'ticket_fut_1b',
    orderId: 'order_future_1',
    eventId: 'event_contorno_sf',
    funcionFecha: dateFuture2.toISOString(),
    seatId: `seat_contorno_fut_A_4`,
    zona: 'Platea Baja',
    fila: 'A',
    número: 4,
    qrCode: 'qr_contorno_fut_1b_acomp',
    estado: 'activo',
    holderNombre: 'Acompañante María',
    holderEmail: 'maria.gomez@example.com',
    validadoEn: null
  }
];

const locks = [];

// ----------------------------------------------------
// SEEDING LOGIC
// ----------------------------------------------------

async function seedLocalDb() {
  console.log('Seeding Local Db Mock (db-mock.json)...');
  const mockPath = path.join(__dirname, '..', 'src', 'lib', 'supabase', 'db-mock.json');
  
  const dbState = {
    users,
    venues,
    events,
    event_zones,
    seats,
    orders,
    tickets,
    locks
  };

  fs.writeFileSync(mockPath, JSON.stringify(dbState, null, 2), 'utf8');
  console.log('SUCCESS: Local db-mock.json successfully updated!');
}

async function seedSupabaseDb() {
  console.log('Seeding Supabase remote Postgres database...');
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected to Supabase Postgres. Cleaning old tables...');
    
    // Truncate tables with CASCADE to clean everything cleanly
    await client.query('TRUNCATE TABLE public.tickets, public.orders, public.locks, public.seats, public.event_zones, public.events, public.venues, public.users CASCADE;');
    console.log('Tables cleared.');

    // 1. Insert Users
    console.log('Inserting users...');
    for (const u of users) {
      await client.query(
        'INSERT INTO public.users (id, email, nombre, rol, "venueIds", "eventIds", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [u.id, u.email, u.nombre, u.rol, JSON.stringify(u.venueIds), JSON.stringify(u.eventIds), u.createdAt]
      );
    }

    // 2. Insert Venues
    console.log('Inserting venues...');
    for (const v of venues) {
      await client.query(
        'INSERT INTO public.venues (id, nombre, slug, ciudad, capacidad, imagen, "planoSVG", zonas) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [v.id, v.nombre, v.slug, v.ciudad, v.capacidad, v.imagen, v.planoSVG, JSON.stringify(v.zonas)]
      );
    }

    // 3. Insert Events
    console.log('Inserting events...');
    for (const e of events) {
      await client.query(
        'INSERT INTO public.events (id, "venueId", "título", "descripción", fechas, "imágenes", "categoría", estado, modo, "cargoServicio", "tipoCargo", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
        [e.id, e.venueId, e.título, e.descripción, JSON.stringify(e.fechas), JSON.stringify(e.imágenes), e.categoría, e.estado, e.modo, e.cargoServicio, e.tipoCargo, e.createdAt]
      );
    }

    // 4. Insert Event Zones
    console.log('Inserting event zones...');
    for (const ez of event_zones) {
      await client.query(
        'INSERT INTO public.event_zones (id, "eventId", nombre, capacidad, "capacidadRestante", precio, tipo) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [ez.id, ez.eventId, ez.nombre, ez.capacidad, ez.capacidadRestante, ez.precio, ez.tipo]
      );
    }

    // 5. Insert Seats
    console.log('Inserting seats...');
    // Se inserta en batches para evitar saturar el pooler
    for (let i = 0; i < seats.length; i += 100) {
      const batch = seats.slice(i, i + 100);
      for (const s of batch) {
        await client.query(
          'INSERT INTO public.seats (id, "eventId", "funcionFecha", fila, "número", zona, estado, precio, tipo) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [s.id, s.eventId, s.funcionFecha, s.fila, s.número, s.zona, s.estado, s.precio, s.tipo]
        );
      }
    }

    // 6. Insert Orders
    console.log('Inserting orders...');
    for (const o of orders) {
      await client.query(
        'INSERT INTO public.orders (id, "userId", "compradorEmail", "compradorNombre", "compradorTeléfono", "eventId", "funcionFecha", seats, "zonaLibre", subtotal, "cargoServicio", total, estado, "stripePaymentId", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)',
        [o.id, o.userId, o.compradorEmail, o.compradorNombre, o.compradorTeléfono, o.eventId, o.funcionFecha, o.seats ? JSON.stringify(o.seats) : null, o.zonaLibre ? JSON.stringify(o.zonaLibre) : null, o.subtotal, o.cargoServicio, o.total, o.estado, o.stripePaymentId, o.createdAt]
      );
    }

    // 7. Insert Tickets
    console.log('Inserting tickets...');
    for (const t of tickets) {
      await client.query(
        'INSERT INTO public.tickets (id, "orderId", "eventId", "funcionFecha", "seatId", zona, fila, "número", "qrCode", estado, "holderNombre", "holderEmail", "validadoEn") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
        [t.id, t.orderId, t.eventId, t.funcionFecha, t.seatId, t.zona, t.fila, t.número, t.qrCode, t.estado, t.holderNombre, t.holderEmail, t.validadoEn]
      );
    }

    console.log('SUCCESS: Remote Supabase database successfully seeded!');
    await client.end();
  } catch (err) {
    console.error('ERROR seeding Supabase:', err);
    process.exit(1);
  }
}

async function main() {
  await seedLocalDb();
  await seedSupabaseDb();
}

main();
