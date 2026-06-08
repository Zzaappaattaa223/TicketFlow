# TicketFlow - Plataforma de reserva y venta de entradas

TicketFlow es una plataforma web fullstack premium diseñada para la reserva y venta de entradas de espectáculos en vivo en teatros, salas medianas y estadios.

Desarrollado en **Next.js 15 (App Router)**, **React 19**, **TypeScript estricto** y **Tailwind CSS v4** con persistencia a base de datos.

---

## 🛠️ Arquitectura y Stack Tecnológico

La arquitectura sigue el principio de **Separación de Responsabilidades (SoC)** y utiliza la estrategia **Lógica Local Primero**:

- **Frontend**: Next.js 15, React 19 (Server Components y Server Actions).
- **Estilos**: Tailwind CSS v4 con variables CSS y soporte de animaciones y clases para glassmorphism.
- **Modelos de datos**: Validados en cliente y servidor a través de Zod y tipados en TypeScript de forma estricta.
- **Wrappers de Dependencias**:
  - **Base de Datos**: Abstracción en `@db` (`src/lib/supabase`). Utiliza persistencia local offline en [db-mock.json](file:///c:/Users/Owner/antigravity/TicketFlow/src/lib/supabase/db-mock.json).
  - **Autenticación**: Basado en Next.js async cookies seguras e integrado con el servicio de base de datos.
  - **Pagos**: Integrado de forma abstracta para Stripe con simulador local.
  - **Notificaciones**: Wrapper para Resend (Emails) y Twilio (WhatsApp) que genera un archivo de logs local en [notifications-log.json](file:///c:/Users/Owner/antigravity/TicketFlow/src/lib/notifications/notifications-log.json) para depuración en desarrollo.

---

## 📁 Estructura del Proyecto

- `src/types/` — Definición de tipos de TypeScript estrictos del dominio.
- `src/lib/` — Wrappers de servicios (Base de datos, Autenticación, Pagos, Notificaciones).
- `src/context/` — Estado del carrito y temporizadores de bloqueo de butacas.
- `src/app/` — Rutas principales de la aplicación:
  - `(public)/` — Home, detalles, reserva de zonas, checkout y confirmaciones.
  - `(admin)/admin/` — Backoffice para reportes, métricas y CRUDs de Venues/Eventos.
  - `scanner/` — Módulo PWA mobile-first para portería y validación QR de entradas.
- `src/components/` — Componentes reutilizables interactivos del cliente (detalles de shows, buscador, modal de login).

---

## 🚀 Guía de Inicio Rápido

### 1. Variables de Entorno (.env)
Para producción o conectar con los proveedores externos, crea un archivo `.env` en la raíz con las siguientes claves (Secrets Manager):
```env
STRIPE_SECRET_KEY=tu_stripe_key
RESEND_API_KEY=tu_resend_key
TWILIO_ACCOUNT_SID=tu_twilio_sid
TWILIO_AUTH_TOKEN=tu_twilio_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```
*Si no se proveen estas variables, la aplicación utilizará automáticamente el modo simulado local sin romperse.*

### 2. Levantar Servidor de Desarrollo
Instala las dependencias y corre el servidor de desarrollo local:
```bash
npm install
npm run dev
```
Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

### 3. Cuentas de Prueba Rápidas
El sistema inicializa la base de datos con cuentas semilla predeterminadas para pruebas:
- **Super Admin**: `admin@ticketflow.com` (Permite ver el `/admin` dashboard y CRUDs).
- **Portero**: `portero@ticketflow.com` (Permite entrar a `/scanner` para validar QRs).

---

## 🧪 Ejecución de Pruebas

Para correr las pruebas unitarias y de integración de lógica comercial (bloqueos, reservas y QRs) con **Vitest**:
```bash
npx vitest run
```
