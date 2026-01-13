import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Onboarding from '../components/Onboarding';
import { ensureContactPermissionWithDisclosure } from '../lib/contactConsent';
import { safePush, safeReplace } from '../lib/navigation';
import { ensureAndroidNotificationChannel } from '../lib/notifications';
import { supabase } from '../lib/supabase';

import i18n from '../lib/i18n';

// Mapping des sons prout (doit correspondre à FriendsList.tsx)
const PROUT_SOUNDS: { [key: string]: any } = {
  prout1: require('../assets/sounds/prout1.wav'),
  prout2: require('../assets/sounds/prout2.wav'),
  prout3: require('../assets/sounds/prout3.wav'),
  prout4: require('../assets/sounds/prout4.wav'),
  prout5: require('../assets/sounds/prout5.wav'),
  prout6: require('../assets/sounds/prout6.wav'),
  prout7: require('../assets/sounds/prout7.wav'),
  prout8: require('../assets/sounds/prout8.wav'),
  prout9: require('../assets/sounds/prout9.wav'),
  prout10: require('../assets/sounds/prout10.wav'),
  prout11: require('../assets/sounds/prout11.wav'),
  prout12: require('../assets/sounds/prout12.wav'),
  prout13: require('../assets/sounds/prout13.wav'),
  prout14: require('../assets/sounds/prout14.wav'),
  prout15: require('../assets/sounds/prout15.wav'),
  prout16: require('../assets/sounds/prout16.wav'),
  prout17: require('../assets/sounds/prout17.wav'),
  prout18: require('../assets/sounds/prout18.wav'),
  prout19: require('../assets/sounds/prout19.wav'),
  prout20: require('../assets/sounds/prout20.wav'),
};

// Fonction pour jouer le son prout localement (foreground)
async function playProutSoundLocally(proutKey: string) {
  try {
    // Configurer le mode audio pour les notifications
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    
    console.log('🔊 [playProutSoundLocally] Début pour:', proutKey);
    const soundFile = PROUT_SOUNDS[proutKey] || PROUT_SOUNDS.prout1;
    if (!soundFile) {
      const errorMsg = `Fichier son non trouvé pour: ${proutKey}`;
      console.error('❌ [playProutSoundLocally]', errorMsg);
      Alert.alert('Erreur', errorMsg);
      return;
    }
    console.log('🔊 [playProutSoundLocally] Création Sound pour:', proutKey);
    const { sound } = await Audio.Sound.createAsync(soundFile, {
      shouldPlay: false,
      volume: 1.0,
    });
    console.log('🔊 [playProutSoundLocally] Sound créé, lecture...');
    
    // Libérer la ressource après lecture
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded) {
        if (status.didJustFinish) {
          console.log('✅ [playProutSoundLocally] Son terminé');
          sound.unloadAsync().catch(() => {});
        } else if (status.error) {
          console.error('❌ [playProutSoundLocally] Erreur playback:', status.error);
          Alert.alert('Erreur playback', status.error);
        }
      }
    });
    
    await sound.playAsync();
    console.log('✅ [playProutSoundLocally] playAsync() appelé avec succès');
  } catch (error: any) {
    const errorMsg = `Erreur lecture son: ${error?.message || error}`;
    console.error('❌ [playProutSoundLocally]', errorMsg);
    Alert.alert('Erreur son', errorMsg);
  }
}

