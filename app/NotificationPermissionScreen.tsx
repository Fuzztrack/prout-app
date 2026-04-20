// app/NotificationPermissionScreen.tsx
import * as Notifications from 'expo-notifications';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { Platform, Alert, Image, StyleSheet, Text, View } from 'react-native';
import { CustomButton } from '../components/CustomButton';
import { safeReplace } from '../lib/navigation';
import { ensureAndroidNotificationChannel } from '../lib/notifications';
import { getFCMToken } from '../lib/fcmToken';
import i18n from '../lib/i18n';

export default function NotificationPermissionScreen() {
  const router = useRouter();
  const { next } = useLocalSearchParams();

  const handleNext = async () => {
    const nextPath = (next as string) || '/ContactPermissionScreen';

    // Demander la permission de notifications
    if (Platform.OS === 'web') {
      Alert.alert(i18n.t('info'), i18n.t('web_notifications_unavailable'));
      safeReplace(router, nextPath, { skipInitialCheck: false });
      return;
    }

    if (Constants.isDevice === false) {
      console.log('📱 [NotificationPermission] Simulateur détecté');
      safeReplace(router, nextPath, { skipInitialCheck: false });
      return;
    }

    if (Constants.executionEnvironment === 'storeClient') {
      console.log('📱 [NotificationPermission] Expo Go détecté');
      safeReplace(router, nextPath, { skipInitialCheck: false });
      return;
    }

    try {
      console.log('📱 [NotificationPermission] Vérification permission...');
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        
        if (finalStatus === 'denied') {
          console.warn('⚠️ [NotificationPermission] Refusée');
          Alert.alert(
            i18n.t('permission_denied_title'),
            i18n.t('permission_denied_body')
          );
        } else if (finalStatus === 'granted') {
          console.log('✅ [NotificationPermission] Accordée');
          try {
            await ensureAndroidNotificationChannel();
            await getFCMToken();
          } catch (tokenError) {
            console.warn('⚠️ [NotificationPermission] Erreur token:', tokenError);
          }
        }
      } else {
        console.log('✅ [NotificationPermission] Déjà accordée');
      }
    } catch (error) {
      console.error('❌ [NotificationPermission] Erreur:', error);
    }
    
    // Rediriger vers la suite du flux
    safeReplace(router, nextPath, { skipInitialCheck: false });
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
