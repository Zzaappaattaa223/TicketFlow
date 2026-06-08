'use client';

import React, { useState, useEffect } from 'react';
import { getUsersAction, updateUserRoleAction, updateUserRoleAssignmentsAction, registerAction, getVenuesAction, getEventsAction } from '@/app/actions';
import { User, UserRole, UserRoleAssignment, Venue, Event } from '@/types';
import { Shield, UserPlus, Loader2, Save, Check, KeyRound, Settings, X, HelpCircle, Trash2, Plus } from 'lucide-react';

const ROLES: UserRole[] = ['Super Admin', 'Admin de Sala', 'Productor', 'Boletería', 'Controlador de Acceso', 'Comprador'];

export default function UsersAdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  
  // Formulario de Invitación
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<UserRole>('Controlador de Acceso');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Estados de Modal de Asignaciones Granulares
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<User | null>(null);
  const [tempAssignments, setTempAssignments] = useState<UserRoleAssignment[]>([]);
  const [newRol, setNewRol] = useState<UserRole>('Admin de Sala');
  const [newVenueId, setNewVenueId] = useState('');
  const [newEventId, setNewEventId] = useState('');
  const [newFecha, setNewFecha] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const usersData = await getUsersAction();
      const venuesData = await getVenuesAction();
      const eventsData = await getEventsAction();
      
      setUsers(usersData);
      setVenues(venuesData);
      setEvents(eventsData);
    } catch (e) {
      console.error('Error al cargar datos iniciales:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);

    if (!nombre.trim() || !email.trim()) {
      setError('El nombre y el correo electrónico son obligatorios.');
      setIsSaving(false);
      return;
    }

    try {
      const res = await registerAction(nombre, email);
      if (res.success && res.user) {
        if (rol !== 'Comprador') {
          await updateUserRoleAction(res.user.id, rol, [], []);
        }
        setSuccess(`¡Usuario "${nombre}" registrado con éxito con el rol "${rol}"!`);
        setNombre('');
        setEmail('');
        setRol('Controlador de Acceso');
        
        // Recargar usuarios
        const usersData = await getUsersAction();
        setUsers(usersData);
      } else {
        setError(res.error || 'Error al registrar el usuario');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      setEditingUserId(userId);
      const user = users.find(u => u.id === userId);
      // Mantener los venueIds y eventIds que ya tenía si cambia de rol, o iniciar vacíos
      const vIds = user?.venueIds || [];
      const eIds = user?.eventIds || [];
      
      await updateUserRoleAction(userId, newRole, vIds, eIds);
      
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, rol: newRole } : u));
      setSuccess('Rol actualizado correctamente.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('No se pudo actualizar el rol del usuario.');
    } finally {
      setEditingUserId(null);
    }
  };

  // Abrir modal de permisos y copiar datos temporales
  const openPermissionsModal = (user: User) => {
    setSelectedUserForPermissions(user);
    setTempAssignments(user.roleAssignments || []);
    setNewRol('Admin de Sala');
    setNewVenueId('');
    setNewEventId('');
    setNewFecha('');
  };

  const handleAddAssignment = () => {
    const newAssign: UserRoleAssignment = {
      id: `assign_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      rol: newRol,
      venueId: newVenueId || undefined,
      eventId: newEventId || undefined,
      fecha: newFecha || undefined
    };
    setTempAssignments(prev => [...prev, newAssign]);
    // Limpiar selectores
    setNewVenueId('');
    setNewEventId('');
    setNewFecha('');
  };

  const handleRemoveAssignment = (id: string) => {
    setTempAssignments(prev => prev.filter(a => a.id !== id));
  };

  const handleSavePermissions = async () => {
    if (!selectedUserForPermissions) return;
    setIsSaving(true);
    setError('');
    
    try {
      await updateUserRoleAssignmentsAction(
        selectedUserForPermissions.id,
        tempAssignments
      );

      // Actualizar en el estado local de usuarios
      setUsers(prev => prev.map(u => 
        u.id === selectedUserForPermissions.id 
          ? { ...u, roleAssignments: tempAssignments } 
          : u
      ));

      setSuccess(`Asignaciones de "${selectedUserForPermissions.nombre}" actualizadas.`);
      setSelectedUserForPermissions(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('No se pudieron guardar las asignaciones.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div>
        <h1 className="text-3xl font-black text-white">Usuarios y Permisos</h1>
        <p className="text-sm text-muted-foreground">Administra los accesos de administradores, productores, controladores de acceso y boleteros de la plataforma.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Columna Izquierda: Formulario Invitación (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel border border-border rounded-2xl p-5 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <UserPlus className="h-4.5 w-4.5 text-primary" />
              <span>Invitar Operador</span>
            </h2>

            <form onSubmit={handleInviteUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Nombre Completo
                </label>
                <input 
                  type="text" 
                  placeholder="Carlos Gómez" 
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full bg-slate-900 border border-border rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-primary transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Correo Electrónico
                </label>
                <input 
                  type="email" 
                  placeholder="carlos.gomez@ticketflow.com" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-border rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-primary transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Rol de Trabajo
                </label>
                <select 
                  value={rol}
                  onChange={(e) => setRol(e.target.value as UserRole)}
                  className="w-full bg-slate-900 border border-border rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-primary transition"
                >
                  {ROLES.filter(r => r !== 'Comprador').map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="text-xs text-primary bg-primary/10 border border-primary/20 rounded-lg p-3">
                  {error}
                </div>
              )}

              {success && (
                <div className="text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-center space-x-1.5">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-primary hover:bg-primary-hover text-white text-xs font-semibold py-2.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Creando acceso...</span>
                  </>
                ) : (
                  <span>Registrar Operador</span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Columna Derecha: Listado y Cambio de Roles (8 cols) */}
        <div className="lg:col-span-8 glass-panel border border-border rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Shield className="h-5 w-5 text-primary" />
            <span>Usuarios de la Plataforma</span>
          </h2>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground uppercase font-bold tracking-wider">
                    <th className="py-3 px-4">Operador</th>
                    <th className="py-3 px-4">Correo</th>
                    <th className="py-3 px-4 text-center">Permiso / Rol</th>
                    <th className="py-3 px-4 text-center">Asignaciones</th>
                    <th className="py-3 px-4">Fecha Registro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {users.map((user) => {
                    const isEditing = editingUserId === user.id;
                    const canConfigurePermissions = user.rol !== 'Super Admin';
                    const asignadasQty = user.roleAssignments?.length || 0;

                    return (
                      <tr key={user.id} className="hover:bg-white/2 transition">
                        <td className="py-4 px-4 font-bold text-white">{user.nombre}</td>
                        <td className="py-4 px-4 text-muted-foreground font-mono">{user.email}</td>
                        <td className="py-4 px-4 text-center">
                          {isEditing ? (
                            <div className="flex justify-center">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            </div>
                          ) : (
                            <select
                              value={user.rol}
                              onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                              className="bg-slate-900 border border-border rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-primary transition"
                            >
                              {ROLES.map(r => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {canConfigurePermissions ? (
                            <button
                              onClick={() => openPermissionsModal(user)}
                              className="inline-flex items-center space-x-1 text-primary hover:bg-primary/10 border border-primary/20 hover:border-primary/40 px-2.5 py-1 rounded transition cursor-pointer text-[10px]"
                            >
                              <Settings className="h-3 w-3" />
                              <span>
                                {asignadasQty === 0 ? 'Sin asignar' : `${asignadasQty} vinculados`}
                              </span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">No aplicable</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-muted-foreground font-mono">
                          {new Date(user.createdAt).toLocaleDateString('es-AR')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE PERMISOS FINOS */}
      {selectedUserForPermissions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b0f19] border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="p-5 border-b border-border flex justify-between items-center bg-black/20 shrink-0">
              <div>
                <h3 className="text-base font-bold text-white">Configurar Asignaciones Granulares</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Operador: <span className="text-white font-semibold">{selectedUserForPermissions.nombre}</span> · Rol: <span className="text-primary font-semibold">{selectedUserForPermissions.rol}</span>
                </p>
              </div>
              <button 
                onClick={() => setSelectedUserForPermissions(null)}
                className="text-muted-foreground hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body Scrollable */}
            <div className="p-6 overflow-y-auto space-y-6 flex-grow">
              
              {/* Formulario de Nueva Asignación */}
              <div className="bg-slate-900/40 border border-border/80 rounded-xl p-4 space-y-4">
                <h4 className="text-xs font-black uppercase text-primary tracking-wider">Vincular Nueva Asignación</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Rol a asignar */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Rol de Permiso
                    </label>
                    <select
                      value={newRol}
                      onChange={(e) => setNewRol(e.target.value as UserRole)}
                      className="w-full bg-[#080c14] border border-border rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary transition"
                    >
                      {ROLES.filter(r => r !== 'Super Admin' && r !== 'Comprador').map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sala */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Sala (Opcional)
                    </label>
                    <select
                      value={newVenueId}
                      onChange={(e) => {
                        setNewVenueId(e.target.value);
                        // Resetear evento/fecha si cambia la sala
                        setNewEventId('');
                        setNewFecha('');
                      }}
                      className="w-full bg-[#080c14] border border-border rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary transition"
                    >
                      <option value="">Cualquier Sala (Global)</option>
                      {venues.map(v => (
                        <option key={v.id} value={v.id}>{v.nombre} ({v.ciudad})</option>
                      ))}
                    </select>
                  </div>

                  {/* Evento */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Espectáculo (Opcional)
                    </label>
                    <select
                      value={newEventId}
                      onChange={(e) => {
                        setNewEventId(e.target.value);
                        setNewFecha('');
                      }}
                      className="w-full bg-[#080c14] border border-border rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary transition"
                    >
                      <option value="">Cualquier Espectáculo (Global)</option>
                      {events
                        .filter(e => !newVenueId || e.venueId === newVenueId)
                        .map(e => (
                          <option key={e.id} value={e.id}>{e.título}</option>
                        ))
                      }
                    </select>
                  </div>

                  {/* Fecha / Función */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Fecha / Función (Opcional)
                    </label>
                    <select
                      value={newFecha}
                      onChange={(e) => setNewFecha(e.target.value)}
                      disabled={!newEventId}
                      className="w-full bg-[#080c14] border border-border rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary transition disabled:opacity-50"
                    >
                      <option value="">Cualquier Fecha</option>
                      {newEventId && events.find(e => e.id === newEventId)?.fechas.map(f => (
                        <option key={f} value={f}>
                          {new Date(f).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} HS
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddAssignment}
                  className="w-full bg-slate-900 border border-border hover:border-primary/50 hover:bg-slate-800 text-xs font-semibold py-2 rounded-lg transition flex items-center justify-center gap-1.5 text-white"
                >
                  <Plus className="h-4 w-4 text-primary" />
                  <span>Vincular Asignación</span>
                </button>
              </div>

              {/* Listado de Asignaciones Existentes */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-primary tracking-wider">Asignaciones Vinculadas</h4>
                
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {tempAssignments.map((assign) => {
                    const venue = venues.find(v => v.id === assign.venueId);
                    const event = events.find(e => e.id === assign.eventId);
                    
                    return (
                      <div 
                        key={assign.id}
                        className="flex justify-between items-center p-3 rounded-xl border border-border bg-[#090d16] text-xs hover:border-border/80 transition"
                      >
                        <div className="space-y-1.5 min-w-0 flex-grow">
                          <span className="inline-block bg-primary/20 text-primary text-[9px] font-bold uppercase px-2 py-0.5 rounded-full">
                            {assign.rol}
                          </span>
                          
                          <div className="text-[10px] text-muted-foreground space-y-0.5">
                            {assign.venueId && (
                              <p><span className="text-white font-medium">Sala:</span> {venue?.nombre || assign.venueId}</p>
                            )}
                            {assign.eventId && (
                              <p><span className="text-white font-medium">Espectáculo:</span> {event?.título || assign.eventId}</p>
                            )}
                            {assign.fecha && (
                              <p>
                                <span className="text-white font-medium">Función:</span>{' '}
                                {new Date(assign.fecha).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} HS
                              </p>
                            )}
                            {!assign.venueId && !assign.eventId && !assign.fecha && (
                              <p className="text-emerald-500 italic">Acceso Global sin restricciones de sala/evento</p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveAssignment(assign.id)}
                          className="text-primary hover:bg-primary/10 p-2 rounded transition cursor-pointer shrink-0 ml-3"
                          title="Remover asignación"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}

                  {tempAssignments.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      No hay asignaciones granulares vinculadas. El usuario usará su rol base de comprador.
                    </p>
                  )}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-5 border-t border-border bg-black/20 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedUserForPermissions(null)}
                className="bg-slate-900 border border-border hover:bg-slate-800 text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer text-white"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={isSaving}
                className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>Guardar Cambios</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
