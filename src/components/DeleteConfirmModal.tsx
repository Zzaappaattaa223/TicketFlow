'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, RefreshCw, Loader2, Trash2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  itemName: string;
  type: 'sala' | 'espectáculo';
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  type
}: DeleteConfirmModalProps) {
  const [captcha, setCaptcha] = useState('');
  const [userInput, setUserInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Generar un código captcha de 6 caracteres alfanuméricos
  const generateCaptcha = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Evitamos O, 0, I, 1 por legibilidad
    let code = '';
    for (let i = 0; i < 6; i++) {
      if (i === 3) code += '-';
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptcha(code);
    setUserInput('');
    setErrorMessage('');
  };

  useEffect(() => {
    if (isOpen) {
      generateCaptcha();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userInput.toUpperCase() !== captcha) {
      setErrorMessage('El código captcha ingresado es incorrecto.');
      return;
    }

    setIsDeleting(true);
    setErrorMessage('');
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Ocurrió un error al intentar eliminar el registro.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0b0f19] border border-primary/20 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
        
        {/* Cabecera / Botón Cerrar */}
        <button 
          onClick={onClose}
          disabled={isDeleting}
          className="absolute top-4 right-4 text-muted-foreground hover:text-white transition cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 space-y-5">
          {/* Ícono y Título de Advertencia */}
          <div className="flex items-center space-x-3 text-primary">
            <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-5.5 w-5.5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">{title}</h3>
              <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Acción Crítica</p>
            </div>
          </div>

          {/* Mensaje Informativo */}
          <div className="space-y-2 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              Estás por eliminar permanentemente {type === 'sala' ? 'la sala' : 'el espectáculo'}{' '}
              <span className="font-extrabold text-white">"{itemName}"</span> de la base de datos de TicketFlow.
            </p>
            <p className="text-primary/90 font-semibold flex items-center gap-1.5 bg-primary/5 p-2.5 rounded-lg border border-primary/10">
              <span>⚠️</span>
              <span>Esta acción es irreversible y podría causar inconsistencias si existen registros de órdenes.</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Sección Captcha */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Confirmación de Seguridad
                </label>
                <button
                  type="button"
                  onClick={generateCaptcha}
                  disabled={isDeleting}
                  className="text-[10px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Nuevo Captcha</span>
                </button>
              </div>

              {/* Caja visual del captcha */}
              <div className="bg-slate-900 border border-border rounded-xl p-3 flex justify-center items-center select-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-900 relative overflow-hidden">
                {/* Rayas de interferencia del captcha */}
                <div className="absolute inset-0 opacity-10 bg-[linear-gradient(45deg,#fff_25%,transparent_25%,transparent_50%,#fff_50%,#fff_75%,transparent_75%,transparent)] bg-[size:20px_20px]" />
                <span className="text-xl font-black font-mono tracking-widest text-primary italic drop-shadow-md relative z-10">
                  {captcha}
                </span>
              </div>
            </div>

            {/* Input del captcha */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Escribe el código mostrado arriba
              </label>
              <input 
                type="text"
                placeholder="Ingresar captcha"
                required
                disabled={isDeleting}
                value={userInput}
                onChange={(e) => {
                  setUserInput(e.target.value);
                  setErrorMessage('');
                }}
                className="w-full bg-slate-950 border border-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary font-mono uppercase text-center focus:ring-1 focus:ring-primary/30 transition"
              />
            </div>

            {errorMessage && (
              <div className="text-xs text-primary bg-primary/10 border border-primary/20 rounded-lg p-3 leading-relaxed">
                {errorMessage}
              </div>
            )}

            {/* Acciones */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="flex-grow bg-slate-900 border border-border hover:bg-slate-800 text-xs font-bold py-2.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-center text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isDeleting || userInput.toUpperCase() !== captcha}
                className="flex-grow bg-primary hover:bg-primary-hover disabled:bg-primary/20 disabled:text-white/40 text-white text-xs font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Confirmar Borrado</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
