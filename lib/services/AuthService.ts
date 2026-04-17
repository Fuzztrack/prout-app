import { supabase } from '@/lib/supabase';
import i18n, { updateLocale } from '@/lib/i18n';

export const saveLocaleToSupabase = async () => {
  try {
    const detectedLocale = updateLocale();
    const currentLocale = i18n.locale || detectedLocale || 'en';
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Vérifier si le profil existe
    const { data: existingProfile, error: checkError } = await supabase
      .from('user_profiles')
      .select('id, locale')
      .eq('id', user.id)
      .maybeSingle();
    
    if (checkError) {
      console.error(`❌ [AuthService] Erreur vérification profil:`, checkError.message);
      return;
    }
    
    if (!existingProfile) {
      console.warn(`⚠️ [AuthService] Profil non trouvé pour ${user.id}`);
      return;
    }

    // Mettre à jour la locale
    const { error } = await supabase
      .from('user_profiles')
      .update({ locale: currentLocale })
      .eq('id', user.id);
    
    if (error) {
      console.error(`❌ [AuthService] Erreur mise à jour locale:`, error.message);
    }
  } catch (error: any) {
    console.error('❌ [AuthService] Exception saveLocale:', error?.message || error);
  }
};
