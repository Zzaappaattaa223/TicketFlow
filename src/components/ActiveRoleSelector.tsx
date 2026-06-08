'use client';

import React, { useTransition } from 'react';
import { setActiveRoleAssignmentAction } from '@/app/actions';
import { Loader2, ShieldCheck } from 'lucide-react';

interface ActiveRoleSelectorProps {
  options: { id: string; label: string }[];
  activeId: string;
}

export default function ActiveRoleSelector({ options, activeId }: ActiveRoleSelectorProps) {
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    startTransition(async () => {
      await setActiveRoleAssignmentAction(val);
      // Recargar la página para limpiar cachés y re-renderizar todos los componentes del servidor
      window.location.reload();
    });
  };

  if (options.length <= 1) {
    // Si no tiene asignaciones múltiples, mostrar la única que tiene de forma estática o nada
    return null;
  }

  return (
    <div className="mt-2.5 px-1 relative">
      <div className="flex items-center space-x-1 text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">
        <ShieldCheck className="h-3 w-3 text-primary shrink-0" />
        <span>Espacio de Trabajo</span>
      </div>

      <div className="relative">
        <select
          value={activeId}
          onChange={handleChange}
          disabled={isPending}
          className="w-full bg-[#090d16] border border-border/80 hover:border-primary/50 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition cursor-pointer disabled:opacity-50 appearance-none pr-8"
        >
          {options.map((opt) => (
            <option key={opt.id} value={opt.id} className="bg-[#0b0f19]">
              {opt.label}
            </option>
          ))}
        </select>
        
        {/* Spinner o Flecha */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-muted-foreground">
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
