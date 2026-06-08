import { cookies } from 'next/headers';
import { User, UserRole } from '@/types';
import { dbService } from '@db/index';

export interface IAuthService {
  login(email: string): Promise<User | null>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  register(nombre: string, email: string, rol?: UserRole): Promise<User>;
  getGuestSession(email: string, nombre: string): Promise<User>;
  loginWithGoogle(email: string, nombre: string): Promise<User>;
}

class LocalAuthService implements IAuthService {
  private COOKIE_NAME = 'ticketflow_session';

  async login(email: string): Promise<User | null> {
    const user = await dbService.getUserByEmail(email);
    if (!user) return null;

    const cookieStore = await cookies();
    cookieStore.set(this.COOKIE_NAME, user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 semana
      path: '/'
    });

    return user;
  }

  async logout(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(this.COOKIE_NAME);
  }

  async getCurrentUser(): Promise<User | null> {
    const cookieStore = await cookies();
    const userId = cookieStore.get(this.COOKIE_NAME)?.value;
    if (!userId) return null;

    return await dbService.getUserById(userId);
  }

  async register(nombre: string, email: string, rol: UserRole = 'Comprador'): Promise<User> {
    const user: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email,
      nombre,
      rol,
      createdAt: new Date().toISOString()
    };

    const newUser = await dbService.createUser(user);

    const cookieStore = await cookies();
    cookieStore.set(this.COOKIE_NAME, newUser.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    });

    return newUser;
  }

  async getGuestSession(email: string, nombre: string): Promise<User> {
    // Retorna una sesión temporal que no se persiste
    return {
      id: `guest_${Date.now()}`,
      email,
      nombre,
      rol: 'Comprador',
      createdAt: new Date().toISOString()
    };
  }

  async loginWithGoogle(email: string, nombre: string): Promise<User> {
    let user = await dbService.getUserByEmail(email);
    if (!user) {
      user = await this.register(nombre, email, 'Comprador');
    } else {
      await this.login(email);
    }
    return user;
  }
}

export const authService: IAuthService = new LocalAuthService();
