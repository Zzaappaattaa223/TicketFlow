'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { getEventsAction, validateTicketAction, getTicketsByEventIdAction } from '@/app/actions';
import { Event, Ticket } from '@/types';
import { Camera, Search, CheckCircle, XCircle, AlertCircle, RefreshCw, KeyRound, UserCheck, Play, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ScannerPage() {
  const { currentUser } = useApp();
  
  // Estados de carga de datos
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [searchAttendee, setSearchAttendee] = useState('');
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Estados de escaneo/entrada
  const [manualQR, setManualQR] = useState('');
  const [scannerResult, setScannerResult] = useState<{
    status: 'idle' | 'success' | 'already_used' | 'error';
    message: string;
    ticket?: Ticket;
  }>({ status: 'idle', message: '' });

  const [isLoadingValidation, setIsLoadingValidation] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  // Estados Offline e Integración PWA
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string>('');

  // Sincronizar cola offline en segundo plano
  const syncOfflineQueue = async () => {
    if (typeof window === 'undefined') return;
    const queueStr = localStorage.getItem('ticketflow_offline_queue');
    if (!queueStr) return;

    try {
      const queue: Array<{ eventId: string; qrCode: string; validadoEn: string; porteroName: string }> = JSON.parse(queueStr);
      if (queue.length === 0) return;

      setIsSyncing(true);
      setSyncMessage(`Sincronizando ${queue.length} validaciones offline...`);

      let successCount = 0;
      for (const item of queue) {
        try {
          const res = await validateTicketAction(item.qrCode, item.porteroName);
          if (res.success) {
            successCount++;
          }
        } catch (err) {
          console.error(`Error sincronizando ticket offline ${item.qrCode}:`, err);
        }
      }

      localStorage.removeItem('ticketflow_offline_queue');
      setSyncMessage(`Éxito: Sincronizados ${successCount} de ${queue.length} tickets offline.`);
      
      setTimeout(() => {
        setSyncMessage('');
      }, 4000);

      // Recargar tickets frescos del servidor si tenemos show seleccionado
      if (selectedEventId) {
        const freshTickets = await getTicketsByEventIdAction(selectedEventId);
        setTickets(freshTickets);
        localStorage.setItem(`ticketflow_offline_tickets_${selectedEventId}`, JSON.stringify(freshTickets));
      }
    } catch (e) {
      console.error('Error procesando la cola offline:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Manejar estado de conexión online/offline
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    setIsOnline(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) {
      syncOfflineQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [selectedEventId]);

  // Cargar eventos del portero
  useEffect(() => {
    async function loadScannerData() {
      setIsDataLoading(true);
      try {
        const allEvents = await getEventsAction();
        const pubEvents = allEvents.filter(e => e.estado === 'publicado');
        
        let filteredEvents = pubEvents;
        if (currentUser && currentUser.rol === 'Controlador de Acceso') {
          const allowedVenues = currentUser.venueIds || [];
          const allowedEvents = currentUser.eventIds || [];
          filteredEvents = pubEvents.filter(
            e => allowedVenues.includes(e.venueId) || allowedEvents.includes(e.id)
          );
        }

        setEvents(filteredEvents);
        if (filteredEvents.length > 0) {
          setSelectedEventId(filteredEvents[0].id);
        } else {
          setSelectedEventId('');
        }
      } catch (err) {
        console.error('Error cargando eventos para el scanner:', err);
      } finally {
        setIsDataLoading(false);
      }
    }
    
    if (currentUser && (currentUser.rol === 'Controlador de Acceso' || currentUser.rol === 'Super Admin')) {
      loadScannerData();
    }
  }, [currentUser]);

  // Cargar listado de tickets al cambiar el evento seleccionado (soporte offline)
  useEffect(() => {
    async function loadTickets() {
      if (!selectedEventId) return;
      setIsDataLoading(true);
      try {
        if (isOnline) {
          const eventTickets = await getTicketsByEventIdAction(selectedEventId);
          setTickets(eventTickets);
          localStorage.setItem(`ticketflow_offline_tickets_${selectedEventId}`, JSON.stringify(eventTickets));
        } else {
          const localTicketsStr = localStorage.getItem(`ticketflow_offline_tickets_${selectedEventId}`);
          if (localTicketsStr) {
            setTickets(JSON.parse(localTicketsStr));
          } else {
            setTickets([]);
          }
        }
      } catch (e) {
        console.error('Error al cargar tickets:', e);
        // Fallback local por error de red
        const localTicketsStr = localStorage.getItem(`ticketflow_offline_tickets_${selectedEventId}`);
        if (localTicketsStr) {
          setTickets(JSON.parse(localTicketsStr));
        }
      } finally {
        setIsDataLoading(false);
      }
    }
    loadTickets();
  }, [selectedEventId, isOnline]);

  // Si no está autenticado como Controlador de Acceso o Admin
  if (!currentUser || (currentUser.rol !== 'Controlador de Acceso' && currentUser.rol !== 'Super Admin')) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center flex flex-col items-center justify-center space-y-6">
        <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
          <KeyRound className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Acceso Restringido</h1>
          <p className="text-sm text-muted-foreground">
            Debes iniciar sesión con una cuenta con rol de <span className="text-white font-semibold">Controlador de Acceso</span> o <span className="text-white font-semibold">Super Admin</span> para acceder al módulo de validación.
          </p>
        </div>

        <div className="bg-[#0d1426] border border-border p-4 rounded-xl w-full text-left space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">Acceso rápido para desarrollo:</p>
          <p className="text-xs text-muted-foreground">
            Inicia sesión desde el menú superior usando las credenciales pre-cargadas de prueba:
          </p>
          <div className="bg-slate-950 p-2.5 rounded font-mono text-[10px] text-primary/95">
            Email: portero@ticketflow.com
          </div>
        </div>

        <Link 
          href="/" 
          className="inline-flex items-center space-x-1.5 text-xs text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver al Inicio</span>
        </Link>
      </div>
    );
  }

  // Ejecutar validación (soporta modo offline local)
  const handleValidate = async (qrCodeStr: string) => {
    if (!qrCodeStr.trim()) return;
    setIsLoadingValidation(true);
    setScannerResult({ status: 'idle', message: '' });
    
    try {
      if (isOnline) {
        // Validación online habitual
        const res = await validateTicketAction(qrCodeStr, currentUser.nombre);
        
        if (res.success && res.ticket) {
          setScannerResult({
            status: 'success',
            message: '¡ENTRADA VÁLIDA! Permitir acceso.',
            ticket: res.ticket
          });
          setManualQR('');
          
          // Actualizar caché de tickets local
          const updated = tickets.map(t => t.qrCode === qrCodeStr ? { ...t, estado: 'usado' as const, validadoEn: res.ticket?.validadoEn } : t);
          setTickets(updated);
          localStorage.setItem(`ticketflow_offline_tickets_${selectedEventId}`, JSON.stringify(updated));
        } else if (res.error?.includes('ya fue validada')) {
          setScannerResult({
            status: 'already_used',
            message: res.error,
            ticket: res.ticket
          });
        } else {
          setScannerResult({
            status: 'error',
            message: res.error || 'Entrada inválida o inexistente.'
          });
        }
      } else {
        // Validación offline contra caché
        const localTicketsStr = localStorage.getItem(`ticketflow_offline_tickets_${selectedEventId}`);
        if (!localTicketsStr) {
          setScannerResult({
            status: 'error',
            message: 'Sin conexión a internet y no hay base de datos local para este espectáculo.'
          });
          setIsLoadingValidation(false);
          return;
        }

        const localTickets: Ticket[] = JSON.parse(localTicketsStr);
        const idx = localTickets.findIndex(t => t.qrCode === qrCodeStr);

        if (idx === -1) {
          setScannerResult({
            status: 'error',
            message: 'Código QR no reconocido offline. Entrada inválida.'
          });
          setIsLoadingValidation(false);
          return;
        }

        const ticket = localTickets[idx];

        if (ticket.estado === 'usado') {
          const tValidado = ticket.validadoEn ? new Date(ticket.validadoEn).toLocaleString('es-AR') : 'recientemente';
          setScannerResult({
            status: 'already_used',
            message: `Esta entrada ya fue validada el ${tValidado} (Offline).`,
            ticket
          });
          setIsLoadingValidation(false);
          return;
        }

        if (ticket.estado === 'cancelado') {
          setScannerResult({
            status: 'error',
            message: 'Esta entrada ha sido cancelada por administración.',
            ticket
          });
          setIsLoadingValidation(false);
          return;
        }

        // Marcar como usado localmente
        const nowStr = new Date().toISOString();
        const updatedTicket: Ticket = {
          ...ticket,
          estado: 'usado',
          validadoEn: nowStr
        };

        localTickets[idx] = updatedTicket;
        localStorage.setItem(`ticketflow_offline_tickets_${selectedEventId}`, JSON.stringify(localTickets));
        setTickets(localTickets);

        // Encolar validación en cola de sincronización offline
        const queueStr = localStorage.getItem('ticketflow_offline_queue');
        const queue = queueStr ? JSON.parse(queueStr) : [];
        queue.push({
          eventId: selectedEventId,
          qrCode: qrCodeStr,
          validadoEn: nowStr,
          porteroName: currentUser.nombre
        });
        localStorage.setItem('ticketflow_offline_queue', JSON.stringify(queue));

        setScannerResult({
          status: 'success',
          message: '¡ENTRADA VÁLIDA (Offline)! Permitir acceso.',
          ticket: updatedTicket
        });
        setManualQR('');
      }
    } catch (e) {
      console.error('Error al validar:', e);
      setScannerResult({
        status: 'error',
        message: 'Error de validación.'
      });
    } finally {
      setIsLoadingValidation(false);
    }
  };

  // Contadores de asistencia
  const totalVendidos = tickets.length;
  const totalIngresados = tickets.filter(t => t.estado === 'usado').length;
  const porcIngreso = totalVendidos > 0 ? Math.round((totalIngresados / totalVendidos) * 100) : 0;

  // Filtrado de lista de asistentes
  const filteredTickets = tickets.filter(t => {
    const term = searchAttendee.toLowerCase();
    return t.holderNombre.toLowerCase().includes(term) ||
           t.holderEmail.toLowerCase().includes(term) ||
           t.id.toLowerCase().includes(term) ||
           t.qrCode.toLowerCase().includes(term);
  });

  // Simulador de escaneo de cámara
  const startCameraScan = () => {
    setCameraActive(true);
  };

  const stopCameraScan = () => {
    setCameraActive(false);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8 space-y-6">
      
      {/* Botón Volver */}
      <Link 
        href="/"
        className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition space-x-1 print:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Salir del Scanner</span>
      </Link>

      {/* Encabezado Scanner */}
      <div className="text-center">
        <h1 className="text-2xl font-black text-white flex items-center justify-center space-x-1.5">
          <span>Control de Acceso</span>
          <span className="text-primary font-mono text-xs border border-primary/20 bg-primary/10 px-2 py-0.5 rounded">PWA</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Operador: {currentUser.nombre}</p>
      </div>

      {/* Alertas de Conectividad y Sincronización */}
      {!isOnline && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-2xl p-4 flex items-start space-x-2 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 animate-pulse text-amber-500" />
          <div className="space-y-0.5">
            <p className="font-bold text-white">Modo Offline Activo</p>
            <p className="text-muted-foreground">Estás validando contra los tickets guardados localmente. Los ingresos se sincronizarán al recuperar la señal.</p>
          </div>
        </div>
      )}

      {syncMessage && (
        <div className={`border rounded-2xl p-4 flex items-center space-x-2 text-xs ${
          isSyncing ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
        }`}>
          <RefreshCw className={`h-4 w-4 shrink-0 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Selector de Evento */}
      <div className="bg-slate-900/40 border border-border rounded-2xl p-4 space-y-2">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Espectáculo a Validar
        </label>
        <select 
          value={selectedEventId}
          onChange={(e) => {
            setSelectedEventId(e.target.value);
            setScannerResult({ status: 'idle', message: '' });
          }}
          disabled={isDataLoading || isSyncing}
          className="w-full bg-slate-950 border border-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition"
        >
          {events.map(e => (
            <option key={e.id} value={e.id}>{e.título}</option>
          ))}
        </select>
      </div>

      {/* Panel de Métricas Rápidas */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900/40 border border-border rounded-2xl p-4 text-center">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold">Ingresados</span>
          <p className="text-2xl font-black text-white mt-1">
            {totalIngresados} <span className="text-xs text-muted-foreground">/ {totalVendidos}</span>
          </p>
        </div>
        <div className="bg-slate-900/40 border border-border rounded-2xl p-4 text-center">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold">Asistencia</span>
          <p className="text-2xl font-black text-primary mt-1">
            {porcIngreso}%
          </p>
        </div>
      </div>

      {/* PANTALLA DE RESULTADO DE VALIDACIÓN (Éxito, Ya usado, Inválido) */}
      {scannerResult.status !== 'idle' && (
        <div className={`border rounded-2xl p-5 flex flex-col items-center text-center space-y-3 animate-in zoom-in-95 duration-200 ${
          scannerResult.status === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' :
          scannerResult.status === 'already_used' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
          'bg-primary/10 border-primary/30 text-primary'
        }`}>
          {scannerResult.status === 'success' && <CheckCircle className="h-12 w-12 text-emerald-500 animate-bounce" />}
          {scannerResult.status === 'already_used' && <AlertCircle className="h-12 w-12 text-amber-500 animate-pulse" />}
          {scannerResult.status === 'error' && <XCircle className="h-12 w-12 text-primary animate-pulse" />}

          <div className="space-y-1">
            <h3 className="text-lg font-black uppercase tracking-wide">
              {scannerResult.status === 'success' ? 'Acceso Permitido' : 
               scannerResult.status === 'already_used' ? 'Entrada Ya Usada' : 'Acceso Denegado'}
            </h3>
            <p className="text-xs text-white/95">{scannerResult.message}</p>
          </div>

          {scannerResult.ticket && (
            <div className="w-full border-t border-white/10 pt-3 text-left text-[11px] text-muted-foreground space-y-1 bg-black/20 p-2.5 rounded-lg">
              <p><span className="font-semibold text-white">Titular:</span> {scannerResult.ticket.holderNombre}</p>
              <p><span className="font-semibold text-white">Ubicación:</span> {scannerResult.ticket.zona || 'General'}</p>
              <p><span className="font-semibold text-white">Ticket ID:</span> {scannerResult.ticket.id}</p>
              {scannerResult.ticket.validadoEn && (
                <p>
                  <span className="font-semibold text-white">Hora Uso:</span>{' '}
                  {new Date(scannerResult.ticket.validadoEn).toLocaleTimeString('es-AR')}
                </p>
              )}
            </div>
          )}

          <button 
            onClick={() => setScannerResult({ status: 'idle', message: '' })}
            className="text-xs font-semibold underline text-white hover:opacity-85 cursor-pointer pt-1"
          >
            Listo para el siguiente
          </button>
        </div>
      )}

      {/* CÁMARA O ENTRADA MANUAL */}
      <div className="space-y-4">
        {cameraActive ? (
          <div className="bg-slate-950 border-2 border-primary border-dashed rounded-2xl aspect-square flex flex-col items-center justify-center p-6 space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-primary/80 animate-bounce" style={{ animationDuration: '2.5s' }} />

            <Camera className="h-12 w-12 text-muted-foreground animate-pulse" />
            <div className="text-center space-y-1">
              <p className="text-xs font-bold text-white">Escáner de Cámara Activo</p>
              <p className="text-[10px] text-muted-foreground max-w-xs">
                Para pruebas sin hardware de cámara, haz clic en un ticket de la lista de abajo para simular su escaneo.
              </p>
            </div>

            <button 
              onClick={stopCameraScan}
              className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
            >
              Apagar Cámara
            </button>
          </div>
        ) : (
          <button 
            onClick={startCameraScan}
            className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-2xl flex items-center justify-center space-x-2 transition cursor-pointer"
          >
            <Camera className="h-5 w-5" />
            <span>Encender Cámara Escáner</span>
          </button>
        )}

        {/* Formulario de hash manual */}
        <div className="glass-panel border border-border rounded-2xl p-4 space-y-3">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Ingreso Manual de Código QR
          </label>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Ej. qr_cisnes_..." 
              value={manualQR}
              onChange={(e) => setManualQR(e.target.value)}
              className="flex-grow bg-slate-900 border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-mono"
            />
            <button
              onClick={() => handleValidate(manualQR)}
              disabled={isLoadingValidation || !manualQR}
              className="bg-secondary hover:bg-secondary-hover disabled:bg-secondary/40 border border-border px-4 py-2 rounded-xl text-xs font-semibold text-white transition cursor-pointer flex items-center"
            >
              {isLoadingValidation ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Validar'}
            </button>
          </div>
        </div>
      </div>

      {/* LISTA DE ASISTENTES FALLBACK / SIMULACIÓN */}
      <div className="glass-panel border border-border rounded-2xl p-4 space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-white flex items-center space-x-1.5">
            <UserCheck className="h-4 w-4 text-primary" />
            <span>Lista de Asistentes</span>
          </h2>
          <p className="text-[10px] text-muted-foreground">Busca al espectador o haz clic en "Escanear" para simular.</p>
        </div>

        {/* Buscador de lista */}
        <div className="relative">
          <Search className="absolute left-3.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o correo..." 
            value={searchAttendee}
            onChange={(e) => setSearchAttendee(e.target.value)}
            className="w-full bg-slate-950 border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-primary transition"
          />
        </div>

        {/* Lista scrollable */}
        <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
          {filteredTickets.length > 0 ? (
            filteredTickets.map(ticket => {
              const isUsado = ticket.estado === 'usado';
              return (
                <div 
                  key={ticket.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-black/20 border border-border/40 text-xs"
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold text-white leading-tight">{ticket.holderNombre}</p>
                    <p className="text-[10px] text-muted-foreground leading-none">{ticket.zona || 'General'}</p>
                    <p className="text-[9px] font-mono text-muted-foreground/60 leading-none">{ticket.qrCode}</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      isUsado ? 'bg-amber-500/10 text-amber-500 border border-amber-500/25' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/25'
                    }`}>
                      {ticket.estado}
                    </span>
                    
                    {!isUsado && (
                      <button
                        onClick={() => handleValidate(ticket.qrCode)}
                        className="bg-primary/20 hover:bg-primary/35 text-primary border border-primary/20 p-1.5 rounded transition cursor-pointer"
                        title="Simular Escaneo"
                      >
                        <Play className="h-3 w-3 fill-current" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-[10px] text-center text-muted-foreground py-4">No hay tickets emitidos para este evento o coincidencia de búsqueda.</p>
          )}
        </div>
      </div>

    </div>
  );
}
