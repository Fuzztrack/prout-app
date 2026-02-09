import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { useAudioPlayer } from 'expo-audio'; // Supprimé
import { Audio } from 'expo-av';
import * as Contacts from 'expo-contacts';
import { useFocusEffect, useRouter } from 'expo-router';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Linking, NativeModules, Platform, Animated as RNAnimated, StyleSheet, Text, TextInput, TouchableOpacity, View, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView } from 'react-native';
import { Gesture, GestureDetector, TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { RINGER_MODE, VolumeManager } from 'react-native-volume-manager';
import { ensureContactPermissionWithDisclosure } from '../lib/contactConsent';
import { normalizePhone } from '../lib/normalizePhone';
import { sendProutViaBackend } from '../lib/sendProutBackend';
// Import supprimé : on utilise maintenant sync_contacts (fonction SQL Supabase)
import i18n from '../lib/i18n';
import { supabase } from '../lib/supabase';
const ANIM_IMAGES = [
  require('../assets/images/animprout1.png'),
  require('../assets/images/animprout2.png'),
  require('../assets/images/animprout3.png'),
  require('../assets/images/animprout4.png'),
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 150; // Seuil pour déclencher l'action
const TAP_THRESHOLD = 12; // Distance max pour considérer un tap

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

// Mapping des noms de prouts (via i18n maintenant)

const SOUND_KEYS = Object.keys(PROUT_SOUNDS);

// Clés de cache pour AsyncStorage
const CACHE_KEY_FRIENDS = 'cached_friends_list';
const CACHE_KEY_PENDING_REQUESTS = 'cached_pending_requests';
const CACHE_KEY_LAST_SENT_MESSAGES = 'cached_last_sent_messages';
const CACHE_KEY_DISMISSED_SILENT_WARNING = 'cached_dismissed_silent_warning';
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 heures

// Mémoire de session (pas persistée) pour bloquer la bannière après clic OK
let dismissedSilentWarningSession = false;
// Importance Android : on considère silencieux si LOW (2) ou moindre
const ANDROID_SOUND_IMPORTANCE_THRESHOLD = 2; // DEFAULT = 3, HIGH = 4, LOW = 2

// Fonction utilitaire pour charger le cache de manière sécurisée
const loadCacheSafely = async (key: string) => {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    
    // Vérifier que c'est un tableau
    if (!Array.isArray(parsed.data)) {
      // Cache invalide, ignoré
      return null;
    }
    
    // Vérifier l'âge du cache (optionnel)
    if (parsed.timestamp && Date.now() - parsed.timestamp > CACHE_MAX_AGE) {
      // Cache expiré, ignoré
      return null;
    }
    
    return parsed.data;
  } catch (e) {
    // Erreur lecture cache (non critique)
    return null; // En cas d'erreur, on ignore le cache et on continue normalement
  }
};

// Cache pour les derniers messages envoyés (map userId -> {text, ts})
const loadLastSentMessagesCache = async (): Promise<Record<string, { text: string; ts: string }>> => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY_LAST_SENT_MESSAGES);
    if (!cached) return {};
    const parsed = JSON.parse(cached);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
};

const saveLastSentMessagesCache = async (map: Record<string, { text: string; ts: string }>) => {
  try {
    await AsyncStorage.setItem(CACHE_KEY_LAST_SENT_MESSAGES, JSON.stringify(map));
  } catch {
    // ignorer
  }
};

// Fonction utilitaire pour sauvegarder le cache de manière sécurisée
const saveCacheSafely = async (key: string, data: any[]) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    // Erreur sauvegarde cache (non critique)
    // On ignore l'erreur, ce n'est pas critique
  }
};

type SwipeableFriendRowHandle = {
  startHoldSend: () => void;
  cancelHoldSend: () => void;
};

type SwipeableFriendRowProps = { 
  friend: any; 
  backgroundColor: string; 
  onSendProut: () => void; 
  onLongPressName: () => void;
  onPressName?: () => void;
  hasUnread?: boolean;
  unreadMessage?: string | null;
  onDeleteFriend: () => void;
  onMuteFriend: () => void;
  onUnmuteFriend?: () => void;
  isMuted?: boolean;
  introDelay?: number;
};

// Composant SwipeableFriendRow : Swipe to Action avec animation frame-by-frame (version Reanimated pour iOS fluide)
const SwipeableFriendRow = forwardRef<SwipeableFriendRowHandle, SwipeableFriendRowProps>(({
  friend, 
  backgroundColor, 
  onSendProut, 
  onLongPressName,
  onPressName,
  hasUnread = false,
  unreadMessage,
  onDeleteFriend,
  onMuteFriend,
  onUnmuteFriend,
  isMuted = false,
  introDelay = 0,
}, ref) => {
  const translationX = useSharedValue(0);
  const maxSwipeRight = SCREEN_WIDTH * 0.7; // Maximum 70% de l'écran vers la droite
  const maxSwipeLeft = SCREEN_WIDTH * 0.7; // Maximum 70% de l'écran vers la gauche
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showFinalImage, setShowFinalImage] = useState(false);
  const introOffset = useSharedValue(0);
  const introDirectionRef = useRef(Math.random() > 0.5 ? 1 : -1);

  useEffect(() => {
    introOffset.value = introDirectionRef.current * 24;
    introOffset.value = withDelay(
      introDelay,
      withSpring(0, { damping: 12, stiffness: 140 })
    );
  }, [introDelay, introOffset]);
  
  // Calculer l'index de l'image en fonction de la distance du swipe (seulement pour swipe droite)
  const getImageIndex = (dx: number) => {
    const percentage = Math.min(dx / maxSwipeRight, 1);
    if (percentage <= 0.10) return 0; // animprout1 (0-10%)
    if (percentage <= 0.90) return 1; // animprout2 (10-90%)
    return 2; // animprout3 (90-100%)
  };

  // Fonction pour mettre à jour l'index d'image (appelée depuis le thread JS)
  const updateImageIndex = (x: number) => {
    const imageIndex = getImageIndex(x);
    if (imageIndex !== currentImageIndex) {
      setCurrentImageIndex(imageIndex);
    }
  };

  // Fonction pour déclencher l'action (swipe droite)
  const triggerAction = () => {
    setShowFinalImage(true);
    setCurrentImageIndex(0);
    onSendProut();
    
    // Après le retour du slider, attendre 0.5 seconde avant de cacher l'image
    setTimeout(() => {
      setShowFinalImage(false);
      setCurrentImageIndex(0);
    }, 500);
  };

  useImperativeHandle(ref, () => ({
    startHoldSend: () => {
      cancelAnimation(translationX);
      translationX.value = withTiming(maxSwipeRight, { duration: 800 }, (finished) => {
        if (finished) {
          runOnJS(triggerAction)();
          translationX.value = withSpring(0, {
            damping: 15,
            stiffness: 150,
          });
          runOnJS(setCurrentImageIndex)(0);
        }
      });
    },
    cancelHoldSend: () => {
      cancelAnimation(translationX);
      translationX.value = withSpring(0, {
        damping: 15,
        stiffness: 150,
      });
      runOnJS(setCurrentImageIndex)(0);
      runOnJS(setShowFinalImage)(false);
    },
  }));

  useAnimatedReaction(
    () => translationX.value,
    (value) => {
      if (value > 0) {
        runOnJS(updateImageIndex)(value);
      }
    }
  );

  // Fonction pour réinitialiser la position (doit être appelée depuis le thread UI)
  const resetPosition = () => {
    translationX.value = withSpring(0, {
      damping: 15,
      stiffness: 150,
    });
  };

  // Fonction pour afficher l'alerte de sourdine/suppression (doit être définie en dehors du geste)
  const showMuteDeleteAlert = useCallback(() => {
    try {
      if (isMuted) {
        // Si déjà en sourdine, proposer de quitter le mode sourdine
        Alert.alert(
          i18n.t('exit_mute_mode_title'),
          i18n.t('exit_mute_mode_body', { pseudo: friend.pseudo }),
          [
            { text: i18n.t('cancel'), style: 'cancel', onPress: () => {} },
            { text: 'Quitter le mode sourdine', onPress: () => {
              if (onUnmuteFriend) {
                onUnmuteFriend();
              }
            } },
          ]
        );
      } else {
        // Sinon, proposer de mettre en sourdine ou supprimer
        Alert.alert(
          i18n.t('delete_or_mute'),
          '',
          [
            { text: i18n.t('cancel'), style: 'cancel', onPress: () => {} },
            { text: i18n.t('tuto_4_title'), onPress: () => onMuteFriend() },
            { text: i18n.t('delete_friend'), style: 'destructive', onPress: () => onDeleteFriend() },
          ]
        );
      }
    } catch (error) {
      console.error('Erreur lors de l\'affichage de l\'alerte:', error);
    }
  }, [isMuted, friend.pseudo, onUnmuteFriend, onMuteFriend, onDeleteFriend]);

  // Geste avec Reanimated (fluide sur iOS) - Supporte gauche et droite
  const gesture = Gesture.Pan()
    .activeOffsetX([-TAP_THRESHOLD, TAP_THRESHOLD]) // Priorité au tap court
    .failOffsetY([-10, 10])   // Laisser le scroll vertical passer
    .onStart(() => {
      // Reset si nécessaire
    })
    .onUpdate((e) => {
      // Permettre le swipe dans les deux sens
      const newX = Math.max(-maxSwipeLeft, Math.min(e.translationX, maxSwipeRight));
      translationX.value = newX;
      
      // Mettre à jour l'image seulement si swipe vers la droite
      if (newX > 0) {
        runOnJS(updateImageIndex)(newX);
      }
    })
    .onEnd((e) => {
      const finalX = e.translationX;
      const finalY = e.translationY;

      // Si mouvement très faible : considérer comme TAP prioritaire
      if (Math.abs(finalX) < TAP_THRESHOLD && Math.abs(finalY || 0) < TAP_THRESHOLD) {
        if (onPressName) {
          runOnJS(onPressName)();
        }
        translationX.value = withSpring(0, { damping: 15, stiffness: 150 });
        runOnJS(setCurrentImageIndex)(0);
        return;
      }
      
      // Swipe vers la droite (envoi de prout)
      if (finalX >= SWIPE_THRESHOLD) {
        runOnJS(triggerAction)();
        translationX.value = withSpring(0, {
          damping: 15,
          stiffness: 150,
        });
      } 
      // Swipe vers la gauche (menu actions)
      else if (finalX <= -SWIPE_THRESHOLD) {
        translationX.value = withSpring(0, {
          damping: 15,
          stiffness: 150,
        });
        runOnJS(showMuteDeleteAlert)();
      } 
      // Seuil non atteint : retour à la position initiale
      else {
        translationX.value = withSpring(0, {
          damping: 15,
          stiffness: 150,
        });
        if (finalX > 0) {
          runOnJS(setCurrentImageIndex)(0);
        }
      }
    });

  // Style animé pour la ligne qui se déplace
  const animatedLineStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translationX.value + introOffset.value }],
    };
  });

  // Style animé pour le zoom de l'image de fond (seulement pour swipe droite)
  const animatedImageScale = useAnimatedStyle(() => {
    // Ne zoomer que si on swipe vers la droite
    const positiveX = Math.max(0, translationX.value);
    const scale = interpolate(
      positiveX,
      [0, maxSwipeRight],
      [0.5, 4.0],
      Extrapolation.CLAMP
    );
    
    return {
      transform: [{ scale }],
      opacity: translationX.value > 0 ? 1 : 0, // Cacher l'image si swipe gauche
    };
  });

  // Style animé pour le fond rouge (seulement pour swipe gauche)
  const animatedRedBackground = useAnimatedStyle(() => {
    const negativeX = Math.min(0, translationX.value);
    const opacity = interpolate(
      Math.abs(negativeX),
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP
    );
    
    return {
      opacity,
    };
  });

  return (
    <View style={[styles.swipeableRow, { backgroundColor }]} collapsable={false}>
      {/* Background gauche : Fond rouge pour suppression */}
      <Animated.View 
        style={[
          styles.deleteBackground,
          animatedRedBackground
        ]}
        collapsable={false}
      >
        <Text style={styles.deleteText}>{i18n.t('delete_or_mute')}</Text>
      </Animated.View>

      {/* Background droite : Image d'animation avec fond clair */}
      <View style={styles.swipeBackground} collapsable={false}>
        {/* Image finale (animprout4) après l'envoi du prout */}
        {showFinalImage ? (
          <View style={styles.finalImageContainer} collapsable={false}>
            <Animated.Image 
              source={ANIM_IMAGES[3]} 
              style={[
                styles.animImage,
                {
                  transform: [{ scale: 4.0 }], // Même taille que la fin du zoom
                },
              ]}
              resizeMode="contain"
            />
          </View>
        ) : (
          /* Image normale pendant le swipe */
          currentImageIndex >= 0 && currentImageIndex < 3 && (
            <Animated.Image 
              source={ANIM_IMAGES[currentImageIndex]} 
              style={[styles.animImage, animatedImageScale]}
              resizeMode="contain"
            />
          )
        )}
      </View>

      {/* Foreground : Ligne de contact */}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            styles.swipeForeground,
            {
              backgroundColor,
            },
            animatedLineStyle,
          ]}
        >
          <GHTouchableOpacity
            onPress={onPressName}
            onLongPress={onLongPressName}
            delayLongPress={500}
            activeOpacity={0.8}
            style={[styles.userInfo, { flex: 1 }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.pseudo} numberOfLines={1}>{friend.pseudo}</Text>
              {friend.isZenMode && <Text style={{marginLeft: 5, fontSize: 16}}>🌙</Text>}
              {friend.is_muted && (
                <Ionicons name="volume-mute-outline" size={20} color="#666" style={{marginLeft: 5}} />
              )}
              {hasUnread && unreadMessage ? (
                <View style={styles.unreadInline}>
                  <Text
                    style={styles.unreadMessage}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    "{unreadMessage}"
                  </Text>
                  <View style={styles.redDot} />
                </View>
              ) : hasUnread ? (
                <View style={styles.redDot} />
              ) : null}
            </View>
          </GHTouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});
 
