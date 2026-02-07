import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { useAudioPlayer } from 'expo-audio'; // Supprimé
import { Audio } from 'expo-av';
import * as Contacts from 'expo-contacts';
import { useFocusEffect, useRouter } from 'expo-router';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Alert, AppState, DeviceEventEmitter, Dimensions, FlatList, Image, Keyboard, KeyboardAvoidingView, Linking, NativeModules, Platform, Animated as RNAnimated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { Gesture, GestureDetector, TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
// 👇 AJOUT : Hook pour capturer la hauteur réelle du clavier (Texte OU Emoji)
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import Modal from 'react-native-modal';
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
  withTiming
} from 'react-native-reanimated';
import { RINGER_MODE, VolumeManager } from 'react-native-volume-manager';
import { ensureContactPermissionWithDisclosure } from '../lib/contactConsent';
import { normalizePhone } from '../lib/normalizePhone';
import { markMessageReadViaBackend, sendProutViaBackend } from '../lib/sendProutBackend';
// Import supprimé : on utilise maintenant sync_contacts (fonction SQL Supabase)
import i18n from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { SearchBar } from './SearchBar';
const ANIM_IMAGES = [
  require('../assets/images/animprout1.png'),
  require('../assets/images/animprout2.png'),
  require('../assets/images/animprout3.png'),
  require('../assets/images/animprout4.png'),
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
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

type LastSentMessage = { text: string; ts: string; id?: string; status?: 'read'; readAt?: number };
type LastSentMap = Record<string, LastSentMessage[]>; // Tableau de messages pour accumulation

// Mémoire de session (pas persistée) pour bloquer la bannière après clic OK
let dismissedSilentWarningSession = false;
// Mémoire globale pour les messages supprimés (pour éviter la réapparition si re-render)
const deletedMessagesCache = new Set<string>();

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

// Cache pour les derniers messages envoyés (map userId -> [{text, ts, id?, status?}])
const LAST_SENT_TTL_MS = 24 * 60 * 60 * 1000;
const TEMP_SENT_TTL_MS = 10 * 60 * 1000; // 10 min pour les messages sans ID (stale)
const READ_ANIMATION_MS = 3000; // 3 secondes pour l'animation de disparition

const isFreshSentMessage = (msg?: LastSentMessage) => {
  if (!msg) return false;
  if (!msg.ts) {
    // Si pas de timestamp et pas d'ID, on considère stale
    return !!msg.id;
  }
  const time = new Date(msg.ts).getTime();
  if (Number.isNaN(time)) return true;
  const age = Date.now() - time;
  // Si pas d'ID, c'est un message temporaire: purge rapide
  if (!msg.id) {
    return age < TEMP_SENT_TTL_MS;
  }
  return age < LAST_SENT_TTL_MS;
};
const loadLastSentMessagesCache = async (): Promise<LastSentMap> => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY_LAST_SENT_MESSAGES);
    if (!cached) return {};
    const parsed = JSON.parse(cached);
    if (parsed && typeof parsed === 'object') {
      // Migration : convertir l'ancien format (un seul message) vers le nouveau (tableau)
      const migrated: LastSentMap = {};
      Object.entries(parsed).forEach(([userId, value]: [string, any]) => {
        if (Array.isArray(value)) {
          // Déjà au bon format
          migrated[userId] = value;
        } else if (value && typeof value === 'object' && value.text) {
          // Ancien format : convertir en tableau
          migrated[userId] = [value];
        }
      });
      return migrated;
    }
    return {};
  } catch {
    return {};
  }
};

