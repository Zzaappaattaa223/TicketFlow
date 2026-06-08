'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Event, Zone } from '@/types';
import { 
  getCurrentUserAction, 
  logoutAction, 
  lockZoneCapacityAction, 
  unlockZoneCapacityAction,
  lockSeatsAction,
  unlockSeatsAction
} from '@/app/actions';

interface CartItem {
  event: Event;
  fecha: string;
  zone?: Zone; // Opcional para numerado
  cantidad: number;
  subtotal: number;
  cargoServicio: number;
  total: number;
  seats?: { id: string; fila: string; número: number; zona: string; precio: number }[]; // Opcional para libre
}

interface AppContextType {
  currentUser: User | null;
  sessionId: string;
  cart: CartItem | null;
  cartTimeLeft: number; // en segundos (máx 600 = 10 min)
  isLoadingUser: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  addToCart: (event: Event, fecha: string, zone: Zone, cantidad: number) => Promise<boolean>;
  addToCartNumerado: (
    event: Event, 
    fecha: string, 
    selectedSeats: { id: string; fila: string; número: number; zona: string; precio: number }[]
  ) => Promise<boolean>;
  updateCartQuantity: (cantidad: number) => Promise<boolean>;
  clearCart: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [cart, setCart] = useState<CartItem | null>(null);
  const [cartTimeLeft, setCartTimeLeft] = useState<number>(0);
  const [isLoadingUser, setIsLoadingUser] = useState<boolean>(true);

  // Inicializar sessionId y cargar usuario actual
  useEffect(() => {
    let sid = localStorage.getItem('ticketflow_session_id');
    if (!sid) {
      sid = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('ticketflow_session_id', sid);
    }
    setSessionId(sid);

    // Recuperar carrito local si existe
    const cachedCart = localStorage.getItem('ticketflow_cart');
    const cachedExpires = localStorage.getItem('ticketflow_cart_expires');

    if (cachedCart && cachedExpires) {
      const expiresAt = new Date(cachedExpires).getTime();
      const now = new Date().getTime();
      if (now < expiresAt) {
        setCart(JSON.parse(cachedCart));
        setCartTimeLeft(Math.floor((expiresAt - now) / 1000));
      } else {
        localStorage.removeItem('ticketflow_cart');
        localStorage.removeItem('ticketflow_cart_expires');
      }
    }

    refreshUser();
  }, []);

  // Cargar/Actualizar usuario actual desde las cookies del servidor
  const refreshUser = async () => {
    setIsLoadingUser(true);
    try {
      const user = await getCurrentUserAction();
      setCurrentUser(user);
    } catch (e) {
      console.error('Error cargando usuario:', e);
    } finally {
      setIsLoadingUser(false);
    }
  };

  const logout = async () => {
    await logoutAction();
    setCurrentUser(null);
  };

