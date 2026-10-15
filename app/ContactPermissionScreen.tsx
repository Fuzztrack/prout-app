// app/ContactPermissionScreen.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CustomButton } from '../components/CustomButton';
import { safeReplace } from '../lib/navigation';
import { ensureContactPermissionWithDisclosure, CONTACT_CONSENT_KEY } from '../lib/contactConsent';
import { syncUserContacts } from '../lib/contactSync';
import i18n from '../lib/i18n';

export default function ContactPermissionScreen() {
  const router = useRouter();

  const handleAccept = async () => {
    try {
      console.log('📱 Demande de permission de contacts avec divulgation...');
      const status = await ensureContactPermissionWithDisclosure(true);
      if (status === Contacts.PermissionStatus.GRANTED) {
        console.log('✅ Permission de contacts accordée');
        syncUserContacts(true).catch(() => {});
      }
    } catch (error) {
      console.warn('⚠️ Erreur lors de la demande de permission de contacts:', error);
    }
    safeReplace(router, '/AuthChoiceScreen');
  };

  const handleSkip = async () => {
    try {
      await AsyncStorage.setItem(CONTACT_CONSENT_KEY, 'denied');
    } catch (e) {
      console.warn('⚠️ Erreur enregistrement refus contact:', e);
    }
    safeReplace(router, '/AuthChoiceScreen');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image 
          source={require('../assets/images/proot.png')} 
          style={styles.headerImage}
          resizeMode="contain"
        />
      </View>
      
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardEmoji}>👥</Text>
          <Text style={styles.title}>{i18n.t('contact_permission_title')}</Text>
          <Text style={styles.message}>
            {i18n.t('contact_permission_message')}
          </Text>
        </View>
        
        <CustomButton
          title={i18n.t('contact_consent_accept') || i18n.t('accept')}
          onPress={handleAccept}
          textColor="#604a3e"
        />

        <TouchableOpacity onPress={handleSkip} style={styles.skipButton} activeOpacity={0.7}>
          <Text style={styles.skipText}>{i18n.t('contact_consent_refuse') || i18n.t('refuse')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 0,
    backgroundColor: '#ebb89b',
  },
  header: {
    alignItems: 'center',
    marginBottom: 0,
    marginTop: 20,
  },
  headerImage: {
    width: 280,
    height: 180,
    marginBottom: 2,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#604a3e',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: '#604a3e',
    textAlign: 'center',
    lineHeight: 20,
  },
  skipButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#604a3e',
    opacity: 0.8,
  },
});
