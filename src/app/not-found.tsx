import React from 'react';
import Link from 'next/link';
import { Home, AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#060913] text-[#f8fafc] flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background glowing effects */}
      <div className="absolute top-[20%] left-[20%] w-[400px] h-[400px] bg-[#ff4a5a]/10 rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="absolute bottom-[20%] right-[20%] w-[300px] h-[300px] bg-[#ffb800]/5 rounded-full blur-[80px] pointer-events-none z-0" />

      <div className="z-10 text-center max-w-md mx-auto bg-[rgba(13,20,38,0.45)] backdrop-blur-[12px] p-8 rounded-2xl border border-white/5 shadow-2xl relative">
        {/* Glow accent bar at top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#ff4a5a] to-[#ffb800] rounded-t-2xl" />
        
        <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#ff4a5a]/10 border border-[#ff4a5a]/20 text-[#ff4a5a]">
          <AlertCircle size={36} />
        </div>

        <h1 className="text-6xl font-extrabold tracking-tight mb-2 bg-gradient-to-r from-[#ff4a5a] to-[#ffb800] -webkit-background-clip-text -webkit-text-fill-color-transparent">
          404
        </h1>
        <h2 className="text-xl font-bold mb-4">
          Página no encontrada
        </h2>
        <p className="text-[#94a3b8] mb-8 text-sm leading-relaxed">
          Lo sentimos, la página que buscas no existe o ha sido movida. Si estás intentando acceder a un evento, puede que ya no esté disponible.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="glow-button inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[#ff4a5a] hover:bg-[#e03a49] text-white font-semibold text-sm transition-all shadow-lg shadow-[#ff4a5a]/20"
          >
            <Home className="mr-2" size={16} />
            Volver al Inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
