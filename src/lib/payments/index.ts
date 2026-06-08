import Stripe from 'stripe';

export interface IPaymentService {
  createPaymentIntent(amount: number, currency: string, metadata?: Record<string, string>): Promise<{
    clientSecret: string;
    id: string;
  }>;
  verifyWebhookSignature(body: string, signature: string, secret: string): Promise<Stripe.Event | null>;
}

class StripePaymentService implements IPaymentService {
  private stripe: Stripe | null = null;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (secretKey) {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-01-27' as any, // Asegurar compatibilidad
      });
    } else {
      console.warn('STRIPE_SECRET_KEY no provista. Usando procesador de pagos simulado (Mock).');
    }
  }

  async createPaymentIntent(amount: number, currency: string, metadata?: Record<string, string>): Promise<{
    clientSecret: string;
    id: string;
  }> {
    if (this.stripe) {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        metadata
      });
      return {
        clientSecret: paymentIntent.client_secret || '',
        id: paymentIntent.id
      };
    } else {
      // Simulación local para desarrollo y testing
      const id = `pi_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return {
        clientSecret: `${id}_secret_${Math.random().toString(36).substr(2, 5)}`,
        id
      };
    }
  }

  async verifyWebhookSignature(body: string, signature: string, secret: string): Promise<Stripe.Event | null> {
    if (this.stripe) {
      try {
        return this.stripe.webhooks.constructEvent(body, signature, secret);
      } catch (error) {
        console.error('Error verificando firma de Stripe Webhook:', error);
        return null;
      }
    }
    return null;
  }
}

export const paymentService: IPaymentService = new StripePaymentService();

export { mercadoPagoService } from './mercadoPago';

