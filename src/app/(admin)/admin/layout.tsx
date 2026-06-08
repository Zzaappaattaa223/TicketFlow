import React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Shield, LayoutDashboard, MapPin, Calendar, Users, LogOut, Ticket, TrendingUp, ShoppingBag } from 'lucide-react';
import { getActiveRoleAndPermissions } from '@/app/actions';
import { dbService } from '@db/index';
import { cookies } from 'next/headers';
import ActiveRoleSelector from '@/components/ActiveRoleSelector';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const revalidate = 0;

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const permissions = await getActiveRoleAndPermissions();
  const { rol, user } = permissions;

  // Bloquear accesos si no tiene un rol administrativo activo
  if (!user || (rol !== 'Super Admin' && rol !== 'Productor' && rol !== 'Boletería' && rol !== 'Admin de Sala' && rol !== 'Controlador de Acceso')) {
    redirect('/');
  }

  // Resolver nombres de salas y espectáculos para mostrarlos estéticamente en el selector
  const options = [{ id: '', label: `${user.rol} (Principal)` }];
  if (user.roleAssignments && user.roleAssignments.length > 0) {
    for (const assign of user.roleAssignments) {
      let suffix = 'Global';
      if (assign.venueId) {
        const v = await dbService.getVenueById(assign.venueId);
        if (v) suffix = v.nombre;
      } else if (assign.eventId) {
        const e = await dbService.getEventById(assign.eventId);
        if (e) {
          if (assign.fecha) {
            suffix = `${e.título} (${new Date(assign.fecha).toLocaleDateString('es-AR')})`;
          } else {
            suffix = e.título;
          }
        }
      }
      options.push({
        id: assign.id,
        label: `${assign.rol} — ${suffix}`
      });
    }
  }

  const cookieStore = await cookies();
  const activeId = cookieStore.get('ticketflow_active_assignment')?.value || '';

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar Fijo */}
      <aside className="w-64 bg-[#03060c] border-r border-border flex flex-col shrink-0">
        {/* Cabecera Logo */}
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link href="/" className="flex items-center space-x-2">
            <Ticket className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold tracking-tight text-gradient-primary">TicketFlow Admin</span>
          </Link>
        </div>

        {/* Perfil Operador */}
        <div className="p-4 border-b border-border/60 bg-white/2 bg-slate-900/10">
          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Usuario Conectado</p>
          <p className="text-sm font-bold text-white mt-0.5 truncate">{user.nombre}</p>
          
          <div className="flex flex-col space-y-1 mt-1.5">
            <span className="inline-block bg-primary/20 text-primary text-[9px] font-bold uppercase px-2 py-0.5 rounded-full self-start">
              {rol}
            </span>
            <ActiveRoleSelector options={options} activeId={activeId} />
          </div>
        </div>

        {/* Navegación Sidebar */}
        <nav className="flex-grow p-4 space-y-1">
          <Link 
            href="/admin"
            className="flex items-center space-x-3 px-4 py-3 text-sm font-semibold rounded-lg hover:bg-white/5 hover:text-white transition"
          >
            <LayoutDashboard className="h-4.5 w-4.5 text-primary" />
            <span>Dashboard</span>
          </Link>
          
          {(rol === 'Super Admin' || rol === 'Admin de Sala') && (
            <Link 
              href="/admin/salas"
              className="flex items-center space-x-3 px-4 py-3 text-sm font-semibold rounded-lg hover:bg-white/5 hover:text-white transition"
            >
              <MapPin className="h-4.5 w-4.5 text-primary" />
              <span>Salas</span>
            </Link>
          )}

          {(rol === 'Super Admin' || rol === 'Admin de Sala' || rol === 'Productor') && (
            <Link 
              href="/admin/events"
              className="flex items-center space-x-3 px-4 py-3 text-sm font-semibold rounded-lg hover:bg-white/5 hover:text-white transition"
            >
              <Calendar className="h-4.5 w-4.5 text-primary" />
              <span>Eventos / Funciones</span>
            </Link>
          )}

          {rol === 'Super Admin' && (
            <Link 
              href="/admin/users"
              className="flex items-center space-x-3 px-4 py-3 text-sm font-semibold rounded-lg hover:bg-white/5 hover:text-white transition"
            >
              <Users className="h-4.5 w-4.5 text-primary" />
              <span>Usuarios y Roles</span>
            </Link>
          )}

          {(rol === 'Super Admin' || rol === 'Admin de Sala' || rol === 'Productor') && (
            <Link 
              href="/admin/reports"
              className="flex items-center space-x-3 px-4 py-3 text-sm font-semibold rounded-lg hover:bg-white/5 hover:text-white transition"
            >
              <TrendingUp className="h-4.5 w-4.5 text-primary" />
              <span>Reportes</span>
            </Link>
          )}

          {(rol === 'Super Admin' || rol === 'Admin de Sala' || rol === 'Productor' || rol === 'Boletería') && (
            <Link 
              href="/admin/boleteria"
              className="flex items-center space-x-3 px-4 py-3 text-sm font-semibold rounded-lg hover:bg-white/5 hover:text-white transition"
            >
              <ShoppingBag className="h-4.5 w-4.5 text-primary" />
              <span>Boletería (Venta / Cortesía)</span>
            </Link>
          )}
        </nav>

        {/* Footer Sidebar */}
        <div className="p-4 border-t border-border">
          <Link 
            href="/"
            className="flex items-center space-x-3 px-4 py-2.5 text-xs text-muted-foreground hover:text-primary transition rounded-lg hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" />
            <span>Salir al Sitio Público</span>
          </Link>
        </div>
      </aside>

      {/* Contenedor Contenido */}
      <main className="flex-grow p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8">
          {children}
        </div>
      </main>
    </div>
  );
}
