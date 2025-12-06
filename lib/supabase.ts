import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from "@supabase/supabase-js";
import { Platform } from 'react-native';

// Vos clés (je les ai remises ici pour que le copier-coller soit direct)
const supabaseUrl = 'https://utfwujyymaikraaigvuv.supabase.co';
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Znd1anl5bWFpa3JhYWlndnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxODkwNzAsImV4cCI6MjA3ODc2NTA3MH0.d6MLGOsvTlxJDARH64D1u4kJHxKAlfX1FLegrWVE-Is";

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
  // Cela doit correspondre à votre fichier app/confirm-email.tsx
  return 'proutapp://confirm-email';
};
