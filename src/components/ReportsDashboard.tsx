'use client';

import React, { useMemo } from 'react';
import { Order, Event, Venue, Ticket } from '@/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { DollarSign, Ticket as TicketIcon, TrendingUp, Download, Eye, FileText, Sparkles } from 'lucide-react';

interface ReportsDashboardProps {
  orders: Order[];
  events: Event[];
  venues: Venue[];
  tickets: Ticket[];
}

const COLORS = ['#FF4A5A', '#FFB800', '#3B82F6', '#8B5CF6', '#10B981', '#EC4899', '#6366F1'];

export default function ReportsDashboard({ orders, events, venues, tickets }: ReportsDashboardProps) {
  
  const paidOrders = useMemo(() => orders.filter(o => o.estado === 'pagado'), [orders]);
  
  // KPIs
  const totalFacturado = useMemo(() => paidOrders.reduce((sum, o) => sum + o.total, 0), [paidOrders]);
  const totalTickets = useMemo(() => paidOrders.reduce((sum, o) => sum + (o.zonaLibre?.cantidad || 0) + (o.seats?.length || 0), 0), [paidOrders]);
  const ticketMedio = totalTickets > 0 ? Math.round(totalFacturado / totalTickets) : 0;

  // 1. Datos para gráfico de ventas por evento
  const chartEventsData = useMemo(() => {
    return events.map(event => {
      const eventOrders = paidOrders.filter(o => o.eventId === event.id);
      const facturacion = eventOrders.reduce((sum, o) => sum + o.total, 0);
      const qty = eventOrders.reduce((sum, o) => sum + (o.zonaLibre?.cantidad || 0) + (o.seats?.length || 0), 0);
      
      return {
        name: event.título.substring(0, 15) + '...',
        títuloCompleto: event.título,
        Facturación: facturacion,
        Entradas: qty
      };
    });
  }, [events, paidOrders]);

  // 2. Datos para gráfico de categorías de eventos
  const chartCategoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach(event => {
      const eventOrders = paidOrders.filter(o => o.eventId === event.id);
      const facturacion = eventOrders.reduce((sum, o) => sum + o.total, 0);
      counts[event.categoría] = (counts[event.categoría] || 0) + facturacion;
    });

    return Object.keys(counts).map(key => ({
      name: key.toUpperCase(),
      value: counts[key]
    })).filter(d => d.value > 0);
  }, [events, paidOrders]);

  // 3. Exportar Ventas de Evento a CSV
  const handleExportSales = (event: Event) => {
    const eventOrders = paidOrders.filter(o => o.eventId === event.id);
    
    // Encabezados
    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += 'ID de Orden,Nombre Comprador,Email,Teléfono,Ubicación,Subtotal,Cargo Servicio,Total Pagado,Fecha\n';

    // Filas
    eventOrders.forEach(o => {
      const ubicacion = o.zonaLibre 
        ? `${o.zonaLibre.nombre} (x${o.zonaLibre.cantidad})`
        : o.seats?.map(s => `${s.fila}-${s.número}`).join('; ') || 'Butacas';
      const fecha = new Date(o.createdAt).toLocaleDateString('es-AR');
      
      csvContent += `"${o.id}","${o.compradorNombre}","${o.compradorEmail}","${o.compradorTeléfono || '-'}","${ubicacion}",${o.subtotal},${o.cargoServicio},${o.total},"${fecha}"\n`;
    });

    // Descarga de archivo en el navegador
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Ventas_${event.título.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 4. Exportar Asistentes / Tickets de Evento a CSV
  const handleExportAttendees = async (event: Event) => {
    // Filtrar los tickets de este evento
    const eventTickets = tickets.filter(t => t.eventId === event.id);

    // Encabezados
    let csvContent = '\uFEFF';
    csvContent += 'Ticket ID,Nombre Asistente,Email,Sector,Fila,Asiento,Estado,Validado En,QR Code\n';

    // Filas
    eventTickets.forEach(t => {
      const validadoEnStr = t.validadoEn ? new Date(t.validadoEn).toLocaleString('es-AR') : '-';
      csvContent += `"${t.id}","${t.holderNombre}","${t.holderEmail}","${t.zona || 'General'}","${t.fila || '-'}","${t.número || '-'}","${t.estado}","${validadoEnStr}","${t.qrCode}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Asistentes_${event.título.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="glass-panel border border-border rounded-2xl p-6 flex items-center space-x-4">
          <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Facturado Total</span>
            <p className="text-2xl font-black text-white font-mono">${totalFacturado.toLocaleString('es-AR')}</p>
          </div>
        </div>

        <div className="glass-panel border border-border rounded-2xl p-6 flex items-center space-x-4">
          <div className="h-12 w-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
            <TicketIcon className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Entradas Emitidas</span>
            <p className="text-2xl font-black text-white">{totalTickets} ubicaciones</p>
          </div>
        </div>

        <div className="glass-panel border border-border rounded-2xl p-6 flex items-center space-x-4">
          <div className="h-12 w-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Ticket Promedio</span>
            <p className="text-2xl font-black text-white font-mono">${ticketMedio.toLocaleString('es-AR')}</p>
          </div>
        </div>
      </div>

      {/* Gráficos Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gráfico de Barras: Facturación */}
        <div className="glass-panel border border-border rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center">
            <Sparkles className="h-4.5 w-4.5 mr-2 text-primary" />
            <span>Facturación por Espectáculo</span>
          </h2>
          <div className="h-72 w-full text-xs">
            {chartEventsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartEventsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0d1426', borderColor: 'rgba(255,255,255,0.1)' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="Facturación" fill="#ff4a5a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-20">No hay ventas registradas.</p>
            )}
          </div>
        </div>

        {/* Gráfico de Torta: Distribución Categorías */}
        <div className="glass-panel border border-border rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center">
            <Sparkles className="h-4.5 w-4.5 mr-2 text-primary" />
            <span>Distribución de Ingresos por Género</span>
          </h2>
          <div className="h-72 w-full text-xs flex items-center justify-center">
            {chartCategoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartCategoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartCategoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => value !== undefined && value !== null ? `$${Number(value).toLocaleString('es-AR')}` : ''}
                    contentStyle={{ backgroundColor: '#0d1426', borderColor: 'rgba(255,255,255,0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} formatter={(value) => <span className="text-muted-foreground text-[10px]">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-20">No hay ventas registradas.</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabla y descargador CSV por espectáculo */}
      <div className="glass-panel border border-border rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-white">Detalle de Auditorías por Evento</h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground uppercase font-bold tracking-wider">
                <th className="py-3 px-4">Espectáculo</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4">Ventas Brutas</th>
                <th className="py-3 px-4">Tickets Emitidos</th>
                <th className="py-3 px-4 text-center">Acciones de Auditoría</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {events.map((event) => {
                const eventOrders = paidOrders.filter(o => o.eventId === event.id);
                const totalFactEvent = eventOrders.reduce((sum, o) => sum + o.total, 0);
                const totalTicketsEvent = eventOrders.reduce((sum, o) => sum + (o.zonaLibre?.cantidad || 0) + (o.seats?.length || 0), 0);

                return (
                  <tr key={event.id} className="hover:bg-white/2 transition">
                    <td className="py-4 px-4 font-bold text-white">{event.título}</td>
                    <td className="py-4 px-4 uppercase text-primary font-semibold">{event.categoría}</td>
                    <td className="py-4 px-4 font-mono font-bold text-white">${totalFactEvent.toLocaleString('es-AR')}</td>
                    <td className="py-4 px-4 text-muted-foreground">{totalTicketsEvent} emitidos</td>
                    <td className="py-4 px-4 flex justify-center gap-2">
                      <button
                        onClick={() => handleExportSales(event)}
                        disabled={totalTicketsEvent === 0}
                        className="inline-flex items-center space-x-1 bg-slate-900 border border-border/80 hover:border-primary/20 text-muted-foreground hover:text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        title="Descargar Planilla de Ventas"
                      >
                        <FileText className="h-3.5 w-3.5 mr-1 text-primary" />
                        <span>Exportar Ventas (CSV)</span>
                      </button>
                      
                      <button
                        onClick={() => handleExportAttendees(event)}
                        disabled={totalTicketsEvent === 0}
                        className="inline-flex items-center space-x-1 bg-slate-900 border border-border/80 hover:border-primary/20 text-muted-foreground hover:text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        title="Descargar Control de Puerta"
                      >
                        <Download className="h-3.5 w-3.5 mr-1 text-primary" />
                        <span>Exportar Tickets (CSV)</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
