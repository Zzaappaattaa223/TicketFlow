'use client';

import React, { useState } from 'react';
import { Order, Event } from '@/types';
import { refundOrderAction } from '@/app/actions';
import { RotateCcw, Loader2, Check, AlertTriangle, X } from 'lucide-react';

interface RecentOrdersTableProps {
  initialOrders: Order[];
  events: Event[];
}

export default function RecentOrdersTable({ initialOrders, events }: RecentOrdersTableProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Abrir confirmación
  const handleOpenConfirm = (orderId: string) => {
    setError(null);
    setSuccess(null);
    setRefundingOrderId(orderId);
  };

  // Confirmar Reembolso
  const handleConfirmRefund = async () => {
    if (!refundingOrderId) return;
    setIsProcessing(true);
    setError(null);

    try {
      const res = await refundOrderAction(refundingOrderId);
      if (res.success && res.order) {
        // Actualizar estado local
        setOrders(prev => 
          prev.map(o => o.id === refundingOrderId ? { ...o, estado: 'reembolsado' } : o)
        );
        setSuccess(`La orden ${refundingOrderId.substring(6, 12).toUpperCase()} ha sido reembolsada y sus butacas/capacidad han sido liberadas.`);
        setRefundingOrderId(null);
      } else {
        setError(res.error || 'Error al procesar el reembolso.');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión al procesar el reembolso.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Mensajes de feedback con micro-animaciones */}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 rounded-xl p-3 flex items-start gap-2 text-xs animate-in slide-in-from-top-2 duration-200">
          <Check className="h-4.5 w-4.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="bg-primary/10 border border-primary/25 text-primary rounded-xl p-3 flex items-start gap-2 text-xs animate-in slide-in-from-top-2 duration-200">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground uppercase font-bold tracking-wider">
              <th className="py-3 px-4">Orden ID</th>
              <th className="py-3 px-4">Comprador</th>
              <th className="py-3 px-4">Espectáculo</th>
              <th className="py-3 px-4">Detalle</th>
              <th className="py-3 px-4 text-right">Total</th>
              <th className="py-3 px-4 text-center">Estado</th>
              <th className="py-3 px-4">Canal / ID Pago</th>
              <th className="py-3 px-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {orders.slice().reverse().slice(0, 15).map((order) => {
              const event = events.find(e => e.id === order.eventId);
              const isPaid = order.estado === 'pagado';
              const isRefunded = order.estado === 'reembolsado';

              let paymentLabel = 'Online';
              if (order.stripePaymentId?.startsWith('presencial_')) {
                const parts = order.stripePaymentId.split('_');
                const method = parts[1];
                paymentLabel = method === 'cortesia' ? 'Cortesía' : `Presencial (${method.replace('tarjeta', 'tarjeta')})`;
              }

              return (
                <tr key={order.id} className="hover:bg-white/2 transition">
                  <td className="py-3.5 px-4 font-mono font-bold text-white">
                    {order.id.substring(6, 15).toUpperCase()}
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-white leading-tight">{order.compradorNombre}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">{order.compradorEmail}</p>
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-white leading-tight">{event?.título || 'Espectáculo'}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">
                      {new Date(order.funcionFecha).toLocaleDateString('es-AR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground">
                    {order.zonaLibre ? (
                      <span className="bg-slate-900 border border-border px-2 py-0.5 rounded text-[10px]">
                        {order.zonaLibre.nombre} (x{order.zonaLibre.cantidad})
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {order.seats?.map((s, index) => (
                          <span key={index} className="bg-slate-900 border border-border px-1.5 py-0.5 rounded text-[9px] font-mono">
                            {s.zona.substring(0, 3)}:{s.fila}{s.número}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                    ${order.total.toLocaleString('es-AR')}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className={`inline-block text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                      isPaid ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                      isRefunded ? 'bg-slate-500/10 text-slate-500 border border-slate-500/20' :
                      order.estado === 'pendiente' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                      'bg-primary/10 text-primary border border-primary/20'
                    }`}>
                      {order.estado}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[10px] text-muted-foreground">
                    <p className="font-semibold text-white">{paymentLabel}</p>
                    <p className="text-[9px] opacity-75 truncate max-w-[120px]">{order.stripePaymentId || '-'}</p>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {isPaid ? (
                      <button
                        onClick={() => handleOpenConfirm(order.id)}
                        className="inline-flex items-center space-x-1 bg-primary/10 hover:bg-primary/25 border border-primary/25 hover:border-primary/50 text-primary hover:text-white px-2.5 py-1 rounded-lg transition cursor-pointer text-[10px]"
                        title="Reembolsar y liberar butacas"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Reembolsar</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-muted-foreground">
                  Aún no hay transacciones registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE CONFIRMACIÓN DE REEMBOLSO */}
      {refundingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b0f19] border border-border rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-border flex justify-between items-center bg-black/20">
              <h3 className="text-sm font-bold text-white">Confirmar Reembolso</h3>
              <button 
                onClick={() => setRefundingOrderId(null)}
                className="text-muted-foreground hover:text-white transition cursor-pointer"
                disabled={isProcessing}
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-center">
              <div className="mx-auto h-12 w-12 bg-primary/15 rounded-full flex items-center justify-center text-primary">
                <RotateCcw className="h-6 w-6 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-white font-bold uppercase tracking-wider">
                  Orden: {refundingOrderId.substring(6, 12).toUpperCase()}
                </p>
                <p className="text-xs text-muted-foreground leading-normal">
                  ¿Estás seguro de que deseas reembolsar esta orden? Esta acción marcará los tickets como <span className="text-white font-semibold">cancelados</span> y liberará las butacas/capacidad del show inmediatamente.
                </p>
              </div>
            </div>

            <div className="p-5 border-t border-border bg-black/20 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setRefundingOrderId(null)}
                disabled={isProcessing}
                className="bg-slate-900 border border-border hover:bg-slate-800 text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRefund}
                disabled={isProcessing}
                className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Reembolsando...</span>
                  </>
                ) : (
                  <span>Sí, Reembolsar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
