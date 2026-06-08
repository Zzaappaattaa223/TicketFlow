import React from 'react';
import { getOrderByIdAction, getEventByIdAction, getVenueByIdAction, getTicketsByOrderIdAction, updateOrderStatusAction } from '@/app/actions';
import OrderConfirmation from '@/components/OrderConfirmation';
import { notFound } from 'next/navigation';

interface ConfirmationPageProps {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const revalidate = 0;

export default async function ConfirmationPage({ params, searchParams }: ConfirmationPageProps) {
  const { orderId } = await params;
  const sParams = await searchParams;

  let order = await getOrderByIdAction(orderId);
  if (!order) {
    notFound();
  }

  // Si viene con el parámetro de éxito de Mercado Pago y la orden está pendiente, la actualizamos
  const status = sParams.collection_status || sParams.status;
  if (status === 'approved' && order.estado === 'pendiente') {
    const paymentId = (sParams.payment_id as string) || `mp_${Date.now()}`;
    const res = await updateOrderStatusAction(orderId, 'pagado', paymentId);
    if (res.success && res.order) {
      order = res.order;
    }
  }

  const event = await getEventByIdAction(order.eventId);
  if (!event) {
    notFound();
  }

  const venue = await getVenueByIdAction(event.venueId);
  const tickets = await getTicketsByOrderIdAction(orderId);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <OrderConfirmation order={order} event={event} venue={venue} tickets={tickets} />
    </div>
  );
}
