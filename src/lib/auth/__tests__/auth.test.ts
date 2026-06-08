import { vi, describe, it, expect, beforeAll } from 'vitest';

// Mock de next/headers para simular las cookies asíncronas de Next.js 15
vi.mock('next/headers', () => {
  const store = new Map<string, string>();
  return {
    cookies: vi.fn(async () => ({
      get: (name: string) => {
        const val = store.get(name);
        return val ? { value: val } : undefined;
      },
      set: (name: string, value: string) => {
        store.set(name, value);
      },
      delete: (name: string) => {
        store.delete(name);
      }
    }))
  };
});

import fs from 'fs';
import path from 'path';
import { authService } from '../index';
import { dbService } from '@db/index';

describe('AuthService - Autenticación y Sesiones', () => {
  beforeAll(async () => {
    const mockFilePath = path.join(process.cwd(), 'src/lib/supabase/db-mock.json');
    if (fs.existsSync(mockFilePath)) {
      fs.unlinkSync(mockFilePath);
    }
    await dbService.seedDb();
  });

  it('debe registrar un usuario correctamente y establecer la cookie de sesión', async () => {
    const email = 'cliente.nuevo@ticketflow.com';
    const nombre = 'Cliente Nuevo';

    const user = await authService.register(nombre, email, 'Comprador');
    expect(user.email).toBe(email);
    expect(user.nombre).toBe(nombre);
    expect(user.rol).toBe('Comprador');

    // Recuperar usuario actual (debería leer de la cookie simulada)
    const currentUser = await authService.getCurrentUser();
    expect(currentUser).toBeDefined();
    expect(currentUser?.id).toBe(user.id);
  });

  it('debe permitir login con email existente', async () => {
    // El email admin@ticketflow.com fue sembrado en localDb
    const email = 'admin@ticketflow.com';
    const user = await authService.login(email);

    expect(user).toBeDefined();
    expect(user?.email).toBe(email);
    expect(user?.rol).toBe('Super Admin');

    const currentUser = await authService.getCurrentUser();
    expect(currentUser?.id).toBe(user?.id);
  });

  it('debe devolver null al hacer login con email inexistente', async () => {
    const user = await authService.login('inexistente@correo.com');
    expect(user).toBeNull();
  });

  it('debe eliminar la sesión al hacer logout', async () => {
    await authService.login('admin@ticketflow.com');
    let currentUser = await authService.getCurrentUser();
    expect(currentUser).not.toBeNull();

    await authService.logout();
    currentUser = await authService.getCurrentUser();
    expect(currentUser).toBeNull();
  });

  it('debe generar una sesión de invitado válida sin persistencia', async () => {
    const email = 'guest@correo.com';
    const nombre = 'Invitado Sencillo';

    const guestUser = await authService.getGuestSession(email, nombre);
    expect(guestUser.id).toContain('guest_');
    expect(guestUser.email).toBe(email);
    expect(guestUser.nombre).toBe(nombre);
  });
});
