import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Luces de fondo ambientadas (Glows cinematográficos) */}
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[20%] right-[-10%] w-[400px] h-[400px] bg-accent/5 rounded-full blur-[100px] pointer-events-none z-0" />

      {/* Header */}
      <Header />

      {/* Contenido principal */}
      <main className="flex-grow z-10 relative">
        {children}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
