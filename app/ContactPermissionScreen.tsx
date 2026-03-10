// app/ContactPermissionScreen.tsx
import * as Contacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { CustomButton } from '../components/CustomButton';
import { safeReplace } from '../lib/navigation';
import { ensureContactPermissionWithDisclosure } from '../lib/contactConsent';
import i18n from '../lib/i18n';

export default function ContactPermissionScreen() {
  const router = useRouter();

  const handleNext = async () => {
    // Demander la permission de contacts
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      try {
        console.log('📱 Demande de permission de contacts avec divulgation...');
        const status = await ensureContactPermissionWithDisclosure();
        console.log('📱 Statut de permission de contacts après demande:', status);
        
        if (status === 'denied') {
          Alert.alert(
            i18n.t('error'),
            i18n.t('contacts_access_required_later')
          );
        } else if (status === 'granted') {
          console.log('✅ Permission de contacts accordée');
        }
      } catch (error) {
        console.warn('⚠️ Erreur lors de la demande de permission de contacts:', error);
      }
    }
    
    // Rediriger vers la page d'inscription
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
        <Text style={styles.title}>{i18n.t('contact_permission_title')}</Text>
        <Text style={styles.message}>
          {i18n.t('contact_permission_message')}
        </Text>
        
        <CustomButton
          title={i18n.t('next')}
          onPress={handleNext}
          textColor="#604a3e"
        />
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
    height: 210,
    marginBottom: 2,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#604a3e',
    textAlign: 'center',
    marginBottom: 30,
  },
  message: {
    fontSize: 16,
    color: '#604a3e',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
});