  // Manejar el temporizador del carrito (lock)
  useEffect(() => {
    if (cartTimeLeft <= 0) {
      if (cart) {
        // Expirar el carrito
        handleCartExpiration();
      }
      return;
    }

    const timer = setInterval(() => {
      setCartTimeLeft(prev => {
        const nextValue = prev - 1;
        if (nextValue <= 0) {
          clearInterval(timer);
          return 0;
        }
        return nextValue;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cartTimeLeft, cart]);

  const handleCartExpiration = async () => {
    if (cart) {
      console.log('El tiempo del carrito expiró. Liberando bloqueos...');
      if (cart.seats) {
        await unlockSeatsAction(cart.event.id, cart.fecha, cart.seats.map(s => s.id), sessionId);
      } else if (cart.zone) {
        await unlockZoneCapacityAction(cart.event.id, cart.fecha, cart.zone.id, sessionId);
      }
      setCart(null);
      setCartTimeLeft(0);
      localStorage.removeItem('ticketflow_cart');
      localStorage.removeItem('ticketflow_cart_expires');
      alert('Tu reserva temporal de 10 minutos ha expirado. Las entradas se han liberado.');
    }
  };

  const addToCart = async (event: Event, fecha: string, zone: Zone, cantidad: number): Promise<boolean> => {
    if (!sessionId) return false;

    // Intentar adquirir el bloqueo en el servidor
    const success = await lockZoneCapacityAction(event.id, fecha, zone.id, cantidad, sessionId);
    if (!success) return false;

    // Calcular costos
    const subtotal = zone.precio * cantidad;
    let cargoServicio = 0;
    if (event.tipoCargo === 'porcentaje') {
      cargoServicio = (subtotal * event.cargoServicio) / 100;
    } else {
      cargoServicio = event.cargoServicio * cantidad;
    }
    const total = subtotal + cargoServicio;

    const newCartItem: CartItem = {
      event,
      fecha,
      zone,
      cantidad,
      subtotal,
      cargoServicio,
      total
    };

    setCart(newCartItem);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
    setCartTimeLeft(600);

    localStorage.setItem('ticketflow_cart', JSON.stringify(newCartItem));
    localStorage.setItem('ticketflow_cart_expires', expiresAt.toISOString());

    return true;
  };

  const addToCartNumerado = async (
    event: Event, 
    fecha: string, 
    selectedSeats: { id: string; fila: string; número: number; zona: string; precio: number }[]
  ): Promise<boolean> => {
    if (!sessionId || selectedSeats.length === 0) return false;

    // Liberar cualquier carrito previo antes de bloquear nuevos
    await clearCart();

    const seatIds = selectedSeats.map(s => s.id);
    const success = await lockSeatsAction(event.id, fecha, seatIds, sessionId);
    if (!success) return false;

    // Calcular costos
    const subtotal = selectedSeats.reduce((sum, s) => sum + s.precio, 0);
    let cargoServicio = 0;
    if (event.tipoCargo === 'porcentaje') {
      cargoServicio = (subtotal * event.cargoServicio) / 100;
    } else {
      cargoServicio = event.cargoServicio * selectedSeats.length;
    }
    const total = subtotal + cargoServicio;

    const newCartItem: CartItem = {
      event,
      fecha,
      cantidad: selectedSeats.length,
      subtotal,
      cargoServicio,
      total,
      seats: selectedSeats
    };

    setCart(newCartItem);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
    setCartTimeLeft(600);

    localStorage.setItem('ticketflow_cart', JSON.stringify(newCartItem));
    localStorage.setItem('ticketflow_cart_expires', expiresAt.toISOString());

    return true;
  };

  const updateCartQuantity = async (cantidad: number): Promise<boolean> => {
    // Para numerado, la cantidad se controla seleccionando/deseleccionando en el mapa, no por stepper
    if (!cart || cart.seats || !sessionId) return false;
    if (!cart.zone) return false;

    if (cantidad <= 0) {
      await clearCart();
      return true;
    }

    // Intentar cambiar el bloqueo
    const success = await lockZoneCapacityAction(cart.event.id, cart.fecha, cart.zone.id, cantidad, sessionId);
    if (!success) return false;

    const subtotal = cart.zone.precio * cantidad;
    let cargoServicio = 0;
    if (cart.event.tipoCargo === 'porcentaje') {
      cargoServicio = (subtotal * cart.event.cargoServicio) / 100;
    } else {
      cargoServicio = cart.event.cargoServicio * cantidad;
    }
    const total = subtotal + cargoServicio;

    const updatedCart: CartItem = {
      ...cart,
      cantidad,
      subtotal,
      cargoServicio,
      total
    };

    setCart(updatedCart);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    setCartTimeLeft(600);

    localStorage.setItem('ticketflow_cart', JSON.stringify(updatedCart));
    localStorage.setItem('ticketflow_cart_expires', expiresAt.toISOString());

    return true;
  };

  const clearCart = async () => {
    if (cart && sessionId) {
      if (cart.seats) {
        await unlockSeatsAction(cart.event.id, cart.fecha, cart.seats.map(s => s.id), sessionId);
      } else if (cart.zone) {
        await unlockZoneCapacityAction(cart.event.id, cart.fecha, cart.zone.id, sessionId);
      }
    }
    setCart(null);
    setCartTimeLeft(0);
    localStorage.removeItem('ticketflow_cart');
    localStorage.removeItem('ticketflow_cart_expires');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        sessionId,
        cart,
        cartTimeLeft,
        isLoadingUser,
        refreshUser,
        logout,
        addToCart,
        addToCartNumerado,
        updateCartQuantity,
        clearCart
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp debe usarse dentro de un AppProvider');
  }
  return context;
}
