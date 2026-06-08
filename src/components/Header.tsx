'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { loginAction, registerAction } from '@/app/actions';
import { supabase } from '@/lib/supabase/supabaseClient';
import { Ticket, User, ShoppingCart, LogOut, Shield, CheckCircle, Clock } from 'lucide-react';

export default function Header() {
  const pathname = usePathname();
  const { currentUser, cart, cartTimeLeft, refreshUser, logout } = useApp();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);

    if (supabase) {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`
          }
        });
        if (error) {
          setError(error.message);
          setIsLoading(false);
        }
      } catch (err: any) {
        setError(err.message || 'Error al iniciar sesión con Google');
        setIsLoading(false);
      }
    } else {
      setError('Autenticación con Google no configurada en el cliente.');
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email) {
      setError('El correo electrónico es requerido.');
      setIsLoading(false);
      return;
    }

    try {
      if (isRegister) {
        if (!nombre) {
          setError('El nombre es requerido.');
          setIsLoading(false);
          return;
        }
        const res = await registerAction(nombre, email);
        if (res.success) {
          await refreshUser();
          setShowAuthModal(false);
          setEmail('');
          setNombre('');
        } else {
          setError(res.error || 'Ocurrió un error');
        }
      } else {
        const res = await loginAction(email);
        if (res.success) {
          await refreshUser();
          setShowAuthModal(false);
          setEmail('');
        } else {
          setError(res.error || 'Ocurrió un error');
        }
      }
    } catch (err) {
      setError('Ocurrió un error inesperado');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <Ticket className="h-7 w-7 text-primary transform group-hover:rotate-12 transition-transform duration-300" />
            <span className="text-xl font-bold tracking-tight text-gradient-primary">TicketFlow</span>
          </Link>

          {/* Navegación central */}
          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium">
            <Link 
              href="/" 
              className={`transition-colors duration-200 ${pathname === '/' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Cartelera
            </Link>
            {currentUser && (
              <Link 
                href="/mis-entradas" 
                className={`transition-colors duration-200 ${pathname === '/mis-entradas' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Mis Entradas
              </Link>
            )}
            {currentUser?.rol === 'Controlador de Acceso' && (
              <Link 
                href="/scanner" 
                className="flex items-center text-accent hover:text-accent-hover transition-colors"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Escanear Entradas
              </Link>
            )}
            {(currentUser?.rol === 'Super Admin' || currentUser?.rol === 'Productor' || currentUser?.rol === 'Boletería') && (
              <Link 
                href="/admin" 
                className="flex items-center text-accent hover:text-accent-hover transition-colors"
              >
                <Shield className="h-4 w-4 mr-1" />
                Panel Admin
              </Link>
            )}
          </nav>

          {/* Botones de acción derecha */}
          <div className="flex items-center space-x-4">
            {/* Temporizador de Lock / Carrito */}
            {cart && (
              <Link 
                href="/checkout" 
                className="flex items-center space-x-2 bg-primary/15 border border-primary/30 text-primary px-3 py-1.5 rounded-full text-xs font-semibold animate-pulse hover:bg-primary/25 transition"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>Checkout ({cart.cantidad})</span>
                <span className="flex items-center border-l border-primary/30 pl-2 ml-1 text-foreground font-mono">
                  <Clock className="h-3 w-3 mr-1 text-primary" />
                  {formatTime(cartTimeLeft)}
                </span>
              </Link>
            )}

            {/* Usuario / Login */}
            {currentUser ? (
              <div className="flex items-center space-x-4">
                <div className="hidden lg:flex flex-col text-right">
                  <span className="text-sm font-semibold text-foreground leading-tight">{currentUser.nombre}</span>
                  <span className="text-xs text-muted-foreground">{currentUser.rol}</span>
                </div>
                <button 
                  onClick={logout}
                  className="flex items-center justify-center p-2 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10 text-muted-foreground hover:text-primary transition-all duration-200"
                  title="Cerrar sesión"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => {
                  setError('');
                  setIsRegister(false);
                  setShowAuthModal(true);
                }}
                className="glow-button bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg transition-colors duration-300"
              >
                Iniciar Sesión
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Modal de Autenticación */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0d1426] border border-border rounded-xl shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground text-xl font-bold"
            >
              &times;
            </button>
            <h2 className="text-2xl font-bold mb-2 text-gradient-primary">
              {isRegister ? 'Crear una Cuenta' : 'Iniciar Sesión'}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {isRegister 
                ? 'Regístrate para comprar y ver tus entradas.' 
                : 'Accede a tu cuenta para continuar con la compra.'}
            </p>

            <form onSubmit={handleAuth} className="space-y-4">
              {isRegister && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Nombre Completo
                  </label>
                  <input 
                    type="text" 
                    placeholder="Juan Pérez" 
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full bg-slate-900 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Correo Electrónico
                </label>
                <input 
                  type="email" 
                  placeholder="juan.perez@ejemplo.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition"
                />
              </div>

              {error && (
                <div className="text-xs text-primary bg-primary/10 border border-primary/20 rounded-md p-3">
                  {error}
                </div>
              )}

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-primary-foreground font-semibold py-2.5 rounded-lg transition"
              >
                {isLoading ? 'Cargando...' : isRegister ? 'Registrarse' : 'Ingresar'}
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-border/50"></div>
                <span className="flex-shrink mx-3 text-[9px] text-muted-foreground uppercase font-bold tracking-wider">O continuar con</span>
                <div className="flex-grow border-t border-border/50"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full bg-[#141d2f] hover:bg-[#1a253b] border border-border text-foreground font-semibold py-2.5 rounded-lg transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21.35,11.1H12v2.7h5.38C16.88,15.22,14.77,16.5,12,16.5c-3.04,0-5.6-2.06-6.52-4.83a7.48,7.48,0,0,1,0-3.34C6.4,5.56,8.96,3.5,12,3.5a7,7,0,0,1,4.95,1.95l2-2A9.9,9.9,0,0,0,12,1C6.48,1,2,5.48,2,11s4.48,10,10,10c5.78,0,10-4.06,10-10A8.93,8.93,0,0,0,21.35,11.1Z" fill="#ff4a5a"/>
                </svg>
                <span className="text-xs">Google / Gmail</span>
              </button>
            </form>

            {/* Alternar Modal */}
            <div className="mt-6 pt-6 border-t border-border/50 text-center text-sm">
              <span className="text-muted-foreground">
                {isRegister ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta?'}
              </span>{' '}
              <button 
                onClick={() => {
                  setError('');
                  setIsRegister(!isRegister);
                }}
                className="text-primary hover:underline font-semibold"
              >
                {isRegister ? 'Ingresa aquí' : 'Regístrate aquí'}
              </button>
            </div>
            
            {/* Cuentas de prueba rápidas */}
            {!isRegister && (
              <div className="mt-4 p-3 bg-white/5 border border-white/5 rounded-lg text-xs space-y-1">
                <p className="font-semibold text-muted-foreground">Cuentas de prueba disponibles:</p>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => setEmail('admin@ticketflow.com')}
                    className="bg-accent/20 hover:bg-accent/30 text-accent px-2 py-0.5 rounded transition"
                  >
                    Super Admin
                  </button>
                  <button 
                    onClick={() => setEmail('portero@ticketflow.com')}
                    className="bg-accent/20 hover:bg-accent/30 text-accent px-2 py-0.5 rounded transition"
                  >
                    Controlador
                  </button>
                </div>
              </div>
            )}
          </div>
   
        </div>
      )}
    </>
  );
}
