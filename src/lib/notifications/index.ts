import fs from 'fs';
import path from 'path';

export interface INotificationService {
  sendEmail(to: string, subject: string, htmlContent: string): Promise<boolean>;
  sendWhatsApp(to: string, body: string): Promise<boolean>;
  getLoggedNotifications(): Promise<any[]>;
}

const LOG_FILE_PATH = path.join(process.cwd(), 'src/lib/notifications/notifications-log.json');

class NotificationService implements INotificationService {
  private resendApiKey = process.env.RESEND_API_KEY;
  private twilioSid = process.env.TWILIO_ACCOUNT_SID;
  private twilioToken = process.env.TWILIO_AUTH_TOKEN;
  private twilioFrom = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

  private logNotificationLocal(type: 'email' | 'whatsapp', to: string, content: any) {
    const dir = path.dirname(LOG_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let logs: any[] = [];
    if (fs.existsSync(LOG_FILE_PATH)) {
      try {
        logs = JSON.parse(fs.readFileSync(LOG_FILE_PATH, 'utf-8'));
      } catch (e) {
        logs = [];
      }
    }

    logs.push({
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      to,
      timestamp: new Date().toISOString(),
      content
    });

    fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(logs, null, 2), 'utf-8');
  }

  async sendEmail(to: string, subject: string, htmlContent: string): Promise<boolean> {
    console.log(`[Notification: Email] Enviando a: ${to} | Asunto: ${subject}`);
    this.logNotificationLocal('email', to, { subject, htmlContent });

    if (this.resendApiKey) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'TicketFlow <noreply@ticketflow.com>',
            to,
            subject,
            html: htmlContent
          })
        });
        return res.ok;
      } catch (error) {
        console.error('Error al enviar email con Resend:', error);
        return false;
      }
    }

    return true; // Simulación exitosa
  }

  async sendWhatsApp(to: string, body: string): Promise<boolean> {
    console.log(`[Notification: WhatsApp] Enviando a: ${to} | Mensaje: ${body}`);
    this.logNotificationLocal('whatsapp', to, { body });

    if (this.twilioSid && this.twilioToken) {
      try {
        const auth = Buffer.from(`${this.twilioSid}:${this.twilioToken}`).toString('base64');
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${this.twilioSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              From: this.twilioFrom,
              To: `whatsapp:${to}`,
              Body: body
            })
          }
        );
        return res.ok;
      } catch (error) {
        console.error('Error al enviar WhatsApp con Twilio:', error);
        return false;
      }
    }

    return true; // Simulación exitosa
  }

  async getLoggedNotifications(): Promise<any[]> {
    if (fs.existsSync(LOG_FILE_PATH)) {
      try {
        return JSON.parse(fs.readFileSync(LOG_FILE_PATH, 'utf-8'));
      } catch (e) {
        return [];
      }
    }
    return [];
  }
}

export const notificationService: INotificationService = new NotificationService();
