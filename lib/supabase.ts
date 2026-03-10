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
    // 🛑 MODIFICATION ICI : On met false pour gérer le token manuellement sur mobile
    detectSessionInUrl: false,
  },
});

export const getRedirectUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  // iOS : app Proot! (com.prrt.app) avec scheme prootapp. Android : scheme proutapp inchangé.
  const scheme = Platform.OS === 'ios' ? 'prootapp' : 'proutapp';
  return `${scheme}://confirm-email`;
};
