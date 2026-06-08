-- TicketFlow - SQL Schema para Supabase
-- Copia y pega este script en el editor SQL de tu panel de Supabase para configurar la base de datos.

-- Habilitar extensión uuid-ossp si es necesaria
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('Super Admin', 'Admin de Sala', 'Productor', 'Boletería', 'Controlador de Acceso', 'Comprador')),
    "venueIds" JSONB DEFAULT '[]'::jsonb, -- IDs de salas asociadas (permisos finos)
    "eventIds" JSONB DEFAULT '[]'::jsonb, -- IDs de shows asociados (permisos finos)
    "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Habilitar RLS (Row Level Security) - Deshabilitado por simplicidad para desarrollo híbrido
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total a usuarios de manera pública" ON public.users FOR ALL USING (true) WITH CHECK (true);

-- 2. Tabla de Salas (Venues)
CREATE TABLE IF NOT EXISTS public.venues (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    ciudad TEXT NOT NULL,
    capacidad INT NOT NULL,
    imagen TEXT,
    "planoSVG" TEXT,
    zonas JSONB NOT NULL DEFAULT '[]'::jsonb, -- Listado de zonas por defecto
    "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total a salas de manera pública" ON public.venues FOR ALL USING (true) WITH CHECK (true);

-- 3. Tabla de Eventos / Espectáculos
CREATE TABLE IF NOT EXISTS public.events (
    id TEXT PRIMARY KEY,
    "venueId" TEXT NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    "título" TEXT NOT NULL,
    "descripción" TEXT NOT NULL,
    fechas JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de strings ISO de las funciones
    "imágenes" JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de URLs de imágenes
    "categoría" TEXT NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('borrador', 'publicado', 'pausado', 'agotado', 'cancelado')),
    modo TEXT NOT NULL CHECK (modo IN ('numerado', 'libre')),
    "cargoServicio" NUMERIC NOT NULL DEFAULT 0,
    "tipoCargo" TEXT NOT NULL CHECK ("tipoCargo" IN ('porcentaje', 'fijo')),
    "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total a eventos de manera pública" ON public.events FOR ALL USING (true) WITH CHECK (true);

-- 4. Tabla de Zonas Activas de Eventos (Capacidad restante por show)
CREATE TABLE IF NOT EXISTS public.event_zones (
    id TEXT PRIMARY KEY,
    "eventId" TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    capacidad INT NOT NULL,
    "capacidadRestante" INT NOT NULL,
    precio NUMERIC NOT NULL,
    tipo TEXT NOT NULL
);

ALTER TABLE public.event_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total a zonas de eventos de manera pública" ON public.event_zones FOR ALL USING (true) WITH CHECK (true);

-- 5. Tabla de Butacas (Eventos numerados)
CREATE TABLE IF NOT EXISTS public.seats (
    id TEXT PRIMARY KEY,
    "eventId" TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    "funcionFecha" TEXT NOT NULL,
    fila TEXT NOT NULL,
    "número" INT NOT NULL,
    zona TEXT NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('libre', 'bloqueado', 'reservado', 'vendido')),
    precio NUMERIC NOT NULL,
    tipo TEXT NOT NULL
);

ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total a butacas de manera pública" ON public.seats FOR ALL USING (true) WITH CHECK (true);

-- 6. Tabla de Órdenes
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    "userId" TEXT, -- Referencia opcional si el usuario está logueado
    "compradorEmail" TEXT NOT NULL,
    "compradorNombre" TEXT NOT NULL,
    "compradorTeléfono" TEXT,
    "eventId" TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    "funcionFecha" TEXT NOT NULL,
    seats JSONB, -- Array de butacas compradas [{fila, numero, zona, precio}]
    "zonaLibre" JSONB, -- Detalle de zona libre comprada {nombre, cantidad, precioUnitario}
    subtotal NUMERIC NOT NULL,
    "cargoServicio" NUMERIC NOT NULL,
    total NUMERIC NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('pendiente', 'pagado', 'fallido', 'reembolsado')),
    "stripePaymentId" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total a órdenes de manera pública" ON public.orders FOR ALL USING (true) WITH CHECK (true);

-- 7. Tabla de Tickets Emitidos
CREATE TABLE IF NOT EXISTS public.tickets (
    id TEXT PRIMARY KEY,
    "orderId" TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    "eventId" TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    "funcionFecha" TEXT NOT NULL,
    "seatId" TEXT,
    zona TEXT,
    fila TEXT,
    "número" INT,
    "qrCode" TEXT UNIQUE NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('activo', 'usado', 'cancelado')),
    "holderNombre" TEXT NOT NULL,
    "holderEmail" TEXT NOT NULL,
    "validadoEn" TEXT
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total a tickets de manera pública" ON public.tickets FOR ALL USING (true) WITH CHECK (true);

-- 8. Tabla de Bloqueos Temporales (Butacas y capacidad libre)
CREATE TABLE IF NOT EXISTS public.locks (
    id TEXT PRIMARY KEY, -- seatId o eventId_zone_userId
    "eventId" TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    "funcionFecha" TEXT NOT NULL,
    "userIdOrSessionId" TEXT NOT NULL,
    cantidad INT, -- Opcional, solo para zonas libres
    "lockedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acceso total a bloqueos de manera pública" ON public.locks FOR ALL USING (true) WITH CHECK (true);

-- Índices de Optimización de Búsqueda
CREATE INDEX IF NOT EXISTS idx_seats_event_date ON public.seats("eventId", "funcionFecha");
CREATE INDEX IF NOT EXISTS idx_tickets_order ON public.tickets("orderId");
CREATE INDEX IF NOT EXISTS idx_tickets_qr ON public.tickets("qrCode");
CREATE INDEX IF NOT EXISTS idx_locks_expires ON public.locks("expiresAt");
CREATE INDEX IF NOT EXISTS idx_events_venue ON public.events("venueId");
