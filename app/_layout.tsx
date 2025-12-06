import { useAudioPlayer } from 'expo-audio';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
    // Jouer le son si l'app est ouverte
    const data = notification.request.content.data as { proutKey?: string; key?: string; type?: string } | undefined;
    const proutKey = data?.proutKey || data?.key;
    
    if (proutKey && PROUT_SOUNDS[proutKey] && notificationAudioPlayer) {
      notificationAudioPlayer.replace(PROUT_SOUNDS[proutKey]);
      notificationAudioPlayer.play();
    }

    return {
      shouldShowAlert: true,
      shouldPlaySound: false, // ⚠️ Désactiver le son système iOS - l'app joue le son personnalisé via notificationAudioPlayer
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
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

    // Les notifications sont gérées par expo-notifications (foreground et background)
    // Le listener Notifications.addNotificationReceivedListener ci-dessous s'occupe de tout

    // Vérifier la dernière notification reçue (au cas où l'app était fermée)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        // Dernière notification reçue
      }
    });

    // 👇 LISTENER pour les notifications reçues (foreground ET background)
    // Ce listener est appelé pour TOUTES les notifications, même en foreground
    const notificationSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as { 
        proutKey?: string; 
        key?: string; 
        type?: string;
        sender?: string;
        proutName?: string;
      } | undefined;
      const proutKey = data?.proutKey || data?.key;
      const sender = data?.sender;
      const proutName = data?.proutName;
      
      if (proutKey && PROUT_SOUNDS[proutKey] && notificationAudioPlayer) {
        notificationAudioPlayer.replace(PROUT_SOUNDS[proutKey]);
        notificationAudioPlayer.play();
        
        // Afficher un toast en foreground
        if (sender) {
          const displayTitle = proutName 
            ? `${sender} t'a envoyé ${proutName} ! 💨`
            : `${sender} t'a envoyé un prout 💨`;
          
          setToastMessage({
            title: displayTitle,
            body: '',
          });
          
          // Animation d'apparition/disparition
          Animated.sequence([
            Animated.timing(toastOpacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.delay(1300),
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

    // 👇 LISTENER pour les notifications cliquées (quand l'utilisateur clique sur la notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      // Notification cliquée (pas de log nécessaire)
    });

    // GESTION DES LIENS
    const handleAuthUrl = async (url: string) => {
      // Gérer les liens de réinitialisation de mot de passe
      if (url.includes('reset-password') || url.includes('type=recovery')) {
        // Marquer qu'on est dans un flux de réinitialisation pour éviter les redirections automatiques
        isResetPasswordFlow = true;
        
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

    // 👇 ÉCOUTEUR pour les changements d'état d'authentification (notamment SIGNED_IN après confirmation email)
    // ⚠️ On ignore les événements SIGNED_IN pendant le flux OAuth pour éviter les conflits de navigation
    // ⚠️ On ignore aussi les événements SIGNED_IN si on est sur la page reset-password
    let isOAuthFlow = false;
    let isResetPasswordFlow = false;
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Ne pas rediriger si on est dans un flux de réinitialisation de mot de passe
      if (isResetPasswordFlow) {
        return;
      }
      
      if (event === 'SIGNED_IN' && session?.user && !isOAuthFlow) {
        // Vérifier si c'est un flux de réinitialisation (type=recovery dans les métadonnées)
        const isRecoveryFlow = session.user.app_metadata?.provider === 'email' && 
                               (session.user.app_metadata?.recovery || 
                                session.user.user_metadata?.recovery);
        
        if (isRecoveryFlow) {
          isResetPasswordFlow = true;
          return; // Ne pas rediriger, laisser l'utilisateur sur reset-password
        }
        
        // Appeler checkProfileAndNavigate pour mettre à jour le pseudo
        // Seulement si on n'est pas dans un flux OAuth (géré par AuthChoiceScreen)
        checkProfileAndNavigate(session.user.id);
      }
    });
    
    // Exposer le flag pour que AuthChoiceScreen puisse le contrôler
    (global as any).__isOAuthFlow = (value: boolean) => {
      isOAuthFlow = value;
    };

    setTimeout(() => setIsReady(true), 100);
    return () => {
      subscription.remove();
      notificationSubscription.remove();
      responseSubscription.remove();
      authSubscription.unsubscribe();
    };
  }, []);

  const checkProfileAndNavigate = async (userId: string) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Récupérer le profil et les métadonnées utilisateur
    const { data: profile } = await supabase.from('user_profiles').select('pseudo').eq('id', userId).maybeSingle();
    const { data: { user } } = await supabase.auth.getUser();
    
    // 1. D'abord, chercher le pseudo d'inscription explicite
    let pseudoFromMetadata = user?.user_metadata?.pseudo || null;
    let pseudoExtractedFromApple = false;
    
    // 2. Si pas de pseudo d'inscription, extraire le prénom depuis Apple/Google (full_name ou name)
    if (!pseudoFromMetadata || pseudoFromMetadata === 'Nouveau Membre') {
      const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || null;
      if (fullName) {
        // Extraire le prénom (première partie avant l'espace)
        const firstName = fullName.split(' ')[0].trim();
        if (firstName && firstName.length > 0) {
          pseudoFromMetadata = firstName;
          pseudoExtractedFromApple = true; // Marquer que le pseudo vient d'être extrait
          // Stocker le prénom dans les métadonnées pour les prochaines connexions
          await supabase.auth.updateUser({
            data: { pseudo: firstName }
          });
        }
      }
    }
    
    const phoneFromMetadata = user?.user_metadata?.phone;
    
    if (pseudoFromMetadata && (!profile || profile.pseudo === 'Nouveau Membre' || !profile.pseudo)) {
      // Attendre un peu pour laisser le trigger créer le profil si nécessaire
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Vérifier si le profil existe avant de faire update ou upsert
      const { data: checkProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      
      const updateData = {
        pseudo: pseudoFromMetadata,
        phone: phoneFromMetadata || null,
        updated_at: new Date().toISOString()
      };
      
      let updateError, updateResult;
      if (checkProfile) {
        updateResult = await supabase
          .from('user_profiles')
          .update(updateData)
          .eq('id', userId)
          .select();
        updateError = updateResult.error;
      } else {
        updateResult = await supabase
          .from('user_profiles')
          .upsert({ 
            id: userId,
            ...updateData
          }, {
            onConflict: 'id'
          })
          .select();
        updateError = updateResult.error;
      }
      
      if (updateError) {
        console.error('❌ Erreur mise à jour pseudo:', updateError);
        // Retry après un délai avec upsert pour être sûr
        await new Promise(resolve => setTimeout(resolve, 1000));
        await supabase
          .from('user_profiles')
          .upsert({ 
            id: userId,
            pseudo: pseudoFromMetadata,
            phone: phoneFromMetadata || null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          });
      }
      
      // Recharger le profil après mise à jour
      const { data: updatedProfile } = await supabase.from('user_profiles').select('pseudo').eq('id', userId).maybeSingle();
      
      // Si le pseudo vient d'être extrait depuis Apple, toujours rediriger vers CompleteProfileScreen
      // pour que l'utilisateur valide/modifie le pseudo
      if (pseudoExtractedFromApple) {
        // Pseudo extrait depuis Apple, redirection vers CompleteProfileScreen
        router.replace('/CompleteProfileScreen');
        return;
      }
      
      if (updatedProfile && updatedProfile.pseudo && updatedProfile.pseudo !== 'Nouveau Membre') {
        router.replace('/(tabs)');
        return;
      }
    }
    
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
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
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