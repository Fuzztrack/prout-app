// app/NotificationPermissionScreen.tsx
import * as Notifications from 'expo-notifications';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { Platform, Alert, Image, StyleSheet, Text, View, Linking } from 'react-native';
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
            i18n.t('permission_denied_body'),
            [
              { text: i18n.t('ok'), onPress: () => safeReplace(router, nextPath, { skipInitialCheck: false }) },
              { text: i18n.t('settings'), onPress: () => Linking.openSettings() }
            ]
          );
          return; // On s'arrête ici pour laisser l'utilisateur choisir
        }
      }

      if (finalStatus === 'granted') {
        console.log('✅ [NotificationPermission] Accordée');
        try {
          await ensureAndroidNotificationChannel();
          const token = await getFCMToken();
          
          if (!token) {
            console.warn('⚠️ [NotificationPermission] Token null malgré permission accordée');
            Alert.alert(
              i18n.t('notification_service_error_title'),
              i18n.t('notification_service_error_body'),
              [
                { text: i18n.t('retry'), onPress: () => handleNext() },
                { text: i18n.t('ok'), onPress: () => safeReplace(router, nextPath, { skipInitialCheck: false }) }
              ]
            );
            return;
          }
        } catch (tokenError) {
          console.warn('⚠️ [NotificationPermission] Erreur critique token:', tokenError);
        }
      }
    } catch (error) {
      console.error('❌ [NotificationPermission] Erreur globale:', error);
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
        <View style={styles.card}>
          <Text style={styles.cardEmoji}>📢</Text>
          <Text style={styles.title}>{i18n.t('notification_permission_title')}</Text>
          <Text style={styles.message}>
            {i18n.t('notification_permission_message')}
          </Text>
          <Text style={styles.subMessage}>
            {i18n.t('accept_notifications_message')}
          </Text>
        </View>

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
    paddingHorizontal: 10,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardEmoji: {
    fontSize: 42,
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#604a3e',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: '#604a3e',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
    fontWeight: '600',
  },
  subMessage: {
    fontSize: 14,
    color: '#604a3e',
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.85,
  },
});
