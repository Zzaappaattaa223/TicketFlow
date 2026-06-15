export class MercadoPagoService {
  private accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  async createPreference(
    title: string,
    unitPrice: number,
    quantity: number,
    orderId: string,
    baseUrl?: string
  ): Promise<{ initPoint: string; id: string }> {
    const activeBaseUrl = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    if (!this.accessToken) {
      console.warn('MERCADOPAGO_ACCESS_TOKEN no provisto. Usando simulador de Mercado Pago.');
      const id = `pref_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return {
        initPoint: `${activeBaseUrl}/confirmation/${orderId}?collection_status=approved&collection_id=mp_mock_123&payment_id=mp_mock_123&status=approved&payment_type=credit_card&merchant_order_id=mp_mock_456&preference_id=${id}&site_id=MLA&processing_mode=aggregator&merchant_account_id=null`,
        id
      };
    }

    try {
      const response = await fetch('https://api.mercadopago.com/v1/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: [
            {
              title,
              unit_price: unitPrice,
              quantity,
              currency_id: 'ARS'
            }
          ],
          back_urls: {
            success: `${activeBaseUrl}/confirmation/${orderId}`,
            failure: `${activeBaseUrl}/checkout?payment_error=true`,
            pending: `${activeBaseUrl}/confirmation/${orderId}?payment_status=pending`
          },
          auto_return: 'approved',
          external_reference: orderId
        })
      });

      if (!response.ok) {
        throw new Error(`Error de Mercado Pago API: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        initPoint: data.init_point,
        id: data.id
      };
    } catch (error) {
      console.error('Error al crear preferencia de Mercado Pago:', error);
      throw error;
    }
  }
}

export const mercadoPagoService = new MercadoPagoService();
