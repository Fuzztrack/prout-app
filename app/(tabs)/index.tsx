import { useAppStore } from '@/lib/store';
import { AppHeader } from '@/components/AppHeader';
import { BlockedUsersList } from '@/components/BlockedUsersList';
import { EditProfil } from '@/components/EditProfil';
import { FriendsList } from '@/components/FriendsList';
import { IdentityList } from '@/components/IdentityList';
import { PrivacyPolicyModal } from '@/components/PrivacyPolicyModal';
import { SearchUser } from '@/components/SearchUser';
import { TutorialSwiper } from '@/components/TutorialSwiper';
import i18n from '@/lib/i18n';
import { safeReplace } from '@/lib/navigation';
import { registerPushTokenForUser } from '@/lib/pushTokenRegistration';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ActionSheetIOS, Animated, DeviceEventEmitter, Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const appVersion = Constants.expoConfig?.version ?? '1.1.12';
  
  const isLoadedRef = useRef(false);
  
  // Utilisation du Store Zustand pour l'état global
  const { 
    userId, pseudo: currentPseudo, avatarUrl: currentAvatarUrl, 
    isZenMode, isSilentMode, isHapticEnabled, activeView,
    setProfile, setZenMode, setSilentMode, setHapticEnabled, setActiveView 
  } = useAppStore();

  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showIdentity, setShowIdentity] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [listIntroTrigger, setListIntroTrigger] = useState(1);
  const [friendsRefreshTrigger, setFriendsRefreshTrigger] = useState(0);
  const friendsListRef = useRef<any>(null);
  const zenTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const zenStartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ZEN_END_KEY = 'zen_end_at';
  const ZEN_REASON_KEY = 'zen_reason';
  const ZEN_START_KEY = 'zen_start_at';
  const SILENT_MODE_KEY = 'silent_mode_enabled';
  const [showZenOptions, setShowZenOptions] = useState(false);
  const [showSilentModal, setShowSilentModal] = useState(false);
  const [zenModeReason, setZenModeReason] = useState<string | null>(null);
  const [hasScheduledZenMode, setHasScheduledZenMode] = useState(false);
  const CACHE_PSEUDO_KEY = 'cached_current_pseudo';
  
  // Animation de secousse pour le header
  const shakeX = useRef(new Animated.Value(0)).current;
  const shakeY = useRef(new Animated.Value(0)).current;

  const handleSoundcheckPress = useCallback(() => {
    router.push('/soundcheck');
  }, [router]);

  // --- MISE À JOUR TOKEN FCM ---
  const updateIosBundleId = async (userId: string) => {
    if (Platform.OS !== 'ios') return;
    try {
      const bundleId = Constants.expoConfig?.ios?.bundleIdentifier;
      if (!bundleId) return;
      const { error } = await supabase
        .from('user_profiles')
        .update({ push_ios_bundle: bundleId })
        .eq('id', userId);
      if (error) {
        console.error('❌ Erreur mise à jour push_ios_bundle dans Supabase:', error);
      }
    } catch (e) {
      console.error('❌ Exception mise à jour push_ios_bundle:', e);
    }
  };

  const updatePushToken = async (userId: string) => {
    // Permettre le simulateur pour le développement (Device.isDevice retourne false dans le simulateur)
    if (Platform.OS === 'web') return;
    try {
      await registerPushTokenForUser(userId);
    } catch (e) { 
      console.error('Erreur mise à jour token FCM:', e);
    }
  };

  // --- CHARGEMENT ---
  const loadData = async () => {
    if (isLoadedRef.current) return;
    
    try {
      // ⚠️ PLUS ROBUSTE : On vérifie la session, mais on ne redirige pas brutalement 
      // si getUser() échoue à cause du réseau (mode offline possible)
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      let currentUser = user;
      
      if (!user || userError) {
        // Fallback session locale pour le mode offline
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          currentUser = session.user;
          if (__DEV__) console.log('✅ [Home] Session locale récupérée (Mode Offline)');
        } else {
          // VRAIMENT pas de session -> redirection
          if (__DEV__) console.log('❌ [Home] Pas de session détectée, redirection Auth');
          safeReplace(router, '/AuthChoiceScreen', { skipInitialCheck: false });
          return;
        }
      }

      if (!currentUser) return;

      setProfile({ userId: currentUser.id });
      // Enregistrer le bundle iOS même sans permission notifications
      updateIosBundleId(currentUser.id);

      // Charger l'état Zen, le pseudo et le retour haptique
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_zen_mode, pseudo, avatar_url')
        .eq('id', currentUser.id)
        .single();
      
      // Charger la préférence de retour haptique depuis AsyncStorage (iOS uniquement)
      if (Platform.OS === 'ios') {
        const hapticEnabled = await AsyncStorage.getItem('haptic_feedback_enabled');
        const isEnabled = hapticEnabled === null || hapticEnabled === 'true'; // Activé par défaut si non défini
        setHapticEnabled(isEnabled);
      } else {
        // Sur Android, le retour haptique n'est pas disponible pour le moment
        setHapticEnabled(false);
      }
      
      if (profile) {
        setZenMode(profile.is_zen_mode || false);
        const pseudo = profile.pseudo || '';
        setProfile({ pseudo, avatarUrl: profile.avatar_url || null });
        // Mémoriser pour affichage instantané au prochain lancement
        AsyncStorage.setItem(CACHE_PSEUDO_KEY, pseudo).catch(() => {});
      }

      // Charger l'état Envois silencieux
      const silentModeEnabled = await AsyncStorage.getItem(SILENT_MODE_KEY);
      setSilentMode(silentModeEnabled === 'true');

      // Mise à jour token FCM en arrière-plan (fonctionne aussi dans le simulateur)
      if (Platform.OS !== 'web') {
          registerPushTokenForUser(currentUser.id).catch((error) => {
            console.error('❌ Erreur mise à jour token dans Supabase:', error);
          });
      }
      isLoadedRef.current = true;
    } catch (e) {
      console.log("Erreur Home:", e);
    }
  };

  const refreshCurrentProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('pseudo, avatar_url')
        .eq('id', userId)
        .single();

      if (profile) {
        const pseudo = profile.pseudo || '';
        setProfile({ pseudo, avatarUrl: profile.avatar_url || null });
        AsyncStorage.setItem(CACHE_PSEUDO_KEY, pseudo).catch(() => {});
      }
    } catch {
      // noop
    }
  }, [userId, setProfile]);

  // Précharger le pseudo depuis le cache pour afficher le bonjour instantanément
  useEffect(() => {
    setActiveView('list');
    AsyncStorage.getItem(CACHE_PSEUDO_KEY).then((cached) => {
      if (cached) setProfile({ pseudo: cached });
    }).catch(() => {});
    loadData();
  }, []);

  // Écouter les événements du clavier uniquement pour iOS si besoin, ou supprimer si inutile
  // Sur Android, on évite absolument de provoquer des re-renders globaux quand le clavier bouge
  useEffect(() => {
    // Nettoyage de l'ancien listener Android qui causait des re-renders fatals pour le focus
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

  const triggerListIntro = useCallback(() => {
    setListIntroTrigger((prev) => prev + 1);
  }, []);

  const toggleProfileMenu = useCallback(() => {
    const next = activeView === 'profileMenu' ? 'list' : 'profileMenu';
    setActiveView(next);
    if (activeView === 'profileMenu') {
      triggerListIntro();
    }
  }, [activeView, setActiveView, triggerListIntro]);

  const toggleSearchVisibility = useCallback(() => {
    setIsSearchVisible((prev) => {
      const next = !prev;
      if (!next) {
        setSearchQuery('');
        Keyboard.dismiss();
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('OPEN_SEARCH_MODAL', () => {
      setActiveView('list');
      setShowSearch(true);
    });
    return () => {
      sub.remove();
    };
  }, [setActiveView]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('OPEN_PROFILE_VIEW', () => {
      setActiveView('profile');
    });
    return () => {
      sub.remove();
    };
  }, [setActiveView]);

  const getZenReasonLabel = useCallback((reason?: string | null) => {
    if (!reason) return null;
    if (reason === '1h' || reason === '8h') return reason;
    if (reason === 'job') return 'save my job';
    if (reason === 'night') return 'save my night';
    return reason;
  }, []);

  const zenMenuLabel = useMemo(() => {
    const reasonLabel = getZenReasonLabel(zenModeReason);
    if (reasonLabel) {
      return `${i18n.t('zen_mode')} · ${reasonLabel}`;
    }
    return i18n.t('zen_mode');
  }, [getZenReasonLabel, isZenMode, zenModeReason]);

  const zenModeEnabled = isZenMode || hasScheduledZenMode || !!zenModeReason;

  // Mémoïser le header pour éviter qu'il ne re-render pendant qu'on tape dans la recherche
  const headerComponent = useMemo(() => (
    <AppHeader
      currentPseudo={currentPseudo}
      profileAvatarUrl={currentAvatarUrl}
      isProfileMenuOpen={activeView === 'profileMenu'}
      isProfileOpen={activeView === 'profile'}
      isZenMode={isZenMode}
      isSilentMode={isSilentMode}
      isSearchVisible={isSearchVisible}
      onSearchToggle={toggleSearchVisibility}
      onAddFriendPress={() => {
        setActiveView('list');
        setShowSearch(true);
      }}
      onZenModePress={() => {
        void applyZenMode(false);
      }}
      onSilentModePress={() => {
        if (isSilentMode) setSilentMode(false);
      }}
      onSoundcheckPress={handleSoundcheckPress}
      onProfileMenuPress={toggleProfileMenu}
      onProfilePress={() => setActiveView('profile')}
      shakeX={shakeX}
      shakeY={shakeY}
    />
  ), [currentPseudo, currentAvatarUrl, activeView, isZenMode, isSilentMode, isSearchVisible, toggleSearchVisibility, setActiveView, applyZenMode, setSilentMode, handleSoundcheckPress, toggleProfileMenu, shakeX, shakeY]);

  // --- MODE ZEN ---
  const clearZenAutoOff = useCallback(async () => {
    if (zenTimeoutRef.current) {
      clearTimeout(zenTimeoutRef.current);
      zenTimeoutRef.current = null;
    }
    await AsyncStorage.multiRemove([ZEN_END_KEY, ZEN_REASON_KEY, ZEN_START_KEY]);
    setZenModeReason(null);
    setHasScheduledZenMode(false);
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

      setZenMode(newMode); // Optimistic update via Store

      try {
        const { error } = await supabase
          .from('user_profiles')
          .update({ is_zen_mode: newMode })
          .eq('id', userId);

        if (error) {
          console.error('Erreur mise à jour mode Zen:', error);
          setZenMode(!newMode); // Rollback via Store
        } else if (!newMode) {
          setZenModeReason(null);
          await clearZenAutoOff();
          await clearZenAutoOn();
        }
      } catch (e) {
        console.error('Erreur mode Zen:', e);
        setZenMode(!newMode);
        if (!newMode) {
          setZenModeReason(null);
          await clearZenAutoOff();
          await clearZenAutoOn();
        }
      }
    },
    [clearZenAutoOff, clearZenAutoOn, supabase, userId, setZenMode]
  );

  const scheduleZenAutoOff = useCallback(
    async (endAt: number, reason: string) => {
      const delay = Math.max(0, endAt - Date.now());
      setZenModeReason(reason || null);
      setHasScheduledZenMode(true);
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
      setZenModeReason(reason || null);
      setHasScheduledZenMode(true);
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
      setZenModeReason(reason || null);
      setHasScheduledZenMode(!!endAt && Number.isFinite(endAt) && Date.now() < endAt);
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
    if (!zenModeEnabled) {
      if (Platform.OS === 'ios') {
        const options = ['1h', '8h', i18n.t('zen_job_label'), i18n.t('zen_night_label'), i18n.t('cancel')];
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

  const toggleHapticFeedback = async () => {
    const newValue = !isHapticEnabled;
    setHapticEnabled(newValue);
    
    // Tester le retour haptique immédiatement pour donner un feedback visuel
    if (newValue && Platform.OS !== 'web') {
      try {
        if (Platform.OS === 'ios') {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setTimeout(async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }, 100);
        } else {
          Vibration.vibrate(200);
        }
      } catch (e: any) {
        console.error('❌ [HAPTIC] Erreur test retour haptique:', e?.message || e);
      }
    }
  };

  const toggleSilentMode = () => {
    if (isSilentMode) {
      setSilentMode(false);
    } else {
      setShowSilentModal(true);
    }
  };

  const confirmSilentMode = async () => {
    setSilentMode(true);
    setShowSilentModal(false);
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
    <>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {Platform.OS === 'ios' ? (
          <KeyboardAvoidingView 
            behavior="padding"
            style={styles.keyboardAvoid}
            keyboardVerticalOffset={0}
            enabled={!isSearchVisible}
          >
             <View style={styles.listSection}>
               {/* Contenu iOS */}
               {activeView === 'tutorial' ? (
                 <TutorialSwiper onClose={() => setActiveView('list')} />
               ) : activeView === 'profile' ? (
                 <EditProfil 
                   onClose={() => setActiveView('list')} 
                   onProfileUpdated={(newPseudo, newAvatarUrl) => {
                     // Mettre à jour le store global immédiatement pour changer le greeting et l'avatar
                     setProfile({ pseudo: newPseudo, avatarUrl: newAvatarUrl });
                     // Sauvegarder dans le cache pour le prochain démarrage
                     AsyncStorage.setItem(CACHE_PSEUDO_KEY, newPseudo).catch(() => {});
                   }}
                 />
               ) : (
                 <>
                   <FriendsList 
                     onProutSent={shakeHeader} 
                     isSearchVisible={isSearchVisible}
                     onSearchChange={setIsSearchVisible}
                     searchQuery={searchQuery}
                     onSearchQueryChange={setSearchQuery}
                     listIntroTrigger={listIntroTrigger}
                     refreshTrigger={friendsRefreshTrigger}
                    onSoundcheckPress={handleSoundcheckPress}
                     headerComponent={headerComponent}
                   />
       
                   {activeView === 'profileMenu' && (
                     <View style={styles.menuOverlay}>
                       <ScrollView 
                         style={{ flex: 1 }} 
                         contentContainerStyle={{ paddingBottom: 20 }}
                         showsVerticalScrollIndicator={false}
                       >
                         <TouchableOpacity activeOpacity={1} onPress={toggleProfileMenu}>
                           {headerComponent}
                         </TouchableOpacity>
                         
                         <View style={styles.menuCard}>
                           {[
                            { label: i18n.t('invite_friend'), icon: 'share-social-outline', onPress: handleShare, iconColor: '#604a3e' },
                            { label: zenMenuLabel, icon: zenModeEnabled ? 'moon' : 'moon-outline', onPress: () => { void toggleZenMode(); }, iconColor: zenModeEnabled ? '#ebb89b' : '#604a3e' },
                             { label: i18n.t('silent_mode'), icon: isSilentMode ? 'volume-mute' : 'volume-mute-outline', onPress: () => { toggleSilentMode(); }, iconColor: isSilentMode ? '#ebb89b' : '#604a3e' },
                             { label: i18n.t('resonance_dashboard_menu'), icon: 'trophy', onPress: () => { setActiveView('list'); router.push('/complicity'); }, iconColor: '#604a3e' },
                             { label: i18n.t('review_app_functions'), icon: 'help-circle-outline', onPress: () => setActiveView('tutorial'), iconColor: '#604a3e' },
                             { label: i18n.t('who_is_who'), icon: 'eye-outline', onPress: () => { setShowIdentity(true); setActiveView('list'); }, iconColor: '#604a3e' },
                             { label: i18n.t('blocked_friends_menu'), icon: 'ban-outline', onPress: () => { setShowBlockedUsers(true); setActiveView('list'); }, iconColor: '#604a3e' },
                             // Retour haptique uniquement sur iOS
                             ...(Platform.OS === 'ios' ? [{ label: i18n.t('haptic_feedback'), icon: isHapticEnabled ? 'phone-portrait' : 'phone-portrait-outline', onPress: toggleHapticFeedback, iconColor: isHapticEnabled ? '#ebb89b' : '#604a3e' }] : []),
                             { label: i18n.t('privacy_policy_menu'), icon: 'document-text-outline', onPress: () => { setShowPrivacy(true); setActiveView('list'); }, iconColor: '#604a3e' },
                           ].map((item, index) => (
                             <TouchableOpacity 
                               key={index}
                               style={[styles.menuItem, { backgroundColor: index % 2 === 0 ? '#d2f1ef' : '#baded7' }]} 
                               onPress={item.onPress}
                             >
                               <Text style={styles.menuText}>{item.label}</Text>
                               <Ionicons
                                 name={item.icon as any}
                              size={22}
                                 color={item.iconColor}
                               />
                             </TouchableOpacity>
                           ))}
                         </View>
                        <Text style={styles.menuVersionText}>{`Proot ! version ${appVersion}`}</Text>
                       </ScrollView>
                     </View>
                   )}
                 </>
               )}
             </View>
          </KeyboardAvoidingView>
        ) : (
          <View style={styles.listSection}>
            {/* Contenu Android - Pas de KeyboardAvoidingView global, pas de re-render sur clavier */}
            {activeView === 'tutorial' ? (
              <TutorialSwiper onClose={() => setActiveView('list')} />
            ) : activeView === 'profile' ? (
              <EditProfil 
                onClose={() => setActiveView('list')} 
                onProfileUpdated={(newPseudo, newAvatarUrl) => {
                  // Mettre à jour le store global immédiatement pour changer le greeting et l'avatar
                  setProfile({ pseudo: newPseudo, avatarUrl: newAvatarUrl });
                  // Sauvegarder dans le cache pour le prochain démarrage
                  AsyncStorage.setItem(CACHE_PSEUDO_KEY, newPseudo).catch(() => {});
                }}
              />
            ) : (
              <>
                <FriendsList 
                  onProutSent={shakeHeader} 
                  isSearchVisible={isSearchVisible}
                  onSearchChange={setIsSearchVisible}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                  listIntroTrigger={listIntroTrigger}
                  refreshTrigger={friendsRefreshTrigger}
                  onSoundcheckPress={handleSoundcheckPress}
                  headerComponent={headerComponent}
                />
    
                {activeView === 'profileMenu' && (
                  <View style={styles.menuOverlay}>
                    <ScrollView 
                      style={{ flex: 1 }} 
                      contentContainerStyle={{ paddingBottom: 20 }}
                      showsVerticalScrollIndicator={false}
                    >
                      <TouchableOpacity activeOpacity={1} onPress={toggleProfileMenu}>
                        {headerComponent}
                      </TouchableOpacity>
                      
                      <View style={styles.menuCard}>
                          {[
                            { label: i18n.t('invite_friend'), icon: 'share-social-outline', onPress: handleShare, iconColor: '#604a3e' },
                            { label: zenMenuLabel, icon: zenModeEnabled ? 'moon' : 'moon-outline', onPress: () => { void toggleZenMode(); }, iconColor: zenModeEnabled ? '#ebb89b' : '#604a3e' },
                            { label: i18n.t('silent_mode'), icon: isSilentMode ? 'volume-mute' : 'volume-mute-outline', onPress: () => { toggleSilentMode(); }, iconColor: isSilentMode ? '#ebb89b' : '#604a3e' },
                            { label: i18n.t('resonance_dashboard_menu'), icon: 'trophy', onPress: () => { setActiveView('list'); router.push('/complicity'); }, iconColor: '#604a3e' },
                            { label: i18n.t('review_app_functions'), icon: 'help-circle-outline', onPress: () => setActiveView('tutorial'), iconColor: '#604a3e' },
                            { label: i18n.t('who_is_who'), icon: 'eye-outline', onPress: () => { setShowIdentity(true); setActiveView('list'); }, iconColor: '#604a3e' },
                            { label: i18n.t('blocked_friends_menu'), icon: 'ban-outline', onPress: () => { setShowBlockedUsers(true); setActiveView('list'); }, iconColor: '#604a3e' },
                            // Retour haptique uniquement sur iOS
                            ...(Platform.OS === 'ios' ? [{ label: i18n.t('haptic_feedback'), icon: isHapticEnabled ? 'phone-portrait' : 'phone-portrait-outline', onPress: toggleHapticFeedback, iconColor: isHapticEnabled ? '#ebb89b' : '#604a3e' }] : []),
                            { label: i18n.t('privacy_policy_menu'), icon: 'document-text-outline', onPress: () => { setShowPrivacy(true); setActiveView('list'); }, iconColor: '#604a3e' },
                        ].map((item, index) => (
                          <TouchableOpacity 
                            key={index}
                            style={[styles.menuItem, { backgroundColor: index % 2 === 0 ? '#d2f1ef' : '#baded7' }]} 
                            onPress={item.onPress}
                          >
                            <Text style={styles.menuText}>{item.label}</Text>
                            <Ionicons
                              name={item.icon as any}
                                size={22}
                              color={item.iconColor}
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={styles.menuVersionText}>{`Proot ! version ${appVersion}`}</Text>
                    </ScrollView>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      <PrivacyPolicyModal visible={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <SearchUser visible={showSearch} onClose={() => setShowSearch(false)} />
      <IdentityList visible={showIdentity} onClose={() => setShowIdentity(false)} />
      <BlockedUsersList
        visible={showBlockedUsers}
        onClose={() => setShowBlockedUsers(false)}
        onUnblocked={() => setFriendsRefreshTrigger((prev) => prev + 1)}
      />
    </View>

      {/* Après le conteneur principal : au-dessus du menu liste (z-index) */}
      {showZenOptions && (
        <View style={styles.zenOverlay}>
          <View style={styles.zenCard}>
            <Text style={styles.zenTitle}>{i18n.t('zen_confirm_title')}</Text>
            <Text style={styles.zenSubtitle}>{i18n.t('choose_duration')}</Text>
            {[
              { label: '1h', type: '1h' as const },
              { label: '8h', type: '8h' as const },
              { label: i18n.t('zen_job_label'), type: 'job' as const },
              { label: i18n.t('zen_night_label'), type: 'night' as const },
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

      {showSilentModal && (
        <View style={styles.zenOverlay} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={() => setShowSilentModal(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={styles.silentModalCard}>
            <Text style={styles.zenTitle}>{i18n.t('silent_mode_title')}</Text>
            <Text style={styles.silentModalDescription}>{i18n.t('silent_mode_description')}</Text>
            <TouchableOpacity style={styles.zenCancel} onPress={confirmSilentMode}>
              <Text style={styles.zenCancelText}>{i18n.t('ok')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#ebb89b' 
  },
  keyboardAvoid: {
    flex: 1,
  },
  listSection: {
    flex: 1,
    paddingBottom: 0,
    position: 'relative',
  },
  listSectionWithMargin: {
    paddingTop: 50,
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ebb89b',
    zIndex: 10,
  },
  menuCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 12, // Réduit de 16 à 12 pour gagner de la place
    borderRadius: 14,
    gap: 4, // Réduit de 6 à 4
    marginHorizontal: 10, // Réduit de 20 à 10 pour moins d'étroitesse
    marginTop: 5,
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    minHeight: 44,
    // Ombre projetée vers la gauche (comme lignes contact FriendList)
    ...Platform.select({
      ios: {
        shadowColor: '#5c4a3d',
        shadowOffset: { width: -5, height: 3 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  menuText: {
    fontSize: 15,
    color: '#604a3e',
    fontWeight: '600',
  },
  menuVersionText: {
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
    color: '#604a3e',
    fontSize: 12,
    opacity: 0.75,
  },
  // Zen options overlay (Android) - Edge-to-Edge
  zenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999, // Au-dessus de tout, y compris StatusBar
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
  silentModalCard: {
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
  silentModalDescription: {
    fontSize: 15,
    color: '#604a3e',
    lineHeight: 22,
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