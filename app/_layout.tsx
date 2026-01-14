import AsyncStorage from '@react-native-async-storage/async-storage';
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

// 🔔 CONFIGURATION GLOBALE
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    return {
      shouldPlaySound: true, // ✅ Le son du canal joue normalement
      shouldSetBadge: false,
      shouldShowBanner: true, // ✅ Banner système activé
      shouldShowList: true,
    };
  },
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
      const { title, body, data } = notification.request.content;
      
      if (data?.type === 'prout') {
        showToast(title || 'Prout !', body || '');
      } else if (data?.type === 'identity_response') {
        showToast('Identité révélée', body || 'Ton ami a partagé son identité.');
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