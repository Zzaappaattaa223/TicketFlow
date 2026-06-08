import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getTicketEmailTemplate } from '../emailTemplates';
import { notificationService } from '../index';
import { Ticket, Event, Venue } from '@/types';

const LOG_FILE_PATH = path.join(process.cwd(), 'src/lib/notifications/notifications-log.json');

describe('Notification Module Tests', () => {
  let originalLogContent: string | null = null;

  beforeAll(() => {
    // Resguardar log original si existe
    if (fs.existsSync(LOG_FILE_PATH)) {
      originalLogContent = fs.readFileSync(LOG_FILE_PATH, 'utf-8');
    }
  });

  afterAll(() => {
    // Restaurar o limpiar log
    if (originalLogContent !== null) {
      fs.writeFileSync(LOG_FILE_PATH, originalLogContent, 'utf-8');
    } else if (fs.existsSync(LOG_FILE_PATH)) {
      try {
        fs.unlinkSync(LOG_FILE_PATH);
      } catch (e) {
        // Ignorar si no se puede borrar
      }
    }
  });

  const mockVenue: Venue = {
    id: 'venue-1',
    nombre: 'Teatro Colón',
    slug: 'teatro-colon',
    ciudad: 'Buenos Aires',
    capacidad: 2500,
    zonas: []
  };

  const mockEvent: Event = {
    id: 'event-1',
    venueId: 'venue-1',
    título: 'Concierto de Gala',
    descripción: 'Una noche increíble de música clásica.',
    fechas: ['2026-10-15T20:00:00.000Z'],
    imágenes: ['https://example.com/image.jpg'],
    categoría: 'concierto',
    estado: 'publicado',
    modo: 'numerado',
    cargoServicio: 10,
    tipoCargo: 'porcentaje',
    createdAt: '2026-06-07T00:00:00.000Z'
  };

  const mockTicket: Ticket = {
    id: 'ticket-123',
    orderId: 'order-456',
    eventId: 'event-1',
    funcionFecha: '2026-10-15T20:00:00.000Z',
    seatId: 'seat-789',
    fila: 'A',
    número: 12,
    qrCode: 'qr-hash-123456',
    estado: 'activo',
    holderNombre: 'Juan Pérez',
    holderEmail: 'juan.perez@example.com'
  };

  it('debe generar correctamente el template HTML del ticket por email', () => {
    const html = getTicketEmailTemplate(mockTicket, mockEvent, mockVenue, 'Juan Pérez');
    
    expect(html).toContain('TICKETFLOW');
    expect(html).toContain('Concierto de Gala');
    expect(html).toContain('Teatro Colón');
    expect(html).toContain('Juan Pérez');
    expect(html).toContain('qr-hash-123456');
    expect(html).toContain('Fila A, Asiento 12');
  });

  it('debe registrar el envío de un email en el archivo de log local', async () => {
    const success = await notificationService.sendEmail(
      'juan.perez@example.com',
      'Tus Entradas para Concierto de Gala',
      '<h1>Prueba de email</h1>'
    );

    expect(success).toBe(true);

    const logs = await notificationService.getLoggedNotifications();
    const emailLog = logs.find(log => log.to === 'juan.perez@example.com' && log.type === 'email');
    expect(emailLog).toBeDefined();
    expect(emailLog.content.subject).toBe('Tus Entradas para Concierto de Gala');
  });

  it('debe registrar el envío de un WhatsApp en el archivo de log local', async () => {
    const success = await notificationService.sendWhatsApp(
      '+5491112345678',
      'Tu entrada está lista. QR: https://example.com/qr'
    );

    expect(success).toBe(true);

    const logs = await notificationService.getLoggedNotifications();
    const waLog = logs.find(log => log.to === '+5491112345678' && log.type === 'whatsapp');
    expect(waLog).toBeDefined();
    expect(waLog.content.body).toContain('Tu entrada está lista');
  });
});
