import { useAudioPlayer } from 'expo-audio';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { ensureAndroidNotificationChannel } from '../lib/notifications';
import { supabase } from '../lib/supabase';

// Player audio global pour les notifications (initialisé dans le composant)
let notificationAudioPlayer: ReturnType<typeof useAudioPlayer> | null = null;

// Mapping des sons prout
const PROUT_SOUNDS: { [key: string]: any } = {
  prout1: require('../assets/sounds/prout1.ogg'),
  prout2: require('../assets/sounds/prout2.ogg'),
  prout3: require('../assets/sounds/prout3.ogg'),
  prout4: require('../assets/sounds/prout4.ogg'),
  prout5: require('../assets/sounds/prout5.ogg'),
  prout6: require('../assets/sounds/prout6.ogg'),
  prout7: require('../assets/sounds/prout7.ogg'),
  prout8: require('../assets/sounds/prout8.ogg'),
  prout9: require('../assets/sounds/prout9.ogg'),
  prout10: require('../assets/sounds/prout10.ogg'),
  prout11: require('../assets/sounds/prout11.ogg'),
  prout12: require('../assets/sounds/prout12.ogg'),
  prout13: require('../assets/sounds/prout13.ogg'),
  prout14: require('../assets/sounds/prout14.ogg'),
  prout15: require('../assets/sounds/prout15.ogg'),
  prout16: require('../assets/sounds/prout16.ogg'),
  prout17: require('../assets/sounds/prout17.ogg'),
  prout18: require('../assets/sounds/prout18.ogg'),
  prout19: require('../assets/sounds/prout19.ogg'),
  prout20: require('../assets/sounds/prout20.ogg'),
};

// 👇 Configuration simple des notifications
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    console.log(`📱 [FOREGROUND HANDLER] Notification reçue (app ouverte):`, {
      title: notification.request.content.title,
      body: notification.request.content.body,
      data: notification.request.content.data,
      sound: notification.request.content.sound,
    });

    // Jouer le son si l'app est ouverte
    const data = notification.request.content.data as { proutKey?: string; key?: string; type?: string } | undefined;
    // Le backend envoie 'proutKey' dans data, mais on garde 'key' pour compatibilité
    const proutKey = data?.proutKey || data?.key;
    
    console.log(`📱 [FOREGROUND HANDLER] proutKey:`, proutKey);
    console.log(`📱 [FOREGROUND HANDLER] data complet:`, data);
    
    if (proutKey && PROUT_SOUNDS[proutKey] && notificationAudioPlayer) {
      notificationAudioPlayer.replace(PROUT_SOUNDS[proutKey]);
      notificationAudioPlayer.play();
      console.log(`🔊 [FOREGROUND HANDLER] Son ${proutKey} joué localement`);
    } else {
      console.warn(`⚠️ [FOREGROUND HANDLER] Impossible de jouer le son:`, {
        proutKey,
        hasProutKey: !!proutKey,
        hasSound: proutKey ? !!PROUT_SOUNDS[proutKey] : false,
        hasPlayer: !!notificationAudioPlayer
      });
    }

    return {
      shouldShowAlert: true,   // Affiche la notification
      shouldPlaySound: true,   // Joue le son (Android utilisera le canal)
      shouldSetBadge: false,
    };
  },
});