export function FriendsList({ onProutSent, isZenMode, isSilentMode, headerComponent }: { onProutSent?: () => void; isZenMode?: boolean; isSilentMode?: boolean; headerComponent?: React.ReactElement } = {}) {
  const [appUsers, setAppUsers] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [identityRequests, setIdentityRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); // Commencer à true pour éviter le flash
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPseudo, setCurrentPseudo] = useState<string>("Un ami");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pendingMessages, setPendingMessages] = useState<any[]>([]);
  const [lastSentMessages, setLastSentMessages] = useState<Record<string, { text: string; ts: string }>>({});
  const [showSilentWarning, setShowSilentWarning] = useState(false);
  const [dismissedSilentWarning, setDismissedSilentWarning] = useState(dismissedSilentWarningSession); // reste à true pour toute la session après clic OK
  const [expandedFriendId, setExpandedFriendId] = useState<string | null>(null);
  const [expandedUnreadId, setExpandedUnreadId] = useState<string | null>(null);
  const [unreadCache, setUnreadCache] = useState<Record<string, { id: string; message_content: string }[]>>({});
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const toastOpacity = useRef(new RNAnimated.Value(0)).current;
  
  // État pour le mode silencieux
  const [volume, setVolume] = useState<number | undefined>(undefined);
  const [ringerMode, setRingerMode] = useState<number | undefined>(undefined); // Android : mode sonore
  const [notificationVolume, setNotificationVolume] = useState<number | undefined>(undefined); // Volume des notifications (Android)
  const volumeListenerRef = useRef<any>(null);
  const ringerListenerRef = useRef<any>(null);
  
  const openNotificationSettings = useCallback(() => {
    if (Platform.OS === 'android') {
      // Android : ouvrir les paramètres système son via module natif
      try {
        const { SoundSettingsModule } = NativeModules;
        console.log('🔍 [SoundSettings] Module disponible?', !!SoundSettingsModule);
        console.log('🔍 [SoundSettings] openSoundSettings disponible?', !!SoundSettingsModule?.openSoundSettings);
        console.log('🔍 [SoundSettings] Tous les NativeModules:', Object.keys(NativeModules));
        
        if (SoundSettingsModule && typeof SoundSettingsModule.openSoundSettings === 'function') {
          console.log('✅ [SoundSettings] Ouverture des paramètres son via module natif');
          SoundSettingsModule.openSoundSettings();
          return; // Succès, on sort
        } else {
          console.warn('⚠️ [SoundSettings] Module ou méthode non disponible, utilisation du fallback');
        }
      } catch (e) {
        console.error('❌ [SoundSettings] Erreur lors de l\'accès au module:', e);
      }
      
      // Fallback : ouvrir les paramètres système généraux (ouvre les paramètres de l'app)
      console.warn('⚠️ [SoundSettings] Utilisation du fallback Linking.openSettings()');
      Linking.openSettings().catch(() => {});
    } else {
      // iOS : tenter d'ouvrir directement les réglages Son (sinon fallback app settings)
      const iosSoundUrls = [
        'App-Prefs:root=Sounds', // iOS 11+
        'App-Prefs:root=Sounds&path=RINGER_AND_ALERTS',
        'prefs:root=Sounds', // anciens schémas
        'prefs:root=Sounds&path=RINGER_AND_ALERTS',
      ];
      (async () => {
        for (const url of iosSoundUrls) {
          const can = await Linking.canOpenURL(url);
          if (can) {
            Linking.openURL(url).catch(() => {});
            return;
          }
        }
        // Fallback : paramètres de l'app si le schéma Sound n'est pas supporté
        Linking.openSettings().catch(() => {});
      })();
    }
  }, []);
  const subscriptionRef = useRef<any>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cacheLoadedRef = useRef(false); // Pour éviter de charger le cache plusieurs fois
  const contactsSyncedRef = useRef(false); // Pour éviter de synchroniser les contacts plusieurs fois
  const phoneFriendIdsRef = useRef<string[]>([]);
  const lastSentSetAtRef = useRef<number>(0); // timestamp du dernier setLastSentMessages local (pour éviter un clear trop tôt)
  const lastPressTime = useRef(0); // Debounce pour les clics sur les amis
  
  // Polling simple (sans backoff exponentiel)
  const flatListRef = useRef<FlatList>(null);
  const rowRefs = useRef<Record<string, SwipeableFriendRowHandle | null>>({});
  const textInputRefs = useRef<Record<string, TextInput | null>>({});

  // Focus automatique du TextInput quand le champ de message s'ouvre
  useEffect(() => {
    if (expandedFriendId && textInputRefs.current[expandedFriendId]) {
      // Petit délai pour laisser le layout se stabiliser avant de focus
      const timer = setTimeout(() => {
        textInputRefs.current[expandedFriendId]?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [expandedFriendId]);

  // Messages éphémères (pending_messages)
  const fetchPendingMessages = async (userId: string) => {
    const { data, error } = await supabase
      .from('pending_messages')
      .select('id, from_user_id, sender_pseudo, message_content')
      .eq('to_user_id', userId);
    if (error) {
      return;
    }
    setPendingMessages(data || []);

    // Mise à jour optimiste locale pour remonter les expéditeurs (messages reçus)
    if (data && data.length > 0) {
      const now = new Date().toISOString();
      const uniqueSenderIds = [...new Set(data.map(m => m.from_user_id))];
      setAppUsers(prev => {
        const updated = prev.map(friend =>
          uniqueSenderIds.includes(friend.id)
            ? { ...friend, last_interaction_at: now }
            : friend
        );
        return sortFriends(updated);
      });
    }
    // Le backend met à jour last_interaction_at, mais cette mise à jour optimiste rend l'affichage instantané
  };

  const markMessageAsRead = async (messageId: string) => {
    try {
      await supabase.from('pending_messages').delete().eq('id', messageId);
      setPendingMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (e) {
      // Ignorer les erreurs de suppression silencieusement
    }
  };

  // Messages envoyés par moi et non lus (persistance du dernier message)
  const fetchSentPendingMessages = async (userId: string) => {
    const { data, error } = await supabase
      .from('pending_messages')
      .select('to_user_id, message_content, created_at')
      .eq('from_user_id', userId);
    if (error) {
      return [];
    }
    return data || [];
  };

  // Fonction de tri basée sur last_interaction_at depuis Supabase
  const sortFriends = (friends: any[]) => {
    return friends.sort((a, b) => {
      // Utiliser last_interaction_at directement depuis l'objet friend
      const timeA = a.last_interaction_at ? new Date(a.last_interaction_at).getTime() : 0;
      const timeB = b.last_interaction_at ? new Date(b.last_interaction_at).getTime() : 0;
      // Tri décroissant (plus récent en premier)
      if (timeA !== timeB) return timeB - timeA;
      // Fallback: ordre alphabétique
      return (a.pseudo || '').localeCompare(b.pseudo || '');
    });
  };
  
  // Cooldown par utilisateur pour éviter le spam (Map<userId, timestamp>)
  const cooldownMapRef = useRef<Map<string, number>>(new Map());
  const COOLDOWN_DURATION = 2000; // 2 secondes de pause entre chaque envoi

  // const player = useAudioPlayer(); // Supprimé

  useFocusEffect(
    useCallback(() => {
      // Recharger les données à chaque fois que l'écran gagne le focus
      // Le tri se fait maintenant uniquement via last_interaction_at depuis Supabase
      loadData(false, false, false);
    }, [])
  );

  useEffect(() => {
    // Pas d'annotation de type ici pour éviter le conflit de type AudioMode
    const mode = {
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    };

    Audio.setAudioModeAsync(mode).catch(() => {
      // Ignorer les erreurs de configuration audio silencieusement
    });
  }, []);

  useEffect(() => {
    const initialize = async () => {
      // Réinitialiser le flag de synchronisation au démarrage
      contactsSyncedRef.current = false;
      
      // ÉTAPE 1 : Charger le cache IMMÉDIATEMENT (avant tout)
      let hasCache = false;
      if (!cacheLoadedRef.current) {
        cacheLoadedRef.current = true;
        try {
          const cachedFriends = await loadCacheSafely(CACHE_KEY_FRIENDS);
          const cachedRequests = await loadCacheSafely(CACHE_KEY_PENDING_REQUESTS);
          
          // Afficher immédiatement le cache s'il existe, même si certains tokens manquent
          const cacheHasEntries = cachedFriends && cachedFriends.length > 0;
          
          if (cacheHasEntries) {
            // Appliquer le tri sur le cache (basé sur last_interaction_at depuis Supabase)
            const sortedCache = sortFriends(cachedFriends);
            setAppUsers(sortedCache);
            setLoading(false); // Cache trouvé, pas de spinner
            hasCache = true;
          }
          
          if (cachedRequests) {
            setPendingRequests(cachedRequests);
          }
        } catch (e) {
          // Ignorer les erreurs de cache
        }
      }
      
      // ÉTAPE 2 : Charger les données réseau (en arrière-plan)
      // Passer hasCache pour éviter de remettre loading à true si on a du cache
      // Si pas de cache, on force le loading (premier chargement)
      // ⚡ On diffère la sync contacts pour éviter de bloquer le premier rendu
      loadData(hasCache, !hasCache, false);
      setTimeout(() => {
        if (!contactsSyncedRef.current) {
          loadData(true, false, true);
        }
      }, 300);
      
      // ÉTAPE 3 : Configurer Realtime et polling
      setupRealtimeSubscription();
      
      // Polling simple (sans backoff exponentiel)
      // Les changements importants sont gérés en temps réel via Realtime
      pollingIntervalRef.current = setInterval(() => {
        loadData(false, false, false); // Pas de cache, pas de forceLoading, PAS de sync contacts
      }, 30000) as unknown as NodeJS.Timeout; // 30 secondes
    };
    
    initialize();

    return () => {
      // Nettoyer la subscription Realtime
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      // Nettoyer le polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

// Charger le cache des derniers messages envoyés
useEffect(() => {
  const loadCache = async () => {
    const cached = await loadLastSentMessagesCache();
    setLastSentMessages(cached);
  };
  loadCache();
}, []);

// Vérifier si les notifications sont silencieuses
  // iOS : via VolumeManager.getVolume() + addSilentListener()
  // Android : via expo-notifications (permissions + canaux)
  useEffect(() => {
    let mounted = true;

    const setupSilentModeDetection = async () => {
      try {
        if (Platform.OS === 'ios') {
          // iOS : vérifier uniquement le volume initial (pas le switch silencieux)
          const volumeResult = await VolumeManager.getVolume();
          if (mounted) {
            setVolume(volumeResult?.volume);
            if (volumeResult?.volume === 0 && !dismissedSilentWarning) {
              setShowSilentWarning(true);
            }
          }

          // iOS : écouter uniquement les changements de volume (pas le switch silencieux)
          const volListener = VolumeManager.addVolumeListener((result) => {
            if (mounted) {
              setVolume(result?.volume);
              if (result?.volume === 0 && !dismissedSilentWarning) {
                setShowSilentWarning(true);
              } else if (result?.volume !== undefined && result.volume > 0) {
                setShowSilentWarning(false);
              }
            }
          });
          volumeListenerRef.current = volListener;
        } else {
          // Android : vérifier uniquement le volume des notifications (pas le mode sonnerie)
          try {
            const readNotificationVolume = async (): Promise<number | undefined> => {
              // API officielle : getVolume() renvoie un map avec notification/ring/etc.
              const res = await VolumeManager.getVolume();
              if (res && typeof (res as any).notification === 'number') {
                return (res as any).notification;
              }
              if (typeof res?.volume === 'number') {
                return res.volume; // fallback musique
              }
              return undefined;
            };

            const mode = await VolumeManager.getRingerMode();
            if (mounted && typeof mode === 'number') {
              setRingerMode(mode);
            }

            const vol = await readNotificationVolume();
            if (mounted && vol !== undefined) {
              setNotificationVolume(vol);
              if (mode === RINGER_MODE.normal && vol === 0 && !dismissedSilentWarning) {
                setShowSilentWarning(true);
              } else {
                setShowSilentWarning(false);
              }
            }

            // Écouter les changements de volume des notifications uniquement
            const volListener = VolumeManager.addVolumeListener((result) => {
              if (!mounted) return;
              const isNotif = result?.type === 'notification';
              const vol = result?.volume;
              if (isNotif && vol !== undefined) {
                setNotificationVolume(vol);
                if (ringerMode === RINGER_MODE.normal && vol === 0 && !dismissedSilentWarning) {
                  setShowSilentWarning(true);
                } else if (vol > 0) {
                  setShowSilentWarning(false);
                }
              }
            });
            volumeListenerRef.current = volListener;

            // Écouter les changements de ringer mode
            const ringListener = VolumeManager.addRingerListener((event: any) => {
              if (!mounted) return;
              const modeStr = event?.mode;
              const modeVal =
                modeStr === 'NORMAL'
                  ? RINGER_MODE.normal
                  : modeStr === 'VIBRATE'
                  ? RINGER_MODE.vibrate
                  : RINGER_MODE.silent;
              setRingerMode(modeVal);
              // Re-évaluer avec le volume courant (relecture pour éviter la valeur stale)
              VolumeManager.getVolume().then((res) => {
                const notifVol =
                  res && typeof (res as any).notification === 'number'
                    ? (res as any).notification
                    : typeof res?.volume === 'number'
                    ? res.volume
                    : undefined;
                if (notifVol !== undefined) {
                  setNotificationVolume(notifVol);
                  if (modeVal === RINGER_MODE.normal && notifVol === 0 && !dismissedSilentWarning) {
                    setShowSilentWarning(true);
                  } else {
                    setShowSilentWarning(false);
                  }
                }
              });
            });
            ringerListenerRef.current = ringListener;
          } catch (e) {
            // En cas d'erreur, ne pas afficher la bannière
            if (mounted) {
              setShowSilentWarning(false);
            }
          }
        }
      } catch (e) {
        // Module non disponible ou erreur, désactiver la fonctionnalité
        if (mounted) {
          setShowSilentWarning(false);
        }
      }
    };

    setupSilentModeDetection();

    return () => {
      mounted = false;
      // Nettoyer les listeners
      if (volumeListenerRef.current) {
        volumeListenerRef.current.remove();
        volumeListenerRef.current = null;
      }
      if (ringerListenerRef.current) {
        ringerListenerRef.current.remove();
        ringerListenerRef.current = null;
      }
    };
  }, []);

  // Détecter si le volume des notifications est à 0 (uniquement), logique simplifiée
  useEffect(() => {
    let isSilent = false;

    if (Platform.OS === 'ios') {
      if (volume !== undefined) {
        isSilent = volume === 0;
      } else {
        return; // attendre la première valeur
      }
    } else {
      if (notificationVolume !== undefined) {
        isSilent = notificationVolume === 0;
      } else {
        return; // attendre la première valeur
      }
    }

    // Android : ne pas afficher si le ringer n'est pas en mode normal
    const androidCanShow =
      Platform.OS === 'android'
        ? ringerMode === RINGER_MODE.normal && isSilent
        : isSilent;

    // Afficher seulement si non dismissé dans la session courante
    setShowSilentWarning(androidCanShow && !dismissedSilentWarning);
  }, [volume, notificationVolume, dismissedSilentWarning, ringerMode]);

  // Note: Les notifications sont gérées par setupRealtimeSubscription et loadData
  // qui rechargent last_interaction_at depuis Supabase pour mettre à jour le tri

  const router = useRouter();

  const loadData = async (hasCacheFromInit: boolean = false, forceLoading: boolean = false, syncContacts: boolean = true) => {
    // Ne mettre loading à true que si :
    // 1. On n'a pas de cache à l'init ET pas de données affichées
    // 2. OU si forceLoading est true (premier chargement)
    if (forceLoading || (!hasCacheFromInit && appUsers.length === 0)) {
      setLoading(true);
      
      // Timeout de sécurité pour le chargement
      setTimeout(() => {
        setLoading((currentLoading) => {
          if (currentLoading) {
            // Alert.alert("Connexion lente", "Impossible de charger la liste d'amis. Vérifiez votre réseau."); // Désactivé car trop fréquent
            return false;
          }
          return currentLoading;
        });
      }, 8000); // 8 secondes pour être large
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      
      setCurrentUserId(user.id);
      const { data: profile } = await supabase.from('user_profiles').select('pseudo').eq('id', user.id).single();
      if (profile) {
        setCurrentPseudo(profile.pseudo);
      }

      // Lancer en parallèle le chargement des messages éphémères et des demandes/identités
  const pendingMessagesPromise = fetchPendingMessages(user.id);
  const sentPendingMessagesPromise = fetchSentPendingMessages(user.id);

      const requestsAndIdentityPromise = (async () => {
        // Charger les demandes en attente
        const { data: rawRequests } = await supabase
          .from('friends')
          .select('id, user_id, method')
          .eq('friend_id', user.id)
          .eq('status', 'pending');
        
        if (rawRequests?.length) {
          // Filtrer les demandes : si la réciproque est déjà acceptée, ne pas afficher la demande
          const filteredRequests = [];
          for (const req of rawRequests) {
            // Vérifier si la réciproque existe déjà avec status='accepted'
            const { data: reciprocal } = await supabase
              .from('friends')
              .select('id, status')
              .eq('user_id', user.id)
              .eq('friend_id', req.user_id)
              .maybeSingle();
            
            // Si la réciproque n'existe pas ou est encore pending, afficher la demande
            // Si elle est accepted, c'est que le trigger a déjà créé la réciproque, donc on ne montre pas la demande
            if (!reciprocal || reciprocal.status === 'pending') {
              filteredRequests.push(req);
            }
          }
          
          if (filteredRequests.length > 0) {
            const senderIds = filteredRequests.map(r => r.user_id);
            const { data: senders } = await supabase
              .from('user_profiles')
              .select('id, pseudo')
              .in('id', senderIds);
            const cleanRequests = filteredRequests.map(req => ({
              requestId: req.id,
              senderId: req.user_id,
              pseudo: senders?.find(s => s.id === req.user_id)?.pseudo || 'Inconnu',
              method: req.method
            }));
            setPendingRequests(cleanRequests);
            // Sauvegarder dans le cache (sans bloquer si ça échoue)
            await saveCacheSafely(CACHE_KEY_PENDING_REQUESTS, cleanRequests);
          } else {
            setPendingRequests([]);
            await saveCacheSafely(CACHE_KEY_PENDING_REQUESTS, []);
          }
        } else { 
          setPendingRequests([]);
          await saveCacheSafely(CACHE_KEY_PENDING_REQUESTS, []);
        }

        // Tentative de récupération des pseudos séparément pour contourner le problème de relation
        const { data: identityRows, error: identityError } = await supabase
          .from('identity_reveals')
          .select(`
            requester_id,
            status
          `)
          .eq('friend_id', user.id)
          .eq('status', 'pending');

        if (identityError) {
          console.error('❌ Erreur chargement demandes identité:', identityError);
        }

        let identityList: any[] = [];
        if (identityRows && identityRows.length > 0) {
          const requesterIds = identityRows.map(r => r.requester_id);
          const { data: requesters } = await supabase
            .from('user_profiles')
            .select('id, pseudo')
            .in('id', requesterIds);
          
          identityList = identityRows.map(row => ({
            requesterId: row.requester_id,
            requesterPseudo: requesters?.find(u => u.id === row.requester_id)?.pseudo || 'Inconnu',
          }));
        }
        setIdentityRequests(identityList);
      })();

      let phoneFriendsIds: string[] = [];
      const status = await ensureContactPermissionWithDisclosure();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
        if (data.length > 0) {
          // Normaliser les numéros de téléphone
          const phones = data
            .flatMap(c => c.phoneNumbers || [])
            .map(p => normalizePhone(p.number || ''))
            .filter(p => p !== null && p !== '');

          if (phones.length > 0) {
            // 🪄 Appel à sync_contacts UNIQUEMENT si syncContacts est true ET qu'on n'a pas déjà synchronisé
            // (pas lors du polling, seulement au chargement initial)
            if (syncContacts && !contactsSyncedRef.current) {
              const { data: matchedFriends, error } = await supabase
                .rpc('sync_contacts', { 
                  phones: phones 
                });

              if (error) {
                console.error('❌ Erreur sync contacts:', error);
              } else if (matchedFriends) {
                phoneFriendsIds = matchedFriends.map((u: { id: string }) => u.id);
                contactsSyncedRef.current = true; // Marquer comme synchronisé
              }
            } else {
              // Lors du polling, on récupère juste les IDs depuis la base (sans appeler sync_contacts)
              const { data: contactsFound } = await supabase
                .from('user_profiles')
                .select('id')
                .in('phone', phones)
                .neq('id', user.id);
              
              if (contactsFound) {
                phoneFriendsIds = contactsFound.map(u => u.id);
              }
            }
          }
        }
      }

      // Charger les amis acceptés en parallèle (réduit le nombre de requêtes)
      const [addedFriendsResult, friendsWhereIAmFriendResult] = await Promise.all([
        supabase
          .from('friends')
          .select('friend_id')
          .eq('user_id', user.id)
          .eq('status', 'accepted'),
        supabase
          .from('friends')
          .select('user_id')
          .eq('friend_id', user.id)
          .eq('status', 'accepted')
      ]);
      
      const addedFriendsIds = addedFriendsResult.data?.map(f => f.friend_id) || [];
      const friendsWhereIAmFriendIds = friendsWhereIAmFriendResult.data?.map(f => f.user_id) || [];
      
      // Combiner tous les IDs d'amis (contacts + relations acceptées dans les deux sens)
      phoneFriendIdsRef.current = phoneFriendsIds;
      const allFriendIds = [...new Set([...phoneFriendsIds, ...addedFriendsIds, ...friendsWhereIAmFriendIds])];

      if (allFriendIds.length > 0) {
          // Récupérer les amis avec leur token FCM (stocké dans expo_push_token)
          // IMPORTANT : Vérifier que le token est bien présent
          const { data: finalFriends } = await supabase
            .from('user_profiles')
            .select('id, pseudo, phone, expo_push_token, push_platform, is_zen_mode')
            .in('id', allFriendIds)
            .not('expo_push_token', 'is', null)
            .neq('expo_push_token', '');
          
          let identityAliasMap: Record<string, { alias: string | null, status: string | null }> = {};
          let mutedMap: Record<string, boolean> = {};
          let mutedByMap: Record<string, boolean> = {};
          let lastInteractionMap: Record<string, string> = {};
          
          // Charger toutes les données en parallèle pour réduire les requêtes séquentielles
          const [revealsResult, mutedFriendsResult, mutedByFriendsResult, myFriendsRelationsResult] = await Promise.all([
            supabase
              .from('identity_reveals')
              .select('friend_id, alias, status')
              .eq('requester_id', user.id)
              .in('friend_id', allFriendIds),
            supabase
              .from('friends')
              .select('friend_id, is_muted')
              .eq('user_id', user.id)
              .in('friend_id', allFriendIds),
            supabase
              .from('friends')
              .select('user_id, is_muted')
              .eq('friend_id', user.id)
              .in('user_id', allFriendIds)
              .eq('is_muted', true),
            supabase
              .from('friends')
              .select('friend_id, last_interaction_at')
              .eq('user_id', user.id)
              .in('friend_id', allFriendIds)
          ]);

          // Traiter les résultats
          if (revealsResult.data) {
            identityAliasMap = revealsResult.data.reduce((acc, reveal) => {
              acc[reveal.friend_id] = {
                alias: reveal.alias,
                status: reveal.status,
              };
              return acc;
            }, {} as Record<string, { alias: string | null, status: string | null }>);
          }

          if (mutedFriendsResult.data) {
            mutedMap = mutedFriendsResult.data.reduce((acc, f) => {
              acc[f.friend_id] = f.is_muted || false;
              return acc;
            }, {} as Record<string, boolean>);
          }

          if (mutedByFriendsResult.data) {
            mutedByFriendsResult.data.forEach(f => {
              mutedByMap[f.user_id] = true;
            });
          }

          // Créer un map de last_interaction_at pour l'associer directement aux friends
          if (myFriendsRelationsResult.data) {
            myFriendsRelationsResult.data.forEach(rel => {
              if (rel.last_interaction_at) {
                lastInteractionMap[rel.friend_id] = rel.last_interaction_at;
              }
            });
          }

          const friendsList = (finalFriends || []).map(friend => {
            // Si cet ami m'a mis en sourdine, je dois le voir en mode veille
            const isMutedByMe = mutedMap[friend.id] || false;
            const hasMutedMe = mutedByMap[friend.id] || false;
            
            return {
              ...friend,
              isPhoneContact: phoneFriendsIds.includes(friend.id),
              identityAlias: identityAliasMap[friend.id]?.alias || null,
              identityStatus: identityAliasMap[friend.id]?.status || null,
              // Si l'ami m'a mis en sourdine, je le vois en mode veille
              isZenMode: friend.is_zen_mode || hasMutedMe,
              is_muted: isMutedByMe,
              // Ajouter last_interaction_at directement sur l'objet friend pour le tri
              last_interaction_at: lastInteractionMap[friend.id] || null,
            };
          });
          
          // Vérifier les tokens (sans logs)
          friendsList.forEach(friend => {
            if (!friend.expo_push_token || friend.expo_push_token.trim() === '') {
              // Token manquant, mais on ne log plus
            }
          });
          
          // Trier la liste avant de la setter
          const sortedList = sortFriends(friendsList);
          setAppUsers(sortedList);
          
          // Sauvegarder dans le cache (sans bloquer si ça échoue)
          await saveCacheSafely(CACHE_KEY_FRIENDS, sortedList);
      } else {
          setAppUsers([]);
          await saveCacheSafely(CACHE_KEY_FRIENDS, []);
      }

      await Promise.all([pendingMessagesPromise, requestsAndIdentityPromise]);
      const sentPendingMessagesResult = await sentPendingMessagesPromise;
      if (sentPendingMessagesResult && sentPendingMessagesResult.length > 0) {
        const map: Record<string, { text: string; ts: string }> = {};
        sentPendingMessagesResult.forEach((m: any) => {
          map[m.to_user_id] = { text: m.message_content, ts: m.created_at };
        });
        setLastSentMessages(map);
        saveLastSentMessagesCache(map);
      } else {
        // Aucun message envoyé en attente côté serveur : ne nettoyer que si aucun set récent (éviter la course après envoi)
        setLastSentMessages((prev) => {
          if (Object.keys(prev).length === 0) return prev;
          const now = Date.now();
          if (now - lastSentSetAtRef.current < 5000) {
            // On vient de poser un message local, on attend le prochain cycle
            return prev;
          }
          saveLastSentMessagesCache({});
          return {};
        });
      }
    } catch (e) {
      // Erreur silencieuse (le polling réessayera plus tard)
    } finally { 
      setLoading(false); 
    }
  };

  // Configurer la subscription Realtime pour écouter les changements sur friends
  const setupRealtimeSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Créer un canal pour écouter les changements sur la table friends
      // Filtrer pour écouter seulement les changements sur les relations où user_id = currentUserId
      // Cela inclut les mises à jour de last_interaction_at qui déclenchent le tri
      const channel = supabase
        .channel('friends-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'friends',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            // Mise à jour optimiste locale pour un tri instantané
            const newValue = (payload.new as any)?.last_interaction_at;
            const friendId = (payload.new as any)?.friend_id;
            if (newValue && friendId) {
              setAppUsers(prev => {
                const updated = prev.map(f =>
                  f.id === friendId ? { ...f, last_interaction_at: newValue } : f
                );
                return sortFriends(updated);
              });
            }
            // Rechargement pour garantir la synchro avec Supabase
            loadData(false, false, false);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'friends',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            loadData(false, false, false);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'friends',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            // Recharger les données si une relation est supprimée
            loadData(false, false, false);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'identity_reveals',
          },
          (payload) => {
            // Recharger les données si une demande d'identité change
            loadData(false, false);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pending_messages',
            filter: `to_user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const senderId = (payload.new as any)?.from_user_id;
              const now = new Date().toISOString();

              setPendingMessages((prev) => {
                const filtered = prev.filter(m => m.id !== payload.new.id);
                return [...filtered, payload.new as any];
              });

              // Mise à jour optimiste : remonter l'expéditeur immédiatement
              if (senderId) {
                setAppUsers(prev => {
                  const updated = prev.map(f =>
                    f.id === senderId ? { ...f, last_interaction_at: now } : f
                  );
                  return sortFriends(updated);
                });

                // Si on avait un dernier message envoyé à ce contact, le retirer dès qu'il répond / que son message arrive
                setLastSentMessages((prev) => {
                  if (!prev[senderId]) return prev;
                  const next = { ...prev };
                  delete next[senderId];
                  saveLastSentMessagesCache(next);
                  return next;
                });
              }

              // Rechargement pour synchroniser avec Supabase
              loadData(false, false, false);
            } else if (payload.eventType === 'DELETE') {
              setPendingMessages((prev) => prev.filter(m => m.id !== payload.old.id));
            }
          }
        )
        // Écouter aussi les pending_messages envoyés par moi (pour savoir quand l'autre a lu/supprimé)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pending_messages',
            filter: `from_user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              const toUserId = (payload.old as any)?.to_user_id;
              if (toUserId) {
                setLastSentMessages((prev) => {
                  const copy = { ...prev };
                  delete copy[toUserId];
                  saveLastSentMessagesCache(copy);
                  return copy;
                });
                lastSentSetAtRef.current = 0;
              }
            } else if (payload.eventType === 'INSERT') {
              const toUserId = (payload.new as any)?.to_user_id;
              const text = (payload.new as any)?.message_content;
              const ts = (payload.new as any)?.created_at || new Date().toISOString();
              if (toUserId && text) {
                setLastSentMessages((prev) => {
                  const next = { ...prev, [toUserId]: { text, ts } };
                  lastSentSetAtRef.current = Date.now();
                  saveLastSentMessagesCache(next);
                  return next;
                });
              }
            }
          }
        )
        .subscribe(() => {
          // Subscription active, pas besoin de log
        });

      subscriptionRef.current = channel;
    } catch (error) {
      console.error('❌ Erreur lors de la configuration de Realtime friends:', error);
    }
  };

  const handleAccept = async (req: any) => {
    if (!currentUserId) return;
    try {
      // Récupérer la relation pour vérifier son method
      const { data: relation } = await supabase
        .from('friends')
        .select('method')
        .eq('id', req.requestId)
        .single();

      // Si c'est une invitation, on met juste à jour le status
      // Le trigger handle_invitation_accept créera automatiquement la réciproque B→A avec status='accepted'
      if (relation?.method === 'invitation') {
        const { error: updateError } = await supabase
          .from('friends')
          .update({ status: 'accepted' })
          .eq('id', req.requestId);
        
        if (updateError) {
          console.error('Erreur lors de l\'acceptation de l\'invitation:', updateError);
          Alert.alert(i18n.t('error'), i18n.t('cannot_accept_invitation'));
          return;
        }
        // Le trigger créera automatiquement la réciproque, pas besoin de créer manuellement
      } else {
        // Pour les demandes de recherche, on met à jour et on crée la réciproque
        const { error: updateError } = await supabase
          .from('friends')
          .update({ status: 'accepted' })
          .eq('id', req.requestId);
        
        if (updateError) {
          console.error('Erreur lors de l\'acceptation de la demande:', updateError);
          Alert.alert(i18n.t('error'), i18n.t('cannot_accept_request'));
          return;
        }
        
        // Vérifier si la réciproque existe déjà
        const { data: reciprocal } = await supabase
          .from('friends')
          .select('id, status')
          .eq('user_id', currentUserId)
          .eq('friend_id', req.senderId)
          .maybeSingle();
        
        // Si la réciproque n'existe pas ou est pending, la créer/mettre à jour
        if (!reciprocal) {
          await supabase
            .from('friends')
            .upsert({ 
              user_id: currentUserId, 
              friend_id: req.senderId, 
              status: 'accepted', 
              method: 'search' 
            });
        } else if (reciprocal.status === 'pending') {
          // Si elle existe mais est pending, la mettre à jour
          await supabase
            .from('friends')
            .update({ status: 'accepted' })
            .eq('id', reciprocal.id);
        }
      }
      
      loadData();
    } catch (e) { 
      console.error("Erreur handleAccept:", e);
      Alert.alert(i18n.t('error'), i18n.t('cannot_accept_request')); 
    }
  };

  const handleReject = async (requestId: string) => {
    try { await supabase.from('friends').delete().eq('id', requestId); loadData(); } catch (e) {}
  };

  const handleMuteFriend = async (friend: any) => {
    if (!currentUserId) return;
    try {
      const { error } = await supabase
        .from('friends')
        .update({ is_muted: true })
        .eq('user_id', currentUserId)
        .eq('friend_id', friend.id);
      if (error) {
        console.error('❌ Erreur mise en sourdine:', error);
        Alert.alert(i18n.t('error'), i18n.t('cannot_activate_mute'));
        return;
      }
      setAppUsers(prev => prev.map(u => u.id === friend.id ? { ...u, is_muted: true } : u));
      const updated = appUsers.map(u => u.id === friend.id ? { ...u, is_muted: true } : u);
      await saveCacheSafely(CACHE_KEY_FRIENDS, updated);
    } catch (e) {
      console.error('❌ Erreur mise en sourdine:', e);
      Alert.alert(i18n.t('error'), "Impossible d'activer la sourdine.");
    }
  };

  const handleUnmuteFriend = async (friend: any) => {
    if (!currentUserId) return;
    try {
      const { error } = await supabase
        .from('friends')
        .update({ is_muted: false })
        .eq('user_id', currentUserId)
        .eq('friend_id', friend.id);
      if (error) {
        console.error('❌ Erreur désactivation sourdine:', error);
        Alert.alert(i18n.t('error'), i18n.t('cannot_disable_mute'));
        return;
      }
      setAppUsers(prev => prev.map(u => u.id === friend.id ? { ...u, is_muted: false } : u));
      const updated = appUsers.map(u => u.id === friend.id ? { ...u, is_muted: false } : u);
      await saveCacheSafely(CACHE_KEY_FRIENDS, updated);
    } catch (e) {
      console.error('❌ Erreur désactivation sourdine:', e);
      Alert.alert(i18n.t('error'), i18n.t('cannot_disable_mute'));
    }
  };

  const handleDeleteFriend = async (friend: any) => {
    if (!currentUserId) return;
    
    const isContactFriend =
      friend?.isPhoneContact ||
      phoneFriendIdsRef.current.includes(friend?.id);

    if (isContactFriend) {
      Alert.alert(
        i18n.t('delete_impossible_title'),
        i18n.t('delete_impossible_contact'),
      );
      return;
    }
    
    // Afficher la confirmation avec Alert
    Alert.alert(
      i18n.t('confirm_delete_title'),
      i18n.t('confirm_delete_body', { pseudo: friend.pseudo }),
      [
        {
          text: i18n.t('cancel'),
          style: 'cancel',
          onPress: () => {
            // Rien à faire, le slider reviendra automatiquement
          },
        },
        {
          text: i18n.t('confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              // Supprimer les deux relations dans friends (A→B et B→A)
              // Relation A→B (où currentUserId est user_id)
              await supabase
                .from('friends')
                .delete()
                .eq('user_id', currentUserId)
                .eq('friend_id', friend.id);
              
              // Relation B→A (où friend.id est user_id)
              await supabase
                .from('friends')
                .delete()
                .eq('user_id', friend.id)
                .eq('friend_id', currentUserId);
              
              // Recharger la liste
              loadData();
              
              // Afficher un toast de confirmation
              showToast(i18n.t('friend_deleted_toast', { pseudo: friend.pseudo }));
            } catch (error) {
              console.error('Erreur lors de la suppression:', error);
              Alert.alert(i18n.t('error'), i18n.t('cannot_delete_friend'));
            }
          },
        },
      ]
    );
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    // Animation d'apparition
    RNAnimated.sequence([
      RNAnimated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      RNAnimated.delay(1300), // Afficher pendant 1.3s
      RNAnimated.timing(toastOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToastMessage(null);
    });
  };

  const handleLongPressName = async (friend: any) => {
    if (friend.identityAlias) {
      showToast(`✨ ${friend.identityAlias}`);
      return;
    }

    if (friend.identityStatus === 'pending') {
      Alert.alert(
        i18n.t('already_asked_identity_title'),
        i18n.t('already_asked_identity_body', { pseudo: friend.pseudo }),
        [
          { text: i18n.t('cancel'), style: 'cancel' },
          { text: i18n.t('relaunch_btn'), onPress: () => requestIdentityReveal(friend, { force: true }) },
        ],
      );
      return;
    }

    let contactRevealed = false;

    if (friend.phone) {
      try {
        const status = await ensureContactPermissionWithDisclosure();
        if (status === 'granted') {
          const { data: contacts } = await Contacts.getContactsAsync({
            fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
          });

          if (contacts && contacts.length > 0) {
            const normalizedFriendPhone = normalizePhone(friend.phone);

            const matchingContact = contacts.find(contact => {
              if (!contact.phoneNumbers || contact.phoneNumbers.length === 0) return false;
              return contact.phoneNumbers.some(phoneNumber => {
                const normalizedContactPhone = normalizePhone(phoneNumber.number || '');
                return normalizedContactPhone === normalizedFriendPhone;
              });
            });

            if (matchingContact) {
              const fullName = matchingContact.name || matchingContact.firstName || matchingContact.lastName || friend.pseudo;
              showToast(fullName);
              contactRevealed = true;
            }
          }
        }
      } catch (error) {
        console.error("Erreur lors de la recherche du contact:", error);
      }
    }

    if (contactRevealed) {
      return;
    }

    Alert.alert(
      i18n.t('ask_identity_title'),
      i18n.t('ask_identity_body', { pseudo: friend.pseudo }),
      [
        { text: i18n.t('cancel'), style: 'cancel' },
        {
          text: i18n.t('ask_btn'),
          onPress: () => requestIdentityReveal(friend),
        },
      ],
    );
  };

  const requestIdentityReveal = async (friend: any, options: { force?: boolean } = {}) => {
    if (!currentUserId) return;

    try {
      await supabase
        .from('identity_reveals')
        .upsert({
          requester_id: currentUserId,
          friend_id: friend.id,
          status: 'pending',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'requester_id,friend_id',
        });

      if (friend.expo_push_token) {
        await sendProutViaBackend(
          friend.expo_push_token,
          currentPseudo || 'Un ami',
          'identity-request',
          (friend.push_platform as 'ios' | 'android' | undefined) || 'android', // par défaut android pour forcer data-only et ProutMessagingService
          {
            requesterId: currentUserId,
            requesterPseudo: currentPseudo || 'Un ami',
            receiverId: friend.id, // ⚠️ IMPORTANT : passer receiverId pour que le backend récupère la bonne locale
            // locale: i18n.locale || 'fr', // ❌ RETIRÉ : le backend utilise la locale du destinataire
          },
        );
      }

      if (options.force) {
        showToast(i18n.t('identity_request_sent') + ' !');
      } else {
        Alert.alert(i18n.t('success'), i18n.t('identity_request_sent') + ' !');
      }
      loadData(false, false, false);
    } catch (error) {
      console.error('❌ Impossible de demander l’identité:', error);
      Alert.alert(i18n.t('error'), 'Impossible d’envoyer la demande.');
    }
  };

  const scrollToFriend = (_friendId: string) => {
    // Désactivé : on laisse le KeyboardAvoidingView gérer le décalage du clavier, pas de scroll manuel supplémentaire.
    return;
  };

  const handlePressFriend = (friend: any) => {
    // Debounce pour éviter les doubles clics (fermeture puis réouverture immédiate)
    const now = Date.now();
    if (now - lastPressTime.current < 500) return;
    lastPressTime.current = now;

    const unreadMessages = pendingMessages.filter(m => m.from_user_id === friend.id);
    const alreadyUnreadOpen = expandedUnreadId === friend.id;
    const isInputOpen = expandedFriendId === friend.id;
    const hasCachedMessages = unreadCache[friend.id] && unreadCache[friend.id].length > 0;
    
    // Si on a des messages non lus OU des messages en cache (déjà ouverts)
    if (unreadMessages.length > 0 || hasCachedMessages) {
      if (!alreadyUnreadOpen && unreadMessages.length > 0) {
        // Première ouverture : afficher les messages ET ouvrir le champ de saisie automatiquement
        setExpandedUnreadId(friend.id);
        setUnreadCache((prev) => ({ ...prev, [friend.id]: unreadMessages }));
        unreadMessages.forEach(msg => markMessageAsRead(msg.id));
        setExpandedFriendId(friend.id); // Ouvrir le champ de saisie automatiquement
        return;
      }
      
      // Messages déjà ouverts (soit dans unreadMessages, soit dans le cache)
      if (!isInputOpen) {
        // Si l'input n'est pas ouvert, ouvrir l'input en gardant les messages visibles
        setExpandedFriendId(friend.id);
        return;
      }
      
      // Si l'input est ouvert, fermer tout
      setExpandedFriendId(null);
      setExpandedUnreadId(null);
      Keyboard.dismiss(); // Force la fermeture du clavier
      // Nettoyer le cache pour ce contact
      setUnreadCache((prev) => {
        const newCache = { ...prev };
        delete newCache[friend.id];
        return newCache;
      });
      return;
    }

    const newExpandedId = expandedFriendId === friend.id ? null : friend.id;
    if (!newExpandedId) {
      Keyboard.dismiss(); // Force la fermeture du clavier si on ferme
    }
    setExpandedFriendId(newExpandedId);
    // Ne pas fermer les messages d'un autre contact quand on clique sur un contact sans messages
  };

  const handleSendProut = async (recipient: any) => {
    // 1. Vérification Mode Zen (Moi) - utilise la prop isZenMode
    if (isZenMode) {
      Alert.alert(i18n.t('zen_mode_active_me_title'), i18n.t('zen_mode_active_me_body'));
      return;
    }

    // 2. Vérification Mode Zen (Destinataire)
    if (recipient.isZenMode) {
      Alert.alert(i18n.t('zen_mode_active_friend_title'), i18n.t('zen_mode_active_friend_body', { pseudo: recipient.pseudo }));
      return;
    }

    // 3. Vérification Sourdine : si le destinataire a mis l'expéditeur en sourdine
    if (!currentUserId) return;
    try {
      const { data: muteCheck } = await supabase
        .from('friends')
        .select('is_muted')
        .eq('user_id', recipient.id)
        .eq('friend_id', currentUserId)
        .maybeSingle();
      
      if (muteCheck?.is_muted) {
        Alert.alert(
          i18n.t('mute_mode_active_title'),
          i18n.t('mute_mode_active_body', { pseudo: recipient.pseudo })
        );
        return;
      }
    } catch (e) {
      console.error('❌ Erreur vérification sourdine:', e);
      // Continuer même en cas d'erreur pour ne pas bloquer l'envoi
    }

    // Vérifier le cooldown pour cet utilisateur
    const now = Date.now();
    const lastSent = cooldownMapRef.current.get(recipient.id);
    
    if (lastSent && (now - lastSent) < COOLDOWN_DURATION) {
      // En cooldown, ignorer la requête
      const remainingTime = Math.ceil((COOLDOWN_DURATION - (now - lastSent)) / 1000);
      // Cooldown actif, réessayez plus tard
      return;
    }
    
    // Mettre à jour le timestamp pour cet utilisateur
    cooldownMapRef.current.set(recipient.id, now);
    
    try {
      // TOUJOURS recharger le pseudo depuis la base pour être sûr d'avoir la valeur à jour
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert(i18n.t('error'), i18n.t('not_connected'));
        // Retirer le cooldown en cas d'erreur
        cooldownMapRef.current.delete(recipient.id);
        return;
      }

      // Récupérer le pseudo de l'expéditeur depuis la base de données
      const { data: senderProfile, error: senderProfileError } = await supabase
        .from('user_profiles')
        .select('pseudo')
        .eq('id', user.id)
        .single();

      if (senderProfileError || !senderProfile?.pseudo) {
        console.error('❌ Erreur lors de la récupération du pseudo de l\'expéditeur:', senderProfileError);
        Alert.alert(i18n.t('error'), i18n.t('cannot_retrieve_pseudo'));
        cooldownMapRef.current.delete(recipient.id);
        return;
      }

      const senderPseudo = senderProfile.pseudo.trim();
      if (!senderPseudo || senderPseudo === '') {
        Alert.alert(i18n.t('error'), i18n.t('pseudo_not_defined'));
        cooldownMapRef.current.delete(recipient.id);
        return;
      }

      // Mettre à jour l'état local pour les prochaines fois
      if (currentPseudo !== senderPseudo) {
        setCurrentPseudo(senderPseudo);
      }

      // Le token FCM est stocké dans expo_push_token (réutilisation du champ existant)
      let fcmToken = recipient.expo_push_token;
      let targetPlatform = recipient.push_platform;
      
      // Si le token n'est pas présent, essayer de le récupérer depuis la base
      if (!fcmToken || fcmToken.trim() === '') {
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('expo_push_token, pseudo, push_platform')
          .eq('id', recipient.id)
          .single();
        
        if (profileError) {
          console.error(`❌ Erreur lors de la récupération du profil pour ${recipient.pseudo}:`, profileError);
        }
        
        if (profile?.expo_push_token && profile.expo_push_token.trim() !== '') {
          fcmToken = profile.expo_push_token;
          targetPlatform = profile.push_platform || targetPlatform;
          
          // Mettre à jour l'objet dans la liste pour éviter de refaire la requête
          const updatedUsers = appUsers.map(u => 
            u.id === recipient.id ? { ...u, expo_push_token: fcmToken, push_platform: profile.push_platform || u.push_platform } : u
          );
          setAppUsers(updatedUsers);
        } else {
          Alert.alert(
            i18n.t('error'), 
            i18n.t('notifications_not_enabled', { pseudo: recipient.pseudo })
          );
          // Retirer le cooldown en cas d'erreur
          cooldownMapRef.current.delete(recipient.id);
          return;
        }
      }

      // Le backend se charge de détecter le type de token (iOS Expo ou Android FCM)
      // et d'utiliser la bonne API. On envoie le token tel quel.

      // ⚡ Choisir un prout aléatoire AVANT de l'utiliser
      const randomKey = SOUND_KEYS[Math.floor(Math.random() * SOUND_KEYS.length)];
      const customMessage = (messageDrafts[recipient.id] || '').trim().slice(0, 140);

      // Jouer localement avec expo-av (seulement si le mode silencieux n'est pas activé)
      if (!isSilentMode) {
        const soundFile = PROUT_SOUNDS[randomKey];
        try {
          const { sound } = await Audio.Sound.createAsync(soundFile);
          await sound.playAsync();
          // Libérer la ressource après lecture
          sound.setOnPlaybackStatusUpdate(async (status) => {
            if (status.isLoaded && status.didJustFinish) {
              await sound.unloadAsync();
            }
          });
        } catch (error) {
          // Ignorer l'erreur si l'app est en arrière-plan (comportement normal d'Android)
          // Ignorer les erreurs de lecture audio silencieusement (normal en arrière-plan)
        }
      }

      // Envoyer le push via backend avec le token FCM et le bon pseudo
      // ⚠️ On ne passe PAS la locale de l'expéditeur : le backend récupère celle du destinataire depuis Supabase
      await sendProutViaBackend(
        fcmToken,
        senderPseudo,
        randomKey,
        targetPlatform || 'android', // défaut android pour forcer data-only + canal custom
        {
          ...(customMessage ? { customMessage } : {}),
          senderId: user.id,
          receiverId: recipient.id,
          // locale: i18n.locale || 'fr', // ❌ RETIRÉ : le backend utilise la locale du destinataire
        }
      );
      
      // Mise à jour optimiste locale immédiate : mettre à jour last_interaction_at localement
      // pour que le tri soit instantané, puis recharger depuis Supabase pour la synchronisation
      const now = new Date().toISOString();
      setAppUsers(prevUsers => {
        const updatedUsers = prevUsers.map(friend => 
          friend.id === recipient.id 
            ? { ...friend, last_interaction_at: now }
            : friend
        );
        return sortFriends(updatedUsers);
      });
      if (customMessage) {
        setLastSentMessages(prev => {
          const next = { ...prev, [recipient.id]: { text: customMessage, ts: now } };
          lastSentSetAtRef.current = Date.now();
          saveLastSentMessagesCache(next);
          return next;
        });
      }
      
      // Le backend met à jour last_interaction_at pour les deux relations (A→B et B→A)
      // Recharger les données depuis Supabase pour synchroniser avec le backend
      loadData(false, false, false);

      // Nettoyer le brouillon et refermer le champ
      setMessageDrafts(prev => ({ ...prev, [recipient.id]: '' }));
      setExpandedFriendId(null);
      setExpandedUnreadId(null);
      // Nettoyer le cache pour ce contact
      setUnreadCache((prev) => {
        const newCache = { ...prev };
        delete newCache[recipient.id];
        return newCache;
      });

      // Afficher le nom du prout dans un toast (traduit dans la langue de l'expéditeur)
      const proutName = i18n.t(`prout_names.${randomKey}`) || randomKey;
      showToast(`${proutName} !`);
      
      // Déclencher l'animation de secousse du header
      if (onProutSent) {
        onProutSent();
      }

    } catch (error: any) {
      console.error("Erreur lors de l'envoi du prout:", error?.message || error);
      
      // Si c'est une erreur 429 (Too Many Requests), informer l'utilisateur
      if (error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
        Alert.alert(i18n.t('cooldown_alert'), i18n.t('cooldown_message'));
      } else if (
        error?.message?.includes('target_app_uninstalled') ||
        error?.code === 'target_app_uninstalled'
      ) {
        Alert.alert(i18n.t('error'), i18n.t('app_uninstalled', { pseudo: recipient.pseudo }));
        // Purger localement l'ami sans token
        const filtered = appUsers.filter(u => u.id !== recipient.id);
        setAppUsers(filtered);
        await saveCacheSafely(CACHE_KEY_FRIENDS, filtered);
      } else {
        // Message plus détaillé selon le type d'erreur
        let errorMessage = "Impossible d'envoyer le prout.";
        if (error?.message?.includes('Backend error')) {
          errorMessage = i18n.t('backend_error_ios');
        }
        Alert.alert(i18n.t('error'), errorMessage);
      }
      
      // En cas d'erreur, on retire le cooldown pour permettre une nouvelle tentative
      cooldownMapRef.current.delete(recipient.id);
    }
  };

  const renderRequestsHeader = () => {
    const hasRequests = pendingRequests.length > 0 || identityRequests.length > 0;
    const shouldShowSilentWarning = showSilentWarning && !dismissedSilentWarning;
    if (!hasRequests && !shouldShowSilentWarning) return null;
    return (
      <View style={styles.requestsContainer}>
        {shouldShowSilentWarning && (
          <View style={styles.silentWarning}>
            <Text style={styles.silentWarningText}>{i18n.t('silent_notifications_warning')}</Text>
            <View style={styles.silentWarningActions}>
              <TouchableOpacity style={styles.silentWarningButton} onPress={openNotificationSettings}>
                <Text style={styles.silentWarningButtonText}>{i18n.t('settings')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.silentWarningButtonOk} onPress={() => {
                dismissedSilentWarningSession = true; // bloquer pour toute la session
                setDismissedSilentWarning(true);
              }}>
                <Text style={styles.silentWarningButtonText}>{i18n.t('ok')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {pendingRequests.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{i18n.t('friends_requests')}</Text>
            {pendingRequests.map((req) => (
              <View key={req.requestId} style={styles.requestRow}>
                <Text style={styles.requestName}>{req.pseudo}</Text>
                <View style={styles.requestActions}>
                  <TouchableOpacity onPress={() => handleReject(req.requestId)} style={styles.rejectBtn}>
                    <Ionicons name="close" size={20} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleAccept(req)} style={styles.acceptBtn}>
                    <Ionicons name="checkmark" size={20} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {identityRequests.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: pendingRequests.length ? 20 : 0 }]}>{i18n.t('identity_requests')}</Text>
            {identityRequests.map((req) => (
              <View key={req.requesterId} style={styles.identityRow}>
                <Text style={styles.requestName}>{req.requesterPseudo}</Text>
                <TouchableOpacity
                  style={styles.identityButton}
                  onPress={() => router.push({
                    pathname: '/IdentityRevealScreen',
                    params: {
                      requesterId: req.requesterId,
                      requesterPseudo: req.requesterPseudo,
                    },
                  })}
                >
                  <Ionicons name="person-circle" size={18} color="white" />
                  <Text style={styles.identityButtonText}>{i18n.t('respond_btn')}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </View>
    );
  };

  const scrollToInput = (index: number) => {
    if (Platform.OS !== 'ios') return;
    if (!flatListRef.current) return;
    // Petit délai pour laisser le temps au clavier de démarrer/finir son animation
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, viewPosition: 1, animated: true });
    }, 100);
  };

  // Synchronisation avec l'ouverture du clavier pour iOS
  useEffect(() => {
    if (Platform.OS === 'ios') {
      const showSub = Keyboard.addListener('keyboardWillShow', () => {
        if (expandedFriendId) {
          const index = appUsers.findIndex(f => f.id === expandedFriendId);
          if (index !== -1 && flatListRef.current) {
             flatListRef.current.scrollToIndex({ index, viewPosition: 1, animated: true });
          }
        }
      });
      return () => showSub.remove();
    }
  }, [expandedFriendId, appUsers]);

  const handlePressHeader = () => {
    Keyboard.dismiss();
    setExpandedFriendId(null);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadData(false, false, true);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading && appUsers.length === 0 && pendingRequests.length === 0) return <ActivityIndicator color="#007AFF" style={{margin: 20}} />;

  const content = Platform.OS === 'ios' ? (
      <KeyboardAvoidingView
        style={styles.container}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={appUsers}
          keyExtractor={(item) => item.id}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 400 },
            appUsers.length === 0 && pendingRequests.length === 0 ? styles.emptyContentPadding : null,
          ]}
          ListHeaderComponent={
            <TouchableWithoutFeedback onPress={handlePressHeader}>
              <View>
                {headerComponent}
                {renderRequestsHeader()}
              </View>
            </TouchableWithoutFeedback>
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>{i18n.t('no_friends')}</Text>
              <Text style={styles.subText}>{i18n.t('invite_contacts')}</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const unreadMessages = pendingMessages.filter(m => m.from_user_id === item.id);
            const hasUnread = unreadMessages.length > 0;
            // Afficher le dernier message (le plus récent) dans l'aperçu
            const lastUnread = unreadMessages.length > 0 ? unreadMessages[unreadMessages.length - 1] : null;
            const isUnreadExpanded = expandedUnreadId === item.id;
            const isExpanded = expandedFriendId === item.id;
            const draftValue = messageDrafts[item.id] || '';
            const unreadListToShow = unreadMessages.length > 0 ? unreadMessages : (unreadCache[item.id] || []);
            if (isExpanded) {
              scrollToInput(index);
            }
            return (
              <View style={{ position: 'relative', marginBottom: 5 }}>
              <SwipeableFriendRow
                ref={(ref) => { rowRefs.current[item.id] = ref; }}
                friend={item}
                backgroundColor={index % 2 === 0 ? '#d2f1ef' : '#baded7'}
                onSendProut={() => handleSendProut(item)}
                onLongPressName={() => handleLongPressName(item)}
                onPressName={() => handlePressFriend(item)}
                hasUnread={hasUnread}
                unreadMessage={lastUnread?.message_content || (hasUnread && unreadMessages.length > 1 ? `${unreadMessages.length} messages` : null)}
                onDeleteFriend={() => handleDeleteFriend(item)}
                onMuteFriend={() => handleMuteFriend(item)}
                onUnmuteFriend={() => handleUnmuteFriend(item)}
                isMuted={item.is_muted || false}
                introDelay={index * 40}
              />
                {isUnreadExpanded && unreadListToShow.length > 0 && (
                  <TouchableOpacity 
                    style={styles.unreadContainer}
                    onPress={() => handlePressFriend(item)}
                    activeOpacity={0.7}
                  >
                    {unreadListToShow.map((msg) => (
                      <Text key={msg.id} style={styles.unreadItemText}>- "{msg.message_content}"</Text>
                    ))}
                  </TouchableOpacity>
                )}
                {isExpanded && (
                  <View
                    style={[
                      styles.messageInputContainer,
                      Platform.OS === 'android' && styles.messageInputContainerAndroid,
                    ]}
                  >
                  {lastSentMessages[item.id]?.text ? (
                    <View style={styles.lastSentContainer}>
                      <Text style={styles.lastSentText}>"{lastSentMessages[item.id].text}"</Text>
                    </View>
                  ) : null}
                    <View
                      style={[
                        styles.messageInputRow,
                        Platform.OS === 'android' && styles.messageInputRowAndroid,
                      ]}
                    >
                      <TextInput
                        ref={(ref) => { textInputRefs.current[item.id] = ref; }}
                        style={styles.messageInput}
                        placeholder={i18n.t('add_message_placeholder')}
                        placeholderTextColor="#777"
                        value={draftValue}
                        onChangeText={(text) => setMessageDrafts(prev => ({ ...prev, [item.id]: text }))}
                        maxLength={140}
                        multiline
                        onFocus={() => {
                          if (Platform.OS === 'ios') {
                            scrollToInput(index);
                          }
                        }}
                      />
                      <TouchableOpacity
                        onPress={() => draftValue.trim() && handleSendProut(item)}
                        style={[
                          styles.messageSendButton,
                          !draftValue.trim() && styles.messageSendButtonDisabled,
                        ]}
                        accessibilityLabel="Envoyer"
                        activeOpacity={draftValue.trim() ? 0.8 : 1}
                        disabled={!draftValue.trim()}
                      >
                        <Ionicons name="send" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          }}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            appUsers.length > 0 ? (
              <View style={styles.footerHelp}>
                <Text style={styles.footerHelpText}>{i18n.t('footer_help_text')}</Text>
              </View>
            ) : null
          }
        />

      {/* Toast qui disparaît automatiquement */}
      {toastMessage && (
        <RNAnimated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </RNAnimated.View>
      )}
    </KeyboardAvoidingView>
  ) : (
      <View style={styles.container}>
        <FlatList
          ref={flatListRef}
          data={appUsers}
          keyExtractor={(item) => item.id}
          style={styles.list}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.listContent,
            appUsers.length === 0 && pendingRequests.length === 0 ? styles.emptyContentPadding : null,
          ]}
          ListHeaderComponent={
            <TouchableWithoutFeedback onPress={handlePressHeader}>
              <View>
                {headerComponent}
                {renderRequestsHeader()}
              </View>
            </TouchableWithoutFeedback>
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>{i18n.t('no_friends')}</Text>
              <Text style={styles.subText}>{i18n.t('invite_contacts')}</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const unreadMessages = pendingMessages.filter(m => m.from_user_id === item.id);
            const hasUnread = unreadMessages.length > 0;
            const lastUnread = unreadMessages.length > 0 ? unreadMessages[unreadMessages.length - 1] : null;
            const isUnreadExpanded = expandedUnreadId === item.id;
            const isExpanded = expandedFriendId === item.id;
            const draftValue = messageDrafts[item.id] || '';
            const unreadListToShow = unreadMessages.length > 0 ? unreadMessages : (unreadCache[item.id] || []);
            return (
              <View style={{ position: 'relative', marginBottom: 5 }}>
              <SwipeableFriendRow
                ref={(ref) => { rowRefs.current[item.id] = ref; }}
                friend={item}
                backgroundColor={index % 2 === 0 ? '#d2f1ef' : '#baded7'}
                onSendProut={() => handleSendProut(item)}
                onLongPressName={() => handleLongPressName(item)}
                onPressName={() => handlePressFriend(item)}
                hasUnread={hasUnread}
                unreadMessage={lastUnread?.message_content || (hasUnread && unreadMessages.length > 1 ? `${unreadMessages.length} messages` : null)}
                onDeleteFriend={() => handleDeleteFriend(item)}
                onMuteFriend={() => handleMuteFriend(item)}
                onUnmuteFriend={() => handleUnmuteFriend(item)}
                isMuted={item.is_muted || false}
                introDelay={index * 40}
              />
                {isUnreadExpanded && unreadListToShow.length > 0 && (
                  <TouchableOpacity 
                    style={styles.unreadContainer}
                    onPress={() => handlePressFriend(item)}
                    activeOpacity={0.7}
                  >
                    {unreadListToShow.map((msg) => (
                      <Text key={msg.id} style={styles.unreadItemText}>- "{msg.message_content}"</Text>
                    ))}
                  </TouchableOpacity>
                )}
                {isExpanded && (
                  <View style={styles.messageInputContainer}>
                  {lastSentMessages[item.id]?.text ? (
                    <View style={styles.lastSentContainer}>
                      <Text style={styles.lastSentText}>"{lastSentMessages[item.id].text}"</Text>
                    </View>
                  ) : null}
                    <View style={styles.messageInputRow}>
                      <TextInput
                        ref={(ref) => { textInputRefs.current[item.id] = ref; }}
                        style={styles.messageInput}
                        placeholder={i18n.t('add_message_placeholder')}
                        placeholderTextColor="#777"
                        value={draftValue}
                        onChangeText={(text) => setMessageDrafts(prev => ({ ...prev, [item.id]: text }))}
                        maxLength={140}
                        multiline
                      />
                      <TouchableOpacity
                        onPress={() => draftValue.trim() && handleSendProut(item)}
                        style={[
                          styles.messageSendButton,
                          !draftValue.trim() && styles.messageSendButtonDisabled,
                        ]}
                        accessibilityLabel="Envoyer"
                        activeOpacity={draftValue.trim() ? 0.8 : 1}
                        disabled={!draftValue.trim()}
                      >
                        <Ionicons name="send" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          }}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            appUsers.length > 0 ? (
              <View style={styles.footerHelp}>
                <Text style={styles.footerHelpText}>{i18n.t('footer_help_text')}</Text>
              </View>
            ) : null
          }
        />

      {/* Toast qui disparaît automatiquement */}
      {toastMessage && (
        <RNAnimated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </RNAnimated.View>
      )}
    </View>
  );

  return content;
}

const styles = StyleSheet.create({
  container: { flex: 1, marginTop: 0 },
  keyboardAvoidingView: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingBottom: 20 },
  emptyContentPadding: { flexGrow: 1, justifyContent: 'center' },
  sectionTitle: { fontWeight: 'bold', color: '#604a3e', marginBottom: 10, fontSize: 16, marginLeft: 5 },
  requestsContainer: { marginBottom: 20 },
  requestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', padding: 12, borderRadius: 10, marginBottom: 8 },
  requestName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  requestActions: { flexDirection: 'row', gap: 15 },
  acceptBtn: { backgroundColor: '#4CAF50', padding: 8, borderRadius: 20 },
  rejectBtn: { backgroundColor: '#F44336', padding: 8, borderRadius: 20 },
  identityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', padding: 12, borderRadius: 10, marginBottom: 8 },
  identityButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#604a3e', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  identityButtonText: { color: 'white', fontWeight: 'bold' },
  emptyCard: { backgroundColor: 'rgba(255,255,255,0.7)', padding: 20, borderRadius: 15, alignItems: 'center' },
  emptyText: { color: '#666', fontSize: 16, fontWeight: 'bold' },
  subText: { color: '#888', fontSize: 14, marginTop: 5 },
  messageInputContainer: { backgroundColor: 'rgba(255,255,255,0.9)', marginTop: 0, marginBottom: 10, padding: 8, paddingBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: '#d9e6e3' },
  messageInputContainerAndroid: { marginBottom: 0, paddingBottom: 0 },
  messageLabel: { color: '#604a3e', fontWeight: '600', marginBottom: 6 },
  messageInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 0, gap: 8 },
  messageInputRowAndroid: { alignItems: 'flex-end' },
  messageInput: { flex: 1, minHeight: 40, maxHeight: 80, borderWidth: 1, borderColor: '#c5d7d3', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, color: '#333', backgroundColor: '#fff', fontSize: 14 },
  messageSendButton: { backgroundColor: '#ebb89b', padding: 10, borderRadius: 999, justifyContent: 'center', alignItems: 'center', minWidth: 40, minHeight: 40 },
  messageSendButtonDisabled: { backgroundColor: '#d9d9d9' },
  sendButton: { padding: 16, width: 80, height: 80, justifyContent: 'center', alignItems: 'center', alignSelf: 'center' },
  sendIcon: { width: 64, height: 64 },
  messageHelper: { marginTop: 4, marginLeft: 4, color: '#777', fontSize: 11 },
  lastSentContainer: { backgroundColor: 'rgba(235, 184, 155, 0.25)', borderRadius: 10, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(96, 74, 62, 0.12)' },
  lastSentText: { fontSize: 13, color: '#604a3e', opacity: 0.9 },
  unreadContainer: { backgroundColor: 'rgba(255,255,255,0.95)', marginTop: 0, marginBottom: 0, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#d9e6e3' },
  unreadItemText: { color: '#604a3e', fontSize: 14, marginBottom: 4 },
  silentWarning: { backgroundColor: 'rgba(255,255,255,0.9)', padding: 12, borderRadius: 10, marginBottom: 8 },
  silentWarningText: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  silentWarningActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  silentWarningButton: { backgroundColor: '#ebb89b', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  silentWarningButtonOk: { backgroundColor: '#4CAF50', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  silentWarningButtonText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  swipeableRow: {
    position: 'relative',
    borderRadius: 15,
    overflow: 'hidden', // Garder hidden pour le design
    height: 60, // Hauteur fixe pour aligner l'image
    zIndex: 1, // S'assurer que le conteneur reste dans son espace
  },
  swipeBackground: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    justifyContent: 'center', // Centrer verticalement
    alignItems: 'flex-start', // Positionner à gauche
    paddingLeft: 20, // Espacement depuis la gauche
    height: 60, // Même hauteur que la ligne
    backgroundColor: 'rgba(255, 255, 255, 0.4)', // Fond clair pour différencier les couches
    overflow: 'hidden', // CRITIQUE : Masquer impérativement ce qui dépasse lors du zoom agressif
  },
  animImage: {
    width: 60,
    height: 60,
    // Le transform origin est center par défaut en React Native
    // L'image va zoomer depuis son centre
  },
  finalImageContainer: {
    // Conteneur pour l'image finale pour éviter qu'elle affecte le layout parent
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    zIndex: 1,
  },
  swipeForeground: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    height: '100%',
    width: '100%',
  },
  toast: {
    position: 'absolute',
    top: 100,
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
    alignItems: 'center',
  },
  toastText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  pseudo: { fontSize: 18, fontWeight: '600', color: '#333', marginLeft: 10, flex: 1 },
  unreadInline: { flexDirection: 'row', alignItems: 'center', maxWidth: '55%', marginLeft: -60, gap: 6 },
  unreadMessage: { fontSize: 13, fontStyle: 'italic', color: '#7a5547', flexShrink: 1 },
  redDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#4caf50' },
  deleteBackground: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    backgroundColor: '#F44336', // Rouge
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
    borderRadius: 15,
  },
  deleteText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerHelp: {
    padding: 20,
    paddingTop: 30,
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerHelpText: {
    color: '#604a3e',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.7,
  },
});
