import React from 'react';
import Link from 'next/link';
import { Ticket } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full bg-[#03060c] border-t border-border mt-auto py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between space-y-6 md:space-y-0">
          {/* Info izquierda */}
          <div className="flex flex-col items-center md:items-start space-y-2">
            <Link href="/" className="flex items-center space-x-2">
              <Ticket className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold tracking-tight text-gradient-primary">TicketFlow</span>
            </Link>
            <p className="text-xs text-muted-foreground text-center md:text-left max-w-md">
              Plataforma integral de venta y validación de entradas premium para espectáculos y teatros en vivo.
            </p>
          </div>

          {/* Enlaces y Copyright */}
          <div className="flex flex-col items-center md:items-end space-y-2 text-xs text-muted-foreground">
            <div className="flex space-x-4 mb-2">
              <Link href="/" className="hover:text-foreground transition">Cartelera</Link>
              <Link href="/scanner" className="hover:text-foreground transition">Portería / Scanner</Link>
              <Link href="/admin" className="hover:text-foreground transition">Administración</Link>
            </div>
            <p>© 2026 TicketFlow. Desarrollado con tecnología de punta en Google Antigravity IDE.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
