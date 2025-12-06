import { FriendsList } from '@/components/FriendsList';
import { getFCMToken } from '@/lib/fcmToken';
import { safePush, safeReplace } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Animated, Image, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
  const router = useRouter();
  
  const isLoadedRef = useRef(false);
  
  // Animation de secousse pour le header - seulement X et Y (pas de rotation)
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

        {/* 2. LA BARRE DE NAVIGATION (Juste en dessous) */}
        <View style={styles.navBar}>
             {/* Bouton Invitation (Gauche) */}
            <TouchableOpacity onPress={() => safePush(router, '/invitation', { skipInitialCheck: false })} style={styles.iconButton}>
                <Ionicons name="paper-plane" size={32} color="#ffffff" />
            </TouchableOpacity>

             {/* Bouton Profil (Droite) */}
            <TouchableOpacity onPress={() => safePush(router, '/profile', { skipInitialCheck: false })} style={styles.iconButton}>
                <Image 
                    source={require('../../assets/images/icon_compte.png')} 
                    style={styles.navIcon} 
                    resizeMode="contain"
                />
            </TouchableOpacity>
        </View>
      </View>

      {/* 3. LA LISTE */}
      <View style={styles.listSection}>
        <FriendsList onProutSent={shakeHeader} />
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
    paddingBottom: 10,
  },
  listSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  
  // Conteneur du Logo
  logoContainer: {
    alignItems: 'center',
    marginBottom: 10, // Espace entre le logo et les boutons
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
    marginBottom: 20, // Espace entre les boutons et la liste
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