const saveLastSentMessagesCache = async (map: LastSentMap) => {
  try {
    // Ne jamais sauvegarder les messages lus dans le cache
    const cleaned: LastSentMap = {};
    Object.entries(map).forEach(([userId, messages]) => {
      if (Array.isArray(messages)) {
        const unreadMessages = messages.filter(
          msg => msg.status !== 'read' && isFreshSentMessage(msg)
        );
        if (unreadMessages.length > 0) {
          cleaned[userId] = unreadMessages;
        }
      } else if (
        messages &&
        typeof messages === 'object' &&
        (messages as any).status !== 'read' &&
        isFreshSentMessage(messages as LastSentMessage)
      ) {
        // Format ancien (un seul message) - migration
        cleaned[userId] = [messages as LastSentMessage];
      }
    });
    await AsyncStorage.setItem(CACHE_KEY_LAST_SENT_MESSAGES, JSON.stringify(cleaned));
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
  introTrigger?: number;
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
  introTrigger = 0,
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
  }, [introDelay, introOffset, introTrigger]);
  
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

      {/* Background droite : Image d'animation avec fond clair (cachée sur iOS) */}
      {Platform.OS !== 'ios' && (
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
      )}

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
              {/* Avatar */}
              {friend.avatar_url ? (
                <Image 
                  source={{ uri: friend.avatar_url }} 
                  style={styles.friendAvatar} 
                />
              ) : (
                <View style={styles.friendAvatarPlaceholder}>
                  <Text style={styles.friendAvatarPlaceholderText}>
                    {friend.pseudo ? friend.pseudo.charAt(0).toUpperCase() : '?'}
                  </Text>
                </View>
              )}
              <Text style={styles.pseudo} numberOfLines={1}>{friend.pseudo}</Text>
              {friend.isZenMode && (
                <Ionicons name="moon" size={20} color="#ebb89b" style={{ marginLeft: 5 }} />
              )}
              {friend.is_muted && (
                <Ionicons name="volume-mute-outline" size={20} color="#666" style={{ marginLeft: 5 }} />
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

// Composant pour gérer l'animation du message envoyé (PRRT! : opacité réduite quand lu)
const SentMessageStatus = ({ message }: { message: { text: string; status?: 'read' } | undefined }) => {
  const [displayedMessage, setDisplayedMessage] = useState(message);
  const opacity = useRef(new RNAnimated.Value(1)).current;
  const [isRead, setIsRead] = useState(false);

  useEffect(() => {
    if (message && message.status !== 'read') {
      setDisplayedMessage(message);
      setIsRead(false);
      opacity.setValue(1);
    } else if (displayedMessage && (message?.status === 'read' || !message)) {
      setIsRead(true);
      // PRRT! : opacité réduite sur la bulle quand lu, puis disparition
      RNAnimated.sequence([
        RNAnimated.timing(opacity, {
          toValue: 0.45,
          duration: 200,
          useNativeDriver: true,
        }),
        RNAnimated.delay(400),
        RNAnimated.timing(opacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [message]);

  if (!displayedMessage) return null;

  return (
    <RNAnimated.View style={{ alignSelf: 'flex-end', opacity, maxWidth: '100%', alignItems: 'flex-end' }}>
      <View style={styles.bubbleSent}>
        <Text style={styles.bubbleTextSent}>{displayedMessage.text}</Text>
      </View>
      {isRead && (
        <Text style={{ fontSize: 12, color: '#604a3e', marginRight: 12, marginBottom: 4, fontStyle: 'italic', opacity: 0.9 }}>
          {i18n.t('message_read')}
        </Text>
      )}
    </RNAnimated.View>
  );
};

// Composant pour gérer l'animation de disparition des messages reçus (quand A envoie un message)
const ReceivedMessageFade = ({ message, shouldFadeOut, onFadeComplete }: { 
  message: { id: string; text: string }; 
  shouldFadeOut: boolean;
  onFadeComplete: () => void;
}) => {
  const opacity = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    if (shouldFadeOut) {
      RNAnimated.sequence([
        RNAnimated.delay(500),
        RNAnimated.timing(opacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        })
      ]).start(() => {
        onFadeComplete();
      });
    } else {
      opacity.setValue(1);
    }
  }, [shouldFadeOut]);

  return (
    <RNAnimated.View style={{ alignSelf: 'flex-start', opacity, maxWidth: '100%' }}>
      <View style={styles.bubbleReceived}>
        <Text style={styles.bubbleTextReceived}>{message.text}</Text>
      </View>
    </RNAnimated.View>
  );
};
 
const isHuaweiDevice =
  Platform.OS === 'android' &&
  /huawei/i.test(
    ((Platform as any).constants?.Brand as string) ||
      ((Platform as any).constants?.Manufacturer as string) ||
      ''
  );
const isSamsungDevice =
  Platform.OS === 'android' &&
  /samsung/i.test(
    ((Platform as any).constants?.Brand as string) ||
      ((Platform as any).constants?.Manufacturer as string) ||
      ''
  );
const isPixelDevice =
  Platform.OS === 'android' &&
  /google|pixel/i.test(
    ((Platform as any).constants?.Brand as string) ||
      ((Platform as any).constants?.Manufacturer as string) ||
      ((Platform as any).constants?.Model as string) ||
      ''
  );
const huaweiModel =
  ((Platform as any).constants?.Model as string) ||
  ((Platform as any).constants?.model as string) ||
  '';
// Détection des vieux Android (Huawei P9, Android 8 et moins)
const isOldAndroid = Platform.OS === 'android' && Platform.Version < 29;
const isProblemAndroidDevice =
Platform.OS === 'android' && (isSamsungDevice || isHuaweiDevice || isOldAndroid);

// Props de sécurité standard pour la recherche
const oldAndroidInputProps = {
  autoCorrect: false,
  autoCapitalize: 'none' as const,
  autoComplete: 'off' as const,
  keyboardType: 'default' as const,
  textContentType: 'none' as const,
  importantForAutofill: 'no' as const,
};

export function FriendsList({ 
  onProutSent, 
  isZenMode, 
  isSilentMode, 
  headerComponent,
  isSearchVisible = false,
  onSearchChange,
  searchQuery = '',
  onSearchQueryChange,
  listIntroTrigger = 0
}: { 
  onProutSent?: () => void; 
  isZenMode?: boolean; 
  isSilentMode?: boolean; 
  headerComponent?: React.ReactElement;
  isSearchVisible?: boolean;
  onSearchChange?: (visible: boolean) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  listIntroTrigger?: number;
} = {}) {
  const [appUsers, setAppUsers] = useState<any[]>([]);
  const appUsersRef = useRef<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [identityRequests, setIdentityRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); // Commencer à true pour éviter le flash
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPseudo, setCurrentPseudo] = useState<string>("Un ami");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pendingMessages, setPendingMessages] = useState<any[]>([]);
  const [lastSentMessages, setLastSentMessages] = useState<LastSentMap>({});
  const [showSilentWarning, setShowSilentWarning] = useState(false);
  const [dismissedSilentWarning, setDismissedSilentWarning] = useState(dismissedSilentWarningSession); // reste à true pour toute la session après clic OK
  const [expandedFriendId, setExpandedFriendId] = useState<string | null>(null);
  const expandedFriendIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    expandedFriendIdRef.current = expandedFriendId;
  }, [expandedFriendId]);
  const [keyboardVisible, setKeyboardVisible] = useState(false); // État local pour le clavier
  // const [keyboardHeight, setKeyboardHeight] = useState(0); // ❌ Supprimé : géré par Reanimated
  const [isModalContentVisible, setIsModalContentVisible] = useState(false);
  const [modalContentHeight, setModalContentHeight] = useState(0);
  const [inputLayout, setInputLayout] = useState<{ y: number; height: number } | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0); // Hauteur du header pour ajuster la liste
  const keyboardVisibleRef = useRef(false);
  const lastFocusAttemptRef = useRef<{ friendId: string | null; at: number }>({ friendId: null, at: 0 });
  const lastStickyOpenAtRef = useRef<number | null>(null);
  const refocusOnHideAttemptedRef = useRef(false);
  const refocusOnBlurAttemptedRef = useRef(false);
  const lastSearchOpenAtRef = useRef<number | null>(null);
  const refocusSearchOnBlurAttemptedRef = useRef(false);
  const isClosingModalRef = useRef(false);
  
  // 👇 AJOUT : Gestion Reanimated du clavier pour Android via react-native-keyboard-controller
  const keyboardHeightSV = useSharedValue(0);
  useKeyboardHandler({
    onMove: (e: { height: number }) => {
      'worklet';
      keyboardHeightSV.value = e.height;
    },
    onInteractive: (e: { height: number }) => {
      'worklet';
      keyboardHeightSV.value = e.height;
    },
    onEnd: (e: { height: number }) => {
      'worklet';
      keyboardHeightSV.value = e.height; // Peut être 0 si fermé, ou la hauteur finale
    },
  });

  // Style animé pour le padding Android (Fluide & Précis)
  const androidChatStyle = useAnimatedStyle(() => {
    if (Platform.OS !== 'android') return {};
    return {
      paddingBottom: keyboardHeightSV.value > 0 ? keyboardHeightSV.value + 10 : 10,
    };
  });

  const closingCooldownUntilRef = useRef<number | null>(null);
  const openedFromSearchRef = useRef(false); // Track si le chat a été ouvert depuis la recherche
  const [expandedUnreadId, setExpandedUnreadId] = useState<string | null>(null);
  const [unreadCache, setUnreadCache] = useState<Record<string, { id: string; message_content: string; created_at?: string }[]>>({});
  const [fadingOutReceivedMessages, setFadingOutReceivedMessages] = useState<Set<string>>(new Set());
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [sendingFriendId, setSendingFriendId] = useState<string | null>(null);
  const [identityModalVisible, setIdentityModalVisible] = useState(false);
  const [identityModalFriend, setIdentityModalFriend] = useState<any>(null);
  const [identityModalName, setIdentityModalName] = useState<string | null>(null);
  const toastOpacity = useRef(new RNAnimated.Value(0)).current;
  const lastSentByIdRef = useRef<Record<string, string>>({});
  const pendingReadIdsRef = useRef<Set<string>>(new Set());
  const pendingReadRemovalTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const prevExpandedRef = useRef<string | null>(null);
  const stickyScrollViewRef = useRef<ScrollView>(null);
  const stickyScrollViewAnimatedRef = useRef<Animated.ScrollView>(null);

  const updateLastSentIndex = (map: LastSentMap) => {
    const index: Record<string, string> = {};
    Object.entries(map).forEach(([userId, messages]) => {
      if (Array.isArray(messages)) {
        messages.forEach(msg => {
          if (msg?.id) {
            index[msg.id] = userId;
          }
        });
      }
    });
    lastSentByIdRef.current = index;
  };

  const reconcilePendingReadIds = (input: LastSentMap) => {
    let updated = false;
    const next = { ...input };
    pendingReadIdsRef.current.forEach((id) => {
      Object.keys(next).forEach(userId => {
        const messages = next[userId];
        if (Array.isArray(messages)) {
          const msgIndex = messages.findIndex(msg => msg.id === id);
          if (msgIndex !== -1) {
            next[userId] = messages.map((msg, idx) => 
              idx === msgIndex ? { ...msg, status: 'read' as const } : msg
            );
            pendingReadIdsRef.current.delete(id);
            updated = true;
          }
        }
      });
    });
    return { next, updated };
  };

  
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
        
        if (SoundSettingsModule && typeof SoundSettingsModule.openSoundSettings === 'function') {
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
  const broadcastSubscriptionRef = useRef<any>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cacheLoadedRef = useRef(false); // Pour éviter de charger le cache plusieurs fois
  const contactsSyncedRef = useRef(false); // Pour éviter de synchroniser les contacts plusieurs fois
  const phoneFriendIdsRef = useRef<string[]>([]);
  const lastSentSetAtRef = useRef<number>(0); // timestamp du dernier setLastSentMessages local (pour éviter un clear trop tôt)
  const lastPressTime = useRef(0); // Debounce pour les clics sur les amis
  const pendingCenterScrollFriendIdRef = useRef<string | null>(null);
  
  // Polling simple (sans backoff exponentiel)
  const flatListRef = useRef<FlatList>(null);
  const rowRefs = useRef<Record<string, SwipeableFriendRowHandle | null>>({});
  const textInputRefs = useRef<Record<string, TextInput | null>>({});
  const searchInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    appUsersRef.current = appUsers;
  }, [appUsers]);

  // Focus automatique du TextInput quand le champ de message s'ouvre (iOS uniquement)
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (expandedFriendId && textInputRefs.current[expandedFriendId]) {
      // Petit délai pour laisser le layout se stabiliser avant de focus
      const timer = setTimeout(() => {
        textInputRefs.current[expandedFriendId]?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [expandedFriendId]);

  // PRRT! Protocol : à l'entrée du chat, marquer comme lu tous les messages reçus non-lus de cet ami
  useEffect(() => {
    if (!expandedFriendId || !currentUserId) return;
    const unreadFromFriend = pendingMessages.filter(
      m => m.from_user_id === expandedFriendId && !m.message_content?.startsWith('READ:')
    );
    if (unreadFromFriend.length > 0) {
      unreadFromFriend.forEach(m => deletedMessagesCache.add(m.id));
      setUnreadCache(prev => {
        const currentCache = prev[expandedFriendId] || [];
        const newMsgs = unreadFromFriend.filter(u => !currentCache.some(c => c.id === u.id));
        if (newMsgs.length === 0) return prev;
        return { ...prev, [expandedFriendId]: [...currentCache, ...newMsgs] };
      });
      unreadFromFriend.forEach(msg => markMessageReadViaBackend(msg.id, msg.from_user_id));
    }
  }, [expandedFriendId, currentUserId, pendingMessages]);

  // Marquer comme lu automatiquement les nouveaux messages qui arrivent pendant que le sticky est ouvert
  useEffect(() => {
    let timer: any;
    if (expandedFriendId && AppState.currentState === 'active') {
      const unreadForActive = pendingMessages.filter(m => m.from_user_id === expandedFriendId && !m.message_content?.startsWith('READ:'));
      if (unreadForActive.length > 0) {
        setUnreadCache(prev => {
          const currentCache = prev[expandedFriendId] || [];
          const newMsgs = unreadForActive.filter(u => !currentCache.some(c => c.id === u.id));
          if (newMsgs.length === 0) return prev;
          return { ...prev, [expandedFriendId]: [...currentCache, ...newMsgs] };
        });
        timer = setTimeout(() => {
          unreadForActive.forEach(msg => markMessageAsRead(msg.id));
        }, 1500);
      }
    }
    return () => clearTimeout(timer);
  }, [pendingMessages, expandedFriendId]);

  // PRRT! Protocol : au démontage du chat (fermeture ou changement d'ami), nettoyer l'état local des messages lus et envoyés
  useEffect(() => {
    if (prevExpandedRef.current && !expandedFriendId) {
      const prevId = prevExpandedRef.current;
      const cachedForPrev = unreadCache[prevId] || [];
      setUnreadCache(prev => ({ ...prev, [prevId]: [] }));
      if (cachedForPrev.length > 0) {
        setFadingOutReceivedMessages(prev => {
          const newSet = new Set(prev);
          cachedForPrev.forEach(msg => newSet.delete(msg.id));
          return newSet;
        });
      }
      // Retirer de l'affichage les messages reçus déjà marqués READ: (lu puis supprimés côté backend)
      setPendingMessages(prev => prev.filter(m => !m.message_content?.startsWith('READ:')));

      // Nettoyer les messages envoyés marqués comme 'read' pour cet ami
      setLastSentMessages(prev => {
        const msgs = prev[prevId];
        if (Array.isArray(msgs)) {
          const kept = msgs.filter(msg => msg.status !== 'read');
          if (kept.length !== msgs.length) {
             const next = { ...prev, [prevId]: kept };
             updateLastSentIndex(next);
             saveLastSentMessagesCache(next);
             return next;
          }
        }
        return prev;
      });
    }
    prevExpandedRef.current = expandedFriendId;
  }, [expandedFriendId, unreadCache]);


  // Animation "Lu" immédiate côté A dès que B lit (pas besoin d'ouvrir le sticky)

  // Si un broadcast arrive avant que le message soit en cache, on réconcilie dès que possible
  useEffect(() => {
    if (pendingReadIdsRef.current.size === 0) return;
    setLastSentMessages(prev => {
      const { next, updated } = reconcilePendingReadIds(prev);
      if (updated) {
        updateLastSentIndex(next);
        saveLastSentMessagesCache(next);
        return next;
      }
      return prev;
    });
  }, [lastSentMessages]);

  // Écouter l'événement global de rafraîchissement (déclenché par la réception d'une notif push)
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('REFRESH_DATA', () => {
      loadData(false, false, false);
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // Messages éphémères (pending_messages) — tri chronologique pour affichage type WhatsApp (plus ancien en haut, plus récent en bas)
  const fetchPendingMessages = async (userId: string) => {
    const { data, error } = await supabase
      .from('pending_messages')
      .select('id, from_user_id, sender_pseudo, message_content, created_at')
      .eq('to_user_id', userId)
      .order('created_at', { ascending: true });
    if (error) {
      return;
    }
    
    // Filtrer les messages qui sont dans la liste noire locale (supprimés mais pas encore sync)
    const validMessages = (data || []).filter(m => !deletedMessagesCache.has(m.id));
    setPendingMessages(validMessages);

    // Mise à jour optimiste locale pour remonter les expéditeurs (messages reçus)
    if (validMessages.length > 0) {
      const now = new Date().toISOString();
      const uniqueSenderIds = [...new Set(validMessages.map(m => m.from_user_id))];
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
      if (__DEV__) {
        const msg = pendingMessages.find(m => m.id === messageId);
      }
      // 1. Ajouter à la liste noire locale pour empêcher la réapparition immédiate via polling
      deletedMessagesCache.add(messageId);

      // Trouver l'expéditeur pour l'info
      const msg = pendingMessages.find(m => m.id === messageId);
      const senderId = msg?.from_user_id;
      
      // Garantir que le message reste visible dans le sticky tant qu'il est ouvert
      if (msg?.from_user_id) {
        setUnreadCache(prev => {
          const current = prev[msg.from_user_id] || [];
          const already = current.some(m => m.id === msg.id);
          if (already) return prev;
          return {
            ...prev,
            [msg.from_user_id]: [
              ...current,
              { id: msg.id, message_content: msg.message_content, created_at: msg.created_at },
            ],
          };
        });
      }

      // Optimiste : on retire de la liste locale tout de suite
      setPendingMessages(prev => prev.filter(m => m.id !== messageId));

      // 2. Envoyer le signal Broadcast directement au client A (Sender) pour l'instantanéité
      if (senderId) {
        // On utilise un channel éphémère pour envoyer le signal
        const channel = supabase.channel(`room-${senderId}`);
        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            // Rafale de 3 envois pour assurer la réception
            for (let i = 0; i < 3; i++) {
            await channel.send({
              type: 'broadcast',
              event: 'message-read',
              payload: { id: messageId, senderId, receiverId: currentUserId }
            });
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            // Nettoyage après un délai suffisant
            setTimeout(() => supabase.removeChannel(channel), 5000);
          }
        });
      }

      // On demande au BACKEND de faire le travail (Delete DB + Broadcast signal de secours)
      // C'est beaucoup plus fiable car le backend a tous les droits
      if (senderId) {
        await markMessageReadViaBackend(messageId, senderId);
      } else {
        // Fallback si on a perdu l'info sender (rare)
        await supabase.from('pending_messages').delete().eq('id', messageId);
      }
      if (__DEV__) {
      }
    } catch (e) {
      console.warn('Erreur markMessageAsRead:', e);
    }
  };

  // Messages envoyés par moi et non lus (persistance du dernier message)
  const fetchSentPendingMessages = async (userId: string) => {
    const { data, error } = await supabase
      .from('pending_messages')
      .select('id, to_user_id, message_content, created_at')
      .eq('from_user_id', userId);
    if (error) {
      return null;
    }
    return data || [];
  };

  const pickLatestTimestamp = (a?: string | null, b?: string | null) => {
    if (!a) return b || null;
    if (!b) return a;
    const timeA = new Date(a).getTime();
    const timeB = new Date(b).getTime();
    if (!Number.isFinite(timeA) && !Number.isFinite(timeB)) return a;
    if (!Number.isFinite(timeA)) return b;
    if (!Number.isFinite(timeB)) return a;
    return timeA >= timeB ? a : b;
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
          // Charger le cache des amis et des requêtes en parallèle pour aller plus vite
          const [cachedFriends, cachedRequests] = await Promise.all([
            loadCacheSafely(CACHE_KEY_FRIENDS),
            loadCacheSafely(CACHE_KEY_PENDING_REQUESTS)
          ]);
          
          // Afficher immédiatement le cache s'il existe, même si certains tokens manquent
          const cacheHasEntries = cachedFriends && cachedFriends.length > 0;
          
          if (cacheHasEntries) {
            // Appliquer le tri sur le cache (basé sur last_interaction_at depuis Supabase)
            const sortedCache = sortFriends(cachedFriends);
            setAppUsers(sortedCache);
            setLoading(false); // Cache trouvé, pas de spinner : AFFICHAGE INSTANTANÉ
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
      
      // Polling modéré pour garantir la réception même si le Realtime échoue
      // Intervalle plus long pour réduire les logs en boucle
      pollingIntervalRef.current = setInterval(() => {
        loadData(false, false, false); 
      }, 5000) as unknown as NodeJS.Timeout; // 5 secondes (réduit de 2s pour moins de logs)
    };
    
    initialize();

    return () => {
      // Nettoyer la subscription Realtime
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      if (broadcastSubscriptionRef.current) {
        supabase.removeChannel(broadcastSubscriptionRef.current);
        broadcastSubscriptionRef.current = null;
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
    // Purge one-shot du cache local des messages envoyés (debug)
    try {
      const purgeFlag = await AsyncStorage.getItem('cache:last_sent_messages_purged_once_v2');
      if (!purgeFlag) {
        await AsyncStorage.removeItem(CACHE_KEY_LAST_SENT_MESSAGES);
        await AsyncStorage.setItem('cache:last_sent_messages_purged_once_v2', '1');
        if (__DEV__) {
        }
      }
    } catch {
      // ignorer
    }
    const cached = await loadLastSentMessagesCache();
    // Filtrer les messages lus lors du chargement du cache
    const filtered: LastSentMap = {};
    let removedCount = 0;
    let totalCount = 0;
    Object.entries(cached).forEach(([userId, messages]) => {
      if (Array.isArray(messages)) {
        totalCount += messages.length;
        const unreadMessages = messages.filter(msg => {
          const keep = msg.status !== 'read' && isFreshSentMessage(msg);
          if (!keep) removedCount += 1;
          return keep;
        });
        if (unreadMessages.length > 0) {
          filtered[userId] = unreadMessages;
        }
      } else if (
        messages &&
        typeof messages === 'object' &&
        (messages as any).status !== 'read' &&
        isFreshSentMessage(messages as LastSentMessage)
      ) {
        // Format ancien (un seul message) - migration
        filtered[userId] = [messages as LastSentMessage];
      } else if (messages) {
        totalCount += 1;
        removedCount += 1;
      }
    });
    updateLastSentIndex(filtered);
    setLastSentMessages(filtered);
    // Sauvegarder le cache nettoyé
    if (JSON.stringify(filtered) !== JSON.stringify(cached)) {
      saveLastSentMessagesCache(filtered);
    }
    if (__DEV__) {
      // Log removed
    }
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

  // Mémoire pour le dernier toast hors connexion (anti-spam)
  const lastOfflineToastTimeRef = useRef<number>(0);

  const showOfflineToast = () => {
    const now = Date.now();
    // Anti-spam de 30 secondes
    if (now - lastOfflineToastTimeRef.current > 30000) {
      showToast(i18n.t('connection_error_title'), i18n.t('check_connection_body'));
      lastOfflineToastTimeRef.current = now;
    }
  };

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
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      // Gestion explicite de l'erreur réseau pour getUser
      if (userError) {
        console.warn('⚠️ Erreur getUser:', userError);
        // Si c'est une erreur réseau ou si on n'a pas d'utilisateur
        if (userError.message?.includes('Network') || userError.message?.includes('fetch') || !user) {
          showOfflineToast();
          setLoading(false);
          return;
        }
      }

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
          const { data: finalFriends, error: profilesError } = await supabase
            .from('user_profiles')
            .select('id, pseudo, phone, expo_push_token, push_platform, is_zen_mode, avatar_url')
            .in('id', allFriendIds)
            .not('expo_push_token', 'is', null)
            .neq('expo_push_token', '');
          
          // En cas d'erreur réseau sur user_profiles, ne pas toucher à la liste (garder en mémoire)
          if (profilesError) {
            if (__DEV__) console.warn('⚠️ Erreur chargement profils amis (liste conservée):', profilesError.message);
          } else {
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

          const currentUsers = appUsersRef.current || [];
          const currentLastInteractionMap = new Map(
            currentUsers.map((u: any) => [u.id, u.last_interaction_at])
          );

          const friendsList = (finalFriends || []).map(friend => {
            // Si cet ami m'a mis en sourdine, je dois le voir en mode veille
            const isMutedByMe = mutedMap[friend.id] || false;
            const hasMutedMe = mutedByMap[friend.id] || false;
            const serverLastInteraction = lastInteractionMap[friend.id] || null;
            const localLastInteraction = currentLastInteractionMap.get(friend.id) || null;
            const lastInteractionAt = pickLatestTimestamp(
              localLastInteraction,
              serverLastInteraction
            );
            
            return {
              ...friend,
              isPhoneContact: phoneFriendsIds.includes(friend.id),
              identityAlias: identityAliasMap[friend.id]?.alias || null,
              identityStatus: identityAliasMap[friend.id]?.status || null,
              // Si l'ami m'a mis en sourdine, je le vois en mode veille
              isZenMode: friend.is_zen_mode || hasMutedMe,
              is_muted: isMutedByMe,
              // Ajouter last_interaction_at directement sur l'objet friend pour le tri
              last_interaction_at: lastInteractionAt,
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
          // Ne jamais remplacer une liste déjà affichée par une liste vide en cas de réponse vide
          // (réseau flageolant, timeout, etc.) : on garde la liste en mémoire.
          const shouldUpdate = sortedList.length > 0 || (appUsersRef.current?.length ?? 0) === 0;
          if (shouldUpdate) {
            setAppUsers(sortedList);
            await saveCacheSafely(CACHE_KEY_FRIENDS, sortedList);
          }
          }
      } else {
          // allFriendIds.length === 0 : soit l'utilisateur n'a vraiment aucun ami, soit erreur réseau.
          // On ne vide la liste que si les requêtes ont réussi (pas d'erreur). En cas de perte de connexion,
          // on garde la liste en mémoire affichée ; elle sera mise à jour à la prochaine connexion.
          const hasNetworkError = addedFriendsResult.error != null || friendsWhereIAmFriendResult.error != null;
          if (!hasNetworkError) {
            setAppUsers([]);
            await saveCacheSafely(CACHE_KEY_FRIENDS, []);
          }
      }

      await Promise.all([pendingMessagesPromise, requestsAndIdentityPromise]);
      const sentPendingMessagesResult = await sentPendingMessagesPromise;
      
          // Si null, c'est une erreur, on ne touche pas au cache local pour éviter les disparitions fantômes
          if (sentPendingMessagesResult !== null) {
            setLastSentMessages((prev) => {
              // 1. Convertir le résultat serveur en map (tableau de messages par utilisateur)
              // IMPORTANT : On ignore les messages avec "READ:" car ils sont en cours de suppression
              // et ne doivent pas être affichés (ils sont déjà lus par B)
              const serverMap: LastSentMap = {};
              let droppedStaleServer = 0;
              if (sentPendingMessagesResult.length > 0) {
                 sentPendingMessagesResult.forEach((m: any) => {
                    const rawText = m.message_content || '';
                    const isRead = rawText.startsWith('READ:');

                    // Ne pas ajouter les messages lus (avec "READ:") car ils sont en cours de suppression
                    if (isRead) return;
                    
                    const text = rawText;
                    const message: LastSentMessage = { text, ts: m.created_at, id: m.id, status: undefined };
                    // Purger les vieux messages côté serveur aussi
                    if (!isFreshSentMessage(message)) {
                      droppedStaleServer += 1;
                      return;
                    }
                    
                    // Ajouter le message au tableau pour cet utilisateur
                    if (!serverMap[m.to_user_id]) {
                      serverMap[m.to_user_id] = [];
                    }
                    serverMap[m.to_user_id].push(message);
                 });
              }
              if (__DEV__ && droppedStaleServer > 0) {
                // Log removed
              }
              // Logs uniquement si changement ou cas spécial (évite les logs en boucle)
              const serverTotal = Object.values(serverMap).reduce(
                (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
                0
              );
              const prevTotal = Object.values(prev).reduce(
                (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
                0
              );
              // Ne logger que si changement attendu ou cas spécial
              const shouldLog = prevTotal !== serverTotal || prevTotal > 0;
              if (__DEV__ && shouldLog) {
              }

              // 2. Fusionner avec le cache local pour préserver les messages 'read' (animation)
              const next: LastSentMap = { ...serverMap };
              
              Object.entries(prev).forEach(([uid, prevMessages]) => {
                if (!Array.isArray(prevMessages)) return; // Skip si format ancien
                
                const serverMessages = serverMap[uid] || [];
                const serverMessageIds = new Set(serverMessages.map(m => m.id).filter(Boolean));
                
                // Cas 1: Messages lus localement (pour jouer l'animation sur une fenêtre courte)
                const now = Date.now();
                const readMessages = prevMessages.filter(msg => {
                  if (msg.status !== 'read') return false;
                  
                  // Si le chat est ouvert avec cet ami, on garde TOUS les messages lus tant qu'il est ouvert
                  if (expandedFriendIdRef.current === uid) {
                    if (__DEV__) console.log('[CHAT_DEBUG] keeping read message (chat open):', msg.id, msg.text);
                    return true;
                  }

                  if (!msg.readAt) return false;
                  return now - msg.readAt < READ_ANIMATION_MS;
                });
                
                // ... (suite)

                // Cas 2: Messages 'sent' localement mais absents du serveur (temporaires, non lus ou lus récemment)
                // Si un message a un ID mais n'est plus dans le serveur, il a été lu/supprimé.
                
                const unreadMessages = prevMessages.filter(msg => msg.status !== 'read');
                
                const droppedWithIdMessages = unreadMessages.filter(
                  msg => msg.id && !serverMessageIds.has(msg.id)
                );

                if (droppedWithIdMessages.length > 0 && __DEV__) {
                    console.log('[CHAT_DEBUG] dropped messages from server:', droppedWithIdMessages.map(m => m.id));
                    console.log('[CHAT_DEBUG] chat open with:', expandedFriendIdRef.current, 'target:', uid);
                }

                // Si le chat est ouvert, on considère les messages disparus comme LUS et on les garde
                if (expandedFriendIdRef.current === uid) {
                   droppedWithIdMessages.forEach(msg => {
                     // On le transforme en message lu pour le garder affiché
                     console.log('[CHAT_DEBUG] converting dropped message to read (chat open):', msg.id);
                     const readMsg = { ...msg, status: 'read' as const, readAt: Date.now() };
                     readMessages.push(readMsg);
                   });
                } else if (droppedWithIdMessages.length > 0) {
                    console.log('[CHAT_DEBUG] deleting dropped messages (chat closed)');
                }
                
                const staleLocal = unreadMessages.filter(
                  msg => !msg.id && !isFreshSentMessage(msg)
                ).length;
                const localOnlyMessages = unreadMessages.filter(
                  msg => !msg.id && isFreshSentMessage(msg)
                );
                if (__DEV__ && staleLocal > 0) {
                  // Log removed
                }
                if (__DEV__ && droppedWithId > 0) {
                  // Log removed
                }

                const dedupedLocalOnlyMessages = localOnlyMessages.filter(localMsg => {
                  const localTime = new Date(localMsg.ts).getTime();
                  const isDuplicate = filteredServerMessages.some(serverMsg => {
                    const serverTime = new Date(serverMsg.ts).getTime();
                    return (
                      serverMsg.text === localMsg.text &&
                      Math.abs(serverTime - localTime) < 5000
                    );
                  });
                  if (__DEV__ && isDuplicate) {
                    // Log removed
                  }
                  return !isDuplicate;
                });
                
                // Fusionner : messages du serveur + messages locaux uniquement (temporaires, non lus)
                const merged = [...filteredServerMessages, ...readMessages];
                
                // Ajouter les messages locaux uniquement (temporaires, non lus)
                dedupedLocalOnlyMessages.forEach(localMsg => {
                  const now = Date.now();
                  const msgTime = new Date(localMsg.ts).getTime();
                  const age = now - msgTime;
                  if (age < 86400000) { // 24 heures
                    merged.push(localMsg);
                  }
                });
                
                // Trier par timestamp
                if (merged.length > 0) {
                  merged.sort((a, b) => {
                    const timeA = new Date(a.ts).getTime();
                    const timeB = new Date(b.ts).getTime();
                    return timeA - timeB;
                  });
                  next[uid] = merged;
                } else if (serverMessages.length === 0 && dedupedLocalOnlyMessages.length === 0) {
                  // Si aucun message, on supprime la clé
                  delete next[uid];
                }
              });

              // Réconcilier avec les broadcast reçus en avance
              const { next: reconciled, updated } = reconcilePendingReadIds(next);
              const finalNext = updated ? reconciled : next;
              const finalTotal = Object.values(finalNext).reduce(
                (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
                0
              );
              // Ne logger que si changement ou cas spécial (évite les logs en boucle)
              if (__DEV__ && (shouldLog || prevTotal !== finalTotal || updated)) {
              }

              // Sauvegarder dans le cache
              updateLastSentIndex(finalNext);
              saveLastSentMessagesCache(finalNext);
              return finalNext;
            });
          }
          if (__DEV__ && sentPendingMessagesResult === null) {
          }
    } catch (e) {
      // En cas d'erreur réseau, avertir l'utilisateur (avec anti-spam)
      console.warn('⚠️ Erreur loadData:', e);
      showOfflineToast();
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
              const newMessage = payload.new as any;
              
              // Vérifier si ce message n'est pas dans la liste noire (au cas où on reçoit un INSERT tardif)
              if (deletedMessagesCache.has(newMessage.id)) {
                  return;
              }

              const senderId = newMessage.from_user_id;
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
            if (payload.eventType === 'INSERT') {
              const toUserId = (payload.new as any)?.to_user_id;
              const text = (payload.new as any)?.message_content;
              const ts = (payload.new as any)?.created_at || new Date().toISOString();
              const id = (payload.new as any)?.id;
              
              if (toUserId && text) {
                setLastSentMessages((prev) => {
                  const existingMessages = prev[toUserId] || [];
                  const newMessage: LastSentMessage = { text, ts, id };
                  // Vérifier si le message n'existe pas déjà
                  const exists = existingMessages.some(m => m.id === id);
                  if (exists) return prev;
                  
                  const next = { 
                    ...prev, 
                    [toUserId]: [...existingMessages, newMessage] 
                  };
                  lastSentSetAtRef.current = Date.now();
                  updateLastSentIndex(next);
                  saveLastSentMessagesCache(next);
                  return next;
                });
              }
            } else if (payload.eventType === 'UPDATE') {
              // Gestion du Hack "READ:" pour la confirmation de lecture persistante
              const toUserId = (payload.new as any)?.to_user_id;
              const text = (payload.new as any)?.message_content;
              const id = (payload.new as any)?.id;

              if (text && text.startsWith('READ:')) {
                 setLastSentMessages((prev) => {
                    const copy: LastSentMap = {};
                    let updated = false;
                    
                    Object.entries(prev).forEach(([userId, messages]) => {
                      if (Array.isArray(messages)) {
                        const isChatOpen = expandedFriendIdRef.current === userId;
                        
                        if (!isChatOpen) {
                             const kept = messages.filter(msg => msg.id !== id);
                             if (kept.length !== messages.length) {
                               updated = true;
                               if (kept.length > 0) copy[userId] = kept;
                             } else {
                               copy[userId] = messages;
                             }
                        } else {
                             copy[userId] = messages.map(msg => {
                               if (msg.id === id) {
                                 updated = true;
                                 return { ...msg, status: 'read' as const, readAt: Date.now() };
                               }
                               return msg;
                             });
                        }
                      }
                    });

                    if (updated) {
                      updateLastSentIndex(copy);
                      saveLastSentMessagesCache(copy);
                      return copy;
                    }
                    return prev;
                 });
              }
            }
          }
        )
        // Écouter TOUS les DELETE sur pending_messages
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'pending_messages',
          },
          (payload) => {
              const deletedId = (payload.old as any)?.id;
              if (deletedId) {
                setLastSentMessages((prev) => {
                  const copy: LastSentMap = {};
                  let found = false;
                  
                  Object.entries(prev).forEach(([userId, messages]) => {
                    if (Array.isArray(messages)) {
                      const messageIndex = messages.findIndex(msg => msg.id === deletedId);
                      if (messageIndex !== -1) {
                        found = true;
                        const isChatOpen = expandedFriendIdRef.current === userId;
                        
                        if (!isChatOpen) {
                            const kept = messages.filter(msg => msg.id !== deletedId);
                            if (kept.length > 0) copy[userId] = kept;
                        } else {
                            copy[userId] = messages.map((msg, idx) => 
                              idx === messageIndex ? { ...msg, status: 'read' as const, readAt: Date.now() } : msg
                            );
                        }
                        return;
                      }
                      copy[userId] = messages;
                    }
                  });
                  
                  if (found) {
                    updateLastSentIndex(copy);
                    saveLastSentMessagesCache(copy);
                    return copy;
                  }
                  return prev;
                });
                lastSentSetAtRef.current = 0;
              }
          }
        )
        .subscribe(() => {
          // Subscription active
        });

      subscriptionRef.current = channel;

      // PRRT! Protocol : à réception de message-read
      const broadcastChannel = supabase
        .channel(`room-${user.id}`)
        .on('broadcast', { event: 'message-read' }, (payload) => {
            const deletedId = payload.payload?.id;
            const receiverId = payload.payload?.receiverId;
            console.log('[CHAT_DEBUG] broadcast message-read received:', deletedId);
            if (!deletedId) return;
            setLastSentMessages((prev) => {
              let targetUserId: string | null = null;
              Object.entries(prev).forEach(([userId, messages]) => {
                if (Array.isArray(messages) && messages.some(msg => msg.id === deletedId)) {
                  targetUserId = userId;
                }
              });
              if (!targetUserId) {
                targetUserId = lastSentByIdRef.current[deletedId] || receiverId || null;
              }
              console.log('[CHAT_DEBUG] target user for read:', targetUserId, 'expanded:', expandedFriendIdRef.current);
              
              if (targetUserId) {
                const next: LastSentMap = {};
                let changed = false;
                
                const isChatOpen = expandedFriendIdRef.current === targetUserId;
                console.log('[CHAT_DEBUG] isChatOpen:', isChatOpen);

                Object.entries(prev).forEach(([userId, messages]) => {
                  if (Array.isArray(messages)) {
                      if (userId === targetUserId) {
                          if (!isChatOpen) {
                              const kept = messages.filter(msg => msg.id !== deletedId);
                              if (kept.length !== messages.length) changed = true;
                              if (kept.length > 0) next[userId] = kept;
                          } else {
                              next[userId] = messages.map(msg => 
                                  msg.id === deletedId ? { ...msg, status: 'read', readAt: Date.now() } : msg
                              );
                              changed = true;
                          }
                      } else {
                          next[userId] = messages;
                      }
                  }
                });
                if (changed) {
                  updateLastSentIndex(next);
                  saveLastSentMessagesCache(next);
                  return next;
                }
              }
              pendingReadIdsRef.current.add(deletedId);
              loadData(false, false, false);
              return prev;
            });
        })
        .on('broadcast', { event: 'message-received' }, () => {
            loadData(false, false, false);
        })
        .subscribe();
      broadcastSubscriptionRef.current = broadcastChannel;

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
    let revealedName: string | null = null;

    // Cas 1 : Le vrai nom est déjà connu (identityAlias)
    if (friend.identityAlias) {
      revealedName = friend.identityAlias;
      setIdentityModalFriend(friend);
      setIdentityModalName(revealedName);
      setIdentityModalVisible(true);
      return;
    }

    // Cas 2 : Demande déjà en cours - Afficher modal avec avatar + option de relancer
    if (friend.identityStatus === 'pending') {
      setIdentityModalFriend({ ...friend, isPending: true });
      setIdentityModalName(null);
      setIdentityModalVisible(true);
      return;
    }

    // Cas 3 : Chercher dans les contacts
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
              revealedName = matchingContact.name || matchingContact.firstName || matchingContact.lastName || friend.pseudo;
              setIdentityModalFriend(friend);
              setIdentityModalName(revealedName);
              setIdentityModalVisible(true);
              return;
            }
          }
        }
      } catch (error) {
        console.error("Erreur lors de la recherche du contact:", error);
      }
    }

    // Cas 4 : Le vrai nom n'est pas connu - Afficher modal avec demande d'identité
    setIdentityModalFriend(friend);
    setIdentityModalName(null);
    setIdentityModalVisible(true);
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

  const getVisibleUsers = () => {
    // Filtrage local basé sur searchQuery (même logique que la FlatList)
    if (!searchQuery.trim()) return appUsers;
    const query = searchQuery.toLowerCase().trim();
    const filtered = appUsers.filter(user =>
      user.pseudo && user.pseudo.toLowerCase().includes(query)
    );
    return filtered;
  };

  const scrollToActiveFriend = (friendId: string, delay = 0) => {
    // ⏸️ TEST : Réactivé pour Samsung avec react-native-keyboard-controller
    // if (isSamsungDevice) return;
    const visibleUsers = getVisibleUsers();
    const index = visibleUsers.findIndex(u => u.id === friendId);
    if (index < 0) return;

    const doScroll = () => {
      try {
        flatListRef.current?.scrollToIndex({
          index,
          viewPosition: 0.3, // Position plus haute (30% de l'écran) pour meilleure visibilité
          animated: false, // Désactiver l'animation pour éviter l'effet "ça cherche"
        });
      } catch (e) {
        // Ignorer les erreurs de layout (si l'item n'est pas encore mesuré)
      }
    };

    if (delay > 0) {
      setTimeout(doScroll, delay);
    } else {
      requestAnimationFrame(doScroll);
    }
  };

  // Scroller vers l'ami sélectionné quand le clavier s'ouvre ou quand on change d'ami
  useEffect(() => {
    if (!expandedFriendId) return;
    // On centre uniquement quand ça provient d'une sélection utilisateur (évite l'effet "ça cherche")
    if (pendingCenterScrollFriendIdRef.current !== expandedFriendId) return;
    // Si le clavier est déjà visible (ex: on change de contact avec clavier ouvert), on peut centrer tout de suite.
    if (keyboardVisible) {
      scrollToActiveFriend(expandedFriendId);
      pendingCenterScrollFriendIdRef.current = null;
      return;
    }
    // Sinon, on attend l'event clavier (voir onShow). Fallback si jamais le clavier ne s'affiche pas.
    const t = setTimeout(() => {
      if (
        pendingCenterScrollFriendIdRef.current === expandedFriendId &&
        !keyboardVisible
      ) {
        scrollToActiveFriend(expandedFriendId);
        pendingCenterScrollFriendIdRef.current = null;
      }
    }, 350);
    return () => clearTimeout(t);
  }, [expandedFriendId, keyboardVisible, appUsers, searchQuery]);

  useEffect(() => {
    const onShow = (event?: { endCoordinates?: { height?: number } }) => {
      setKeyboardVisible(true);
      keyboardVisibleRef.current = true;
      // keyboardHeight géré par react-native-keyboard-controller (keyboardHeightSV)
      if (Platform.OS === 'android') {
        setIsModalContentVisible(true);
      }
      // Si on vient juste d'ouvrir un contact, on centre après apparition clavier (viewport stabilisé)
      if (
        expandedFriendId &&
        pendingCenterScrollFriendIdRef.current === expandedFriendId
      ) {
        scrollToActiveFriend(expandedFriendId, 60);
        pendingCenterScrollFriendIdRef.current = null;
      }
    };

    const onHide = () => {
      setKeyboardVisible(false);
      keyboardVisibleRef.current = false;
      // keyboardHeight géré par react-native-keyboard-controller (keyboardHeightSV)
      // Ne pas cacher la modale ici : Samsung peut fermer le clavier brièvement
    };

    // Sur iOS keyboardWillShow est plus fluide, sur Android keyboardDidShow est plus sûr pour le layout
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    
    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [expandedFriendId, appUsers]);

  useEffect(() => {
    if (expandedFriendId) {
      lastStickyOpenAtRef.current = Date.now();
      refocusOnHideAttemptedRef.current = false;
      refocusOnBlurAttemptedRef.current = false;
    } else {
      lastStickyOpenAtRef.current = null;
    }
  }, [expandedFriendId]);

  useEffect(() => {
    if (isSearchVisible) {
      lastSearchOpenAtRef.current = Date.now();
      refocusSearchOnBlurAttemptedRef.current = false;
    } else {
      lastSearchOpenAtRef.current = null;
    }
  }, [isSearchVisible]);

  // Focus automatique pour la recherche (simple, sans délai complexe)
  // Sur Android, on désactive l'auto-focus pour éviter le cycle blur/hide
  useEffect(() => {
    if (!isSearchVisible) {
      return;
    }

    // Focus automatique sur Android et iOS
    const timer = setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [isSearchVisible]);

  // ❌ SUPPRIMÉ : L'auto-dismiss causait la fermeture du clavier sur la page dédiée /search
  // useEffect(() => {
  //   if (Platform.OS !== 'android') return;
  //   if (!isSearchVisible && !expandedFriendId) {
  //     Keyboard.dismiss();
  //   }
  // }, [isSearchVisible, expandedFriendId]);

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
        setUnreadCache((prev) => ({
          ...prev,
          [friend.id]: unreadMessages.map((m: any) => ({
            id: m.id,
            message_content: m.message_content,
            created_at: m.created_at,
          })),
        }));
        // Marquer lu avec un délai pour laisser le temps de voir
        setTimeout(() => {
          unreadMessages.forEach(msg => markMessageAsRead(msg.id));
        }, 1000);
        pendingCenterScrollFriendIdRef.current = friend.id;
        // Marquer si on vient de la recherche (pour ajuster le padding sur Google Pixel)
        openedFromSearchRef.current = !!searchQuery.trim();
        setExpandedFriendId(friend.id); // Ouvrir le champ de saisie automatiquement
        // Fermer la recherche si active
        if (searchQuery.trim()) {
          onSearchChange?.(false);
        }
        return;
      }
      
      // Messages déjà ouverts (soit dans unreadMessages, soit dans le cache)
      if (!isInputOpen) {
        // Si l'input n'est pas ouvert, ouvrir l'input en gardant les messages visibles
        pendingCenterScrollFriendIdRef.current = friend.id;
        // Marquer si on vient de la recherche (pour ajuster le padding sur Google Pixel)
        openedFromSearchRef.current = !!searchQuery.trim();
        setExpandedFriendId(friend.id);
        // Fermer la recherche si active
        if (searchQuery.trim()) {
          onSearchChange?.(false);
        }
        return;
      }
      
      // Si l'input est ouvert, fermer tout
      setExpandedFriendId(null);
      setExpandedUnreadId(null);
      Keyboard.dismiss(); // Force la fermeture du clavier
      pendingCenterScrollFriendIdRef.current = null;
      // Nettoyer le cache pour ce contact
      const cachedForFriend = unreadCache[friend.id] || [];
      setUnreadCache((prev) => {
        const newCache = { ...prev };
        delete newCache[friend.id];
        return newCache;
      });
      // Nettoyer aussi les messages en cours de disparition pour ce contact
      if (cachedForFriend.length > 0) {
        setFadingOutReceivedMessages(prev => {
          const newSet = new Set(prev);
          cachedForFriend.forEach(msg => newSet.delete(msg.id));
          return newSet;
        });
      }
      return;
    }

    const newExpandedId = expandedFriendId === friend.id ? null : friend.id;
    if (!newExpandedId) {
      Keyboard.dismiss(); // Force la fermeture du clavier si on ferme
      pendingCenterScrollFriendIdRef.current = null;
      // Si on ferme le sticky et qu'on était en recherche, on vide tout pour retrouver la liste complète
      if (searchQuery.trim()) {
        onSearchQueryChange?.('');
        onSearchChange?.(false);
      }
    } else {
      pendingCenterScrollFriendIdRef.current = friend.id;
      // Marquer si on vient de la recherche (pour ajuster le padding sur Google Pixel)
      openedFromSearchRef.current = !!searchQuery.trim();
      // Si on ouvre un sticky et qu'on était en recherche, on ferme la barre de recherche proprement
      if (searchQuery.trim()) {
        onSearchChange?.(false);
      }
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
      setSendingFriendId(recipient.id);
      // ⚡ Choisir un prout aléatoire et préparer le message tout de suite
      const randomKey = SOUND_KEYS[Math.floor(Math.random() * SOUND_KEYS.length)];
      const customMessage = (messageDrafts[recipient.id] || '').trim().slice(0, 140);

      // Feedback immédiat côté expéditeur
      const proutName = i18n.t(`prout_names.${randomKey}`) || randomKey;
      showToast(`${proutName} !`);
      if (onProutSent) {
        onProutSent();
      }

      // Jouer localement avec expo-av sans bloquer l'envoi
      if (!isSilentMode) {
        const soundFile = PROUT_SOUNDS[randomKey];
        void (async () => {
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
        })();
      }

      // TOUJOURS recharger le pseudo depuis la base pour être sûr d'avoir la valeur à jour
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
         if (userError.message?.includes('Network') || userError.message?.includes('fetch')) {
           showOfflineToast();
           cooldownMapRef.current.delete(recipient.id);
           setSendingFriendId(null);
           return;
         }
      }

      if (!user) {
        Alert.alert(i18n.t('error'), i18n.t('not_connected'));
        // Retirer le cooldown en cas d'erreur
        cooldownMapRef.current.delete(recipient.id);
        setSendingFriendId(null);
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
        setSendingFriendId(null);
        return;
      }

      const senderPseudo = senderProfile.pseudo.trim();
      if (!senderPseudo || senderPseudo === '') {
        Alert.alert(i18n.t('error'), i18n.t('pseudo_not_defined'));
        cooldownMapRef.current.delete(recipient.id);
        setSendingFriendId(null);
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
          const existingMessages = prev[recipient.id] || [];
          // Ajouter 1ms au timestamp pour garantir que le message de A apparaît après les messages de B
          const nowTime = new Date(now).getTime();
          const messageTs = new Date(nowTime + 1).toISOString();
          const newMessage: LastSentMessage = { text: customMessage, ts: messageTs };
          // Ajouter le nouveau message au tableau (accumulation)
          const next = { 
            ...prev, 
            [recipient.id]: [...existingMessages, newMessage] 
          };
          lastSentSetAtRef.current = Date.now();
          saveLastSentMessagesCache(next);
          return next;
        });
      }
      
      // Le backend met à jour last_interaction_at pour les deux relations (A→B et B→A)
      // Recharger les données depuis Supabase pour synchroniser avec le backend
      loadData(false, false, false);

      // Nettoyer le brouillon sans fermer le sticky
      setMessageDrafts(prev => ({ ...prev, [recipient.id]: '' }));
      // Si A répond, marquer les messages de B comme "en cours de disparition" pour l'animation
      // Inclure les messages du cache ET ceux qui sont encore dans pendingMessages
      const cachedMessages = unreadCache[recipient.id] || [];
      const activeMessages = pendingMessages.filter(m => m.from_user_id === recipient.id);
      const allMessagesToFade = [...cachedMessages, ...activeMessages.map(m => ({ id: m.id, message_content: m.message_content, created_at: m.created_at }))];
      // Dédupliquer par ID
      const uniqueMessagesToFade = Array.from(new Map(allMessagesToFade.map(m => [m.id, m])).values());
      
      if (uniqueMessagesToFade.length > 0) {
        setFadingOutReceivedMessages(prev => {
          const newSet = new Set(prev);
          uniqueMessagesToFade.forEach(msg => newSet.add(msg.id));
          return newSet;
        });
        // Supprimer du cache après l'animation (500ms delay + 500ms fade = 1000ms)
        setTimeout(() => {
          setUnreadCache(prev => ({ ...prev, [recipient.id]: [] }));
          setFadingOutReceivedMessages(prev => {
            const newSet = new Set(prev);
            uniqueMessagesToFade.forEach(msg => newSet.delete(msg.id));
            return newSet;
          });
        }, 1000);
      }
      // Laisser un feedback visuel court après envoi
      setTimeout(() => setSendingFriendId(null), 600);

    } catch (error: any) {
      console.error("Erreur lors de l'envoi du prout:", error?.message || error);
      setSendingFriendId(null);
      
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
      } else if (
        error?.message?.includes('Network request failed') || 
        error?.message?.includes('fetch') ||
        error?.message?.toLowerCase().includes('network')
      ) {
         showOfflineToast();
      } else {
        // Message plus détaillé selon le type d'erreur
        let errorMessage = "Impossible d'envoyer le prout.";
        if (error?.message?.includes('Backend error')) {
          const msg = (error?.message ?? '').toLowerCase();
          const isTokenError = msg.includes('token expo') || msg.includes('token fcm') || msg.includes('invalide') || msg.includes('expiré') || msg.includes('devicenotregistered') || msg.includes('erreur expo');
          errorMessage = isTokenError ? i18n.t('token_updating_retry') : i18n.t('backend_error_ios');
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

  const activeFriend = expandedFriendId ? appUsers.find(u => u.id === expandedFriendId) : null;
  const activeFriendIndex = expandedFriendId ? appUsers.findIndex(u => u.id === expandedFriendId) : -1;
  const activeBackgroundColor = activeFriendIndex !== -1 
    ? '#8fb3a5' 
    : '#d4a88a';

  useEffect(() => {
    if (!expandedFriendId) {
      setIsModalContentVisible(false);
      return;
    }
    if (Platform.OS === 'ios') {
      setIsModalContentVisible(true);
    } else {
      setIsModalContentVisible(false);
    }
  }, [expandedFriendId]);

  // Ghost input : conserver le dernier ami pour garder l'input monté
  const lastActiveFriendRef = useRef<any>(null);
  if (activeFriend) {
    lastActiveFriendRef.current = activeFriend;
  }
  const displayFriend = activeFriend || lastActiveFriendRef.current;
  const displayFriendId = displayFriend?.id ?? null;
  const displayFriendIndex = displayFriend ? appUsers.findIndex(u => u.id === displayFriend.id) : -1;
  const displayBackgroundColor = displayFriendIndex !== -1 
    ? '#8fb3a5' 
    : '#d4a88a';
  const displayDraft = displayFriend ? (messageDrafts[displayFriend.id] || '') : '';

  const handlePressHeader = () => {
    Keyboard.dismiss();
    setExpandedFriendId(null);
    if (searchQuery.trim()) {
      onSearchQueryChange?.('');
      onSearchChange?.(false);
    }
  };

  // Ref Proxy pour Samsung (Solution 1)
  const handlePressHeaderRef = useRef(handlePressHeader);
  useEffect(() => {
    handlePressHeaderRef.current = handlePressHeader;
  }); // Update à chaque render pour avoir la dernière closure

  // 👇 AJOUT : Style animé basé sur la hauteur du clavier réelle (SharedValue)
  // Cela permet de redimensionner le ScrollView même pour les Emojis
  const stickyMessagesAnimatedStyle = useAnimatedStyle(() => {
    if (Platform.OS !== 'android') return {};
    const availableHeight = keyboardHeightSV.value > 0 
      ? SCREEN_HEIGHT - keyboardHeightSV.value - 60 - 80 - 20
      : 200; 

    return {
      maxHeight: Math.max(150, Math.min(availableHeight, 400)), 
    };
  });

  // Optimisation Samsung : mémoriser le contenu interne pour éviter de recréer le TextInput
  // quand le clavier s'ouvre (changement de keyboardVisible dans le parent).
  const stickyInnerContent = useMemo(() => {
    if (!displayFriend) return null;

    // Calcul des messages
    const activeUnreadMessages = pendingMessages.filter(m => m.from_user_id === displayFriend.id);
    const cachedForFriend = unreadCache[displayFriend.id] || [];
    const mergedMap = new Map<string, any>();
    cachedForFriend.forEach(m => mergedMap.set(m.id, m));
    activeUnreadMessages.forEach(m => mergedMap.set(m.id, m));
    const activeMessagesToShow = Array.from(mergedMap.values());
    const mySentMessages = lastSentMessages[displayFriend.id] || [];

    // Fusion et tri
    const allMessages = [
        ...activeMessagesToShow.map((m, idx) => ({
            id: m.id || `received-${idx}-${m.created_at}`,
            text: m.message_content,
            ts: m.created_at,
            isMe: false,
            original: undefined
        })),
        ...(Array.isArray(mySentMessages) ? mySentMessages.map((msg, idx) => ({
            id: msg.id || `temp-sent-${displayFriend.id}-${idx}-${msg.ts || Date.now()}`,
            text: msg.text,
            ts: msg.ts,
            isMe: true,
            original: msg
        })) : [])
    ].sort((a, b) => {
        const getTs = (d: string) => {
            if (!d) return 0;
            const t = new Date(d).getTime();
            return isNaN(t) ? 0 : t;
        };
        const timeA = getTs(a.ts);
        const timeB = getTs(b.ts);
        // Si timestamps égaux : placer les messages de B (isMe=false) avant ceux de A (isMe=true)
        if (timeA === timeB) return a.isMe ? 1 : -1;
        // Si timestamp manquant : placer les messages de B avant ceux de A
        if (timeA === 0 || timeB === 0) return a.isMe ? 1 : -1;
        // Tri chronologique normal : plus récent = après
        return timeA - timeB;
    });

    return (
      <>
        <TouchableOpacity 
          style={styles.stickyHeader} 
          onPress={() => handlePressHeaderRef.current()}
          activeOpacity={0.9}
        >
           <Text style={styles.stickyPseudo}>
             {i18n.t('sticky_chat_with', { pseudo: displayFriend.pseudo })}
           </Text>
           <TouchableOpacity onPress={() => handlePressHeaderRef.current()} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
             <Ionicons name="close-circle" size={24} color="#604a3e" />
           </TouchableOpacity>
        </TouchableOpacity>

        {Platform.OS === 'android' ? (
          <Animated.ScrollView
            ref={stickyScrollViewAnimatedRef}
            style={[styles.stickyMessages, stickyMessagesAnimatedStyle]}
            onContentSizeChange={() => stickyScrollViewAnimatedRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={true}
          >
            {allMessages.map((msg) => (
              msg.isMe ? (
                <SentMessageStatus key={msg.id} message={msg.original!} />
              ) : (
                <ReceivedMessageFade
                  key={msg.id}
                  message={{ id: msg.id, text: msg.text }}
                  shouldFadeOut={fadingOutReceivedMessages.has(msg.id)}
                  onFadeComplete={() => {
                    // L'animation est terminée, le message sera supprimé par le setTimeout dans handleSendProut
                  }}
                />
              )
            ))}
          </Animated.ScrollView>
        ) : (
          <ScrollView
            ref={stickyScrollViewRef}
            style={styles.stickyMessages}
            onContentSizeChange={() => stickyScrollViewRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={true}
          >
            {allMessages.map((msg) => (
              msg.isMe ? (
                <SentMessageStatus key={msg.id} message={msg.original!} />
              ) : (
                <ReceivedMessageFade
                  key={msg.id}
                  message={{ id: msg.id, text: msg.text }}
                  shouldFadeOut={fadingOutReceivedMessages.has(msg.id)}
                  onFadeComplete={() => {
                    // L'animation est terminée, le message sera supprimé par le setTimeout dans handleSendProut
                  }}
                />
              )
            ))}
          </ScrollView>
        )}

        <View style={[styles.messageInputRow, { alignItems: 'flex-end', marginBottom: 25 }]}>
          <TextInput
            ref={(ref) => { textInputRefs.current[displayFriend.id] = ref; }}
            style={styles.messageInput}
            placeholder={i18n.t('add_message_placeholder')}
            placeholderTextColor="#777"
            value={displayDraft}
            onChangeText={(text) => setMessageDrafts(prev => ({ ...prev, [displayFriend.id]: text }))}
            maxLength={140}
            multiline
            
            // --- CORRECTION CRITIQUE HUAWEI / SAMSUNG ---
            keyboardType="default"
            {...((isSamsungDevice || isHuaweiDevice || isOldAndroid) ? {
               autoCorrect: false,
               autoComplete: 'off',
               importantForAutofill: 'no', 
               spellCheck: false,
               textContentType: 'none',
            } : {})}
            
            onFocus={() => {
              if (Platform.OS === 'android') {
                refocusOnBlurAttemptedRef.current = false;
              }
            }}
            // Plus de onBlur agressif qui ferme le clavier sur Samsung
            onLayout={() => {}}
            {...oldAndroidInputProps}
          />
          <TouchableOpacity
            onPress={() => displayDraft.trim() && handleSendProut(displayFriend)}
            style={[
              styles.messageSendButton,
              { backgroundColor: sendingFriendId === displayFriend.id ? '#a8d5ba' : displayBackgroundColor },
              !displayDraft.trim() && styles.messageSendButtonDisabled,
            ]}
            accessibilityLabel="Envoyer"
            activeOpacity={displayDraft.trim() ? 0.8 : 1}
            disabled={!displayDraft.trim()}
          >
            <Ionicons name="send" size={18} color="#604a3e" />
          </TouchableOpacity>
        </View>
      </>
    );
  }, [
    displayFriendId,
    pendingMessages,
    unreadCache,
    lastSentMessages,
    displayDraft,
    sendingFriendId,
    displayBackgroundColor,
    fadingOutReceivedMessages,
    // PAS de keyboardVisible ici !
    // PAS de handlePressHeader ici ! (on utilise la Ref)
  ]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadData(false, false, true);
    } finally {
      setIsRefreshing(false);
    }
  };

  // ✅ Supprimé : ActivityIndicator masqué lors du chargement initial
  // On affiche toujours le contenu, même en chargement
  // if (loading && appUsers.length === 0 && pendingRequests.length === 0) return <ActivityIndicator color="#007AFF" style={{margin: 20}} />;

  // Rendu différencié pour le conteneur principal
  // iOS garde KeyboardAvoidingView, Android reste en View pour éviter les blur forcés
  // (on est en mode "pan", donc pas de resize natif, mais KAV Android peut déclencher un blur)
  const Container = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const containerProps = Platform.OS === 'ios'
    ? {
        style: styles.container,
        behavior: 'padding' as const,
        keyboardVerticalOffset: 0,
      }
    : {
        style: styles.container,
      };


  const content = (
    <Container {...containerProps}>
      {/* 
        HEADER FIXE / SEARCHBAR FIXE
        Pour stabiliser le clavier sur Android, on sort la SearchBar de la FlatList.
        Elle devient un élément fixe au-dessus de la liste.
      */}
      <View style={styles.headerOverlayContainer}>
        {/* 
          STABILITÉ MAXIMALE : On garde les deux composants montés.
          On joue sur display: 'none' pour basculer.
          Cela évite le démontage/remontage de l'input qui tue le focus.
        */}
        <View style={{ display: isSearchVisible ? 'flex' : 'none', marginBottom: 10, paddingHorizontal: 0 }}>
          <SearchBar
            ref={(ref) => {
              searchInputRef.current = ref;
            }}
            searchQuery={searchQuery}
            onSearchQueryChange={(text) => {
              onSearchQueryChange?.(text);
            }}
            onSearchChange={(visible) => {
              onSearchChange?.(visible);
            }}
            oldAndroidInputProps={oldAndroidInputProps}
          />
        </View>

        <View style={{ display: !isSearchVisible ? 'flex' : 'none' }}>
          <TouchableWithoutFeedback onPress={handlePressHeader}>
            <View style={styles.headerOverlayContent}>
              {headerComponent}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={getVisibleUsers()}
        keyExtractor={(item) => item.id}
        style={styles.list}
        // Android a besoin de 'always' pour bien gérer les clics quand le clavier est là
        keyboardShouldPersistTaps={Platform.OS === 'android' ? "always" : "handled"}
        keyboardDismissMode={
          Platform.OS === 'ios'
            ? "interactive"
            : isSearchVisible && isSamsungDevice
              ? "none" // ⚠️ CRITIQUE : Empêcher la fermeture automatique pendant la recherche sur Samsung
              : "on-drag"
        }
        // ⏸️ TEST : Réactivation du scroll pour Samsung avec react-native-keyboard-controller
        scrollEnabled={
          !(isSamsungDevice && activeFriend)
          // !(isProblemAndroidDevice && isSearchVisible) // ⏸️ PAUSÉ pour test
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 300 },
        ]}
        onScrollToIndexFailed={(info) => {
          // Fallback : si l'index n'est pas mesurable immédiatement (virtualisation)
          const approxOffset = Math.max(info.averageItemLength * info.index - info.averageItemLength * 2, 0);
          flatListRef.current?.scrollToOffset({ offset: approxOffset, animated: true });
          setTimeout(() => {
            try {
              flatListRef.current?.scrollToIndex({
                index: info.index,
                viewPosition: 0.5,
                animated: true,
              });
            } catch {}
          }, 80);
        }}
        ListHeaderComponent={
          <View>
            {/* SearchBar retirée d'ici pour être stable en haut */}
            <TouchableWithoutFeedback onPress={handlePressHeader} disabled={isSearchVisible}>
              <View>
                {renderRequestsHeader()}
              </View>
            </TouchableWithoutFeedback>
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyCard}>
              {searchQuery.trim() ? (
                // Message pour recherche sans résultat
                <Text style={styles.emptyText}>Aucun ami</Text>
              ) : (
                // Message par défaut
                <>
                  <Text style={styles.emptyText}>{i18n.t('no_friends')}</Text>
                  <Text style={styles.subText}>{i18n.t('invite_contacts')}</Text>
                </>
              )}
            </View>
          )
        }
        renderItem={({ item, index }) => {
          const unreadMessages = pendingMessages.filter(m => m.from_user_id === item.id);
          const hasUnread = unreadMessages.length > 0;
          const lastUnread = unreadMessages.length > 0 ? unreadMessages[unreadMessages.length - 1] : null;
          const isUnreadExpanded = expandedUnreadId === item.id;
          const unreadListToShow = unreadMessages.length > 0 ? unreadMessages : (unreadCache[item.id] || []);
          
          const isActive = expandedFriendId === item.id;
          const baseColor = index % 2 === 0 ? '#d2f1ef' : '#baded7';
          const backgroundColor = isActive 
            ? '#8fb3a5' 
            : baseColor;

          return (
            <View style={{ position: 'relative', marginBottom: 5 }}>
              <SwipeableFriendRow
                ref={(ref) => { rowRefs.current[item.id] = ref; }}
                friend={item}
                backgroundColor={backgroundColor}
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
                introTrigger={listIntroTrigger}
              />
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

      <Modal
        isVisible={!!expandedFriendId}
        onBackdropPress={() => {
          // 1. Cacher visuellement tout de suite
          setIsModalContentVisible(false);
          // 2. Fermer le clavier
          Keyboard.dismiss();
          // 3. Fermer aussi la recherche si elle est active
          if (isSearchVisible) {
            onSearchChange?.(false);
            onSearchQueryChange?.('');
          }
          // 4. Attendre que le clavier soit parti avant de démonter la modale (Anti-Flash)
          if (isPixelDevice) {
            setTimeout(() => {
              setExpandedFriendId(null);
            }, 500);
          } else {
            setTimeout(() => {
              setExpandedFriendId(null);
            }, Platform.OS === 'android' ? 300 : 50);
          }
        }}
        onBackButtonPress={() => {
          setIsModalContentVisible(false);
          Keyboard.dismiss();
          // Fermer aussi la recherche si elle est active
          if (isSearchVisible) {
            onSearchChange?.(false);
            onSearchQueryChange?.('');
          }
          if (isPixelDevice) {
            setTimeout(() => {
              setExpandedFriendId(null);
            }, 500);
          } else {
            setTimeout(() => {
              setExpandedFriendId(null);
            }, Platform.OS === 'android' ? 300 : 50);
          }
        }}
        onModalShow={() => {
          setIsModalContentVisible(true);
          const input = displayFriendId ? textInputRefs.current[displayFriendId] : null;
          if (input) {
            setTimeout(() => {
              input.focus();
            }, Platform.OS === 'android' ? 100 : 0);
          }
        }}
        onModalHide={() => {
          // keyboardHeight géré par react-native-keyboard-controller (keyboardHeightSV)
          setIsModalContentVisible(false);
          isClosingModalRef.current = false;
          closingCooldownUntilRef.current = null;
          openedFromSearchRef.current = false; // Reset le flag
          // Fermer aussi la recherche si elle est active (au cas où elle n'a pas été fermée avant)
          if (isSearchVisible) {
            onSearchChange?.(false);
            onSearchQueryChange?.('');
          }
        }}
        style={{ margin: 0, justifyContent: 'flex-end' }}
        backdropOpacity={0.3}
        useNativeDriver
        useNativeDriverForBackdrop
        hideModalContentWhileAnimating
        animationIn="fadeIn"
        animationOut="fadeOut"
        animationInTiming={150}
        animationOutTiming={1} // Instantané à la fermeture
        backdropTransitionOutTiming={0}
        avoidKeyboard={Platform.OS === 'ios'} // iOS gère nativement, Android géré manuellement
      >
        {Platform.OS === 'android' ? (
           <Animated.View
            style={[
              {
                width: '100%',
                backgroundColor: '#ebb89b',
                borderTopLeftRadius: 15,
                borderTopRightRadius: 15,
                padding: 10,
                opacity: isModalContentVisible ? 1 : 0,
                // paddingBottom géré par androidChatStyle
              },
              androidChatStyle
            ]}
          >
            {expandedFriendId && !isClosingModalRef.current && stickyInnerContent}
          </Animated.View>
        ) : (
          <KeyboardAvoidingView
            behavior="padding"
            style={{ width: '100%' }}
          >
            <View
              style={{
                backgroundColor: '#ebb89b',
                borderTopLeftRadius: 15,
                borderTopRightRadius: 15,
                padding: 10,
                paddingBottom: 30,
                opacity: isModalContentVisible ? 1 : 0,
              }}
            >
              {expandedFriendId && !isClosingModalRef.current && stickyInnerContent}
            </View>
          </KeyboardAvoidingView>
        )}
      </Modal>

      {toastMessage && (
        <RNAnimated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </RNAnimated.View>
      )}

      {/* Modal d'identité avec avatar en grand */}
      <Modal
        isVisible={identityModalVisible}
        onBackdropPress={() => setIdentityModalVisible(false)}
        onBackButtonPress={() => setIdentityModalVisible(false)}
        style={styles.identityModal}
        backdropOpacity={0.5}
        animationIn="fadeIn"
        animationOut="fadeOut"
      >
        <View style={styles.identityModalContent}>
          {identityModalFriend && (
            <>
              {/* Avatar en grand */}
              <View style={styles.identityAvatarContainer}>
                {identityModalFriend.avatar_url ? (
                  <Image 
                    source={{ uri: identityModalFriend.avatar_url }} 
                    style={styles.identityAvatar} 
                  />
                ) : (
                  <View style={styles.identityAvatarPlaceholder}>
                    <Text style={styles.identityAvatarPlaceholderText}>
                      {identityModalFriend.pseudo ? identityModalFriend.pseudo.charAt(0).toUpperCase() : '?'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Vrai nom connu */}
              {identityModalName && (
                <View style={styles.identityNameContainer}>
                  <Text style={styles.identityNameValue}>✨ {identityModalName}</Text>
                </View>
              )}

              {/* Demande d'identité si le nom n'est pas connu */}
              {!identityModalName && (
                <View style={styles.identityRequestContainer}>
                  <Text style={styles.identityRequestTitle}>
                    {identityModalFriend.isPending 
                      ? i18n.t('already_asked_identity_title')
                      : i18n.t('ask_identity_title')}
                  </Text>
                  <Text style={styles.identityRequestBody}>
                    {identityModalFriend.isPending
                      ? i18n.t('already_asked_identity_body', { pseudo: identityModalFriend.pseudo })
                      : i18n.t('ask_identity_body', { pseudo: identityModalFriend.pseudo })}
                  </Text>
                  <View style={styles.identityRequestButtons}>
                    <TouchableOpacity
                      style={[styles.identityRequestButton, styles.identityRequestButtonCancel]}
                      onPress={() => setIdentityModalVisible(false)}
                    >
                      <Text style={styles.identityRequestButtonTextCancel}>
                        {i18n.t('cancel')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.identityRequestButton, styles.identityRequestButtonAsk]}
                      onPress={() => {
                        setIdentityModalVisible(false);
                        if (identityModalFriend.isPending) {
                          requestIdentityReveal(identityModalFriend, { force: true });
                        } else {
                          requestIdentityReveal(identityModalFriend);
                        }
                      }}
                    >
                      <Text style={styles.identityRequestButtonTextAsk}>
                        {identityModalFriend.isPending 
                          ? i18n.t('relaunch_btn')
                          : i18n.t('ask_btn')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Bouton fermer si le nom est connu */}
              {identityModalName && (
                <TouchableOpacity
                  style={styles.identityCloseButton}
                  onPress={() => setIdentityModalVisible(false)}
                >
                  <Text style={styles.identityCloseButtonText}>{i18n.t('ok') || 'OK'}</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </Modal>
    </Container>
  );

  return content;
}

const styles = StyleSheet.create({
  container: { flex: 1, marginTop: 0 },
  keyboardAvoidingView: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingBottom: 20 },
  headerOverlayContainer: {
    position: 'relative',
    zIndex: 10,
  },
  headerOverlayContent: {
    zIndex: 10,
  },
  headerHidden: {
    opacity: 0,
  },
  searchOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
  },
  searchOverlayHidden: {
    opacity: 0,
    pointerEvents: 'none',
  },
  // emptyContentPadding supprimé : évite de repousser le header vers le bas
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
  messageInput: { flex: 1, minHeight: 40, maxHeight: 80, borderWidth: 1, borderColor: '#c5d7d3', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, color: '#333', backgroundColor: '#fff', fontSize: 18 },
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
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
    backgroundColor: '#d9d9d9',
  },
  friendAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#604a3e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  friendAvatarPlaceholderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  pseudo: { fontSize: 18, fontWeight: '600', color: '#333', marginLeft: 0, flex: 1 },
  unreadInline: { flexDirection: 'row', alignItems: 'center', maxWidth: '55%', marginLeft: -60, gap: 6 },
  unreadMessage: { fontSize: 13, fontStyle: 'italic', color: '#7a5547', flexShrink: 1 },
  redDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#ebb89b' },
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
  
  // Styles pour la recherche
  searchContainerModal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginHorizontal: 15,
    marginTop: 5,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.2)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginHorizontal: 15,
    marginTop: 5,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.2)',
  },
  // Version ABSOLUE : Complètement isolée du flux, ne bouge JAMAIS
  searchContainerAbsolute: {
    position: 'absolute',
    top: 100, // Ajuste selon la hauteur réelle de ton header (logo + padding)
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginHorizontal: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.2)',
    elevation: 10, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    padding: 0,
  },
  
  stickyInputContainer: {
    backgroundColor: '#ebb89b',
    padding: 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10, // Padding safe area basique
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: 'rgba(96, 74, 62, 0.3)',
    borderRadius: 12,
  },
  stickyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(96, 74, 62, 0.1)',
    paddingBottom: 4,
    backgroundColor: 'rgba(96, 74, 62, 0.08)',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderRadius: 8,
  },
  stickyPseudo: {
    fontWeight: 'bold',
    color: '#604a3e',
    fontSize: 16,
  },
  stickyMessages: {
    marginBottom: 8,
    maxHeight: 200, // Augmenté pour plus de visibilité, scrollable si dépasse
  },
  bubbleReceived: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleSent: {
    alignSelf: 'flex-end',
    backgroundColor: '#e3f2fd', // Bleu très clair
    borderRadius: 16,
    borderTopRightRadius: 4,
    padding: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleTextReceived: {
    color: '#333',
    fontSize: 18,
  },
  bubbleTextSent: {
    color: '#333',
    fontSize: 18,
  },
  identityModal: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 0,
  },
  identityModalContent: {
    backgroundColor: '#ebb89b',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '85%',
    maxWidth: 400,
  },
  identityAvatarContainer: {
    marginBottom: 20,
  },
  identityAvatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#d9d9d9',
  },
  identityAvatarPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#604a3e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  identityAvatarPlaceholderText: {
    fontSize: 60,
    fontWeight: 'bold',
    color: '#fff',
  },
  identityNameContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  identityNameValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#604a3e',
    textAlign: 'center',
  },
  identityRequestContainer: {
    alignItems: 'center',
    width: '100%',
  },
  identityRequestTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#604a3e',
    marginBottom: 12,
    textAlign: 'center',
  },
  identityRequestBody: {
    fontSize: 16,
    color: '#604a3e',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  identityRequestButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  identityRequestButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  identityRequestButtonCancel: {
    backgroundColor: 'rgba(96, 74, 62, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.3)',
  },
  identityRequestButtonAsk: {
    backgroundColor: '#604a3e',
  },
  identityRequestButtonTextCancel: {
    color: '#604a3e',
    fontWeight: 'bold',
    fontSize: 16,
  },
  identityRequestButtonTextAsk: {
    color: '#ebb89b',
    fontWeight: 'bold',
    fontSize: 16,
  },
  identityCloseButton: {
    backgroundColor: '#604a3e',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginTop: 10,
  },
  identityCloseButtonText: {
    color: '#ebb89b',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
