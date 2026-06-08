'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/supabaseClient';
import { loginWithGoogleAction } from '@/app/actions';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setError('El servicio de autenticación no está configurado.');
      return;
    }

    // Escuchar el cambio de estado de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const email = session.user.email;
        const name = 
          session.user.user_metadata?.full_name || 
          session.user.user_metadata?.name || 
          email?.split('@')[0] || 
          'Usuario de Google';

        if (email) {
          try {
            const res = await loginWithGoogleAction(email, name);
            if (res.success) {
              router.push('/');
            } else {
              setError(res.error || 'No se pudo sincronizar la sesión en el servidor.');
            }
          } catch (err: any) {
            setError(err.message || 'Error de comunicación con el servidor de base de datos.');
          }
        } else {
          setError('No se pudo recuperar el correo electrónico de la cuenta de Google.');
        }
      } else if (event === 'INITIAL_SESSION' && !session) {
        // Si finalizó de cargar la sesión inicial y no hay usuario, redirigir al inicio
        // después de una breve espera para evitar falsos positivos
        const timer = setTimeout(() => {
          router.push('/');
        }, 3000);
        return () => clearTimeout(timer);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#060b18] text-foreground p-6">
      <div className="w-full max-w-md bg-[#0d1426]/85 backdrop-blur-md border border-border/80 rounded-2xl p-8 shadow-2xl text-center space-y-6 flex flex-col items-center">
        {error ? (
          <>
            <div className="h-16 w-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 text-2xl font-bold">
              !
            </div>
            <h1 className="text-xl font-bold text-gradient-primary">Error de Autenticación</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 w-full bg-primary hover:bg-primary-hover text-primary-foreground font-semibold py-2.5 rounded-lg text-sm transition-colors duration-200"
            >
              Volver a la cartelera
            </button>
          </>
        ) : (
          <>
            {/* Spinner animado Premium */}
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
            </div>
            <h1 className="text-xl font-bold text-gradient-primary">Iniciando sesión...</h1>
            <p className="text-sm text-muted-foreground">
              Espere un momento mientras verificamos su cuenta de Google.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
