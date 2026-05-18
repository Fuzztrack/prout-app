// app/Profil.tsx - Page de modification du profil (Full Screen)
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { 
  ActionSheetIOS, 
  ActivityIndicator, 
  Alert, 
  Dimensions, 
  Image, 
  KeyboardAvoidingView, 
  Linking, 
  Platform, 
  Pressable, 
  ScrollView, 
  StyleSheet, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View 
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/lib/store';
import { logSignOutIntent } from '../lib/authDebug';
import i18n from '../lib/i18n';
import { safeReplace } from '../lib/navigation';
import { normalizePhone } from '../lib/normalizePhone';
import { clearCurrentUserPushToken } from '../lib/pushTokenRegistration';
import { supabase, supabaseAnonKey, supabaseUrl } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREVIEW_MAX = Dimensions.get('window').width - 32;
const CACHE_PSEUDO_KEY = 'cached_current_pseudo';
const CACHE_AVATAR_URL_KEY = 'cached_current_avatar_url';

export default function ProfilScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setProfileStore = useAppStore(state => state.setProfile);
  const clearProfile = useAppStore(state => state.clearProfile);
  
  const [pseudo, setPseudo] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreviewVisible, setAvatarPreviewVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentPseudo, setCurrentPseudo] = useState<string>('');
  const [currentEmail, setCurrentEmail] = useState<string>('');
  const [currentPhone, setCurrentPhone] = useState<string>('');

  // Fonction pour gérer les erreurs Supabase
  const handleSupabaseError = (error: any, defaultMessage: string) => {
    console.error('Erreur Supabase:', error);
    if (error?.message?.includes('network') ||
      error?.message?.includes('fetch') ||
      error?.code === 'PGRST116' ||
      error?.code === 'PGRST301') {
      Alert.alert(i18n.t('error'), i18n.t('connection_error_body'));
    } else {
      Alert.alert(i18n.t('error'), defaultMessage);
    }
  };

  // Charger l'utilisateur actuel via la session au démarrage
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        setLoading(true);

        // Récupérer l'utilisateur depuis la session
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          Alert.alert(i18n.t('error'), i18n.t('cannot_retrieve_account'));
          router.back();
          return;
        }

        setUserId(user.id);

        // Récupérer le profil
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) {
          Alert.alert(i18n.t('error'), i18n.t('cannot_load_profile'));
          router.back();
          return;
        }

        setPseudo(profile.pseudo || '');
        setCurrentPseudo(profile.pseudo || '');
        // Normaliser l'email (trim + lowercase) pour l'affichage
        const normalizedEmail = user.email?.trim().toLowerCase() || '';
        setEmail(normalizedEmail);
        setCurrentEmail(normalizedEmail);
        setPhone(profile.phone || '');
        setCurrentPhone(profile.phone || '');
        setAvatarUrl(profile.avatar_url || null);
      } catch (err) {
        console.error('Erreur lors du chargement:', err);
        if (err instanceof Error && (err.message.includes('network') || err.message.includes('fetch'))) {
          Alert.alert(i18n.t('error'), i18n.t('connection_error_body'));
        } else {
          Alert.alert(i18n.t('error'), i18n.t('cannot_load_profile'));
        }
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadCurrentUser();
  }, []);

  // Fonction pour uploader l'image sélectionnée
  const uploadAvatarImage = async (imageUri: string) => {
    if (!userId) return;

    setUploadingAvatar(true);

    try {
      const timestamp = Date.now();
      const fileName = `${userId}/${timestamp}.jpg`;

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        Alert.alert(i18n.t('error'), 'Impossible de récupérer la session');
        setUploadingAvatar(false);
        return;
      }

      const uploadUrl = `${supabaseUrl}/storage/v1/object/avatars/${fileName}`;
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        name: `${timestamp}.jpg`,
        type: 'image/jpeg',
      } as any);

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: supabaseAnonKey,
          'x-upsert': 'true',
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Upload échoué (${uploadResponse.status}): ${errorText}`);
      }

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) {
        console.error('Erreur mise à jour avatar:', updateError);
        Alert.alert(i18n.t('error'), 'Impossible de mettre à jour l\'avatar');
        setUploadingAvatar(false);
        return;
      }

      setAvatarUrl(publicUrl);
      setProfileStore({ pseudo, avatarUrl: publicUrl });
      AsyncStorage.setItem(CACHE_AVATAR_URL_KEY, publicUrl).catch(() => {});
      Alert.alert(i18n.t('success'), 'Photo de profil mise à jour');
    } catch (error: any) {
      console.error('Erreur upload avatar:', error);
      Alert.alert(i18n.t('error'), error?.message || 'Une erreur est survenue');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handlePickAvatar = async () => {
    if (!userId) return;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [i18n.t('cancel'), i18n.t('camera'), i18n.t('gallery')],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) await handleCameraPick();
          else if (buttonIndex === 2) await handleGalleryPick();
        }
      );
    } else {
      Alert.alert(
        i18n.t('choose_photo_source'),
        '',
        [
          { text: i18n.t('cancel'), style: 'cancel' },
          { text: i18n.t('camera'), onPress: () => handleCameraPick() },
          { text: i18n.t('gallery'), onPress: () => handleGalleryPick() },
        ]
      );
    }
  };

  const handleCameraPick = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(i18n.t('error'), 'Permission d\'accès à la caméra requise');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      await uploadAvatarImage(result.assets[0].uri);
    }
  };

  const handleGalleryPick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      await uploadAvatarImage(result.assets[0].uri);
    }
  };

  const handleUpdateAll = async () => {
    if (!userId) return;

    const trimmedPseudo = pseudo.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim() ? normalizePhone(phone.trim()) : null;
    const normalizedCurrentPhone = normalizePhone(currentPhone);

    const pseudoChanged = trimmedPseudo !== currentPseudo && trimmedPseudo !== '';
    const emailChanged = trimmedEmail !== currentEmail?.toLowerCase().trim() && trimmedEmail !== '';
    const phoneChanged = normalizedPhone !== normalizedCurrentPhone;

    if (!pseudoChanged && !emailChanged && !phoneChanged) {
      Alert.alert(i18n.t('info'), i18n.t('no_change'));
      return;
    }

    if (pseudoChanged && !trimmedPseudo) {
      Alert.alert(i18n.t('error'), i18n.t('cannot_be_empty'));
      return;
    }

    if (emailChanged) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        Alert.alert(i18n.t('error'), 'Veuillez entrer un email valide');
        return;
      }
    }

    if (phoneChanged && normalizedPhone && normalizedPhone.length < 8) {
      Alert.alert(i18n.t('error'), i18n.t('phone_min_digits'));
      return;
    }

    if (pseudoChanged) {
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('pseudo', trimmedPseudo)
        .neq('id', userId)
        .maybeSingle();

      if (existingProfile) {
        Alert.alert(i18n.t('error'), i18n.t('pseudo_already_used'));
        return;
      }
    }

    setLoading(true);
    try {
      const updates: any = {};
      const messages: string[] = [];

      if (pseudoChanged) {
        updates.pseudo = trimmedPseudo;
        messages.push('pseudo');
      }
      if (phoneChanged) {
        updates.phone = normalizedPhone;
        messages.push(i18n.t('phone'));
      }

      if (Object.keys(updates).length > 0) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update(updates)
          .eq('id', userId);

        if (profileError) throw profileError;

        if (pseudoChanged) {
          setCurrentPseudo(trimmedPseudo);
          setPseudo(trimmedPseudo);
          setProfileStore({ pseudo: trimmedPseudo, avatarUrl });
          AsyncStorage.setItem(CACHE_PSEUDO_KEY, trimmedPseudo).catch(() => {});
        }
        if (phoneChanged) {
          setCurrentPhone(normalizedPhone || '');
          setPhone(normalizedPhone || '');
        }
      }

      if (emailChanged) {
        const { error: updateError } = await supabase.auth.updateUser({ email: trimmedEmail });
        if (updateError) throw updateError;
        setCurrentEmail(trimmedEmail);
        setEmail(trimmedEmail);
        messages.push('email');
      }

      const successMessage = i18n.t('update_success_msg', { fields: messages.join(', ') });
      Alert.alert(i18n.t('update_success'), successMessage);
    } catch (err) {
      handleSupabaseError(err, 'Impossible de mettre à jour le profil');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      i18n.t('logout_title'),
      i18n.t('logout_confirm'),
      [
        { text: i18n.t('cancel'), style: 'cancel' },
        {
          text: i18n.t('logout'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await logSignOutIntent('Profil:logout', () => supabase.auth.getUser());
            await clearCurrentUserPushToken();
            await supabase.auth.signOut();
            clearProfile();
            safeReplace(router, '/AuthChoiceScreen');
          }
        }
      ]
    );
  };

  const unsubscribe = async () => {
    Alert.alert(
      i18n.t('delete_account_confirm_title'),
      i18n.t('delete_account_confirm_body'),
      [
        { text: i18n.t('cancel'), style: 'cancel' },
        {
          text: i18n.t('confirm'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { error: deleteError } = await supabase.rpc('delete_user_account');
              if (deleteError) throw deleteError;
              await logSignOutIntent('Profil:deleteAccount', () => supabase.auth.getUser());
              await supabase.auth.signOut();
              clearProfile();
              safeReplace(router, '/AuthChoiceScreen');
            } catch (err) {
              Alert.alert(i18n.t('error'), i18n.t('error_occurred_deletion'));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const contactSupport = () => {
    Linking.openURL('mailto:hello@prootapp.com?subject=Support Proot');
  };

  if (loading && !userId) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#604a3e" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.navRow}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color="#604a3e" />
          </TouchableOpacity>
          <Text style={styles.pageSubtitleNav}>{i18n.t('profile_title')}</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <View style={styles.avatarRow}>
            <TouchableOpacity
              onPress={() => !uploadingAvatar && setAvatarPreviewVisible(true)}
              disabled={uploadingAvatar || loading}
              activeOpacity={0.85}
              style={styles.avatarContainer}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="large" color="#604a3e" />
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderText}>
                    {pseudo ? pseudo.charAt(0).toUpperCase() : '?'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePickAvatar}
              disabled={uploadingAvatar || loading}
              style={styles.cameraSideButton}
            >
              <Ionicons name="camera" size={28} color="#ebb89b" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{i18n.t('pseudo')}</Text>
          <TextInput
            placeholder={i18n.t('pseudo')}
            value={pseudo}
            onChangeText={setPseudo}
            style={styles.input}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{i18n.t('email')}</Text>
          <TextInput
            placeholder={i18n.t('email')}
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{i18n.t('phone')}</Text>
          <TextInput
            placeholder={i18n.t('phone')}
            value={phone}
            onChangeText={setPhone}
            style={styles.input}
            keyboardType="phone-pad"
            placeholderTextColor="#999"
          />
        </View>

        <TouchableOpacity
          style={styles.updateAllButton}
          onPress={handleUpdateAll}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ebb89b" />
          ) : (
            <>
              <Ionicons name="checkmark-outline" size={24} color="#ebb89b" />
              <Text style={styles.updateAllText}>{i18n.t('update_btn')}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={loading}
        >
          <Ionicons name="log-out-outline" size={24} color="#604a3e" />
          <Text style={styles.logoutText}>{i18n.t('logout')}</Text>
        </TouchableOpacity>

        <View style={styles.spacer} />

        <View style={styles.bottomSection}>
          <TouchableOpacity style={styles.supportButton} onPress={contactSupport}>
            <Ionicons name="mail-outline" size={20} color="#604a3e" />
            <Text style={styles.supportText}>{i18n.t('contact_support')}</Text>
          </TouchableOpacity>

          <View style={styles.deleteButtonContainer}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={unsubscribe}
              disabled={loading}
            >
              <Ionicons name="trash-outline" size={20} color="#ff4444" />
              <Text style={styles.deleteText}>{i18n.t('delete_account')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {avatarPreviewVisible && (
        <Pressable 
          style={styles.avatarPreviewBackdrop} 
          onPress={() => setAvatarPreviewVisible(false)}
        >
          <View style={styles.avatarPreviewCenter}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarPreviewImage} resizeMode="contain" />
            ) : (
              <View style={styles.avatarPreviewPlaceholder}>
                <Text style={styles.avatarPreviewPlaceholderText}>
                  {pseudo ? pseudo.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
            )}
            <Text style={styles.avatarPreviewHintText}>{i18n.t('tap_to_close_preview')}</Text>
          </View>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ebb89b' },
  header: { alignItems: 'stretch', paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 0, paddingHorizontal: 12 },
  pageSubtitleNav: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#604a3e', marginTop: 0, marginBottom: 0 },
  headerSpacer: { width: 40 },
  backButton: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 0 },
  scrollContent: { padding: 20, flexGrow: 1 },
  section: { marginBottom: 15 },
  label: { fontSize: 14, color: '#604a3e', fontWeight: '600', marginBottom: 5, marginLeft: 5 },
  input: { backgroundColor: 'white', padding: 15, borderRadius: 12, color: '#333', fontSize: 16, borderWidth: 1, borderColor: 'rgba(96, 74, 62, 0.2)' },
  updateAllButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#604a3e', padding: 15, borderRadius: 15, marginTop: 10, marginBottom: 20 },
  updateAllText: { color: '#ebb89b', fontWeight: 'bold', fontSize: 18, marginLeft: 10 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(96, 74, 62, 0.1)', padding: 15, borderRadius: 15, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(96, 74, 62, 0.2)' },
  logoutText: { color: '#604a3e', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  spacer: { height: 20 },
  bottomSection: { marginBottom: 40, alignItems: 'center' },
  supportButton: { flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 5 },
  supportText: { color: '#604a3e', fontWeight: 'bold', fontSize: 16, marginLeft: 10, textDecorationLine: 'underline' },
  deleteButtonContainer: { marginTop: 15 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  deleteText: { color: '#ff4444', fontWeight: 'bold', fontSize: 14, marginLeft: 8 },
  avatarSection: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  cameraSideButton: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#604a3e', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#ebb89b' },
  avatarContainer: { width: 100, height: 100, borderRadius: 50, overflow: 'hidden', backgroundColor: '#d9d9d9', justifyContent: 'center', alignItems: 'center' },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#604a3e', justifyContent: 'center', alignItems: 'center' },
  avatarPlaceholderText: { fontSize: 40, fontWeight: 'bold', color: '#fff' },
  avatarPreviewBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: 100, justifyContent: 'center', alignItems: 'center' },
  avatarPreviewCenter: { alignItems: 'center', width: '100%' },
  avatarPreviewImage: { width: PREVIEW_MAX, height: PREVIEW_MAX },
  avatarPreviewPlaceholder: { width: 200, height: 200, borderRadius: 100, backgroundColor: '#604a3e', justifyContent: 'center', alignItems: 'center' },
  avatarPreviewPlaceholderText: { fontSize: 80, fontWeight: 'bold', color: '#fff' },
  avatarPreviewHintText: { color: '#fff', fontSize: 14, marginTop: 20 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ebb89b' },
  loadingText: { fontSize: 18, color: '#604a3e', marginTop: 10 },
});
