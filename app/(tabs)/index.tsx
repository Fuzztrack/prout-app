import { EditProfil } from '@/components/EditProfil';
import { FriendsList } from '@/components/FriendsList';
import { IdentityList } from '@/components/IdentityList';
import { PrivacyPolicyModal } from '@/components/PrivacyPolicyModal';
import { SearchUser } from '@/components/SearchUser';
import { TutorialSwiper } from '@/components/TutorialSwiper';
import { getFCMToken } from '@/lib/fcmToken';
import i18n from '@/lib/i18n';
import { safeReplace } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ActionSheetIOS, Animated, Image, Keyboard, KeyboardAvoidingView, Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const isLoadedRef = useRef(false);
  const [activeView, setActiveView] = useState<'list' | 'tutorial' | 'search' | 'profile' | 'profileMenu' | 'identity'>('list');
  const [isZenMode, setIsZenMode] = useState(false);
  const [currentPseudo, setCurrentPseudo] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const zenTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const zenStartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ZEN_END_KEY = 'zen_end_at';
  const ZEN_REASON_KEY = 'zen_reason';
  const ZEN_START_KEY = 'zen_start_at';
  const [showZenOptions, setShowZenOptions] = useState(false);
const CACHE_PSEUDO_KEY = 'cached_current_pseudo';
  
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
        const pseudo = profile.pseudo || '';
        setCurrentPseudo(pseudo);
        // Mémoriser pour affichage instantané au prochain lancement
        AsyncStorage.setItem(CACHE_PSEUDO_KEY, pseudo).catch(() => {});
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

  // Précharger le pseudo depuis le cache pour afficher le bonjour instantanément
  useEffect(() => {
    AsyncStorage.getItem(CACHE_PSEUDO_KEY).then((cached) => {
      if (cached) setCurrentPseudo(cached);
    }).catch(() => {});
    loadData();
  }, []);

  // Écouter les événements du clavier pour corriger le problème de marge sur Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
        setKeyboardVisible(true);
      });
      const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
        // Forcer une mise à jour du layout après la fermeture du clavier
        setTimeout(() => {
          setKeyboardVisible(false);
        }, 100);
      });

      return () => {
        keyboardDidShowListener.remove();
        keyboardDidHideListener.remove();
      };
    }
  }, []);

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
  const clearZenAutoOff = useCallback(async () => {
    if (zenTimeoutRef.current) {
      clearTimeout(zenTimeoutRef.current);
      zenTimeoutRef.current = null;
    }
    await AsyncStorage.multiRemove([ZEN_END_KEY, ZEN_REASON_KEY, ZEN_START_KEY]);
  }, [ZEN_END_KEY, ZEN_REASON_KEY, ZEN_START_KEY]);

  const clearZenAutoOn = useCallback(async () => {
    if (zenStartTimeoutRef.current) {
      clearTimeout(zenStartTimeoutRef.current);
      zenStartTimeoutRef.current = null;
    }
    await AsyncStorage.removeItem(ZEN_START_KEY);
  }, [ZEN_START_KEY]);

  const applyZenMode = useCallback(
    async (newMode: boolean, fromAuto = false) => {
      if (!userId) return;

      setIsZenMode(newMode); // Optimistic update

      try {
        const { error } = await supabase
          .from('user_profiles')
          .update({ is_zen_mode: newMode })
          .eq('id', userId);

        if (error) {
          console.error('Erreur mise à jour mode Zen:', error);
          setIsZenMode(!newMode); // Rollback
        } else if (!newMode) {
          await clearZenAutoOff();
          await clearZenAutoOn();
        }
      } catch (e) {
        console.error('Erreur mode Zen:', e);
        setIsZenMode(!newMode);
        if (!newMode) {
          await clearZenAutoOff();
          await clearZenAutoOn();
        }
      }
    },
    [clearZenAutoOff, clearZenAutoOn, supabase, userId]
  );

  const scheduleZenAutoOff = useCallback(
    async (endAt: number, reason: string) => {
      const delay = Math.max(0, endAt - Date.now());
      await AsyncStorage.multiSet([
        [ZEN_END_KEY, String(endAt)],
        [ZEN_REASON_KEY, reason],
      ]);
      if (zenTimeoutRef.current) {
        clearTimeout(zenTimeoutRef.current);
      }
      zenTimeoutRef.current = setTimeout(() => {
        applyZenMode(false, true);
      }, delay);
    },
    [ZEN_END_KEY, ZEN_REASON_KEY, applyZenMode]
  );

  const scheduleZenWindow = useCallback(
    async (startAt: number, endAt: number, reason: string) => {
      const now = Date.now();
      // Nettoyer timers existants
      if (zenStartTimeoutRef.current) {
        clearTimeout(zenStartTimeoutRef.current);
        zenStartTimeoutRef.current = null;
      }
      if (zenTimeoutRef.current) {
        clearTimeout(zenTimeoutRef.current);
        zenTimeoutRef.current = null;
      }

      // Enregistrer start/end
      await AsyncStorage.multiSet([
        [ZEN_START_KEY, String(startAt)],
        [ZEN_END_KEY, String(endAt)],
        [ZEN_REASON_KEY, reason],
      ]);

      if (now >= endAt) {
        // Fenêtre passée
        await applyZenMode(false, true);
        await clearZenAutoOff();
        await clearZenAutoOn();
        return;
      }

      if (now >= startAt) {
        // Démarrer maintenant, programmer la fin
        await applyZenMode(true, true);
        await scheduleZenAutoOff(endAt, reason);
      } else {
        // Programmer le début puis la fin
        const delayStart = Math.max(0, startAt - now);
        zenStartTimeoutRef.current = setTimeout(async () => {
          await applyZenMode(true, true);
          await scheduleZenAutoOff(endAt, reason);
        }, delayStart);
      }
    },
    [applyZenMode, clearZenAutoOff, clearZenAutoOn, scheduleZenAutoOff, ZEN_END_KEY, ZEN_REASON_KEY, ZEN_START_KEY]
  );

  const restoreZenAutoOff = useCallback(async () => {
    try {
      const [[, startRaw], [, endRaw], [, reason]] = await AsyncStorage.multiGet([ZEN_START_KEY, ZEN_END_KEY, ZEN_REASON_KEY]);
      const startAt = startRaw ? Number(startRaw) : null;
      const endAt = endRaw ? Number(endRaw) : null;
      if (!endAt || !Number.isFinite(endAt)) {
        await clearZenAutoOff();
        await clearZenAutoOn();
        return;
      }
      if (startAt && !Number.isFinite(startAt)) {
        await clearZenAutoOn();
      }
      const now = Date.now();
      if (now >= endAt) {
        await applyZenMode(false, true);
        await clearZenAutoOff();
        await clearZenAutoOn();
        return;
      }
      if (startAt && now < startAt) {
        // pas encore commencé
        await scheduleZenWindow(startAt, endAt, reason || '');
        return;
      }
      // déjà dans la fenêtre
      await applyZenMode(true, true);
      await scheduleZenAutoOff(endAt, reason || '');
    } catch (e) {
      console.error('Erreur restauration timer Zen:', e);
    }
  }, [ZEN_START_KEY, ZEN_END_KEY, ZEN_REASON_KEY, applyZenMode, clearZenAutoOff, clearZenAutoOn, scheduleZenAutoOff, scheduleZenWindow]);

  useEffect(() => {
    restoreZenAutoOff();
  }, [restoreZenAutoOff]);

  const handleZenSelection = useCallback(
    async (type: '1h' | '8h' | 'job' | 'night') => {
      const now = new Date();
      const handleDuration = async (hours: number, label: string) => {
        const endAt = Date.now() + hours * 60 * 60 * 1000;
        await scheduleZenWindow(Date.now(), endAt, label);
      };

      if (type === '1h') {
        await handleDuration(1, '1h');
        return;
      }
      if (type === '8h') {
        await handleDuration(8, '8h');
        return;
      }
      if (type === 'job') {
        const day = now.getDay(); // 0 dimanche - 6 samedi
        const hour = now.getHours();
        const minute = now.getMinutes();
        const isWeekday = day >= 1 && day <= 5;
        const inWindow = isWeekday && (hour > 9 || (hour === 9 && minute >= 0)) && (hour < 19 || (hour === 19 && minute === 0));
        let start = new Date(now);
        let end = new Date(now);
        if (!isWeekday) {
          // Trouver le prochain jour ouvré
          const daysToAdd = day === 5 ? 3 : day === 6 ? 2 : 1; // ven->lun, sam->lun, dim->lun
          start.setDate(start.getDate() + daysToAdd);
          end.setDate(end.getDate() + daysToAdd);
          start.setHours(9, 0, 0, 0);
          end.setHours(19, 0, 0, 0);
        } else if (hour >= 19) {
          // Prochain jour ouvré suivant
          const daysToAdd = day === 5 ? 3 : 1; // ven->lun sinon lendemain
          start.setDate(start.getDate() + daysToAdd);
          end.setDate(end.getDate() + daysToAdd);
          start.setHours(9, 0, 0, 0);
          end.setHours(19, 0, 0, 0);
        } else if (hour < 9) {
          start.setHours(9, 0, 0, 0);
          end.setHours(19, 0, 0, 0);
        } else {
          // Déjà dans la plage
          start = now;
          end.setHours(19, 0, 0, 0);
        }
        await scheduleZenWindow(start.getTime(), end.getTime(), 'job');
        return;
      }
      if (type === 'night') {
        const hour = now.getHours();
        const start = new Date(now);
        const end = new Date(now);
        if (hour >= 22) {
          start.setHours(hour, now.getMinutes(), 0, 0);
          end.setDate(end.getDate() + 1);
          end.setHours(8, 0, 0, 0);
        } else if (hour < 8) {
          // déjà dans la plage (après minuit)
          end.setHours(8, 0, 0, 0);
        } else {
          // Prochaine nuit à 22h
          start.setHours(22, 0, 0, 0);
          end.setDate(end.getDate() + 1);
          end.setHours(8, 0, 0, 0);
        }
        await scheduleZenWindow(start.getTime(), end.getTime(), 'night');
        return;
      }
    },
    [scheduleZenWindow]
  );

  const toggleZenMode = async () => {
    if (!userId) return;

    // Si on active le mode Zen, proposer des durées
    if (!isZenMode) {
      if (Platform.OS === 'ios') {
        const options = ['1h', '8h', 'Save my job !', 'Save my night !', i18n.t('cancel')];
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options,
            cancelButtonIndex: 4,
            title: i18n.t('zen_confirm_title'),
          },
          (buttonIndex) => {
            if (buttonIndex === 0) handleZenSelection('1h');
            if (buttonIndex === 1) handleZenSelection('8h');
            if (buttonIndex === 2) handleZenSelection('job');
            if (buttonIndex === 3) handleZenSelection('night');
          }
        );
      } else {
        setShowZenOptions(true);
      }
    } else {
      // Si on désactive, on le fait direct
      await applyZenMode(false);
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
      <KeyboardAvoidingView 
        behavior="padding"
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={0}
        enabled={Platform.OS === 'android' ? keyboardVisible : true}
      >
        {/* Modal simple pour Android : choix du Mode Zen */}
        {showZenOptions && (
          <View style={styles.zenOverlay}>
            <View style={styles.zenCard}>
              <Text style={styles.zenTitle}>{i18n.t('zen_confirm_title')}</Text>
              <Text style={styles.zenSubtitle}>Choisissez une durée</Text>
              {[
                { label: '1h', type: '1h' as const },
                { label: '8h', type: '8h' as const },
                { label: 'Save my job ! (9h-19h, lun-ven)', type: 'job' as const },
                { label: 'Save my night ! (22h-8h)', type: 'night' as const },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.type}
                  style={styles.zenOption}
                  onPress={async () => {
                    setShowZenOptions(false);
                    await handleZenSelection(opt.type);
                  }}
                >
                  <Text style={styles.zenOptionText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.zenCancel} onPress={() => setShowZenOptions(false)}>
                <Text style={styles.zenCancelText}>{i18n.t('cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* CONTENU PRINCIPAL */}
        {activeView !== 'list' && (
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

            {/* 2. LA BARRE DE NAVIGATION */}
            <View style={styles.navBar}>
              <View style={styles.navBarContent}>
                <View style={styles.greetingContainer}>
                  {currentPseudo ? (
                    <View style={styles.greetingRow}>
                      <Text style={styles.greetingText}>Bonjour {currentPseudo} !</Text>
                      {isZenMode && (
                        <Ionicons
                          name="moon"
                          size={18}
                          color="#ffd700"
                          style={styles.zenIcon}
                        />
                      )}
                    </View>
                  ) : null}
                </View>
                {/* 1. Profil */}
                <TouchableOpacity 
                  onPress={() => setActiveView(activeView === 'profileMenu' ? 'list' : 'profileMenu')} 
                  style={[styles.iconButton, (activeView === 'profileMenu' || activeView === 'profile') && { opacity: 0.7 }]}
                >
                    {(activeView === 'profileMenu' || activeView === 'profile') ? (
                      <Ionicons name="close-circle-outline" size={28} color="#ffffff" />
                    ) : (
                      <Image 
                          source={require('../../assets/images/icon_compte.png')} 
                          style={styles.navIcon} 
                          resizeMode="contain"
                      />
                    )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        <View style={[styles.listSection, Platform.OS === 'android' && !keyboardVisible && { paddingBottom: 0, marginBottom: 0 }]}>
        {activeView === 'tutorial' ? (
          <TutorialSwiper onClose={() => setActiveView('list')} />
        ) : activeView === 'search' ? (
          <SearchUser onClose={() => setActiveView('list')} />
        ) : activeView === 'profile' ? (
          <EditProfil onClose={() => setActiveView('list')} />
        ) : activeView === 'profileMenu' ? (
          <View style={styles.menuCard}>
            {[
              { label: 'Rechercher un ami', icon: 'person-add-outline', onPress: () => setActiveView('search'), iconColor: '#604a3e' },
              { label: 'Mode Zen', icon: isZenMode ? 'moon' : 'moon-outline', onPress: toggleZenMode, iconColor: isZenMode ? '#ffd700' : '#604a3e' },
              { label: 'Gérez votre profil', icon: 'person-circle-outline', onPress: () => setActiveView('profile'), iconColor: '#604a3e' },
              { label: 'Inviter un ami', icon: 'share-social-outline', onPress: handleShare, iconColor: '#604a3e' },
              { label: 'Revoir les fonctions de l\'appli', icon: 'help-circle-outline', onPress: () => setActiveView('tutorial'), iconColor: '#604a3e' },
              { label: 'Qui est qui ? Vérifiez les pseudos', icon: 'eye-outline', onPress: () => setActiveView('identity'), iconColor: '#604a3e' },
              { label: 'Politiques de confidentialité', icon: 'document-text-outline', onPress: () => { setShowPrivacy(true); setActiveView('list'); }, iconColor: '#604a3e' },
            ].map((item, index) => (
              <TouchableOpacity 
                key={index}
                style={[styles.menuItem, { backgroundColor: index % 2 === 0 ? '#d2f1ef' : '#baded7' }]} 
                onPress={item.onPress}
              >
                <Text style={styles.menuText}>{item.label}</Text>
                <Ionicons name={item.icon as any} size={22} color={item.iconColor} />
              </TouchableOpacity>
            ))}
          </View>
        ) : activeView === 'identity' ? (
          <IdentityList onClose={() => setActiveView('list')} />
        ) : (
          <FriendsList 
            onProutSent={shakeHeader} 
            isZenMode={isZenMode}
            headerComponent={
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

                {/* 2. LA BARRE DE NAVIGATION */}
                <View style={styles.navBar}>
                  <View style={styles.navBarContent}>
                    <View style={styles.greetingContainer}>
                      {currentPseudo ? (
                        <View style={styles.greetingRow}>
                          <Text style={styles.greetingText}>Bonjour {currentPseudo} !</Text>
                          {isZenMode && (
                            <Ionicons
                              name="moon"
                              size={18}
                              color="#ffd700"
                              style={styles.zenIcon}
                            />
                          )}
                        </View>
                      ) : null}
                    </View>
                    {/* 1. Profil */}
                    <TouchableOpacity 
                      onPress={() => setActiveView(activeView === 'profileMenu' ? 'list' : 'profileMenu')} 
                      style={[styles.iconButton, (activeView === 'profileMenu' || activeView === 'profile') && { opacity: 0.7 }]}
                    >
                        {(activeView === 'profileMenu' || activeView === 'profile') ? (
                          <Ionicons name="close-circle-outline" size={28} color="#ffffff" />
                        ) : (
                          <Image 
                              source={require('../../assets/images/icon_compte.png')} 
                              style={styles.navIcon} 
                              resizeMode="contain"
                          />
                        )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            }
          />
        )}
        </View>
      </KeyboardAvoidingView>
      <PrivacyPolicyModal visible={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#ebb89b' 
  },
  headerSection: {
    paddingTop: 30, // Réduit de 40 à 30 (-10px)
    paddingHorizontal: 20,
    paddingBottom: 5, // Réduit de 10 à 5
  },
  keyboardAvoid: {
    flex: 1,
  },
  listSection: {
    flex: 1,
    paddingBottom: 0,
  },
  listSectionWithMargin: {
    paddingTop: 50,
  },
  
  // Conteneur du Logo
  logoContainer: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: -10, // Réduit de 10px pour la marge en dessous
  },
  headerImage: { 
    width: 220, 
    height: 160, 
  },

  // Barre de boutons
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10, // Réduit de 20 à 10
    paddingHorizontal: 10, // Marges sur les côtés
  },
  navBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  greetingContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greetingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  zenIcon: {
    marginTop: 1,
  },
  
  iconButton: {
    padding: 5,
    // backgroundColor: 'rgba(255,255,255,0.2)', // Décommentez pour voir la zone de touche
    borderRadius: 10,
  },
  
  navIcon: {
    width: 28, // Réduit de 32 à 28
    height: 28, // Réduit de 32 à 28
    tintColor: 'white' // Icônes en blanc
  },
  menuCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 16,
    borderRadius: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  menuText: {
    fontSize: 15,
    color: '#604a3e',
    fontWeight: '600',
  },
  // Zen options overlay (Android)
  zenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  zenCard: {
    width: '86%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  zenTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#604a3e',
  },
  zenSubtitle: {
    fontSize: 14,
    color: '#604a3e',
    marginBottom: 4,
  },
  zenOption: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#f3f6f6',
  },
  zenOptionText: {
    fontSize: 15,
    color: '#2d2d2d',
    fontWeight: '600',
  },
  zenCancel: {
    marginTop: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#eee',
    alignItems: 'center',
  },
  zenCancelText: {
    fontSize: 15,
    color: '#444',
    fontWeight: '600',
  },
});