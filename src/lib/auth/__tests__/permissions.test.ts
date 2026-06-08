import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

// Mock cookies store de forma global para los tests
const cookieStore = new Map<string, string>();

vi.mock('next/headers', () => {
  return {
    cookies: vi.fn(async () => ({
      get: (name: string) => {
        const val = cookieStore.get(name);
        return val ? { value: val } : undefined;
      },
      set: (name: string, value: string) => {
        cookieStore.set(name, value);
      },
      delete: (name: string) => {
        cookieStore.delete(name);
      }
    }))
  };
});

import { authService } from '../index';
import { dbService } from '../../supabase/index';
import { getActiveRoleAndPermissions, setActiveRoleAssignmentAction } from '../../../app/actions';

describe('RBAC Dinámico - getActiveRoleAndPermissions', () => {
  beforeAll(async () => {
    // Asegurarse de que el mock DB esté sembrado con datos
    await dbService.seedDb();
  });

  beforeEach(() => {
    cookieStore.clear();
  });

  it('debe retornar Super Admin sin restricciones para el usuario admin', async () => {
    await authService.login('admin@ticketflow.com');

    const perms = await getActiveRoleAndPermissions();
    expect(perms.rol).toBe('Super Admin');
    expect(perms.isRestricted).toBe(false);
    expect(perms.venueIds).toEqual([]);
    expect(perms.eventIds).toEqual([]);
  });

  it('debe retornar el perfil base si no hay cookie de asignación seleccionada', async () => {
    // staff@ticketflow.com tiene rol base Comprador y varias asignaciones en db-mock
    await authService.login('staff@ticketflow.com');

    const perms = await getActiveRoleAndPermissions();
    expect(perms.rol).toBe('Comprador');
    expect(perms.isRestricted).toBe(true);
    expect(perms.venueIds).toEqual([]);
    expect(perms.eventIds).toEqual([]);
  });

  it('debe resolver la asignación activa de Admin de Sala usando la cookie', async () => {
    await authService.login('staff@ticketflow.com');
    
    // Configurar cookie para la asignación assign_1 (Admin de Sala en Teatro Colón)
    await setActiveRoleAssignmentAction('assign_1');

    const perms = await getActiveRoleAndPermissions();
    expect(perms.rol).toBe('Admin de Sala');
    expect(perms.isRestricted).toBe(true);
    expect(perms.venueIds).toContain('venue_colon');
    expect(perms.eventIds).toEqual([]);
  });

  it('debe resolver la asignación activa de Productor deduciendo el venueId correcto del evento', async () => {
    await authService.login('staff@ticketflow.com');

    // Configurar cookie para assign_3 (Productor de event_soda)
    // El evento event_soda se programa en Teatro Gran Rex (venue_rex)
    await setActiveRoleAssignmentAction('assign_3');

    const perms = await getActiveRoleAndPermissions();
    expect(perms.rol).toBe('Productor');
    expect(perms.isRestricted).toBe(true);
    expect(perms.eventIds).toContain('event_soda');
    expect(perms.venueIds).toContain('venue_rex');
  });

  it('debe retornar al rol base si la cookie apunta a una asignación inexistente', async () => {
    await authService.login('staff@ticketflow.com');
    await setActiveRoleAssignmentAction('assign_no_existe');

    const perms = await getActiveRoleAndPermissions();
    expect(perms.rol).toBe('Comprador');
    expect(perms.isRestricted).toBe(true);
  });
});
