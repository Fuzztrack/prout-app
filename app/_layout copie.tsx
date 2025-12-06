import { useAudioPlayer } from 'expo-audio';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
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
};

// 👇 SOLUTION FCM DATA-ONLY : Intercepter et afficher manuellement
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const soundName = notification.request.content.data?.soundName;
    const title = notification.request.content.data?.title || notification.request.content.title;
    const body = notification.request.content.data?.body || notification.request.content.body;
    const channelId = notification.request.content.data?.channelId;

    console.log(`🔔 Notification reçue - Son: ${soundName}, Canal: ${channelId}`);

    // Si c'est une notification data-only (FCM), on l'affiche manuellement
    if (soundName && Platform.OS === 'android') {
      try {
        // 1. Jouer le son si l'app est ouverte
        if (PROUT_SOUNDS[soundName] && notificationAudioPlayer) {
          notificationAudioPlayer.replace(PROUT_SOUNDS[soundName]);
          notificationAudioPlayer.play();
        }

        // 2. Afficher la notification manuellement avec le bon canal et son
        // ⚠️ CRUCIAL : On utilise scheduleNotificationAsync pour forcer l'affichage
        // ⚠️ IMPORTANT : Ajouter un flag pour éviter la boucle infinie
        await Notifications.scheduleNotificationAsync({
          content: {
            title: title || 'Prout ! 💨',
            body: body || 'Tu as reçu un prout',
            sound: soundName, // ⚠️ Le son spécifique (sans .ogg)
            data: {
              ...notification.request.content.data,
              fromOurCode: true, // Flag pour éviter la boucle
            },
          },
          trigger: null, // Immédiat
        });
      } catch (e) {
        console.error("❌ Erreur affichage notification manuelle:", e);
      }
    }

    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      sound: soundName || undefined, // Son spécifique si disponible
      priority: Notifications.AndroidImportance.MAX,
      shouldSetBadge: false,
    };
  },
});

export default function RootLayout() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const audioPlayer = useAudioPlayer();

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
      console.log('🔊 _layout.tsx: Initialisation des canaux Android...');
      ensureAndroidNotificationChannel()
        .then(() => {
          console.log('✅ _layout.tsx: Canaux Android initialisés avec succès');
        })
        .catch(err => {
          console.error('❌ _layout.tsx: Erreur initialisation canaux:', err);
        });
    }

    // 👇 LISTENER pour les notifications data-only en background
    // Ce listener intercepte les notifications même quand l'app est fermée
    const notificationSubscription = Notifications.addNotificationReceivedListener(async (notification) => {
      const soundName = notification.request.content.data?.soundName;
      const title = notification.request.content.data?.title;
      const body = notification.request.content.data?.body;
      const channelId = notification.request.content.data?.channelId;
      const isFromOurCode = notification.request.content.data?.fromOurCode; // Flag pour éviter la boucle

      // ⚠️ ÉVITER LA BOUCLE : Si la notification vient déjà de notre code, ne pas la retraiter
      if (isFromOurCode) {
        return; // Ignorer les notifications qu'on a déjà créées
      }

      // Si c'est une notification data-only avec un son, on l'affiche manuellement
      if (soundName && title && body && Platform.OS === 'android') {
        try {
          console.log(`🔔 Background notification interceptée - Son: ${soundName}, Canal: ${channelId}`);
          
          // Afficher la notification avec le bon canal et son
          // ⚠️ IMPORTANT : Ajouter un flag pour éviter la boucle infinie
          await Notifications.scheduleNotificationAsync({
            content: {
              title: title,
              body: body,
              sound: soundName, // Son spécifique
              data: {
                ...notification.request.content.data,
                fromOurCode: true, // Flag pour éviter la boucle
              },
            },
            trigger: null,
          });
        } catch (e) {
          console.error("❌ Erreur affichage notification background:", e);
        }
      }
    });

    // GESTION DES LIENS
    const handleAuthUrl = async (url: string) => {
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
    };
  }, []);

  const checkProfileAndNavigate = async (userId: string) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const { data: profile } = await supabase.from('user_profiles').select('pseudo').eq('id', userId).maybeSingle();
    if (profile && profile.pseudo && profile.pseudo !== 'Nouveau Membre') {
      router.replace('/(tabs)');
    } else {
      router.replace('/CompleteProfileScreen');
    }
  };

  if (!isReady) {
    return <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ebb89b'}}><ActivityIndicator size="large" color="#604a3e" /></View>;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="WelcomeScreen" />
      <Stack.Screen name="AuthChoiceScreen" />
      <Stack.Screen name="LoginScreen" />
      <Stack.Screen name="RegisterEmailScreen" />
      <Stack.Screen name="CompleteProfileScreen" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="confirm-email" options={{ presentation: 'modal' }} />
    </Stack>
  );
}