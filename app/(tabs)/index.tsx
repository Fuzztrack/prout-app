import { EditProfil } from '@/components/EditProfil';
import { FriendsList } from '@/components/FriendsList';
import { SearchUser } from '@/components/SearchUser';
import { TutorialSwiper } from '@/components/TutorialSwiper';
import i18n from '@/lib/i18n';
import { getFCMToken } from '@/lib/fcmToken';
import { safePush, safeReplace } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Platform, Share, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();
  
  const isLoadedRef = useRef(false);
  const [activeView, setActiveView] = useState<'list' | 'tutorial' | 'search' | 'profile'>('list');
  const [isZenMode, setIsZenMode] = useState(false);
  const [currentPseudo, setCurrentPseudo] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);
  
  // Animation de secousse pour le header
  const shakeX = useRef(new Animated.Value(0)).current;
  const shakeY = useRef(new Animated.Value(0)).current;

  // --- MISE À JOUR TOKEN FCM ---
  const updatePushToken = async (userId: string) => {
    // Permettre le simulateur pour le développement (Device.isDevice retourne false dans le simulateur)
    if (Platform.OS === 'web') return;
    try {
      // Demander la permission de notifications (nécessaire pour les canaux Android)
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') {
        // Obtenir le token FCM natif (ou Expo Push Token sur iOS)
        const fcmToken = await getFCMToken();
        if (fcmToken) {
          console.log('✅ Token généré:', Platform.OS === 'ios' ? 'Expo Push Token' : 'FCM Token', fcmToken.substring(0, 30) + '...');
          // Stocker le token FCM dans expo_push_token (on réutilise le champ existant)
          // Ou créer un nouveau champ fcm_token dans Supabase si préféré
          const { error } = await supabase.from('user_profiles').update({ expo_push_token: fcmToken, push_platform: Platform.OS }).eq('id', userId);
          if (error) {
            console.error('❌ Erreur mise à jour token dans Supabase:', error);
          } else {
            console.log('✅ Token mis à jour dans Supabase');
          }
        }
      }
    } catch (e) { 
      console.error('Erreur mise à jour token FCM:', e);
    }
  };

  // --- CHARGEMENT ---
  const loadData = async () => {
    if (isLoadedRef.current) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        safeReplace(router, '/AuthChoiceScreen', { skipInitialCheck: false });
        return;
      }
      setUserId(user.id);

      // Charger l'état Zen et le pseudo
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_zen_mode, pseudo')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        setIsZenMode(profile.is_zen_mode || false);
        setCurrentPseudo(profile.pseudo || '');
      }

      // Mise à jour token FCM en arrière-plan (fonctionne aussi dans le simulateur)
      if (Platform.OS !== 'web') {
          Notifications.getPermissionsAsync().then(({ status }) => {
              if (status === 'granted') {
                  getFCMToken().then(fcmToken => {
                      if (fcmToken) {
                          console.log('✅ Token généré au chargement:', Platform.OS === 'ios' ? 'Expo Push Token' : 'FCM Token', fcmToken.substring(0, 30) + '...');
                          supabase.from('user_profiles').update({ expo_push_token: fcmToken, push_platform: Platform.OS }).eq('id', user.id).then(({ error }) => {
                              if (error) {
                                  console.error('❌ Erreur mise à jour token dans Supabase:', error);
                              } else {
                                  console.log('✅ Token mis à jour dans Supabase');
                              }
                          });
                      }
                  });
              } else {
                  console.warn('⚠️ Permission de notifications non accordée');
              }
          });
      }
      isLoadedRef.current = true;
    } catch (e) {
      console.log("Erreur Home:", e);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Fonction pour vibrer le header quand un prout est envoyé - mouvement subtil (haut-bas, gauche-droite)
  const shakeHeader = useCallback(() => {
    // Réinitialiser toutes les valeurs
    shakeX.setValue(0);
    shakeY.setValue(0);
    
    // Animation de vibration subtile avec mouvements réduits
    const steps = 8; // Moins d'étapes pour un mouvement plus simple
    const baseDuration = 40; // Durée légèrement plus longue pour plus de fluidité
    const amplitude = 4; // Amplitude réduite pour un mouvement subtil (au lieu de 12-15)
    
    // Générer des valeurs simples pour une vibration subtile
    const generateVibrationValues = (count: number, amp: number) => {
      const values = [];
      // Alternance simple : droite, gauche, droite, gauche... (ou haut, bas, haut, bas...)
      for (let i = 0; i < count; i++) {
        // Alternance simple avec amplitude réduite
        values.push((i % 2 === 0 ? 1 : -1) * amp);
      }
      return values;
    };
    
    // Valeurs simples pour X (gauche-droite) - amplitude réduite
    const xValues = generateVibrationValues(steps, amplitude);
    // Valeurs simples pour Y (haut-bas) - amplitude réduite
    const yValues = generateVibrationValues(steps, amplitude);
    
    // Durées constantes pour un mouvement plus fluide
    const durations = Array(steps).fill(baseDuration);
    
    const createVibrationSequence = (
      value: Animated.Value, 
      values: number[], 
      durations: number[]
    ) => {
      const animations: Animated.CompositeAnimation[] = [];
      for (let i = 0; i < values.length; i++) {
        animations.push(
          Animated.timing(value, {
            toValue: values[i],
            duration: durations[i],
            useNativeDriver: true,
          })
        );
      }
      // Retour à zéro
      animations.push(
        Animated.timing(value, {
          toValue: 0,
          duration: baseDuration,
          useNativeDriver: true,
        })
      );
      return animations;
    };
    
    // Animer X et Y en parallèle pour créer une vibration subtile
    Animated.parallel([
      Animated.sequence(createVibrationSequence(shakeX, xValues, durations)),
      Animated.sequence(createVibrationSequence(shakeY, yValues, durations)),
    ]).start();
  }, [shakeX, shakeY]);

  // --- MODE ZEN ---
  const toggleZenMode = async () => {
    if (!userId) return;
    
    // Si on active le mode Zen, on demande confirmation
    if (!isZenMode) {
      Alert.alert(
        i18n.t('zen_confirm_title'),
        i18n.t('zen_confirm_body'),
        [
          { text: i18n.t('cancel'), style: "cancel" },
          { 
            text: i18n.t('activate'), 
            onPress: async () => {
              await applyZenMode(true);
            }
          }
        ]
      );
    } else {
      // Si on désactive, on le fait direct
      await applyZenMode(false);
    }
  };

  const applyZenMode = async (newMode: boolean) => {
    setIsZenMode(newMode); // Optimistic update

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_zen_mode: newMode })
        .eq('id', userId);

      if (error) {
        console.error('Erreur mise à jour mode Zen:', error);
        setIsZenMode(!newMode); // Rollback
      }
    } catch (e) {
      console.error('Erreur mode Zen:', e);
      setIsZenMode(!newMode);
    }
  };

  // --- PARTAGE ---
  const handleShare = async () => {
    try {
      const result = await Share.share({
        message: i18n.t('share_message', { pseudo: currentPseudo }),
      });
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // shared with activity type of result.activityType
        } else {
          // shared
        }
      } else if (result.action === Share.dismissedAction) {
        // dismissed
      }
    } catch (error: any) {
      console.error(error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        {/* 1. LE LOGO (Tout en haut, centré) */}
        <Animated.View 
          style={[
            styles.logoContainer,
            {
              transform: [
                { translateX: shakeX },
                { translateY: shakeY },
              ],
            }
          ]}
        >
          <Image 
              source={require('../../assets/images/prout-meme.png')} 
              style={styles.headerImage} 
              resizeMode="contain" 
          />
        </Animated.View>

        {/* 2. LA BARRE DE NAVIGATION (5 Boutons) */}
        <View style={styles.navBar}>
             {/* 1. Profil */}
            <TouchableOpacity 
              onPress={() => setActiveView(activeView === 'profile' ? 'list' : 'profile')} 
              style={[styles.iconButton, activeView === 'profile' && { opacity: 0.7 }]}
            >
                {activeView === 'profile' ? (
                  <Ionicons name="close-circle-outline" size={32} color="#ffffff" />
                ) : (
                  <Image 
                      source={require('../../assets/images/icon_compte.png')} 
                      style={styles.navIcon} 
                      resizeMode="contain"
                  />
                )}
            </TouchableOpacity>

             {/* 2. Partage Direct (Invitation) */}
            <TouchableOpacity onPress={handleShare} style={styles.iconButton}>
                <Ionicons name="share-social-outline" size={30} color="#ffffff" />
            </TouchableOpacity>

             {/* 3. Recherche (Loupe -> Ajout ami) */}
            <TouchableOpacity 
              onPress={() => setActiveView(activeView === 'search' ? 'list' : 'search')} 
              style={[styles.iconButton, activeView === 'search' && { opacity: 0.7 }]}
            >
                <Ionicons name={activeView === 'search' ? "close-circle-outline" : "person-add-outline"} size={30} color="#ffffff" />
            </TouchableOpacity>

             {/* 4. Mode Zen (Lune) */}
            <TouchableOpacity 
              onPress={toggleZenMode} 
              style={[styles.iconButton, isZenMode && { opacity: 0.7 }]}
            >
                <Ionicons name={isZenMode ? "moon" : "moon-outline"} size={30} color={isZenMode ? "#ffd700" : "#ffffff"} />
            </TouchableOpacity>

             {/* 5. Tutoriel (?) */}
            <TouchableOpacity 
              onPress={() => setActiveView(activeView === 'tutorial' ? 'list' : 'tutorial')} 
              style={[styles.iconButton, activeView === 'tutorial' && { opacity: 0.7 }]}
            >
                <Ionicons name={activeView === 'tutorial' ? "close-circle-outline" : "help-circle-outline"} size={32} color="#ffffff" />
            </TouchableOpacity>
        </View>
      </View>

      {/* 3. CONTENU PRINCIPAL (Liste, Tuto, Recherche ou Profil) */}
      <View style={styles.listSection}>
        {activeView === 'tutorial' ? (
          <TutorialSwiper onClose={() => setActiveView('list')} />
        ) : activeView === 'search' ? (
          <SearchUser onClose={() => setActiveView('list')} />
        ) : activeView === 'profile' ? (
          <EditProfil onClose={() => setActiveView('list')} />
        ) : (
          <FriendsList onProutSent={shakeHeader} isZenMode={isZenMode} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#ebb89b' 
  },
  headerSection: {
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 5, // Réduit de 10 à 5
  },
  listSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  
  // Conteneur du Logo
  logoContainer: {
    alignItems: 'center',
    marginBottom: 5, // Réduit de 10 à 5
  },
  headerImage: { 
    width: 220, 
    height: 160, 
  },

  // Barre de boutons
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Écarte les boutons aux extrémités
    alignItems: 'center',
    marginBottom: 10, // Réduit de 20 à 10
    paddingHorizontal: 10, // Marges sur les côtés
  },
  
  iconButton: {
    padding: 5,
    // backgroundColor: 'rgba(255,255,255,0.2)', // Décommentez pour voir la zone de touche
    borderRadius: 10,
  },
  
  navIcon: {
    width: 32, // Taille contrôlée
    height: 32,
    tintColor: 'white' // Icônes en blanc
  }
});