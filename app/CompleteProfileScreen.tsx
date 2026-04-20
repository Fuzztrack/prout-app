import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import * as Notifications from 'expo-notifications';
import { CustomButton } from '../components/CustomButton';
import { logSignOutIntent } from '../lib/authDebug';
import { buildAcceptedEulaMetadata } from '../lib/eula';
import { normalizePhone } from '../lib/normalizePhone';
import { registerPushTokenForUser, clearCurrentUserPushToken } from '../lib/pushTokenRegistration';
import { safePush, safeReplace } from '../lib/navigation';
import { supabase } from '../lib/supabase';
import i18n from '../lib/i18n';

export default function CompleteProfileScreen() {
  const router = useRouter();
  const [pseudo, setPseudo] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (user) {
        setUserId(user.id);
        
        // Préremplir le pseudo depuis les métadonnées si disponible
        const pseudoFromMetadata = user.user_metadata?.pseudo;
        const phoneFromMetadata = user.user_metadata?.phone;
        
        if (pseudoFromMetadata && pseudoFromMetadata !== 'Nouveau Membre') {
          setPseudo(pseudoFromMetadata);
        }
        
        if (phoneFromMetadata) {
          setPhone(phoneFromMetadata);
        }
      } else {
        safeReplace(router, '/AuthChoiceScreen', { skipInitialCheck: false });
      }
    };

    getUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async () => {
    if (!pseudo.trim()) return Alert.alert(i18n.t('error'), i18n.t('choose_pseudo'));
    
    // Vérifier les permissions de notification avant de sauvegarder
    // Si elles sont indéterminées, on tente de les demander une dernière fois
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'undetermined') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (__DEV__) console.log('🔔 [CompleteProfile] Nouvelles permissions:', newStatus);
      }
    } catch (e) {
      console.warn('⚠️ [CompleteProfile] Erreur check permissions:', e);
    }

    setLoading(true);

    try {
      if (!userId) throw new Error(i18n.t('cannot_identify_account'));
      const { data: { user } } = await supabase.auth.getUser();

      // Normaliser le téléphone si fourni (non obligatoire)
      const normalizedPhone = phone.trim() ? normalizePhone(phone.trim()) : null;

      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          pseudo: pseudo.trim(),
          phone: normalizedPhone,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      // ✅ TENTATIVE D'ENREGISTREMENT DU TOKEN PUSH APRÈS CRÉATION DU PROFIL
      // On attend un tout petit peu pour s'assurer que le profil est bien propagé dans Supabase
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        await registerPushTokenForUser(userId);
      } catch (tokenError) {
        console.warn('⚠️ Erreur enregistrement token push lors de la finalisation:', tokenError);
      }

      try {
        await supabase.auth.updateUser({
          data: buildAcceptedEulaMetadata({
            ...(user?.user_metadata ?? {}),
            pseudo: pseudo.trim(),
            pseudo_validated: true,
          }),
        });
      } catch (metaError) {
        console.warn('⚠️ Impossible de mettre à jour les métadonnées pseudo:', metaError);
      }

      safeReplace(router, '/', { skipInitialCheck: false });

    } catch (e: any) {
      if (
        e?.code === '23505' ||
        e?.message?.toLowerCase().includes('unique') ||
        e?.message?.toLowerCase().includes('already used') ||
        e?.message?.toLowerCase().includes('duplicate')
      ) {
        Alert.alert(i18n.t('error'), i18n.t('pseudo_already_used'));
      } else {
        Alert.alert(i18n.t('error'), e.message || i18n.t('error_occurred'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
        await logSignOutIntent('CompleteProfileScreen:logout', () => supabase.auth.getUser());
        await clearCurrentUserPushToken();
        await supabase.auth.signOut();
    } catch (e) {
        console.log("Erreur déconnexion:", e);
    }
    safeReplace(router, '/AuthChoiceScreen', { skipInitialCheck: false });
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => safePush(router, '/(tabs)', { skipInitialCheck: false })} activeOpacity={0.7}>
          <Image source={require('../assets/images/proot.png')} style={styles.image} resizeMode="contain" />
        </TouchableOpacity>
        
        <Text style={styles.title}>{i18n.t('complete_profile_title')}</Text>
        <Text style={styles.subtitle}>
            {i18n.t('complete_profile_subtitle')}
        </Text>
        
        <TextInput 
            value={pseudo} 
            onChangeText={setPseudo} 
            style={styles.input} 
            placeholder={i18n.t('complete_profile_pseudo_placeholder')}
            placeholderTextColor="#604a3e"
            autoCapitalize="none"
            keyboardAppearance="light"
        />

        <TextInput 
            value={phone} 
            onChangeText={setPhone} 
            style={styles.input} 
            placeholder={i18n.t('phone_placeholder')} 
            placeholderTextColor="#604a3e"
            keyboardType="phone-pad"
            autoCapitalize="none"
            keyboardAppearance="light"
        />

        <CustomButton 
            title={loading ? i18n.t('complete_profile_saving') : i18n.t('complete_profile_cta')}
            onPress={handleSave} 
            disabled={loading || !userId}
            color="#604a3e"
            textColor="#ebb89b"
        />

        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>{i18n.t('cancel_and_logout')}</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ebb89b' },
  scrollContent: { flexGrow: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  image: { width: 180, height: 140, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#604a3e', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#604a3e', textAlign: 'center', marginBottom: 30, paddingHorizontal: 20 },
  input: { backgroundColor: 'white', color: '#000000', borderRadius: 8, padding: 15, marginBottom: 20, width: '100%', fontSize: 18, textAlign: 'center' },
  logoutButton: { marginTop: 30, padding: 10 },
  logoutText: { color: '#604a3e', textDecorationLine: 'underline' }
});
