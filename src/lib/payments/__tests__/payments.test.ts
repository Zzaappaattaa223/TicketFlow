import { describe, it, expect } from 'vitest';
import { paymentService, mercadoPagoService } from '../index';

describe('Payment Module Tests', () => {
  it('debe simular la creación de Stripe PaymentIntent si no hay api key', async () => {
    const res = await paymentService.createPaymentIntent(1500, 'ars', { orderId: 'order-123' });
    
    expect(res.clientSecret).toBeDefined();
    expect(res.id).toContain('pi_mock_');
  });

  it('debe simular la creación de Mercado Pago Preference si no hay api key', async () => {
    const res = await mercadoPagoService.createPreference(
      'Entrada Concierto',
      1200,
      2,
      'order-789'
    );

    expect(res.id).toContain('pref_mock_');
    expect(res.initPoint).toContain('order-789');
    expect(res.initPoint).toContain('collection_status=approved');
  });
});
