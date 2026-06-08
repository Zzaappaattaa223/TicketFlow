import { LocalDbService } from './localDb';
import { SupabaseDbService } from './supabaseDbService';
import { supabase } from './supabaseClient';
import { IDbService } from './dbService';

export const dbService: IDbService = supabase 
  ? new SupabaseDbService() 
  : new LocalDbService();

// Inicializar base de datos con datos semilla si es necesario
if (typeof window === 'undefined') {
  dbService.seedDb().catch(error => {
    console.error('Error al inicializar los datos semilla en la base de datos:', error);
  });
}
