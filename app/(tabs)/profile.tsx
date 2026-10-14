import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/lib/store';
import { logSignOutIntent } from '../../lib/authDebug';
import i18n from '../../lib/i18n';
import { safePush, safeReplace } from '../../lib/navigation';
import { clearCurrentUserPushToken } from '../../lib/pushTokenRegistration';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
  const isNightMode = useAppStore(state => state.isNightMode);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [email, setEmail] = useState<string | null>(null);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        safeReplace(router, '/AuthChoiceScreen', { skipInitialCheck: false });
        return;
      }

      setEmail(user.email || '');

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) setProfile(data);

    } catch (e) {
      console.log("Erreur Profil:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleLogout = async () => {
    Alert.alert(
      i18n.t('logout_title'),
      i18n.t('logout_confirm'),
      [
        { text: i18n.t('cancel'), style: "cancel" },
        {
          text: i18n.t('logout_disconnect'),
          style: "destructive",
          onPress: async () => {
            try {
              await logSignOutIntent('tabs/profile:logout', () => supabase.auth.getUser());
              await clearCurrentUserPushToken();
              console.log('✅ Token push supprimé lors de la déconnexion');

              // Déconnexion
              await supabase.auth.signOut();

              // Afficher le message
              Alert.alert(
                i18n.t('logout_success_title'),
                i18n.t('logout_success_body'),
                [{ text: i18n.t('ok'), onPress: () => safeReplace(router, '/AuthChoiceScreen') }]
              );
            } catch (error) {
              console.error('Erreur lors de la déconnexion:', error);
              await logSignOutIntent('tabs/profile:logout:catch', () => supabase.auth.getUser());
              await supabase.auth.signOut();
              safeReplace(router, '/AuthChoiceScreen');
            }
          }
        }
      ]
    );
  };

  const handleContactSupport = () => {
    const email = 'hello@prootapp.com';
    const subject = 'Support ProutApp';
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}`;

    Linking.openURL(mailtoUrl).catch(() => {
      Alert.alert(i18n.t('error'), i18n.t('cannot_open_email_app', { email }));
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#604a3e" />
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, isNightMode && { backgroundColor: '#1c1613' }]}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 20 }, isNightMode && { backgroundColor: '#1c1613' }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => safePush(router, '/(tabs)', { skipInitialCheck: false })} activeOpacity={0.7}>
            <Image
              source={require('../../assets/images/proot.png')}
              style={styles.headerImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, isNightMode && { backgroundColor: '#271e19' }]}>
              <Text style={[styles.avatarPlaceholderText, isNightMode && { color: '#ebb89b' }]}>
                {profile?.pseudo ? profile.pseudo.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.infoContainer}>
          <Text style={[styles.pseudo, isNightMode && { color: '#f5e6dc' }]}>
            <Text style={styles.label}>{i18n.t('pseudo')}: </Text>
            {profile?.pseudo || i18n.t('not_defined')}
          </Text>
          <Text style={[styles.email, isNightMode && { color: '#c4b0a4' }]}>
            <Text style={styles.label}>{i18n.t('email')}: </Text>
            {email}
          </Text>
          <Text style={[styles.phone, isNightMode && { color: '#c4b0a4' }]}>
            <Text style={styles.label}>{i18n.t('phone')}: </Text>
            {profile?.phone || i18n.t('not_defined_phone')}
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.editButton, isNightMode && { backgroundColor: '#2e4d48', borderColor: '#4da699' }]} 
          onPress={() => safePush(router, '/Profil', { skipInitialCheck: false })}
        >
          <Ionicons name="create-outline" size={24} color={isNightMode ? "#f5e6dc" : "#604a3e"} />
          <Text style={[styles.editText, isNightMode && { color: '#f5e6dc' }]}>{i18n.t('edit_profile')}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.backButton, isNightMode && { backgroundColor: '#1e1612', borderColor: '#3d2f28' }]} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={isNightMode ? "#f5e6dc" : "#604a3e"} />
          <Text style={[styles.backText, isNightMode && { color: '#f5e6dc' }]}>{i18n.t('back')}</Text>
        </TouchableOpacity>

        <View style={styles.spacer} />

        <TouchableOpacity style={styles.logoutLink} onPress={handleLogout}>
          <Text style={[styles.logoutLinkText, isNightMode && { color: '#ebb89b' }]}>{i18n.t('logout')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleContactSupport} style={styles.supportLink}>
          <Text style={[styles.supportLinkText, isNightMode && { color: '#ebb89b' }]}>{i18n.t('contact_support')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#ebb89b' },
  container: { flexGrow: 1, backgroundColor: '#ebb89b', padding: 20, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ebb89b' },
  backButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', padding: 15, borderRadius: 15,
    marginBottom: 15, borderWidth: 1, borderColor: 'rgba(96, 74, 62, 0.2)'
  },
  backText: { color: '#604a3e', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  header: { alignItems: 'center', marginBottom: 20 },
  headerImage: { width: 180, height: 140, marginBottom: 10 },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#d9d9d9',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#604a3e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  infoContainer: { alignItems: 'center', marginBottom: 30 },
  pseudo: { fontSize: 14, color: '#604a3e', marginTop: 5, opacity: 0.8 },
  email: { fontSize: 14, color: '#604a3e', marginTop: 5, opacity: 0.8 },
  phone: { fontSize: 14, color: '#604a3e', marginTop: 5, opacity: 0.8 },
  label: { fontWeight: '600', opacity: 0.9 },

  editButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', padding: 15, borderRadius: 15,
    marginBottom: 15, borderWidth: 1, borderColor: 'rgba(96, 74, 62, 0.2)'
  },
  editText: { color: '#604a3e', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },

  spacer: { height: 20 },
  logoutLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    marginTop: 10,
  },
  logoutLinkText: {
    color: '#604a3e',
    fontSize: 14,
    textDecorationLine: 'underline',
    opacity: 0.8,
  },
  supportLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    marginTop: 10,
  },
  supportLinkText: {
    color: '#604a3e',
    fontSize: 14,
    textDecorationLine: 'underline',
    opacity: 0.8
  },
});