// app/NotificationPermissionScreen.tsx
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Platform, Alert, Image, StyleSheet, Text, View } from 'react-native';
import { CustomButton } from '../components/CustomButton';
import { safePush } from '../lib/navigation';
import { ensureAndroidNotificationChannel } from '../lib/notifications';
import { getFCMToken } from '../lib/fcmToken';
import i18n from '../lib/i18n';

export default function NotificationPermissionScreen() {
  const router = useRouter();

  const handleNext = async () => {
    // Demander la permission de notifications
    if (Platform.OS === 'web') {
      Alert.alert(i18n.t('info'), i18n.t('web_notifications_unavailable'));
      safePush(router, '/ContactPermissionScreen', { skipInitialCheck: false });
      return;
    }

    if (Constants.isDevice === false) {
      Alert.alert(
        i18n.t('info'),
        i18n.t('push_requires_device')
      );
      safePush(router, '/ContactPermissionScreen', { skipInitialCheck: false });
      return;
    }

    if (Constants.executionEnvironment === 'storeClient') {
      Alert.alert(
        'Development Build requis',
        'Les notifications push nécessitent un development build. Expo Go ne les supporte pas.'
      );
      safePush(router, '/ContactPermissionScreen', { skipInitialCheck: false });
      return;
    }

    try {
      console.log('📱 Demande de permission de notifications...');
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('📱 Permission existante:', existingStatus);
      
      let finalStatus = existingStatus;
      
      // Demander la permission si elle n'est pas déjà accordée
      if (existingStatus !== 'granted') {
        console.log('📱 Demande de permission de notifications...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log('📱 Permission après demande:', finalStatus);
        
        if (finalStatus === 'denied') {
          console.warn('⚠️ Permission de notifications refusée');
          Alert.alert(
            i18n.t('permission_denied_title'),
            i18n.t('permission_denied_body')
          );
        } else if (finalStatus === 'granted') {
          console.log('✅ Permission de notifications accordée');
          // Essayer d'obtenir le token pour s'assurer que tout fonctionne
          try {
            await ensureAndroidNotificationChannel();
            await getFCMToken();
          } catch (tokenError) {
            console.warn('⚠️ Erreur lors de l\'obtention du token:', tokenError);
          }
        }
      } else {
        console.log('✅ Permission de notifications déjà accordée');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la demande de permission:', error);
    }
    
    // Rediriger vers la page de permission contacts, puis vers l'inscription
    safePush(router, '/ContactPermissionScreen', { skipInitialCheck: false });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image 
          source={require('../assets/images/prout-meme.png')} 
          style={styles.headerImage}
          resizeMode="contain"
        />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>{i18n.t('notification_permission_title')}</Text>
        
        <Text style={styles.message}>
          {i18n.t('notification_permission_message')}
        </Text>
        
        <Text style={styles.message}>
          {i18n.t('accept_notifications_message')}
        </Text>
        
        <CustomButton
          title={i18n.t('authorize_notifications')}
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

