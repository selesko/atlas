import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};
const supabaseUrl = extra.supabaseUrl || (typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_SUPABASE_URL) || 'https://YOUR_PROJECT.supabase.co';
const supabaseAnonKey = extra.supabaseAnonKey || (typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_SUPABASE_ANON_KEY) || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
