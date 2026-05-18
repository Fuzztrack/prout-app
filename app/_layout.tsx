import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, AppState, NativeModules, Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

import Onboarding from '../components/Onboarding';
import EulaAcceptScreen from './eula-accept';
import { logSessionSnapshot } from '../lib/authDebug';
import { ensureContactPermissionWithDisclosure } from '../lib/contactConsent';
import { hasAcceptedEulaLocally } from '../lib/eula';
import { supabase } from '../lib/supabase';
import { registerPushTokenForUser } from '../lib/pushTokenRegistration';
import i18n from '../lib/i18n';

// Services
import { initNotificationHandler, setupNotificationListeners, injectMessageFromNotification } from '@/lib/services/NotificationService';
import { saveLocaleToSupabase } from '@/lib/services/AuthService';
import { initializeApp } from '@/lib/services/AppInitializer';

// Hooks
import { useDeepLinking } from '@/hooks/useDeepLinking';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 10 minutes : les données sont considérées comme fraîches assez longtemps
      staleTime: 1000 * 60 * 10,
      // 30 jours : garde les données en cache (AsyncStorage)
      gcTime: 1000 * 60 * 60 * 24 * 30,
      retry: 2,
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'PROUT_QUERY_CACHE',
});

persistQueryClient({
  queryClient,
  persister: asyncStoragePersister,
  maxAge: 1000 * 60 * 60 * 24 * 30, // 30 jours
});

SplashScreen.preventAutoHideAsync().catch(() => {});
SystemUI.setBackgroundColorAsync("#ebb89b");
initNotificationHandler();

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, info: any) { console.error('App error boundary caught:', error, info); }
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
  const [offlineAccess, setOfflineAccess] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showEulaGate, setShowEulaGate] = useState(false);
  const router = useRouter();
  const [toastMessage, setToastMessage] = useState<{ title: string; body: string } | null>(null);
  const [toastOpacity] = useState(new Animated.Value(0));

  // Check for cold-start notification
  useEffect(() => {
    (async () => {
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (response && response.notification.request.content.data) {
          console.log('🥶 [COLD START] Notification response found:', JSON.stringify(response.notification.request.content.data));
          await injectMessageFromNotification(response.notification.request.content.data);
        }
      } catch (error) {
        console.error('❌ [COLD START] Error checking last notification:', error);
      }
    })();
  }, []);

  // Activer le Deep Linking
  useDeepLinking();

  useEffect(() => {
    const nativeSoundSettingsModule = NativeModules.SoundSettingsModule;
    nativeSoundSettingsModule?.setAppInForeground?.(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (nextState) => {
      nativeSoundSettingsModule?.setAppInForeground?.(nextState === 'active');
    });
    return () => subscription.remove();
  }, []);

  const showToast = (title: string, body: string) => {
    setToastMessage({ title, body });
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(4000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastMessage(null));
  };

  useEffect(() => {
    const init = async () => {
      const result = await initializeApp();
      setSession(result.session);
      setOfflineAccess(result.offlineAccess);
      setShowOnboarding(result.showOnboarding);
      setShowEulaGate(result.showEulaGate);
      setCheckingOnboarding(false);
      setLoading(false);
      
      // Sauvegarde locale au démarrage si possible
      if (result.session) saveLocaleToSupabase();
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (__DEV__) console.log('🔔 [AuthChange] Event:', event);
      if (session) {
        setSession(session);
        AsyncStorage.setItem('supabase_was_logged_in', 'true');
        saveLocaleToSupabase();
        setTimeout(() => registerPushTokenForUser(session.user.id).catch(() => {}), 1000);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        AsyncStorage.removeItem('supabase_was_logged_in');
        setOfflineAccess(false);
      }
    });

    const cleanupNotifications = setupNotificationListeners(router, showToast);

    return () => {
      supabase.auth.stopAutoRefresh();
      subscription.unsubscribe();
      cleanupNotifications();
    };
  }, [router]);

  // Rattrapage du token Push au premier plan (Foreground)
  useEffect(() => {
    if (!session?.user?.id) return;

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        if (__DEV__) console.log('🔄 [Layout] Rattrapage token push (Foreground)');
        registerPushTokenForUser(session.user.id).catch(() => {});
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [session?.user?.id]);

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loading]);

  const handleOnboardingFinish = async () => {
    try { await AsyncStorage.setItem('hasSeenWelcome', 'true'); } catch (e) {}

    // 1. Notifications
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) registerPushTokenForUser(session.user.id).catch(() => {});
      }
    } catch (e) {}

    // 2. Contacts
    try { await ensureContactPermissionWithDisclosure(); } catch (e) {}

    const eulaAccepted = await hasAcceptedEulaLocally();
    setShowEulaGate(!eulaAccepted);
    setShowOnboarding(false);
  };
  if (loading || checkingOnboarding) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ebb89b' }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <KeyboardProvider statusBarTranslucent>
          <SafeAreaProvider>
            <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#ebb89b' }}>
              <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
              {!showOnboarding && !showEulaGate ? (
                <>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="WelcomeScreen" />
                    <Stack.Screen name="AuthChoiceScreen" />
                    <Stack.Screen name="LoginScreen" />
                    <Stack.Screen name="RegisterEmailScreen" />
                    <Stack.Screen name="CompleteProfileScreen" />
                    <Stack.Screen name="IdentityRevealScreen" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="chat" options={{ gestureEnabled: true }} />
                    <Stack.Screen name="soundcheck" options={{ gestureEnabled: true }} />
                    <Stack.Screen name="confirm-email" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="reset-password" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="eula-accept" options={{ gestureEnabled: false, presentation: 'fullScreenModal' }} />
                    <Stack.Screen name="edit-profile" options={{ presentation: 'transparentModal', animation: 'fade', headerShown: false }} />
                    <Stack.Screen name="complicity" />
                    <Stack.Screen name="Profil" options={{ gestureEnabled: true }} />
                  </Stack>
                  {toastMessage && (
                    <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
                      <Text style={styles.toastTitle}>{toastMessage.title}</Text>
                      <Text style={styles.toastBody}>{toastMessage.body}</Text>
                    </Animated.View>
                  )}
                </>
              ) : null}

              {!checkingOnboarding && showOnboarding ? (
                <Onboarding onFinish={handleOnboardingFinish} />
              ) : null}

              {!checkingOnboarding && !showOnboarding && showEulaGate ? (
                <View style={styles.eulaGateOverlay}>
                  <EulaAcceptScreen
                    defaultNextPath="/AuthChoiceScreen"
                    onAccepted={() => setShowEulaGate(false)}
                  />
                </View>
              ) : null}
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </KeyboardProvider>
      </QueryClientProvider>
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
  eulaGateOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 20,
  },
});

