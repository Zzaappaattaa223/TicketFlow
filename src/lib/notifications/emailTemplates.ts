import { Ticket, Event, Venue } from '@/types';

export function getTicketEmailTemplate(
  ticket: Ticket,
  event: Event,
  venue: Venue | null,
  compradorNombre: string
): string {
  const d = new Date(ticket.funcionFecha);
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  
  let formattedFecha = '';
  try {
    const dayName = dias[d.getDay()];
    const day = d.getDate();
    const monthName = meses[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    formattedFecha = `${dayName}, ${day} de ${monthName} de ${year} a las ${hours}:${minutes}`;
  } catch (e) {
    formattedFecha = d.toLocaleString();
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ticket.qrCode)}`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tus Entradas - TicketFlow</title>
  <style>
    body {
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #030712;
      color: #f3f4f6;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 30px 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 25px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #ff4a5a;
      text-decoration: none;
      letter-spacing: 1px;
    }
    .card {
      background-color: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
    }
    .banner {
      background-size: cover;
      background-position: center;
      height: 180px;
      position: relative;
    }
    .banner-overlay {
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.3) 0%, #0f172a 100%);
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    }
    .content {
      padding: 24px;
    }
    .ticket-title {
      font-size: 22px;
      font-weight: 900;
      color: #ffffff;
      margin: 0 0 10px 0;
      line-height: 1.2;
    }
    .badge {
      display: inline-block;
      background-color: rgba(255, 74, 90, 0.15);
      color: #ff4a5a;
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 9999px;
      margin-bottom: 15px;
    }
    .details-grid {
      display: table;
      width: 100%;
      border-bottom: 1px dashed #1e293b;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .details-row {
      display: table-row;
    }
    .details-cell {
      display: table-cell;
      width: 50%;
      padding-bottom: 12px;
      vertical-align: top;
    }
    .label {
      font-size: 11px;
      color: #94a3b8;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 4px;
      display: block;
    }
    .value {
      font-size: 13px;
      color: #ffffff;
      font-weight: bold;
      margin: 0;
      line-height: 1.3;
    }
    .qr-section {
      text-align: center;
      background-color: #020617;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .qr-code {
      background-color: #ffffff;
      padding: 12px;
      border-radius: 8px;
      display: inline-block;
    }
    .qr-code img {
      display: block;
      width: 160px;
      height: 160px;
    }
    .qr-hash {
      font-family: monospace;
      color: #ff4a5a;
      font-size: 14px;
      font-weight: bold;
      margin-top: 10px;
      letter-spacing: 1px;
    }
    .footer {
      text-align: center;
      font-size: 11px;
      color: #64748b;
      margin-top: 30px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="logo">🎟️ TICKETFLOW</span>
    </div>
    
    <div class="card">
      <div class="banner" style="background-image: url('${event.imágenes[0]}');">
        <div class="banner-overlay"></div>
      </div>
      
      <div class="content">
        <span class="badge">${ticket.zona ? 'Acceso General' : 'Butaca Numerada'}</span>
        <h2 class="ticket-title">${event.título}</h2>
        
        <div class="details-grid">
          <div class="details-row">
            <div class="details-cell">
              <span class="label">Fecha y Hora</span>
              <p class="value">${formattedFecha} HS</p>
            </div>
            <div class="details-cell">
              <span class="label">Lugar / Ciudad</span>
              <p class="value">${venue?.nombre || 'Sala'}<br><span style="font-size: 11px; font-weight: normal; color: #94a3b8;">${venue?.ciudad || ''}</span></p>
            </div>
          </div>
          <div class="details-row" style="margin-top: 10px;">
            <div class="details-cell">
              <span class="label">Sector / Ubicación</span>
              <p class="value">${ticket.zona || `Fila ${ticket.fila}, Asiento ${ticket.número}`}</p>
            </div>
            <div class="details-cell">
              <span class="label">Titular</span>
              <p class="value">${compradorNombre}</p>
            </div>
          </div>
        </div>
        
        <div class="qr-section">
          <span class="label" style="margin-bottom: 12px; font-size: 10px;">Presenta este código QR en la entrada del evento</span>
          <div class="qr-code">
            <img src="${qrUrl}" alt="Código QR del Ticket">
          </div>
          <div class="qr-hash">${ticket.qrCode}</div>
          <span class="label" style="font-size: 9px; margin-top: 8px; text-transform: none;">ID de Entrada: ${ticket.id}</span>
        </div>
        
        <p style="font-size: 11px; color: #64748b; text-align: center; margin: 0; line-height: 1.6;">
          Recomendamos llegar con 30 minutos de antelación al inicio de la función. Lleva este correo en tu dispositivo móvil o impreso para su validación en puerta.
        </p>
      </div>
    </div>
    
    <div class="footer">
      <p>© 2026 TicketFlow. Reservas de espectáculos en vivo.<br>Desarrollado con Google Antigravity IDE.</p>
    </div>
  </div>
</body>
</html>
  `;
}