export default function RootLayout() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const audioPlayer = useAudioPlayer();
  const [toastMessage, setToastMessage] = useState<{ title: string; body: string } | null>(null);
  const toastOpacity = useState(new Animated.Value(0))[0];

  // Initialiser le player audio global pour les notifications
  useEffect(() => {
    notificationAudioPlayer = audioPlayer;
    return () => {
      notificationAudioPlayer = null;
    };
  }, [audioPlayer]);

  useEffect(() => {
    // Initialiser les canaux de notification Android au démarrage
    if (Platform.OS === 'android') {
      ensureAndroidNotificationChannel().catch(err => {
        console.error('❌ Erreur init canaux Android:', err);
      });
    }

    // 👇 INTERCEPTER LES MESSAGES FCM EN FOREGROUND (quand l'app est ouverte)
    // Les notifications FCM ne passent pas par expo-notifications en foreground
    let unsubscribeForeground: (() => void) | null = null;
    if (Platform.OS !== 'web') {
      try {
        const messaging = require('@react-native-firebase/messaging').default;
        
        // Handler pour les messages en foreground
        unsubscribeForeground = messaging().onMessage(async (remoteMessage: any) => {
          console.log('🔥 [FCM FOREGROUND] Message reçu (app ouverte):', {
            title: remoteMessage.notification?.title,
            body: remoteMessage.notification?.body,
            data: remoteMessage.data,
          });

          const proutKey = remoteMessage.data?.proutKey;
          const sender = remoteMessage.data?.sender;
          const proutName = remoteMessage.data?.proutName; // 🎨 Nom stylé depuis le backend

          if (proutKey && PROUT_SOUNDS[proutKey] && notificationAudioPlayer) {
            // Jouer le son
            notificationAudioPlayer.replace(PROUT_SOUNDS[proutKey]);
            notificationAudioPlayer.play();
            console.log(`🔊 [FCM FOREGROUND] Son ${proutKey} joué`);

            // Afficher un toast qui disparaît automatiquement après 1.5s
            if (sender) {
              // 🎨 Utiliser le nom stylé si disponible, sinon utiliser le titre de la notification
              const displayTitle = remoteMessage.notification?.title || 
                                  (proutName ? `${sender} t'a envoyé ${proutName} ! 💨` : 
                                   `${sender} t'a envoyé un prout 💨`);
              
              // 🎨 Utiliser le nom stylé dans le body aussi, ou le body de la notification
              const displayBody = proutName || remoteMessage.notification?.body || '';
              
              setToastMessage({
                title: displayTitle,
                body: displayBody,
              });
              
              // Animation d'apparition
              Animated.sequence([
                Animated.timing(toastOpacity, {
                  toValue: 1,
                  duration: 200,
                  useNativeDriver: true,
                }),
                Animated.delay(1300), // Afficher pendant 1.3s
                Animated.timing(toastOpacity, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true,
                }),
              ]).start(() => {
                setToastMessage(null);
              });
            }
          }
        });

        // Handler pour les messages en background (optionnel, pour éviter le warning)
        messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
          console.log('🔥 [FCM BACKGROUND] Message reçu (app fermée):', remoteMessage);
        });
      } catch (error: any) {
        console.warn('⚠️ @react-native-firebase/messaging non disponible:', error.message);
      }
    }

    // Vérifier la dernière notification reçue (au cas où l'app était fermée)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        console.log(`📥 [LAST NOTIFICATION] Dernière notification reçue:`, {
          title: response.notification.request.content.title,
          body: response.notification.request.content.body,
          data: response.notification.request.content.data,
        });
      }
    });

    // 👇 LISTENER pour les notifications reçues (foreground ET background)
    // Ce listener est appelé pour TOUTES les notifications, même en foreground
    const notificationSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log(`📥 [NOTIFICATION RECEIVED] Notification complète:`, {
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data,
        sound: notification.request.content.sound,
        android: notification.request.trigger && 'android' in notification.request.trigger ? notification.request.trigger.android : null,
      });

      const data = notification.request.content.data as { proutKey?: string; key?: string; type?: string } | undefined;
      // Le backend envoie 'proutKey' dans data, mais on garde 'key' pour compatibilité
      const proutKey = data?.proutKey || data?.key;
      
      console.log(`📥 [NOTIFICATION RECEIVED] proutKey extrait:`, proutKey);
      console.log(`📥 [NOTIFICATION RECEIVED] data complet:`, data);
      console.log(`📥 [NOTIFICATION RECEIVED] PROUT_SOUNDS disponible:`, Object.keys(PROUT_SOUNDS));
      console.log(`📥 [NOTIFICATION RECEIVED] notificationAudioPlayer disponible:`, !!notificationAudioPlayer);
      
      // Jouer le son si disponible (en foreground, on joue manuellement car shouldPlaySound peut ne pas fonctionner)
      if (proutKey && PROUT_SOUNDS[proutKey] && notificationAudioPlayer) {
        notificationAudioPlayer.replace(PROUT_SOUNDS[proutKey]);
        notificationAudioPlayer.play();
        console.log(`🔊 [NOTIFICATION RECEIVED] Son ${proutKey} joué (foreground ou background)`);
      } else {
        console.warn(`⚠️ [NOTIFICATION RECEIVED] Impossible de jouer le son:`, {
          proutKey,
          hasProutKey: !!proutKey,
          hasSound: proutKey ? !!PROUT_SOUNDS[proutKey] : false,
          hasPlayer: !!notificationAudioPlayer
        });
      }
    });

    // 👇 LISTENER pour les notifications cliquées (quand l'utilisateur clique sur la notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log(`👆 [NOTIFICATION CLICKED] Notification cliquée:`, {
        title: response.notification.request.content.title,
        data: response.notification.request.content.data,
      });
    });

    // GESTION DES LIENS
    const handleAuthUrl = async (url: string) => {
      // Gérer les liens de réinitialisation de mot de passe
      if (url.includes('reset-password') || url.includes('type=recovery')) {
        try {
          // Extraire les tokens de l'URL
          const accessTokenMatch = url.match(/access_token=([^&]+)/);
          const refreshTokenMatch = url.match(/refresh_token=([^&]+)/);

          if (accessTokenMatch && refreshTokenMatch) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessTokenMatch[1],
              refresh_token: refreshTokenMatch[1],
            });
            if (!error && data.session) {
              // Rediriger vers la page de réinitialisation
              router.replace('/reset-password');
              return;
            }
          }
        } catch (e) {
          console.error("❌ Erreur URL reset password:", e);
        }
      }

      // Gérer les liens de confirmation d'email
      if (url.includes('access_token') && url.includes('refresh_token')) {
        try {
          const accessTokenMatch = url.match(/access_token=([^&]+)/);
          const refreshTokenMatch = url.match(/refresh_token=([^&]+)/);

          if (accessTokenMatch && refreshTokenMatch) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessTokenMatch[1],
              refresh_token: refreshTokenMatch[1],
            });
            if (!error && data.session) {
              checkProfileAndNavigate(data.session.user.id);
            }
          }
        } catch (e) {
          console.error("❌ Erreur URL:", e);
        }
      }
    };

    const subscription = Linking.addEventListener('url', ({ url }) => handleAuthUrl(url));
    Linking.getInitialURL().then((url) => { if (url) handleAuthUrl(url); });

    setTimeout(() => setIsReady(true), 100);
    return () => {
      subscription.remove();
      notificationSubscription.remove();
      responseSubscription.remove();
      if (unsubscribeForeground) {
        unsubscribeForeground();
      }
    };
  }, []);

  const checkProfileAndNavigate = async (userId: string) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Récupérer le profil et les métadonnées utilisateur
    const { data: profile } = await supabase.from('user_profiles').select('pseudo').eq('id', userId).maybeSingle();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Vérifier si le pseudo est valide (pas "Nouveau Membre" et pas le nom complet Google)
    const isPseudoValid = profile && 
                          profile.pseudo && 
                          profile.pseudo !== 'Nouveau Membre' &&
                          // Vérifier si le pseudo n'est pas le nom complet de Google
                          profile.pseudo !== (user?.user_metadata?.full_name || user?.user_metadata?.name || '');
    
    if (isPseudoValid) {
      router.replace('/(tabs)');
    } else {
      // Rediriger vers CompleteProfileScreen si :
      // - Pas de profil
      // - Pseudo = "Nouveau Membre"
      // - Pseudo = nom complet Google (profil créé automatiquement)
      router.replace('/CompleteProfileScreen');
    }
  };

  if (!isReady) {
    return <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ebb89b'}}><ActivityIndicator size="large" color="#604a3e" /></View>;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="WelcomeScreen" />
        <Stack.Screen name="AuthChoiceScreen" />
        <Stack.Screen name="LoginScreen" />
        <Stack.Screen name="RegisterEmailScreen" />
        <Stack.Screen name="CompleteProfileScreen" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="confirm-email" options={{ presentation: 'modal' }} />
        <Stack.Screen name="reset-password" options={{ presentation: 'modal' }} />
      </Stack>
      
      {/* Toast qui disparaît automatiquement */}
      {toastMessage && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastTitle}>{toastMessage.title}</Text>
          <Text style={styles.toastBody}>{toastMessage.body}</Text>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: '#604a3e',
    borderRadius: 12,
    padding: 16,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  toastTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  toastBody: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
});