import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from "@supabase/supabase-js";
import { Platform } from 'react-native';

// ⚠️ SECURITE: Utiliser UNIQUEMENT les variables d'environnement
// Ne jamais hardcoder de clés dans le code source
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://utfwujyymaikraaigvuv.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY must be defined in environment variables. Please set it in your .env file or EAS secrets.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: 'supabase.auth.token.v2', // Clé personnalisée pour éviter les conflits
  },
});

export const getRedirectUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  // iOS + Android utilisent désormais le scheme Proot!.
  const scheme = 'prootapp';
  return `${scheme}://confirm-email`;
};