// 🔔 CONFIGURATION GLOBALE
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, info: any) {
    console.error('App error boundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ebb89b', padding: 24 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#604a3e', marginBottom: 8 }}>Oups...</Text>
          <Text style={{ fontSize: 16, color: '#604a3e', textAlign: 'center' }}>Une erreur est survenue. Relance l’app.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const router = useRouter();
  const [toastMessage, setToastMessage] = useState<{ title: string, body: string } | null>(null);
  const [toastOpacity] = useState(new Animated.Value(0));

  const showToast = (title: string, body: string) => {
    setToastMessage({ title, body });
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(4000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastMessage(null));
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        // 📢 CONFIGURATION DES CANAUX ANDROID AU DÉMARRAGE
        if (Platform.OS === 'android') {
          await ensureAndroidNotificationChannel();
        }

        // 🔴 Réinitialiser le badge iOS au démarrage de l'app
        if (Platform.OS === 'ios') {
          await Notifications.setBadgeCountAsync(0);
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(session);
        setLoading(false);
      } catch (err) {
        console.warn('⚠️ Init app error:', err);
        if (mounted) setLoading(false);
      }
    };

    init();

    // Timeout de 5s pour éviter le chargement infini
    const timeout = setTimeout(() => {
      setLoading((currentLoading) => {
        if (currentLoading) {
          Alert.alert(
            i18n.t('connection_error_title'),
            i18n.t('connection_error_body'),
            [{ text: i18n.t('ok') }]
          );
          return false; // Arrêter le chargement
        }
        return currentLoading;
      });
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      try {
        const { title, body, data } = notification.request.content;
        
        // Test simple : Alert au tout début
        setTimeout(() => {
          Alert.alert('TEST', 'Listener appelé !');
        }, 100);
        
        console.log('🔔 [FOREGROUND] Notification reçue:', { type: data?.type, proutKey: data?.proutKey, title, body });
        
        if (data?.type === 'prout') {
          showToast(title || 'Prout !', body || '');
          
          // Alert pour voir les données
          setTimeout(() => {
            Alert.alert(
              'DEBUG Notification',
              `Type: ${data?.type || 'UNDEFINED'}\nProutKey: ${data?.proutKey || 'MANQUANT'}\nPlatform: ${Platform.OS}`
            );
          }, 500);
          
          // Jouer le son localement en foreground (Android ne joue pas toujours le son du canal)
          if (Platform.OS === 'android') {
            const proutKeyToPlay = data?.proutKey || 'prout1'; // Fallback sur prout1 si manquant
            console.log('🔊 [FOREGROUND] Tentative de lecture son local pour:', proutKeyToPlay);
            // Appel direct pour tester
            playProutSoundLocally(proutKeyToPlay).then(() => {
              console.log('✅ Son joué avec succès');
            }).catch(err => {
              console.error('❌ [FOREGROUND] Erreur lecture son:', err);
              Alert.alert('Erreur son', String(err));
            });
          }
        } else if (data?.type === 'identity_response') {
          showToast('Identité révélée', body || 'Ton ami a partagé son identité.');
        }
      } catch (error: any) {
        Alert.alert('Erreur listener', String(error));
        console.error('❌ Erreur dans notificationListener:', error);
      }
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const data: any = response.notification.request.content.data;
      // Attendre un peu pour que l'app soit prête avant de naviguer
      setTimeout(() => {
        if (data?.type === 'identity_request') {
          safePush(router, {
            pathname: '/IdentityRevealScreen',
            params: {
              requesterId: data.requesterId,
              requesterPseudo: data.requesterPseudo,
            }
          }, { skipInitialCheck: false });
        } else if (data?.type === 'identity_response') {
          safeReplace(router, '/(tabs)', { skipInitialCheck: false });
        } else if (data?.type === 'prout') {
          safeReplace(router, '/(tabs)', { skipInitialCheck: false });
        }
      }, 500);
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  // Deep Linking
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      let data = Linking.parse(event.url);
      if (event.url.includes('confirm-email')) safeReplace(router, '/confirm-email', { skipInitialCheck: false });
      else if (event.url.includes('reset-password')) safeReplace(router, '/reset-password', { skipInitialCheck: false });
    };
    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [onboardingSeen, welcomeSeen] = await Promise.all([
          AsyncStorage.getItem('hasSeenOnboarding'),
          AsyncStorage.getItem('hasSeenWelcome'),
        ]);

        if (welcomeSeen === 'true' && !onboardingSeen) {
          await AsyncStorage.setItem('hasSeenOnboarding', 'true');
        }

        if ((!onboardingSeen || onboardingSeen !== 'true') && (!welcomeSeen || welcomeSeen !== 'true')) {
          if (isMounted) setShowOnboarding(true);
        }
      } catch (error) {
        console.warn('❌ Vérification onboarding impossible:', error);
      } finally {
        if (isMounted) setCheckingOnboarding(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // 🔴 Réinitialiser le badge iOS quand l'app revient au premier plan
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // L'app est revenue au premier plan, réinitialiser le badge
        Notifications.setBadgeCountAsync(0).catch(err => {
          console.warn('⚠️ Impossible de réinitialiser le badge:', err);
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleOnboardingFinish = async () => {
    try {
      await AsyncStorage.setItem('hasSeenWelcome', 'true');
    } catch (e) {
      console.warn('❌ Impossible de stocker hasSeenWelcome:', e);
    }

    try {
      await Notifications.requestPermissionsAsync();
    } catch (e) {
      console.warn('⚠️ Permission notifications refusée:', e);
    }

    try {
      await ensureContactPermissionWithDisclosure();
    } catch (e) {
      console.warn('⚠️ Permission contacts refusée:', e);
    }

    setShowOnboarding(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ebb89b' }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  if (checkingOnboarding) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ebb89b' }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {!checkingOnboarding && showOnboarding ? (
          <Onboarding onFinish={handleOnboardingFinish} />
        ) : (
          <>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="WelcomeScreen" />
              <Stack.Screen name="AuthChoiceScreen" />
              <Stack.Screen name="LoginScreen" />
              <Stack.Screen name="RegisterEmailScreen" />
              <Stack.Screen name="CompleteProfileScreen" />
              <Stack.Screen name="IdentityRevealScreen" options={{ presentation: 'modal' }} />
              {/* SearchUserScreen est maintenant intégré dans index.tsx, plus besoin de route dédiée */}
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="confirm-email" options={{ presentation: 'modal' }} />
              <Stack.Screen name="reset-password" options={{ presentation: 'modal' }} />
            </Stack>

            {toastMessage && (
              <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
                <Text style={styles.toastTitle}>{toastMessage.title}</Text>
                <Text style={styles.toastBody}>{toastMessage.body}</Text>
              </Animated.View>
            )}
          </>
        )}
      </GestureHandlerRootView>
    </AppErrorBoundary>
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
    shadowRadius: 3.84,
  },
  toastTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  toastBody: { color: '#eee', fontSize: 14 },
});