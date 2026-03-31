import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
// Force git update 2
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { useAudioPlayer } from 'expo-audio'; // Supprimé
import { Audio } from 'expo-av';
import * as Contacts from 'expo-contacts';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Alert, AppState, DeviceEventEmitter, Dimensions, FlatList, Image, Keyboard, KeyboardAvoidingView, Linking, NativeModules, Platform, Animated as RNAnimated, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { Gesture, GestureDetector, TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
// 👇 AJOUT : Hook pour capturer la hauteur réelle du clavier (Texte OU Emoji)
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import Modal from 'react-native-modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { SwipeableFriendRow, SwipeableFriendRowHandle } from './FriendsListComponents/SwipeableFriendRow';
import { AnimatedCategoryHeaderImage } from './FriendsListComponents/AnimatedCategoryHeaderImage';
import { useAppStore } from '../lib/store';
import { useFriends, usePendingMessages, usePendingSentMessages } from '../hooks/useFriends';
import { useSendProut } from '../hooks/useSendProut';
import { RINGER_MODE, VolumeManager } from 'react-native-volume-manager';
import { ensureContactPermissionWithDisclosure } from '../lib/contactConsent';
import { normalizePhone } from '../lib/normalizePhone';
import {
  fetchPendingReceivedViaBackend,
  fetchPendingSentViaBackend,
  markConversationReadViaBackend,
  markMessageReadViaBackend,
  sendProutViaBackend
} from '../lib/sendProutBackend';
// Import supprimé : on utilise maintenant sync_contacts (fonction SQL Supabase)
import i18n from '../lib/i18n';
import { getDisplaySoundLabel, playSound, stopCurrentPlayback, getPickupKeys, pickRandom, pickRandomWithoutImmediateRepeat, getDefaultSoundCategoryForFirstLaunch, getSelectedSoundCategory } from '../lib/audioService';
import {
  DIRECT_SEND_FALLBACK_CATEGORY,
  LOCAL_PLAYBACK_FALLBACK_KEY,
  SOUND_ASSETS,
  SOUND_KEYS_BY_CATEGORY,
} from '../lib/runtimeSounds';
import { supabase } from '../lib/supabase';
import { safePush } from '../lib/navigation';
import { SearchBar } from './SearchBar';
import { SOUND_CATEGORY_KEY, type SoundCategory } from './SoundcheckSelector';

const FIRST_FRIENDLIST_FOOTER_MODAL_KEY = 'first_friendlist_footer_modal_seen_v1';
const FIRST_CHAT_MODAL_KEY = 'first_chat_modal_seen_v2';
const CHAT_MESSAGE_SOUND_CHOICE_KEY = 'chat_message_sound_choice_v1';
const CHAT_MESSAGE_MUTE_KEY = 'chat_message_mute_v2';
const FRIEND_SOUND_CATEGORY_MAP_KEY = 'friend_sound_category_map_v1';
const IOS_SOUNDWAVE_IMAGE = require('../assets/images/proothail.png');
const IOS_SENT_IMAGE = require('../assets/images/animprout4.png');

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const CHAT_MODAL_TOP_SAFE_MARGIN = Platform.OS === 'ios' ? 96 : 84;
const SWIPE_THRESHOLD = 150; // Seuil pour déclencher l'action
const TAP_THRESHOLD = 12; // Distance max pour considérer un tap

type ChatMessageSoundChoice = 'trll' | 'bzzz' | 'pop' | 'mood' | 'toot';
const PICKUP_TRLL_KEYS = getPickupKeys('trll');
const PICKUP_BZZZ_KEYS = getPickupKeys('bzzz');
const PICKUP_POP_KEYS = getPickupKeys('pop');
const PICKUP_MOOD_KEYS = getPickupKeys('mood');
const PICKUP_TOOT_KEYS = getPickupKeys('toot');
const MAX_PICKUP_ROWS = Math.ceil(Math.max(PICKUP_TRLL_KEYS.length, PICKUP_BZZZ_KEYS.length, PICKUP_POP_KEYS.length, PICKUP_MOOD_KEYS.length, PICKUP_TOOT_KEYS.length) / 2);
const CHAT_SPECIFIC_ROW_HEIGHT = 34;
const CHAT_SPECIFIC_BOTTOM_GAP = 30;
const CHAT_SPECIFIC_MIN_HEIGHT = MAX_PICKUP_ROWS * CHAT_SPECIFIC_ROW_HEIGHT + 50 + CHAT_SPECIFIC_BOTTOM_GAP;
const USE_NATIVE_MODAL_DRIVER = Platform.OS !== 'android';
const ANDROID_MODAL_CLOSE_TIMING = Platform.OS === 'android' ? 0 : 120;
const CHAT_MODAL_BACKDROP_OPACITY = Platform.OS === 'android' ? 0 : 0.3;
const FRIEND_SOUND_MODAL_BACKDROP_OPACITY = Platform.OS === 'android' ? 0 : 0.45;
const FRIEND_ROW_LONG_PRESS_DELAY_MS = 320;
// Uniformisation : on affiche toujours `proot.png` pour la catégorie toot/proot,
// y compris sur iOS en locale US/anglais.
const USE_PROOT_TOOT_LOGO = true;
const TOOT_LOGO_IMAGE = require('../assets/images/proot.png');
/** Miniature cliquable sous le chat pour ouvrir le sélecteur de sons */
const CHAT_PROOTHAIL_THUMB = require('../assets/images/proothail.png');
const TOOT_CHAT_ICON_SIZE = Platform.OS === 'android'
  ? { width: 82, height: 55 }
  : USE_PROOT_TOOT_LOGO
    ? { width: 84, height: 56 }
    : undefined;
// Aligné sur app/soundcheck.tsx (TOOT_HEADER_SIZE) pour le logo toot/proot
const TOOT_PICK_HEADER_SIZE = Platform.OS === 'android'
  ? { width: 108, height: 47 }
  : USE_PROOT_TOOT_LOGO
    ? { width: 104, height: 44 }
    : { width: 80, height: 32 };
const MOOD_PICK_HEADER_SIZE = Platform.OS === 'android' ? { width: 88, height: 38 } : undefined;

/**
 * Sous-titres des catégories affichés dans le modal "choose your sound",
 * avec la même logique iOS/Android et la même règle de traduction pour "toot"
 * que `app/soundcheck.tsx`.
 */
function getIOSTootSoundcheckSubtitleKey():
  | 'soundcheck_subtitle_toot'
  | 'soundcheck_subtitle_toot_android' {
  const loc = String(i18n.locale || '').toLowerCase();
  if (loc.startsWith('en')) return 'soundcheck_subtitle_toot_android';
  if (loc.startsWith('fr')) return 'soundcheck_subtitle_toot';
  if (loc.startsWith('es') || loc.startsWith('pt') || loc.startsWith('de') || loc.startsWith('it')) {
    return 'soundcheck_subtitle_toot_android';
  }
  return 'soundcheck_subtitle_toot';
}

function getChooseSoundCategorySubtitleKey(category: SoundCategory): string {
  switch (category) {
    case 'toot':
      return Platform.OS === 'android' ? 'soundcheck_subtitle_toot_android' : getIOSTootSoundcheckSubtitleKey();
    case 'mood':
      return 'soundcheck_subtitle_mood';
    case 'trll':
      return 'soundcheck_subtitle_tweet';
    case 'bzzz':
      return 'soundcheck_subtitle_buzz';
    case 'pop':
      return 'soundcheck_subtitle_pop';
  }
}
// Curseur « catégorie par défaut » dans le modal choose your sound (grille 5 icônes)
/** `false` = curseur masqué, défaut toujours proot (toot). Mettre à `true` pour réafficher le curseur. */
const SHOW_DEFAULT_SOUND_CATEGORY_CURSOR = false;
const TOOT_CURSOR_ICON_SIZE = Platform.OS === 'android'
  ? { width: 82, height: 34 }
  : USE_PROOT_TOOT_LOGO
    ? { width: 90, height: 36 }
    : { width: 72, height: 28 };
/** Mood un peu plus petit que la base pickDefaultCategoryIcon (80×30) */
const MOOD_DEFAULT_CATEGORY_CURSOR_SIZE = { width: 71, height: 26 };
const DEFAULT_SOUND_OPTIONS: Array<{ category: SoundCategory; image: any }> = Platform.OS === 'android'
  ? [
      { category: 'toot', image: TOOT_LOGO_IMAGE },
      { category: 'mood', image: require('../assets/images/mood.png') },
      { category: 'pop', image: require('../assets/images/pop.png') },
      { category: 'trll', image: require('../assets/images/tweet.png') },
      { category: 'bzzz', image: require('../assets/images/buzz.png') },
    ]
  : [
      // iOS : curseur — toot/proot · pop · mood · tweet · buzz
      { category: 'toot', image: TOOT_LOGO_IMAGE },
      { category: 'pop', image: require('../assets/images/pop.png') },
      { category: 'mood', image: require('../assets/images/mood.png') },
      { category: 'trll', image: require('../assets/images/tweet.png') },
      { category: 'bzzz', image: require('../assets/images/buzz.png') },
    ];
const DEFAULT_SOUND_OPTION_ROWS = [
  DEFAULT_SOUND_OPTIONS.slice(0, 3),
  DEFAULT_SOUND_OPTIONS.slice(3),
];

// Audio utility functions removed, now using audioService.ts and runtimeSounds.ts

// Clés de cache pour AsyncStorage
const CACHE_KEY_FRIENDS = 'cached_friends_list';
const CACHE_KEY_PENDING_REQUESTS = 'cached_pending_requests';
const CACHE_KEY_LAST_SENT_MESSAGES = 'cached_last_sent_messages';
const CACHE_KEY_DISMISSED_SILENT_WARNING = 'cached_dismissed_silent_warning';
const CACHE_KEY_BLOCKED_USERS = 'cached_blocked_users_v1';
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 heures

type LastSentMessage = { text: string; ts: string; id?: string; status?: 'read'; readAt?: number; soundKey?: string };
type LastSentMap = Record<string, LastSentMessage[]>; // Tableau de messages pour accumulation

type ParsedMessage = {
  text: string;
  isRead: boolean;
  soundKey?: string;
};

const parseMessageContent = (raw?: string | null): ParsedMessage => {
  if (!raw) return { text: '', isRead: false };
  let isRead = false;
  let text = raw;
  if (text.startsWith('READ:')) {
    isRead = true;
    text = text.slice(5);
  }
  let soundKey: string | undefined;
  if (text.startsWith('[')) {
    const endBracket = text.indexOf(']');
    if (endBracket !== -1) {
      soundKey = text.slice(1, endBracket);
      text = text.slice(endBracket + 1);
    }
  }
  return { text, isRead, soundKey };
};

const stripReadPrefix = (text?: string | null) => {
  return parseMessageContent(text).text;
};

type PendingMessage = {
  id: string;
  from_user_id: string;
  to_user_id?: string;
  sender_pseudo?: string | null;
  message_content?: string | null;
  created_at: string;
  // Marqué localement quand Supabase DELETE arrive pendant une session ouverte
  isPendingDelete?: boolean;
};

type ReportReason = 'spam' | 'harassment' | 'hate_speech' | 'explicit_content' | 'other';
type ReportableMessage = {
  senderId: string;
  sourceMessageId?: string | null;
  createdAt?: string;
};

const truncateContactPreview = (text?: string | null, maxLength: number = 15) => {
  const cleanText = stripReadPrefix(text).trim();
  if (!cleanText) return '';
  return cleanText.length > maxLength ? `${cleanText.slice(0, maxLength)}...` : cleanText;
};

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
const MARK_READ_DELAY_MS = 900; // Délai entre chaque appel markRead pour éviter 429 (rate limit backend)

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

// SwipeableFriendRow removed, now imported from ./FriendsListComponents/SwipeableFriendRow


// Composant pour gérer l'animation du message envoyé (PRRT! : opacité réduite quand lu)
const DIMMED_OPACITY_READ = 0.72; // Grisé léger pour messages envoyés et lus par l'autre (reste lisible)

const SentMessageStatus = ({ message }: { 
  message: { text: string; status?: 'read'; id?: string } | undefined;
}) => {
  const [displayedMessage, setDisplayedMessage] = useState(message);
  const opacity = useRef(new RNAnimated.Value(message?.status === 'read' ? DIMMED_OPACITY_READ : 1)).current;
  const [isRead, setIsRead] = useState(message?.status === 'read');

  useEffect(() => {
    if (message && message.status !== 'read') {
      setDisplayedMessage(message);
      setIsRead(false);
      opacity.setValue(1);
    } else if (displayedMessage && (message?.status === 'read' || !message)) {
      if (!isRead) {
          setIsRead(true);
          // PRRT! : grisé léger quand lu (reste lisible)
          RNAnimated.timing(opacity, {
            toValue: DIMMED_OPACITY_READ,
            duration: 300,
            useNativeDriver: true,
          }).start();
      }
    }
  }, [message]);

  if (!displayedMessage) return null;

  return (
    <RNAnimated.View style={{ alignSelf: 'flex-end', opacity, maxWidth: '100%', alignItems: 'flex-end' }}>
      <View style={styles.bubbleSent}>
        <Text style={styles.bubbleTextSent}>{stripReadPrefix(displayedMessage.text)}</Text>
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
const ReceivedMessageFade = ({ message, soundKey, dimmed, shouldFadeOut, onFadeComplete, onLongPressReport }: {
  message: { id: string; text: string; senderId?: string; sourceMessageId?: string | null; createdAt?: string };
  soundKey?: string;
  dimmed?: boolean;
  shouldFadeOut: boolean;
  onFadeComplete: () => void;
  onLongPressReport?: (message: ReportableMessage) => void;
}) => {
  const opacity = useRef(new RNAnimated.Value(dimmed ? 0.3 : 1)).current;
  const [isReplayActive, setIsReplayActive] = useState(false);

  useEffect(() => {
    if (shouldFadeOut) {
      RNAnimated.sequence([
        RNAnimated.delay(500),
        RNAnimated.timing(opacity, {
          // Session gelée: ne jamais disparaître complètement
          toValue: 0.3,
          duration: 500,
          useNativeDriver: true,
        })
      ]).start(() => {
        onFadeComplete();
      });
    } else {
      opacity.setValue(dimmed ? 0.3 : 1);
    }
  }, [shouldFadeOut, dimmed]);

  const handleReplay = () => {
    if (!soundKey || isReplayActive) return;
    playSound(soundKey, {
      onStart: () => setIsReplayActive(true),
      onEnd: () => setIsReplayActive(false),
    });
  };

  return (
    <RNAnimated.View style={[styles.bubbleReceivedWrapper, { opacity }]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleReplay}
        onLongPress={() => {
          if (!onLongPressReport || !message.senderId) return;
          onLongPressReport({
            senderId: message.senderId,
            sourceMessageId: message.sourceMessageId ?? null,
            createdAt: message.createdAt,
          });
        }}
      >
        <View style={[styles.bubbleReceived, isReplayActive && styles.bubbleReceivedPlaying]}>
          <Text style={styles.bubbleTextReceived}>{stripReadPrefix(message.text)}</Text>
        </View>
      </TouchableOpacity>
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
  headerComponent,
  isSearchVisible = false,
  onSearchChange,
  searchQuery = '',
  onSearchQueryChange,
  listIntroTrigger = 0,
  refreshTrigger = 0,
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
  refreshTrigger?: number;
} = {}) {
  const insets = useSafeAreaInsets();
  const { isZenMode, isSilentMode, isHapticEnabled, pseudo: storePseudo } = useAppStore();
  const queryClient = useQueryClient();
  
  const [appUsers, setAppUsers] = useState<any[]>([]);
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  
  const { data: pendingMessagesData, refetch: refetchMessages } = usePendingMessages(currentUserId);
  const { data: pendingSentData, refetch: refetchSentMessages } = usePendingSentMessages(currentUserId);
  const sendProutMutation = useSendProut(currentUserId);

  // Synchronisation des messages (qui eux fonctionnent bien via TanStack)
  useEffect(() => {
    if (pendingMessagesData) {
      setPendingMessages(prev => {
        // Conserver TOUS les messages récents (< 5s) qui ne sont pas encore dans les données du serveur
        // (qu'ils viennent d'un optimistic update FCM/Broadcast ou d'un événement Realtime INSERT)
        // car le refetch immédiat peut parfois taper sur un replica de DB pas encore à jour.
        const now = Date.now();
        const recentLocalMessages = prev.filter(m => 
          (now - new Date(m.created_at).getTime()) < 5000
        );

        const survivingRecent = recentLocalMessages.filter(localMsg => {
          // Vérifier si le serveur a déjà ce message (par ID strict, ou par contenu/date pour les optimistes)
          const hasMatch = pendingMessagesData.some(serverMsg => {
            if (serverMsg.id === localMsg.id && !localMsg.id.startsWith('notif-') && !localMsg.id.startsWith('broadcast-')) {
              return true;
            }
            return serverMsg.from_user_id === localMsg.from_user_id &&
                   (serverMsg.message_content || '') === localMsg.message_content &&
                   Math.abs(new Date(serverMsg.created_at).getTime() - new Date(localMsg.created_at).getTime()) < 15000;
          });
          return !hasMatch;
        });

        if (survivingRecent.length === 0) {
          return pendingMessagesData;
        }

        // Combiner et trier
        return [...pendingMessagesData, ...survivingRecent].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
    }
  }, [pendingMessagesData]);

  const appUsersRef = useRef<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [identityRequests, setIdentityRequests] = useState<any[]>([]);

  const [loading, setLoading] = useState(true); // Commencer à true, loadData gérera la suite
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pas de fallback ici : le tuto 1ère installation ne doit pas s'afficher si la friendlist est vide.
  const [chatMessageSoundChoice, setChatMessageSoundChoice] = useState<ChatMessageSoundChoice>(
    getDefaultSoundCategoryForFirstLaunch() as ChatMessageSoundChoice
  );
  const [isChatMuteEnabled, setIsChatMuteEnabled] = useState(false);
  const [isChatSoundPickerVisible, setIsChatSoundPickerVisible] = useState(false);
  const [chatSpecificSoundListCategory, setChatSpecificSoundListCategory] = useState<ChatMessageSoundChoice | null>(null);
  const [pendingChatSpecificSoundListCategory, setPendingChatSpecificSoundListCategory] = useState<ChatMessageSoundChoice | null>(null);
  const [pendingChatSoundKeyByFriend, setPendingChatSoundKeyByFriend] = useState<Record<string, string>>({});
  const [friendSoundCategoryByFriend, setFriendSoundCategoryByFriend] = useState<Record<string, SoundCategory>>({});
  const [friendSoundKeyByFriend, setFriendSoundKeyByFriend] = useState<Record<string, string>>({});
  const [friendSoundModalVisible, setFriendSoundModalVisible] = useState(false);
  const [isFriendSoundModalContentVisible, setIsFriendSoundModalContentVisible] = useState(false);
  const [friendSoundModalFriend, setFriendSoundModalFriend] = useState<any>(null);
  const [previewingFriendSoundKey, setPreviewingFriendSoundKey] = useState<string | null>(null);
  const [reportReasonModalVisible, setReportReasonModalVisible] = useState(false);
  const [reportReasonModalReady, setReportReasonModalReady] = useState(false);
  const [pendingReportTarget, setPendingReportTarget] = useState<ReportableMessage | null>(null);
  const [globalDefaultCategory, setGlobalDefaultCategory] = useState<SoundCategory>(
    getDefaultSoundCategoryForFirstLaunch()
  );
  const [firstFriendlistOnboardingStep, setFirstFriendlistOnboardingStep] = useState<'footer' | null>(null);
  const [isFirstChatModalVisible, setIsFirstChatModalVisible] = useState(false);
  const isFirstFriendlistOnboardingVisible = firstFriendlistOnboardingStep !== null;
  const [currentPseudo, setCurrentPseudo] = useState<string>("Un ami");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastSentMessages, setLastSentMessages] = useState<LastSentMap>({});
  const [showSilentWarning, setShowSilentWarning] = useState(false);
  const [dismissedSilentWarning, setDismissedSilentWarning] = useState(dismissedSilentWarningSession); // reste à true pour toute la session après clic OK
  const dismissedSilentWarningRef = useRef(dismissedSilentWarningSession);
  const [expandedFriendId, setExpandedFriendId] = useState<string | null>(null);
  const expandedFriendIdRef = useRef<string | null>(null);
  const lastRandomSoundByFriendRef = useRef<Record<string, string>>({});
  const friendSoundPickCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    expandedFriendIdRef.current = expandedFriendId;
  }, [expandedFriendId]);

  useEffect(() => {
    dismissedSilentWarningRef.current = dismissedSilentWarning;
  }, [dismissedSilentWarning]);

  useEffect(() => {
    if (!expandedFriendId) {
      setChatSpecificSoundListCategory(null);
    } else {
      // Première ouverture du chat : vérifier si on doit afficher la modale
      (async () => {
        try {
          const seenChatModal = await AsyncStorage.getItem(FIRST_CHAT_MODAL_KEY);
          if (!seenChatModal) {
            setIsFirstChatModalVisible(true);
          }
        } catch {
          // non bloquant
        }
      })();
    }
  }, [expandedFriendId]);

  useEffect(() => {
    return () => {
      if (friendSoundPickCloseTimeoutRef.current) {
        clearTimeout(friendSoundPickCloseTimeoutRef.current);
      }
    };
  }, []);

  const markFirstFriendlistFooterSeen = useCallback(async () => {
    try {
      await AsyncStorage.setItem(FIRST_FRIENDLIST_FOOTER_MODAL_KEY, '1');
    } catch {
      // non bloquant
    }
  }, []);

  const closeFirstFriendlistOnboarding = useCallback(async () => {
    setFirstFriendlistOnboardingStep(null);
    await markFirstFriendlistFooterSeen();
  }, [markFirstFriendlistFooterSeen]);

  const closeFirstChatModal = useCallback(async () => {
    setIsFirstChatModalVisible(false);
    try {
      await AsyncStorage.setItem(FIRST_CHAT_MODAL_KEY, '1');
    } catch {
      // non bloquant
    }
  }, []);

  const handleInviteFriendsPress = useCallback(async () => {
    try {
      const shareText = i18n.t('share_message', { pseudo: currentPseudo || storePseudo || 'Un ami' }) || '';
      await Share.share({
        message: shareText,
      });
    } catch {
      // non bloquant
    }
  }, [currentPseudo, storePseudo]);

  const handleFirstFriendlistOnboardingOk = useCallback(async () => {
    if (firstFriendlistOnboardingStep !== 'footer') return;
    await markFirstFriendlistFooterSeen();
    setFirstFriendlistOnboardingStep(null);
  }, [firstFriendlistOnboardingStep, markFirstFriendlistFooterSeen]);

  // Pop-up unique à la première arrivée sur la friendlist
  useFocusEffect(
    useCallback(() => {
      if (appUsers.length < 1) return;
      let cancelled = false;
      (async () => {
        try {
          const seenFooter = await AsyncStorage.getItem(FIRST_FRIENDLIST_FOOTER_MODAL_KEY);
          if (cancelled) return;
          if (!seenFooter) {
            setFirstFriendlistOnboardingStep('footer');
          }
        } catch {
          // Si AsyncStorage échoue, on évite de spammer une modale
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [appUsers.length])
  );
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
  const keyboardBottomOffsetSV = useSharedValue(0);
  const keyboardVisibleSV = useSharedValue(false);
  useKeyboardHandler({
    onMove: (e: { height: number }) => {
      'worklet';
      keyboardHeightSV.value = e.height;
      keyboardBottomOffsetSV.value = Math.max(0, e.height);
      keyboardVisibleSV.value = e.height > 0;
    },
    onInteractive: (e: { height: number }) => {
      'worklet';
      keyboardHeightSV.value = e.height;
      keyboardBottomOffsetSV.value = Math.max(0, e.height);
      keyboardVisibleSV.value = e.height > 0;
    },
    onEnd: (e: { height: number }) => {
      'worklet';
      keyboardHeightSV.value = e.height; // Peut être 0 si fermé, ou la hauteur finale
      keyboardBottomOffsetSV.value = Math.max(0, e.height);
      keyboardVisibleSV.value = e.height > 0;
    },
  });

  // Style animé unifié iOS + Android pour coller la modale au clavier.
  const chatModalKeyboardStyle = useAnimatedStyle(() => {
    const rawKeyboardOffset = keyboardVisibleSV.value
      ? Math.max(0, keyboardBottomOffsetSV.value)
      : 0;
    const closedBottomGap = Platform.OS === 'android' ? Math.max(insets.bottom, 12) : 0;
    const openKeyboardGap =
      Platform.OS === 'android'
        ? Math.max(0, rawKeyboardOffset - Math.max(insets.bottom, 10))
        : rawKeyboardOffset;
    const isKeyboardOpen = rawKeyboardOffset > 0;
    const marginBottom = isKeyboardOpen ? openKeyboardGap : 0;
    const internalBottomPadding = isKeyboardOpen ? 0 : closedBottomGap;
    const chatHeight = Math.max(320, SCREEN_HEIGHT - CHAT_MODAL_TOP_SAFE_MARGIN - marginBottom);
    return {
      // Clavier ouvert: modale collée au haut du clavier.
      // Clavier fermé: modale collée en bas, avec padding interne au-dessus de la barre système.
      marginBottom,
      paddingBottom: internalBottomPadding,
      // Hauteur explicite pour éviter la disparition de la modale avec le layout flex interne.
      height: chatHeight,
    };
  });

  const closingCooldownUntilRef = useRef<number | null>(null);
  const openedFromSearchRef = useRef(false); // Track si le chat a été ouvert depuis la recherche
  const [expandedUnreadId, setExpandedUnreadId] = useState<string | null>(null);
  const [unreadCache, setUnreadCache] = useState<Record<string, { id: string; message_content: string; created_at?: string }[]>>({});
  const [fadingOutReceivedMessages, setFadingOutReceivedMessages] = useState<Set<string>>(new Set());
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const blockedUserIdsRef = useRef<Set<string>>(new Set());
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [sendingFriendId, setSendingFriendId] = useState<string | null>(null);
  const [identityModalVisible, setIdentityModalVisible] = useState(false);
  const [identityModalFriend, setIdentityModalFriend] = useState<any>(null);
  const [identityModalName, setIdentityModalName] = useState<string | null>(null);
  const modalTransitionUntilRef = useRef<number>(0);
  const toastOpacity = useRef(new RNAnimated.Value(0)).current;
  const lastSentByIdRef = useRef<Record<string, string>>({});
  const pendingReadIdsRef = useRef<Set<string>>(new Set());
  // Anti-spam markRead (backoff) : Map<messageId, lastAttemptAtMs>
  // Messages envoyés masqués après fermeture de chat (purge locale)
  const hiddenSentIdsRef = useRef<Set<string>>(new Set());
  const readSentMessagesRef = useRef<Set<string>>(new Set()); // Messages envoyés lus par l'autre (pour ne pas les réafficher en non-lu)
  const pendingReadRemovalTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const prevExpandedRef = useRef<string | null>(null);
  const stickyScrollViewRef = useRef<ScrollView>(null);
  const stickyScrollViewAnimatedRef = useRef<Animated.ScrollView>(null);
  const listTopAlignTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markModalTransition = useCallback((durationMs: number = 420) => {
    modalTransitionUntilRef.current = Date.now() + durationMs;
  }, []);

  const isModalTransitionActive = useCallback(() => {
    return Date.now() < modalTransitionUntilRef.current;
  }, []);

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
    const now = Date.now();
    pendingReadIdsRef.current.forEach((id) => {
      Object.keys(next).forEach(userId => {
        const messages = next[userId];
        if (Array.isArray(messages)) {
          const msgIndex = messages.findIndex(msg => msg.id === id);
          if (msgIndex !== -1) {
            next[userId] = messages.map((msg, idx) => 
              idx === msgIndex ? { ...msg, status: 'read' as const, readAt: now } : msg
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
  const [iosSilentSwitchMuted, setIosSilentSwitchMuted] = useState<boolean>(false);
  const [ringerMode, setRingerMode] = useState<number | undefined>(undefined); // Android : mode sonore
  const [notificationVolume, setNotificationVolume] = useState<number | undefined>(undefined); // Volume des notifications (Android)
  const volumeListenerRef = useRef<any>(null);
  const silentListenerRef = useRef<any>(null);
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
  const broadcastRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reportReasonModalEnableTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const broadcastRetryAttemptsRef = useRef(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cacheLoadedRef = useRef(false); // Pour éviter de charger le cache plusieurs fois
  const contactsSyncedRef = useRef(false); // Pour éviter de synchroniser les contacts plusieurs fois
  const phoneFriendIdsRef = useRef<string[]>([]);
  const lastSentSetAtRef = useRef<number>(0); // timestamp du dernier setLastSentMessages local (pour éviter un clear trop tôt)
  const lastPressTime = useRef(0); // Debounce pour les clics sur les amis
  const pendingCenterScrollFriendIdRef = useRef<string | null>(null);
  const keptReadMessagesRef = useRef<Map<string, PendingMessage[]>>(new Map()); // PRRT! : Messages reçus lus mais gardés visibles tant que le chat est ouvert

  // Backend feature flags / throttles (évite spam 404/429)
  const readConversationUnsupportedRef = useRef(false);
  const readConversationWarnedRef = useRef(false);
  const lastConversationReadByFriendRef = useRef<Map<string, { sig: string; at: number }>>(new Map());
  const readConversationInFlightRef = useRef<Set<string>>(new Set());
  const lastConversationCallAtRef = useRef<Map<string, number>>(new Map());
  const knownIncomingMessageIdsRef = useRef<Set<string>>(new Set());
  const hasHydratedIncomingMessagesRef = useRef(false);
  const CONVERSATION_READ_DEDUP_MS = 3_000;
  const CONVERSATION_READ_MIN_INTERVAL_MS = 2_500;
  const CHAT_VERBOSE_LOGS = false;
  const CHAT_CONTROL_LOGS = false;

  // Protection anti-spam des refresh globaux
  const loadDataInFlightRef = useRef(false);
  const queuedLoadDataArgsRef = useRef<{
    hasCacheFromInit: boolean;
    forceLoading: boolean;
    syncContacts: boolean;
  } | null>(null);
  const lastLoadDataAtRef = useRef(0);
  const LOAD_DATA_MIN_INTERVAL_MS = 1200;

  
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
  // MAIS : Ne pas les supprimer de l'affichage tant que le chat est ouvert
  useEffect(() => {
    if (!expandedFriendId || !currentUserId) return;
    // IMPORTANT : inclure aussi les messages déjà "READ:" (qui peuvent rester bloqués en DB)
    // Sinon, ils ne seront jamais purgés et réapparaîtront après relance de l’app.
    const fromFriend = pendingMessages.filter((m) => m.from_user_id === expandedFriendId);
    if (fromFriend.length === 0) return;

    // 1) Garder visibles dans l’UI tant que le chat est ouvert
    const currentKept = keptReadMessagesRef.current.get(expandedFriendId) || [];
    const newKept = fromFriend.filter((u) => !currentKept.some((c) => c.id === u.id));
    if (newKept.length > 0) {
      keptReadMessagesRef.current.set(expandedFriendId, [...currentKept, ...newKept]);
    }

    // 2) Mettre à jour le cache local des non-lus (badge)
    const unreadOnly = fromFriend.filter((m) => !(m.message_content?.startsWith('READ:') ?? false));
    if (unreadOnly.length > 0) {
      setUnreadCache((prev) => {
        const currentCache = prev[expandedFriendId] || [];
        const newMsgs = unreadOnly.filter((u) => !currentCache.some((c) => c.id === u.id));
        if (newMsgs.length === 0) return prev;
        return { ...prev, [expandedFriendId]: [...currentCache, ...newMsgs] };
      });
    }

    // 3) Read conversation (fiable) : 1 appel backend qui supprime tous les messages A->B
    // (évite les 429 + assure la purge)
    (async () => {
      const friendId = expandedFriendId;
      if (!friendId) return;

      if (readConversationInFlightRef.current.has(friendId)) {
        if (__DEV__) console.log(`[CHAT_DEBUG] readConversation in-flight skipped for ${friendId}`);
        return;
      }

      const ids = Array.from(new Set(fromFriend.map((m) => m.id).filter(Boolean)));
      if (ids.length === 0) return;
      // Dedup court : évite de rappeler en boucle si pendingMessages bouge sans nouveaux IDs
      const sig = `${ids.length}:${ids[0]}:${ids[ids.length - 1]}`;
      const prev = lastConversationReadByFriendRef.current.get(friendId);
      const now = Date.now();
      if (prev && prev.sig === sig && now - prev.at < CONVERSATION_READ_DEDUP_MS) return;
      const lastCallAt = lastConversationCallAtRef.current.get(friendId) || 0;
      if (now - lastCallAt < CONVERSATION_READ_MIN_INTERVAL_MS) return;
      lastConversationReadByFriendRef.current.set(friendId, { sig, at: now });
      lastConversationCallAtRef.current.set(friendId, now);

      if (readConversationUnsupportedRef.current) return;
      readConversationInFlightRef.current.add(friendId);

      const markLocalReadForIds = () => {
        // Marquer localement comme "lu" (dimmer) et garantir purge à la fermeture
        setPendingMessages((prevMsgs) =>
          prevMsgs.map((m) => {
            if (m.from_user_id !== friendId) return m;
            if (!m.id) return m;
            if (!ids.includes(m.id)) return m;
            if (m.message_content?.startsWith('READ:')) return m;
            return { ...m, message_content: `READ:${m.message_content || ''}` };
          })
        );
      };

      const tryClientSideDeleteAndBroadcast = async () => {
        // 1) Broadcast batch à l'expéditeur (A) pour que ses messages passent "lu" localement
        const channel = supabase.channel(`room-${friendId}`);
        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.send({
              type: 'broadcast',
              event: 'message-read',
              payload: { ids, senderId: friendId, receiverId: currentUserId },
            });
            setTimeout(() => supabase.removeChannel(channel), 5000);
          }
        });

        // 2) Delete batch en DB (souvent autorisé côté receiver via RLS)
        // On scinde en paquets pour éviter les limites de payload.
        const CHUNK = 200;
        for (let i = 0; i < ids.length; i += CHUNK) {
          const chunk = ids.slice(i, i + CHUNK);
          await supabase
            .from('pending_messages')
            .delete()
            .in('id', chunk)
            .eq('to_user_id', currentUserId);
        }
      };

      try {
        if (CHAT_VERBOSE_LOGS) {
          console.log(`📞 [CLIENT] Appel markConversationReadViaBackend - senderId: ${friendId}, receiverId: ${currentUserId}`);
        }
        const res = await markConversationReadViaBackend(friendId, currentUserId);
        if (CHAT_VERBOSE_LOGS) {
          console.log(`📞 [CLIENT] Réponse markConversationReadViaBackend:`, {
            ok: res.ok,
            status: res.status,
            idsCount: ids.length
          });
        }
        
        if (res.ok) {
          if (CHAT_VERBOSE_LOGS) console.log(`✅ [CLIENT] markConversationReadViaBackend réussi, marquage local`);
          markLocalReadForIds();
          return;
        }

        if (res.status === 404) {
          readConversationUnsupportedRef.current = true;
          if (!readConversationWarnedRef.current) {
            readConversationWarnedRef.current = true;
            console.warn('Erreur backend readConversation (404) — backend pas encore redéployé');
          }
          // Fallback immédiat sans backend : on marque localement + on tente delete batch Supabase + broadcast batch
          markLocalReadForIds();
          try {
            await tryClientSideDeleteAndBroadcast();
          } catch {
            // Si RLS bloque, le message restera en DB mais ne réapparaîtra plus dans l'UI (READ: + purge locale à la fermeture).
          }
          return;
        }

        // Autres erreurs : on évite toute boucle (pas de purge backend => 429).
        // On tente quand même le fallback client-side (best-effort) pour ne pas laisser la conversation persister.
        markLocalReadForIds();
        try {
          await tryClientSideDeleteAndBroadcast();
        } catch {
          // noop
        }
      } finally {
        readConversationInFlightRef.current.delete(friendId);
      }
    })();
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
          // On laisse l'effet "à l'entrée" faire le readConversation (dedup/throttle).
          // Évite de spammer le backend pendant que le chat est ouvert.
        }, 1500);
      }
    }
    return () => clearTimeout(timer);
  }, [pendingMessages, expandedFriendId, currentUserId]);

      // PRRT! Protocol : au démontage du chat (fermeture ou changement d'ami), nettoyer l'état local des messages lus et envoyés
  useEffect(() => {
    if (prevExpandedRef.current && !expandedFriendId) {
      const prevId = prevExpandedRef.current;
      if (CHAT_CONTROL_LOGS) console.log(`🔒 [CLIENT] Fermeture du chat pour friendId: ${prevId}`);
      
      // IMPORTANT : Mettre à jour la ref IMMÉDIATEMENT pour que loadData sache que le chat est fermé
      // Sinon loadData croit qu'il est encore ouvert et garde les messages !
      expandedFriendIdRef.current = null;
      
      // Nettoyer le buffer local (legacy) et appliquer la règle "session gelée"
      // À la fermeture: on supprime définitivement UNIQUEMENT les messages de cette conversation
      // qui sont en sursis (READ: ou isPendingDelete).
      keptReadMessagesRef.current.delete(prevId);

      // LOGIQUE SNAPCHAT : À la fermeture du chat, on garde les messages reçus non lus
      // Les messages lus (READ:) seront supprimés seulement s'ils sont aussi supprimés du serveur
      // (après 5 secondes) lors du prochain loadData
      setPendingMessages(prev => {
        const beforeCount = prev.length;
        const filtered = prev.filter(m => {
          if (m.from_user_id !== prevId) return true;
          const isRead = m.message_content?.startsWith('READ:') ?? false;
          // LOGIQUE SNAPCHAT : On garde les messages non lus même après fermeture
          // Les messages lus seront supprimés seulement s'ils sont aussi supprimés du serveur
          if (isRead) {
            // Message lu : on le garde temporairement, il sera supprimé par loadData
            // s'il n'est plus sur le serveur (après 5 secondes)
            return true;
          }
          // Message non lu : toujours garder (persistance Snapchat)
          return true;
        });
        const afterCount = filtered.length;
        const dropped = beforeCount - afterCount;
        if (CHAT_CONTROL_LOGS) console.log(`📨 [CLIENT] Messages reçus conservés (logique Snapchat): ${afterCount} sur ${beforeCount} (friendId: ${prevId})`);
        return filtered;
      });

      const cachedForPrev = unreadCache[prevId] || [];
      if (CHAT_CONTROL_LOGS) console.log(`🗑️ [CLIENT] Cache unread nettoyé: ${cachedForPrev.length} messages pour ${prevId}`);
      setUnreadCache(prev => ({ ...prev, [prevId]: [] }));
      if (cachedForPrev.length > 0) {
        setFadingOutReceivedMessages(prev => {
          const newSet = new Set(prev);
          cachedForPrev.forEach(msg => newSet.delete(msg.id));
          return newSet;
        });
      }
      // Ne pas faire de purge globale READ: ici (session gelée).

      // LOGIQUE SNAPCHAT : À la fermeture du chat, on garde TOUS les messages
      // - Messages non lus : restent visibles (persistance)
      // - Messages lus : restent visibles aussi (session gelée)
      // La purge complète se fera seulement si les messages sont supprimés du serveur
      // (après 5 secondes) ET que le chat est fermé
      if (CHAT_CONTROL_LOGS) console.log(`📤 [CLIENT] Fermeture chat Snapchat - Conservation de tous les messages pour ${prevId}`);
      setLastSentMessages(prev => {
        const msgs = prev[prevId];
        if (!Array.isArray(msgs)) {
          if (CHAT_CONTROL_LOGS) console.log(`ℹ️ [CLIENT] Aucun message envoyé pour ${prevId}`);
          return prev;
        }

        if (CHAT_CONTROL_LOGS) console.log(`📤 [CLIENT] Messages envoyés conservés (logique Snapchat):`, {
          totalMessages: msgs.length,
          readMessages: msgs.filter(m => m.status === 'read').length,
          unreadMessages: msgs.filter(m => m.status !== 'read').length
        });

        // LOGIQUE SNAPCHAT : On garde TOUS les messages à la fermeture
        // Ils seront purgés seulement s'ils sont supprimés du serveur (après 5 secondes)
        // et que le chat reste fermé lors du prochain loadData
        return prev;
      });
      
      // PRRT! Protocol : Force sync à la fermeture pour être sûr que l'état local correspond au serveur
      // (supprime les messages qui ont été lus/supprimés sur le serveur mais dont on aurait raté le broadcast)
      // Comme expandedFriendIdRef est maintenant null (ou changé), loadData va nettoyer les messages absents du serveur.
      if (CHAT_CONTROL_LOGS) console.log(`🔄 [CLIENT] Force sync loadData après fermeture du chat`);
      loadData(false, false, false);
    }
    prevExpandedRef.current = expandedFriendId;
  }, [expandedFriendId, unreadCache]);


  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (expandedFriendId) {
      // Polling de sécurité toutes les 5s quand un chat est ouvert
      // Garantit que le statut "Lu" arrive même si le Realtime échoue
      interval = setInterval(() => {
        if (CHAT_VERBOSE_LOGS) console.log(`🔍 [CLIENT] Polling de sécurité (chat ouvert)...`);
        loadData(false, true, false);
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [expandedFriendId]);

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
    const subscription = DeviceEventEmitter.addListener('REFRESH_DATA', async (data?: any) => {
      console.log('🔔 [REFRESH_DATA] Listener triggered with data:', JSON.stringify(data));
      // 1. Le son est géré nativement par ProutMessagingService.kt sur Android
      // même en premier plan. On ne joue rien ici pour éviter le son doublé.

      // Ignorer les événements de rafraîchissement génériques sans données de message
      // (qui viennent potentiellement d'autres endroits de l'app)
      if (data?.source) {
        console.log('🔔 [REFRESH_DATA] Generic refresh event received from', data.source, '- Invalidating queries...');
        queryClient.invalidateQueries({ queryKey: ['pendingMessages'] });
        queryClient.invalidateQueries({ queryKey: ['friends'] });
        return;
      }

      const senderId = typeof data?.senderId === 'string' ? data.senderId : null;
      const customMessage = typeof data?.customMessage === 'string' ? data.customMessage.trim() : '';
      const proutKey = typeof data?.proutKey === 'string' ? data.proutKey : null;

      console.log('🔔 [REFRESH_DATA] Parsed data:', { senderId, customMessage, proutKey });

      // Injection optimiste immédiate pour l'aperçu en FriendList quand la notif
      // arrive avant que le refresh backend/Supabase n'ait eu le temps d'aboutir.
      if (senderId && customMessage) {
        console.log('🔔 [REFRESH_DATA] Injecting optimistic message...');
        const nowIso = new Date().toISOString();
        const optimisticMessage: PendingMessage = {
          id: `notif-${senderId}-${Date.now()}`,
          from_user_id: senderId,
          to_user_id: currentUserId || undefined,
          message_content: `${proutKey ? `[${proutKey}]` : ''}${customMessage}`,
          created_at: nowIso,
          isPendingDelete: false,
        };

        setPendingMessages((prev) => {
          const hasEquivalent = prev.some((msg) => {
            if (msg.from_user_id !== senderId) return false;
            if ((msg.message_content || '') !== optimisticMessage.message_content) return false;
            return Math.abs(new Date(msg.created_at).getTime() - new Date(nowIso).getTime()) < 5000;
          });
          if (hasEquivalent) {
            console.log('🔔 [REFRESH_DATA] Equivalent optimistic message already exists.');
            return prev;
          }
          console.log('🔔 [REFRESH_DATA] Added optimistic message to state.');
          return [...prev, optimisticMessage].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });

        setAppUsers((prev) => {
          const updated = prev.map((friend) =>
            friend.id === senderId ? { ...friend, last_interaction_at: nowIso } : friend
          );
          return [...updated].sort((a, b) => {
            const timeA = a.last_interaction_at ? new Date(a.last_interaction_at).getTime() : 0;
            const timeB = b.last_interaction_at ? new Date(b.last_interaction_at).getTime() : 0;
            return timeB - timeA;
          });
        });
      } else {
        console.log('🔔 [REFRESH_DATA] Missing senderId or customMessage, skipping optimistic injection.');
      }

      // 2. Invalider TanStack Query et re-fetch avec un petit délai 
      // pour laisser le temps au backend de persister et éviter d'écraser 
      // l'état optimiste avec des données obsolètes.
      setTimeout(() => {
        console.log('🔔 [REFRESH_DATA] Timeout reached, invalidating queries and reloading data...');
        queryClient.invalidateQueries({ queryKey: ['pendingMessages'] });
        queryClient.invalidateQueries({ queryKey: ['friends'] });
      }, 1500);
    });
    return () => {
      subscription.remove();
    };
  }, [currentUserId, isSilentMode, queryClient, refetchMessages]);

  // Durée de vie maximale d'un message (24h)
  const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;

  // Messages éphémères (pending_messages) — tri chronologique pour affichage type WhatsApp (plus ancien en haut, plus récent en bas)
  const fetchPendingMessages = async (userId: string) => {
    const data = await fetchPendingReceivedViaBackend(userId);
    if (data === null) {
      return;
    }
    
    const now = Date.now();
    const validMessages: any[] = [];
    const expiredIds: string[] = [];

    (data || []).forEach((m: any) => {
      const msgTime = new Date(m.created_at).getTime();
      if (now - msgTime > MESSAGE_TTL_MS) {
        expiredIds.push(m.id);
      } else {
        validMessages.push(m);
      }
    });

    // Filtrer les messages qui sont dans la liste noire locale (supprimés mais pas encore sync)
    // NOTE: On NE filtre PAS "READ:" (session gelée). Ils seront affichés en opacité réduite.
    const blockedSet = blockedUserIdsRef.current;
    const serverMessages = validMessages
      .filter(m => !blockedSet.has(m.from_user_id))
      .filter(m => !deletedMessagesCache.has(m.id))
      .map((m: any) => ({ ...m, isPendingDelete: false })) as PendingMessage[];

    const incomingMessageIds = serverMessages.map((m) => m.id);
    const trulyNewIncomingMessages = serverMessages.filter(
      (m) => !knownIncomingMessageIdsRef.current.has(m.id)
    );
    knownIncomingMessageIdsRef.current = new Set(incomingMessageIds);

    if (!hasHydratedIncomingMessagesRef.current) {
      hasHydratedIncomingMessagesRef.current = true;
    } else if (trulyNewIncomingMessages.length > 0) {
      triggerIncomingMessageHaptic();
    }

    // Session gelée: merge serveur + état local pour éviter toute disparition pendant chat ouvert
    setPendingMessages((prev) => {
      const prevById = new Map(prev.map(m => [m.id, m]));
      const mergedById = new Map<string, PendingMessage>();

      serverMessages.forEach((m) => {
        const prevMsg = prevById.get(m.id);
        mergedById.set(m.id, { ...m, isPendingDelete: prevMsg?.isPendingDelete ?? false });
      });

      // Compat: conserver les messages déjà gardés (ancienne logique)
      const activeId = expandedFriendIdRef.current;
      if (activeId) {
        const kept = keptReadMessagesRef.current.get(activeId) || [];
        kept.forEach((m) => {
          if (!mergedById.has(m.id)) mergedById.set(m.id, m);
        });

        prev.forEach((m) => {
          const isActiveConversation = m.from_user_id === activeId;
          const isReadOrPending =
            !!m.isPendingDelete || (m.message_content?.startsWith('READ:') ?? false);
          if (isActiveConversation && isReadOrPending && !mergedById.has(m.id)) {
            mergedById.set(m.id, m);
          }
        });
      }

      const next = Array.from(mergedById.values());
      next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return next;
    });

    // Mise à jour optimiste locale pour remonter les expéditeurs (messages reçus)
    if (serverMessages.length > 0) {
      const now = new Date().toISOString();
      const uniqueSenderIds = [...new Set(serverMessages.map(m => m.from_user_id))];
      setAppUsers(prev => {
        const updated = prev.map(friend =>
          uniqueSenderIds.includes(friend.id)
            ? { ...friend, last_interaction_at: now }
            : friend
        );
        return sortFriends(updated);
      });
      scheduleAlignFriendListTop();
    }
    // Le backend met à jour last_interaction_at, mais cette mise à jour optimiste rend l'affichage instantané
  };


  // Messages envoyés par moi et non lus (persistance du dernier message)
  const fetchSentPendingMessages = async (userId: string) => {
    const data = await fetchPendingSentViaBackend(userId);
    if (data === null) {
      console.error(`❌ [fetchSentPendingMessages] Erreur backend pendingSent`);
      return null;
    }

    const now = Date.now();
    const validMessages: any[] = [];
    const expiredIds: string[] = [];

    (data || []).forEach((m: any) => {
      const msgTime = new Date(m.created_at).getTime();
      if (now - msgTime > MESSAGE_TTL_MS) {
        expiredIds.push(m.id);
      } else {
        validMessages.push(m);
      }
    });

    if (CHAT_VERBOSE_LOGS && expiredIds.length > 0) {
      console.log(`📊 [fetchSentPendingMessages] Messages valides: ${validMessages.length}, Expirés: ${expiredIds.length}`);
    }

    // Session gelée: on ne filtre pas READ ici (affichage grisé côté UI)
    return validMessages;
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
          const [cachedFriends, cachedRequests, cachedBlockedUsersRaw] = await Promise.all([
            loadCacheSafely(CACHE_KEY_FRIENDS),
            loadCacheSafely(CACHE_KEY_PENDING_REQUESTS),
            AsyncStorage.getItem(CACHE_KEY_BLOCKED_USERS),
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

          if (cachedBlockedUsersRaw) {
            const parsed = JSON.parse(cachedBlockedUsersRaw);
            if (Array.isArray(parsed)) {
              setBlockedUserIds(parsed);
              blockedUserIdsRef.current = new Set(parsed);
            }
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
      
      /* Polling manual disabled, handled by TanStack Query hooks */
      // pollingIntervalRef.current = setInterval(() => {
      //   loadData(false, false, false); 
      // }, 10000) as unknown as NodeJS.Timeout;
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
      if (broadcastRetryTimeoutRef.current) {
        clearTimeout(broadcastRetryTimeoutRef.current);
        broadcastRetryTimeoutRef.current = null;
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
      const purgeFlag = await AsyncStorage.getItem('cache:last_sent_messages_purged_once_v3');
      if (!purgeFlag) {
        await AsyncStorage.removeItem(CACHE_KEY_LAST_SENT_MESSAGES);
        await AsyncStorage.setItem('cache:last_sent_messages_purged_once_v3', '1');
        if (__DEV__) {
           console.log('[CACHE] Purged last sent messages cache (v3)');
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

useEffect(() => {
  const loadChatSoundChoice = async () => {
    try {
      const [, savedMute] = await Promise.all([
        AsyncStorage.getItem(CHAT_MESSAGE_SOUND_CHOICE_KEY),
        AsyncStorage.getItem(CHAT_MESSAGE_MUTE_KEY),
      ]);
      // Plus de sélection catégorie au tap : défaut toujours proot (toot) pour la randomisation.
      const nextDefault = getDefaultSoundCategoryForFirstLaunch() as ChatMessageSoundChoice;
      setChatMessageSoundChoice(nextDefault);
      // Aligner le stockage (migration depuis d’anciennes préférences par catégorie).
      AsyncStorage.setItem(CHAT_MESSAGE_SOUND_CHOICE_KEY, nextDefault).catch(() => {});
      if (savedMute === '1') {
        setIsChatMuteEnabled(true);
      }
    } catch {
      // noop
    }
  };
  loadChatSoundChoice();
}, []);

const closeChatSpecificSoundList = useCallback(() => {
  if (!isChatSoundPickerVisible && !chatSpecificSoundListCategory && !pendingChatSpecificSoundListCategory) return;
  setIsChatSoundPickerVisible(false);
  setPendingChatSpecificSoundListCategory(null);
  setChatSpecificSoundListCategory(null);
  if (expandedFriendId) {
    setTimeout(() => {
      textInputRefs.current[expandedFriendId]?.focus?.();
    }, 50);
  }
}, [isChatSoundPickerVisible, chatSpecificSoundListCategory, pendingChatSpecificSoundListCategory, expandedFriendId]);

const openChatSpecificSoundList = useCallback((choice: ChatMessageSoundChoice) => {
  // Le bouton "choose a sound" ouvre le picker avec une première liste.
  // La randomisation sans son spécifique reste sur proot (toot) — pas de persistance catégorie ici.
  // Android : attendre la vraie fermeture du clavier avant d'insérer la liste.
  // Cela évite les allers-retours visibles du bloc input / icônes / liste.
  setIsChatSoundPickerVisible(true);
  if (Platform.OS === 'android' && keyboardVisibleRef.current) {
    setPendingChatSpecificSoundListCategory(choice);
    setChatSpecificSoundListCategory(null);
    Keyboard.dismiss();
    return;
  }
  Keyboard.dismiss();
  setPendingChatSpecificSoundListCategory(null);
  setChatSpecificSoundListCategory(choice);
}, []);

const openChatSoundPicker = useCallback(() => {
  // iOS : première liste = mood ; Android : défaut proot (toot)
  const initial =
    Platform.OS === 'ios'
      ? ('mood' as ChatMessageSoundChoice)
      : (getDefaultSoundCategoryForFirstLaunch() as ChatMessageSoundChoice);
  openChatSpecificSoundList(initial);
}, [openChatSpecificSoundList]);

/** Tap sur une icône : change la liste affichée uniquement quand le picker est déjà visible. */
const switchChatSoundListCategoryIfOpen = useCallback((choice: ChatMessageSoundChoice) => {
  if (!isChatSoundPickerVisible && !chatSpecificSoundListCategory && !pendingChatSpecificSoundListCategory) {
    return;
  }
  if (chatSpecificSoundListCategory) {
    setChatSpecificSoundListCategory(choice);
    return;
  }
  if (pendingChatSpecificSoundListCategory) {
    setPendingChatSpecificSoundListCategory(choice);
    return;
  }
  if (isChatSoundPickerVisible) {
    openChatSpecificSoundList(choice);
  }
}, [isChatSoundPickerVisible, chatSpecificSoundListCategory, pendingChatSpecificSoundListCategory, openChatSpecificSoundList]);

const handleSelectChatSpecificSound = useCallback((soundKey: string) => {
  if (!expandedFriendId) return;
  setIsChatSoundPickerVisible(false);
  setPendingChatSpecificSoundListCategory(null);
  setPendingChatSoundKeyByFriend((prev) => ({
    ...prev,
    [expandedFriendId]: soundKey,
  }));
  setChatSpecificSoundListCategory(null);
  // Après choix : pas d’icône catégorie active ; défaut proot pour les prochains envois sans son listé.
  const ambientDefault = getDefaultSoundCategoryForFirstLaunch() as ChatMessageSoundChoice;
  setChatMessageSoundChoice(ambientDefault);
  AsyncStorage.setItem(CHAT_MESSAGE_SOUND_CHOICE_KEY, ambientDefault).catch(() => {});

  // Rouvrir le clavier et refocus l'input après la sélection
  setTimeout(() => {
    textInputRefs.current[expandedFriendId]?.focus?.();
  }, 50);
}, [expandedFriendId]);

const toggleChatMute = useCallback(() => {
  setPendingChatSpecificSoundListCategory(null);
  setChatSpecificSoundListCategory(null);
  setIsChatMuteEnabled((prev) => {
    const next = !prev;
    AsyncStorage.setItem(CHAT_MESSAGE_MUTE_KEY, next ? '1' : '0').catch(() => {});
    return next;
  });
}, []);

useEffect(() => {
  const loadFriendSoundCategoryMap = async () => {
    try {
      const raw = await AsyncStorage.getItem(FRIEND_SOUND_CATEGORY_MAP_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      const sanitized: Record<string, SoundCategory> = {};
      Object.entries(parsed).forEach(([friendId, category]) => {
        if (category === 'trll' || category === 'bzzz') {
          sanitized[friendId] = category;
        }
      });
      setFriendSoundCategoryByFriend(sanitized);
    } catch {
      // noop
    }
  };
  loadFriendSoundCategoryMap();
}, []);

useEffect(() => {
  if (!SHOW_DEFAULT_SOUND_CATEGORY_CURSOR) return;
  let mounted = true;
  AsyncStorage.getItem(SOUND_CATEGORY_KEY)
    .then((saved) => {
      if (!mounted || !saved) return;
      if (saved === 'trll' || saved === 'bzzz' || saved === 'pop' || saved === 'mood' || saved === 'toot') setGlobalDefaultCategory(saved as SoundCategory);
    })
    .catch(() => {});
  return () => { mounted = false; };
}, []);

const handleSelectGlobalDefaultCategory = useCallback(async (category: SoundCategory) => {
  setGlobalDefaultCategory(category);
  try {
    await AsyncStorage.setItem(SOUND_CATEGORY_KEY, category);
  } catch (_) {}
}, []);

const handleLongPressSoundCategory = useCallback((friend: any) => {
  if (isModalTransitionActive()) return;
  if (identityModalVisible || isFirstFriendlistOnboardingVisible || isFirstChatModalVisible) return;
  markModalTransition();
  setIsFriendSoundModalContentVisible(true);
  setFriendSoundModalFriend(friend);
  setFriendSoundModalVisible(true);
}, [identityModalVisible, isFirstFriendlistOnboardingVisible, isModalTransitionActive, markModalTransition]);

const handleSelectFriendSpecificSoundKey = useCallback((soundKey: string) => {
  const friendId = friendSoundModalFriend?.id;
  if (!friendId || !SOUND_ASSETS[soundKey]) return;
  stopCurrentPlayback().catch(() => {});
  setPreviewingFriendSoundKey(null);
  setFriendSoundKeyByFriend((prev) => {
    return { ...prev, [friendId]: soundKey };
  });
  if (friendSoundPickCloseTimeoutRef.current) {
    clearTimeout(friendSoundPickCloseTimeoutRef.current);
    friendSoundPickCloseTimeoutRef.current = null;
  }
  setIsFriendSoundModalContentVisible(false);
  markModalTransition();
  setFriendSoundModalVisible(false);
}, [friendSoundModalFriend?.id, markModalTransition]);

const handlePreviewFriendSpecificSoundKey = useCallback((soundKey: string) => {
  if (!SOUND_ASSETS[soundKey]) return;
  playSound(soundKey, {
    onStart: () => setPreviewingFriendSoundKey(soundKey),
    onEnd: () => {
      setPreviewingFriendSoundKey((prev) => (prev === soundKey ? null : prev));
    },
  });
}, []);

const closeFriendSoundModal = useCallback(() => {
  if (friendSoundPickCloseTimeoutRef.current) {
    clearTimeout(friendSoundPickCloseTimeoutRef.current);
    friendSoundPickCloseTimeoutRef.current = null;
  }
  stopCurrentPlayback().catch(() => {});
  setPreviewingFriendSoundKey(null);
  setIsFriendSoundModalContentVisible(false);
  markModalTransition();
  setFriendSoundModalVisible(false);
}, [markModalTransition]);

const closeFriendSoundPickModal = useCallback(() => {
  if (friendSoundPickCloseTimeoutRef.current) {
    clearTimeout(friendSoundPickCloseTimeoutRef.current);
    friendSoundPickCloseTimeoutRef.current = null;
  }
  stopCurrentPlayback().catch(() => {});
  setPreviewingFriendSoundKey(null);
  setIsFriendSoundModalContentVisible(false);
  setFriendSoundModalVisible(false);
}, []);

const renderFriendSoundPickItem = useCallback((soundKey: string) => {
  const isActive = !!(
    friendSoundModalFriend?.id && friendSoundKeyByFriend[friendSoundModalFriend.id] === soundKey
  );
  const isPreviewing = previewingFriendSoundKey === soundKey;
  return (
    <View key={soundKey} style={styles.friendSoundPickItemRow}>
      <TouchableOpacity
        style={[
          styles.friendSoundPickPlayButton,
          isPreviewing && styles.friendSoundPickPlayButtonActive,
        ]}
        onPress={() => handlePreviewFriendSpecificSoundKey(soundKey)}
        activeOpacity={0.85}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name="play"
          size={14}
          color={isPreviewing ? '#1a1a1a' : '#604a3e'}
          style={styles.friendSoundPickPlayIcon}
        />
      </TouchableOpacity>
      <Pressable
        style={({ pressed }) => [
          styles.friendSoundPickItemButton,
          (pressed || isActive || isPreviewing) && styles.friendSoundPickItemButtonActive,
        ]}
        onPress={() => handleSelectFriendSpecificSoundKey(soundKey)}
      >
        <Text style={styles.friendSoundPickItemText}>{getDisplaySoundLabel(soundKey)}</Text>
      </Pressable>
    </View>
  );
}, [
  friendSoundKeyByFriend,
  friendSoundModalFriend?.id,
  handlePreviewFriendSpecificSoundKey,
  handleSelectFriendSpecificSoundKey,
  previewingFriendSoundKey,
]);

const previewingFriendSoundCategory = useMemo<ChatMessageSoundChoice | null>(() => {
  if (!previewingFriendSoundKey) return null;
  if (PICKUP_TOOT_KEYS.includes(previewingFriendSoundKey)) return 'toot';
  if (PICKUP_MOOD_KEYS.includes(previewingFriendSoundKey)) return 'mood';
  if (PICKUP_POP_KEYS.includes(previewingFriendSoundKey)) return 'pop';
  if (PICKUP_TRLL_KEYS.includes(previewingFriendSoundKey)) return 'trll';
  if (PICKUP_BZZZ_KEYS.includes(previewingFriendSoundKey)) return 'bzzz';
  return null;
}, [previewingFriendSoundKey]);

const closeIdentityModal = useCallback(() => {
  markModalTransition();
  setIdentityModalVisible(false);
}, [markModalTransition]);

// Vérifier si les notifications sont silencieuses
  // iOS : via VolumeManager.getVolume() + addSilentListener()
  // Android : via expo-notifications (permissions + canaux)
  useEffect(() => {
    let mounted = true;

    const setupSilentModeDetection = async () => {
      try {
        if (Platform.OS === 'ios') {
          // iOS : on observe à la fois le volume et le switch silencieux.
          const volumeResult = await VolumeManager.getVolume();
          if (mounted) {
            setVolume(volumeResult?.volume);
            if (volumeResult?.volume === 0 && !dismissedSilentWarningRef.current) {
              setShowSilentWarning(true);
            }
          }

          const silentListener = VolumeManager.addSilentListener((status) => {
            if (!mounted) return;
            setIosSilentSwitchMuted(!!status?.isMuted);
            if (status?.isMuted && !dismissedSilentWarningRef.current) {
              setShowSilentWarning(true);
            }
          });
          silentListenerRef.current = silentListener;

          // iOS : écouter aussi les changements de volume
          const volListener = VolumeManager.addVolumeListener((result) => {
            if (mounted) {
              setVolume(result?.volume);
              if (result?.volume === 0 && !dismissedSilentWarningRef.current) {
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
              if (mode === RINGER_MODE.normal && vol === 0 && !dismissedSilentWarningRef.current) {
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
                if (ringerMode === RINGER_MODE.normal && vol === 0 && !dismissedSilentWarningRef.current) {
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
                  if (modeVal === RINGER_MODE.normal && notifVol === 0 && !dismissedSilentWarningRef.current) {
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
      if (silentListenerRef.current) {
        silentListenerRef.current.remove();
        silentListenerRef.current = null;
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
        isSilent = volume === 0 || iosSilentSwitchMuted;
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
        ? ringerMode !== RINGER_MODE.normal || isSilent
        : isSilent;

    // Si l'utilisateur revient en mode normal, on réarme l'alerte pour
    // qu'elle puisse réapparaître au prochain passage en silencieux.
    if (!androidCanShow && dismissedSilentWarning) {
      dismissedSilentWarningSession = false;
      setDismissedSilentWarning(false);
    }

    // Afficher seulement si non dismissé dans la session courante
    setShowSilentWarning(androidCanShow && !dismissedSilentWarning);
  }, [volume, iosSilentSwitchMuted, notificationVolume, dismissedSilentWarning, ringerMode]);

  // Note: Les notifications sont gérées par setupRealtimeSubscription et loadData
  // qui rechargent last_interaction_at depuis Supabase pour mettre à jour le tri

  const router = useRouter();

  // Mémoire pour le dernier toast hors connexion (anti-spam)
  const lastOfflineToastTimeRef = useRef<number>(0);

  const scheduleAlignFriendListTop = useCallback((delayMs: number = 90) => {
    if (listTopAlignTimeoutRef.current) {
      clearTimeout(listTopAlignTimeoutRef.current);
    }
    listTopAlignTimeoutRef.current = setTimeout(() => {
      try {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      } catch {}
      try {
        flatListRef.current?.scrollToIndex({ index: 0, animated: true, viewPosition: 0 });
      } catch {}
      listTopAlignTimeoutRef.current = null;
    }, delayMs);
  }, []);

  useEffect(() => {
    return () => {
      if (listTopAlignTimeoutRef.current) {
        clearTimeout(listTopAlignTimeoutRef.current);
        listTopAlignTimeoutRef.current = null;
      }
    };
  }, []);

  const triggerIncomingMessageHaptic = useCallback(() => {
    if (Platform.OS !== 'ios' || !isHapticEnabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }, [isHapticEnabled]);

  const triggerOutgoingMessageHaptic = useCallback(() => {
    if (Platform.OS !== 'ios' || !isHapticEnabled) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [isHapticEnabled]);

  const showOfflineToast = () => {
    const now = Date.now();
    // Anti-spam de 30 secondes
    if (now - lastOfflineToastTimeRef.current > 30000) {
      showToast(i18n.t('connection_error_title'), i18n.t('check_connection_body'));
      lastOfflineToastTimeRef.current = now;
    }
  };

  const loadData = async (hasCacheFromInit: boolean = false, forceLoading: boolean = false, syncContacts: boolean = true) => {
    // Évite les fetch concurrents + les rafales de triggers Realtime/polling
    if (loadDataInFlightRef.current) {
      queuedLoadDataArgsRef.current = { hasCacheFromInit, forceLoading, syncContacts };
      return;
    }
    const now = Date.now();
    // forceLoading bypass le throttle temporel
    if (!forceLoading && !syncContacts && now - lastLoadDataAtRef.current < LOAD_DATA_MIN_INTERVAL_MS) {
      return;
    }
    loadDataInFlightRef.current = true;
    lastLoadDataAtRef.current = now;

    // Ne plus mettre loading à true ici pour éviter le flash blanc
    // Seul le chargement initial (si la liste est vide) peut l'activer
    if (forceLoading && appUsersRef.current.length === 0) {
      setLoading(true);
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
      const { data: blockedUsersRows } = await supabase
        .from('blocked_users')
        .select('blocked_user_id')
        .eq('blocker_id', user.id);
      const nextBlockedUserIds = (blockedUsersRows || []).map((row: any) => row.blocked_user_id).filter(Boolean);
      setBlockedUserIds(nextBlockedUserIds);
      blockedUserIdsRef.current = new Set(nextBlockedUserIds);
      await AsyncStorage.setItem(CACHE_KEY_BLOCKED_USERS, JSON.stringify(nextBlockedUserIds));

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
                console.error('❌ Erreur sync contacts:', {
                  code: (error as any)?.code,
                  message: (error as any)?.message,
                  details: (error as any)?.details,
                  hint: (error as any)?.hint,
                });
                // Fallback: on garde le comportement lecture seule des contacts locaux
                // pour éviter de bloquer la liste d'amis si la RPC est indisponible.
                const { data: contactsFound } = await supabase
                  .from('user_profiles')
                  .select('id')
                  .in('phone', phones)
                  .neq('id', user.id);
                if (contactsFound) {
                  phoneFriendsIds = contactsFound.map(u => u.id);
                }
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
      const blockedSet = blockedUserIdsRef.current;
      const allFriendIds = [...new Set([...phoneFriendsIds, ...addedFriendsIds, ...friendsWhereIAmFriendIds])]
        .filter((id) => !blockedSet.has(id));

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
            if (CHAT_VERBOSE_LOGS) {
              console.log(`📥 [CLIENT] loadData - Messages envoyés récupérés depuis pending_messages: ${sentPendingMessagesResult.length}`);
            }
            setLastSentMessages((prev) => {
              // 1. Convertir le résultat serveur en map (tableau de messages par utilisateur)
              // IMPORTANT : On ignore les messages avec "READ:" car ils sont en cours de suppression
              // et ne doivent pas être affichés (ils sont déjà lus par B)
              const serverMap: LastSentMap = {};
              let droppedStaleServer = 0;
              if (sentPendingMessagesResult.length > 0) {
                 sentPendingMessagesResult.forEach((m: any) => {
                    if (m?.id && hiddenSentIdsRef.current.has(m.id)) {
                      return;
                    }
                    const rawContent = m.message_content || '';
                    const parsed = parseMessageContent(rawContent);

                    // IMPORTANT : Si le message est marqué "READ:" côté serveur, on doit le traiter
                    // pour mettre à jour le statut "read" côté client, même s'il sera supprimé dans 5s
                    // Cela garantit que A voit que son message a été lu par B
                    const message: LastSentMessage = { 
                      text: parsed.text,
                      soundKey: parsed.soundKey,
                      ts: m.created_at, 
                      id: m.id, 
                      status: parsed.isRead ? 'read' as const : undefined,
                      readAt: parsed.isRead ? Date.now() : undefined
                    };
                    
                    if (CHAT_VERBOSE_LOGS) {
                      console.log(`📥 [CLIENT] Message envoyé récupéré:`, {
                        id: m.id,
                        to_user_id: m.to_user_id,
                        text_preview: text.substring(0, 30),
                        isRead,
                        hasId: !!m.id
                      });
                    }
                    
                    // Purger les vieux messages côté serveur aussi
                    if (!isFreshSentMessage(message)) {
                      droppedStaleServer += 1;
                      return;
                    }
                    
                    // Ajouter le message au tableau pour cet utilisateur
                    // Même si le message est marqué "READ:", on l'ajoute pour que le statut soit synchronisé
                    // Il sera filtré plus tard si le chat n'est pas ouvert (voir purge ligne 2275)
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
                    return true;
                  }

                  if (!msg.readAt) return false;
                  return now - msg.readAt < READ_ANIMATION_MS;
                });
                const readIds = new Set(readMessages.map(m => m.id).filter(Boolean));
                
                // Filtrer les messages serveur si on a déjà marqué localement "lu"
                // MAIS : garder les messages avec "READ:" pour mettre à jour le statut même s'ils sont en cours de suppression
                const filteredServerMessages = serverMessages.filter(m => {
                  // 1. Si on a reçu un broadcast "read" pour ce message, on sait qu'il est lu.
                  // Si le serveur le renvoie sans statut "read" (car pas encore supprimé), on doit l'ignorer ou le forcer à "read".
                  // Ici on l'ignore car on a déjà la version locale "lue" dans readMessages (via readIds).
                  // Si on a purgé readMessages (chat fermé), on ne veut PAS le revoir en "non-lu".
                  if (readSentMessagesRef.current.has(m.id)) {
                      return false;
                  }

                  // Si le message est marqué "READ:" côté serveur, on doit le traiter pour mettre à jour le statut
                  const isReadOnServer = m.text?.startsWith('READ:') || m.message_content?.startsWith('READ:');
                  if (isReadOnServer) {
                    // Ne pas filtrer : on veut mettre à jour le statut "read" même si le message sera supprimé
                    return true;
                  }
                  // Sinon, filtrer si déjà marqué localement "lu" (via readIds, qui est temporaire si chat ouvert)
                  return !readIds.has(m.id);
                });
                if (__DEV__ && readIds.size > 0) {
                  const filteredCount = serverMessages.length - filteredServerMessages.length;
                  if (filteredCount > 0) {
                    // Log removed
                  }
                }
                
                // Cas 2: Messages 'sent' localement mais absents du serveur (temporaires, non lus ou lus récemment)
                // Si un message a un ID mais n'est plus dans le serveur, il a été lu/supprimé.
                
                const unreadMessages = prevMessages.filter(msg => msg.status !== 'read');
                
                const droppedWithIdMessages = unreadMessages.filter(
                  msg => msg.id && !serverMessageIds.has(msg.id)
                );

                if (droppedWithIdMessages.length > 0 && expandedFriendIdRef.current === uid) {
                    // console.log('[CHAT_DEBUG] dropped messages from server:', droppedWithIdMessages.map(m => m.id));
                }

                // Si le chat est ouvert, on considère les messages disparus comme LUS et on les garde
                if (expandedFriendIdRef.current === uid) {
                   droppedWithIdMessages.forEach(msg => {
                     // On le transforme en message lu pour le garder affiché
                     const readMsg = { ...msg, status: 'read' as const, readAt: Date.now() };
                     readMessages.push(readMsg);
                   });
                } else if (droppedWithIdMessages.length > 0) {
                    // Chat fermé : on laisse tomber les messages disparus du serveur (purge)
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
                if (__DEV__ && droppedWithIdMessages.length > 0) {
                  // Log removed
                }

                const dedupedLocalOnlyMessages = localOnlyMessages.filter(localMsg => {
                  const localTime = new Date(localMsg.ts).getTime();
                  const isDuplicate = filteredServerMessages.some(serverMsg => {
                    const serverTime = new Date(serverMsg.ts).getTime();
                    // On vérifie le texte ET le son pour être sûr (le texte peut être identique pour 2 prouts différents)
                    return (
                      serverMsg.text === localMsg.text &&
                      serverMsg.soundKey === localMsg.soundKey &&
                      Math.abs(serverTime - localTime) < 5000
                    );
                  });
                  if (__DEV__ && isDuplicate) {
                    // Log removed
                  }
                  return !isDuplicate;
                });
                
                // Fusionner : messages du serveur + messages locaux uniquement (temporaires, non lus)
                // IMPORTANT : Traiter les messages avec "READ:" pour mettre à jour le statut même s'ils sont en cours de suppression
                const processedServerMessages = filteredServerMessages.map(m => {
                  // Le texte a déjà été nettoyé ligne 2110, donc on vérifie le statut plutôt que le texte
                  // Si le message a déjà status: 'read', c'est qu'il était marqué "READ:" côté serveur
                  if (m.status === 'read') {
                    // S'assurer que readAt est défini
                    return { ...m, readAt: m.readAt || Date.now() };
                  }
                  // Vérifier aussi dans message_content au cas où (fallback)
                  const rawText = m.message_content || m.text || '';
                  const isReadOnServer = rawText.startsWith('READ:');
                  const isKnownRead = m.id && readSentMessagesRef.current.has(m.id);

                  if (isReadOnServer || isKnownRead) {
                    // Marquer comme lu si c'est connu comme tel
                    if (isKnownRead && m.id && !readSentMessagesRef.current.has(m.id)) {
                        readSentMessagesRef.current.add(m.id);
                    }
                    return { 
                        ...m, 
                        status: 'read' as const, 
                        readAt: m.readAt || Date.now(), 
                        text: isReadOnServer ? rawText.slice('READ:'.length) : rawText 
                    };
                  }
                  return m;
                });
                // Fusionner en dédupliquant par ID : privilégier les messages serveur avec status 'read'
                const mergedById = new Map<string, LastSentMessage>();
                
                // 1. Ajouter d'abord les messages serveur (ils ont la source de vérité)
                processedServerMessages.forEach(msg => {
                  if (msg.id) {
                    // Si le message est dans readSentMessagesRef, le marquer comme lu même s'il n'est pas encore marqué READ: côté serveur
                    if (readSentMessagesRef.current.has(msg.id) && msg.status !== 'read') {
                      console.log(`✅ [CLIENT] Message ${msg.id} trouvé dans readSentMessagesRef, marquage comme lu`);
                      mergedById.set(msg.id, { ...msg, status: 'read' as const, readAt: msg.readAt || Date.now() });
                    } else {
                      mergedById.set(msg.id, msg);
                    }
                  } else {
                    // Message sans ID : utiliser le texte comme clé temporaire
                    const key = `temp-${msg.text}-${msg.ts}`;
                    if (!mergedById.has(key)) {
                      mergedById.set(key, msg);
                    }
                  }
                });
                
                // 2. Ajouter les messages lus localement (pour l'animation) seulement s'ils ne sont pas déjà dans mergedById
                // IMPORTANT : Les messages serveur avec status 'read' ont toujours priorité sur les messages locaux
                readMessages.forEach(msg => {
                  if (msg.id) {
                    const existing = mergedById.get(msg.id);
                    // Si le message serveur n'existe pas ou n'est pas encore marqué comme lu, utiliser le message local
                    if (!existing || existing.status !== 'read') {
                      mergedById.set(msg.id, msg);
                    }
                    // Sinon, garder le message serveur qui a déjà status 'read' (priorité)
                  } else if (!msg.id) {
                    // Message sans ID : vérifier s'il existe déjà par texte
                    const key = `temp-${msg.text}-${msg.ts}`;
                    if (!mergedById.has(key)) {
                      mergedById.set(key, msg);
                    }
                  }
                });
                
                // 3. Ajouter les messages locaux uniquement (temporaires, non lus)
                dedupedLocalOnlyMessages.forEach(localMsg => {
                  const now = Date.now();
                  const msgTime = new Date(localMsg.ts).getTime();
                  const age = now - msgTime;
                  
                  // CORRECTION: Si le message local n'a pas d'ID mais qu'un ID correspondant existe dans readSentMessagesRef,
                  // c'est qu'il a été lu par l'autre. On doit le marquer comme lu.
                  if (!localMsg.id && localMsg.text) {
                    // Chercher dans readSentMessagesRef si un message avec ce texte a été lu
                    // (on ne peut pas faire de matching parfait sans ID, mais on peut essayer de matcher par texte + timestamp)
                    const matchingReadId = Array.from(readSentMessagesRef.current).find(id => {
                      // On ne peut pas vraiment matcher sans avoir les messages depuis la DB
                      // Mais on peut au moins vérifier si le message devrait être marqué comme lu
                      return false; // Pas de matching possible sans ID
                    });
                  }
                  
                  // LOGIQUE SNAPCHAT : Gestion des messages locaux selon leur statut et présence sur le serveur
                  if (age < 86400000) { // 24 heures
                    if (localMsg.id) {
                         if (!mergedById.has(localMsg.id)) {
                             // Message local avec ID qui n'est plus sur le serveur
                             // Cela signifie qu'il a été supprimé du serveur (après 5 secondes)
                             
                             const isChatOpen = expandedFriendIdRef.current === uid;
                             
                             if (localMsg.status === 'read') {
                                 // Message lu supprimé du serveur :
                                 // - Si chat ouvert : on garde (pour l'animation)
                                 // - Si chat fermé : on supprime (purge Snapchat)
                                 if (isChatOpen) {
                                     mergedById.set(localMsg.id, localMsg);
                                 }
                                 // Sinon, on ne l'ajoute pas = il sera supprimé
                             } else {
                                 // Message NON lu supprimé du serveur : c'est bizarre
                                 // On le garde par sécurité (persistance Snapchat)
                                 mergedById.set(localMsg.id, localMsg);
                             }
                         } else {
                 // Le message est sur le serveur.
                 // Si local est 'read' mais serveur 'sent', on force 'read' (priorité locale broadcast)
                 const serverMsg = mergedById.get(localMsg.id);
                 if (serverMsg) {
                     const isKnownRead = readSentMessagesRef.current.has(localMsg.id);
                     if (localMsg.status === 'read' || isKnownRead) {
                        if (serverMsg.status !== 'read') {
                            mergedById.set(localMsg.id, { 
                                ...serverMsg, 
                                status: 'read', 
                                readAt: localMsg.readAt || Date.now() 
                            });
                            // S'assurer qu'il est dans le cache
                            readSentMessagesRef.current.add(localMsg.id);
                        }
                     }
                 }
                         }
                    } else if (!localMsg.id) {
                      const key = `temp-${localMsg.text}-${localMsg.ts}`;
                      if (!mergedById.has(key)) {
                        mergedById.set(key, localMsg);
                      }
                    }
                  }
                });
                
                const merged = Array.from(mergedById.values());
                
                // Trier par timestamp de manière stricte et fiable
                if (merged.length > 0) {
                  merged.sort((a, b) => {
                    const timeA = new Date(a.ts || a.created_at || 0).getTime();
                    const timeB = new Date(b.ts || b.created_at || 0).getTime();
                    // Si les timestamps sont égaux ou invalides, utiliser l'ordre d'ajout comme fallback
                    if (timeA === timeB || (!timeA && !timeB)) {
                      // Garder l'ordre relatif : messages reçus avant messages envoyés si même timestamp
                      return 0;
                    }
                    if (!timeA || isNaN(timeA)) return 1; // Messages sans timestamp à la fin
                    if (!timeB || isNaN(timeB)) return -1;
                    return timeA - timeB; // Tri chronologique strict
                  });
                  next[uid] = merged;
                  // Debug logs removed
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

              // LOGIQUE SNAPCHAT : Purge des messages selon leur statut et la présence sur le serveur
              // - Messages non lus : TOUJOURS gardés (persistance même après fermeture)
              // - Messages lus : gardés seulement s'ils sont encore sur le serveur OU si le chat est ouvert
              // - Messages lus supprimés du serveur : supprimés seulement si le chat est fermé
              const activeId = expandedFriendIdRef.current;
              const pruned: LastSentMap = {};
              Object.entries(finalNext).forEach(([uid, arr]) => {
                if (!Array.isArray(arr)) return;
                const kept = arr.filter((msg) => {
                  // Toujours garder les messages non-lus (persistance Snapchat)
                  // Même si le chat est fermé, on VEUT voir les messages envoyés non lus
                  if (msg.status !== 'read') return true;
                  
                  // Messages lus : garder si :
                  // 1. Le chat est ouvert (pour l'animation de "lu")
                  // 2. OU le message est encore sur le serveur (pas encore supprimé après 5 secondes)
                  // Le message sera supprimé seulement s'il n'est plus sur le serveur ET que le chat est fermé
                  if (activeId === uid) {
                    // Chat ouvert : garder les messages lus récents (pour l'animation)
                    return isFreshSentMessage(msg);
                  }
                  
                  // Chat fermé : garder seulement si le message est encore sur le serveur
                  // (c'est-à-dire qu'il a un ID et qu'il est dans serverMessages)
                  // Si le message n'est plus sur le serveur, il sera supprimé par loadData
                  // car il ne sera pas dans serverMessages
                  return true; // On garde temporairement, loadData filtrera ceux qui ne sont plus sur le serveur
                });
                if (kept.length > 0) pruned[uid] = kept;
              });
              updateLastSentIndex(pruned);
              saveLastSentMessagesCache(pruned);
              return pruned;
            });
          }
          if (__DEV__ && sentPendingMessagesResult === null) {
          }
    } catch (e) {
      // En cas d'erreur réseau, avertir l'utilisateur (avec anti-spam)
      console.warn('⚠️ Erreur loadData:', e);
      showOfflineToast();
    } finally { 
      loadDataInFlightRef.current = false;
      setLoading(false); 
      const queued = queuedLoadDataArgsRef.current;
      if (queued) {
        queuedLoadDataArgsRef.current = null;
        setTimeout(() => {
          loadData(queued.hasCacheFromInit, queued.forceLoading, queued.syncContacts);
        }, 150);
      }
    }
  };

  const refreshTriggerRef = useRef(refreshTrigger);
  useEffect(() => {
    if (refreshTrigger === refreshTriggerRef.current) {
      return;
    }
    refreshTriggerRef.current = refreshTrigger;
    loadData(false, false, false);
  }, [refreshTrigger]);

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
              scheduleAlignFriendListTop();
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
            table: 'pending_messages',
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newMessage = payload.new as any;
              
              // Filtrer manuellement ici pour être sûr à 100%
              if (newMessage.to_user_id !== user.id) return;

              const optimisticMessage = {
                ...newMessage,
                isPendingDelete: false,
              } as PendingMessage;

              // Invalidation différée de TanStack Query pour éviter l'écrasement immédiat
              setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['pendingMessages'] });
                queryClient.invalidateQueries({ queryKey: ['friends'] });
              }, 1500);
              
              // Mise à jour manuelle immédiate du cache pour une réactivité < 50ms
              queryClient.setQueryData(['pendingMessages', user.id], (old: any[] = []) => {
                if (old.some(m => m.id === newMessage.id)) return old;
                return [...old, newMessage];
              });

              // Mise à jour immédiate de l'état local utilisé par FriendsList pour l'aperçu.
              setPendingMessages((prev) => {
                if (prev.some((m) => m.id === optimisticMessage.id)) return prev;
                return [...prev, optimisticMessage].sort(
                  (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
              });

              // Mise à jour optimiste du tri pour remonter immédiatement l'ami concerné.
              const now = newMessage.created_at || new Date().toISOString();
              setAppUsers((prev) => {
                const updated = prev.map((friend) =>
                  friend.id === newMessage.from_user_id
                    ? { ...friend, last_interaction_at: now }
                    : friend
                );
                return sortFriends(updated);
              });
              scheduleAlignFriendListTop();

              // Le son est géré nativement (FCM), on n'en joue pas ici pour éviter le doublon.
            } else if (payload.eventType === 'DELETE') {
              // Rechargement TanStack Query instantané
              queryClient.invalidateQueries({ queryKey: ['pendingMessages', user.id] });
              
              // Session gelée : Si le message est supprimé (lu), on ne le retire PAS si le chat est ouvert.
              // On le marque "en sursis" (isPendingDelete) pour l'afficher grisé.
              const deletedId = payload.old.id;
              setPendingMessages((prev) => {
                const msg = prev.find(m => m.id === deletedId);
                const senderId = msg?.from_user_id;
                const isChatOpen = senderId && senderId === expandedFriendIdRef.current;
                if (isChatOpen) {
                  return prev.map(m => (m.id === deletedId ? { ...m, isPendingDelete: true } : m));
                }
                return prev.filter(m => m.id !== deletedId);
              });
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
              const isEncryptedPayload =
                typeof text === 'string' &&
                (text.startsWith('ENCv1:') || text.startsWith('READ:ENCv1:'));
              if (isEncryptedPayload) {
                loadData(false, false, false);
                return;
              }

              if (toUserId && text && id) {
                setLastSentMessages((prev) => {
                  const existingMessages = prev[toUserId] || [];
                  const exists = existingMessages.some(m => m.id === id);
                  if (exists) return prev;

                  const parsed = parseMessageContent(text);
                  const rawText = parsed.text;
                  const replaceIdx = [...existingMessages].reverse().findIndex(
                    m => !m.id && (m.text === rawText || m.text === text)
                  );
                  const idx = replaceIdx === -1 ? -1 : existingMessages.length - 1 - replaceIdx;

                  let nextList: LastSentMessage[];
                  if (idx >= 0) {
                    nextList = [...existingMessages];
                    nextList[idx] = { ...nextList[idx], id, text: rawText, ts, soundKey: parsed.soundKey };
                  } else {
                    nextList = [...existingMessages, { text: rawText, ts, id, soundKey: parsed.soundKey }];
                  }

                  const next = { ...prev, [toUserId]: nextList };
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
              const isEncryptedPayload =
                typeof text === 'string' &&
                (text.startsWith('ENCv1:') || text.startsWith('READ:ENCv1:'));
              if (isEncryptedPayload) {
                loadData(false, false, false);
                return;
              }

              if (text && toUserId) {
                 const parsed = parseMessageContent(text);
                 if (parsed.isRead) {
                   setLastSentMessages((prev) => {
                      const messages = prev[toUserId];
                      if (!Array.isArray(messages)) return prev;

                      const isChatOpen = expandedFriendIdRef.current === toUserId;
                      const readAt = Date.now();
                      const strippedText = parsed.text;

                      // IMPORTANT : Trouver le message par ID uniquement (évite de marquer le mauvais message)
                      // Ne jamais utiliser "dernier non-lu" car cela peut marquer le mauvais message si l'ordre n'est pas correct
                      let matchIndex = messages.findIndex(msg => msg.id === id);
                      // Fallback uniquement si pas d'ID ET texte correspond exactement (plus sûr)
                      if (matchIndex === -1 && id) {
                        // Chercher par texte correspondant uniquement si on a un ID mais qu'il ne matche pas
                        // (cas où le message n'a pas encore d'ID côté client mais en a côté serveur)
                        const textMatch = messages.findIndex(msg => 
                          !msg.id && (msg.text === strippedText || msg.text === text)
                        );
                        if (textMatch !== -1) matchIndex = textMatch;
                      }
                      // Ne PAS utiliser "dernier non-lu" comme fallback : trop risqué pour l'ordre chronologique

                      if (matchIndex === -1) {
                        // Si l'UPDATE arrive pour un ID qu'on ne connaît pas encore,
                        // on force un rafraîchissement global.
                        DeviceEventEmitter.emit('REFRESH_DATA', { source: 'friendslist_update' });
                        return prev;
                      }

                      const updatedMsg = {
                        ...messages[matchIndex],
                        id: messages[matchIndex].id || id,
                        status: 'read' as const,
                        readAt,
                        soundKey: parsed.soundKey || messages[matchIndex].soundKey,
                      };

                      // Déclencher aussi un rafraîchissement global pour être sûr
                      setTimeout(() => DeviceEventEmitter.emit('REFRESH_DATA', { source: 'friendslist_update_timeout' }), 500);

                      if (!isChatOpen) {
                        const kept = messages.filter((_, i) => i !== matchIndex);
                        if (kept.length === 0) {
                          const next = { ...prev };
                          delete next[toUserId];
                          updateLastSentIndex(next);
                          saveLastSentMessagesCache(next);
                          return next;
                        }
                        const next = { ...prev, [toUserId]: kept };
                        updateLastSentIndex(next);
                        saveLastSentMessagesCache(next);
                        return next;
                      }

                      const nextList = [...messages];
                      nextList[matchIndex] = updatedMsg;
                      const next = { ...prev, [toUserId]: nextList };
                      updateLastSentIndex(next);
                      saveLastSentMessagesCache(next);
                      return next;
                   });
                }
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
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.error('❌ [REALTIME] Erreur de connexion au canal Supabase');
          }
        });

      subscriptionRef.current = channel;

      // PRRT! Protocol : à réception de message-read
      if (CHAT_VERBOSE_LOGS) {
        console.log(`📡 [CLIENT] Configuration du canal broadcast pour room-${user.id}`);
      }
      const subscribeBroadcastChannel = () => {
        if (broadcastSubscriptionRef.current) {
          supabase.removeChannel(broadcastSubscriptionRef.current);
          broadcastSubscriptionRef.current = null;
        }
        const channelName = `room-${user.id}`;
        const broadcastChannel = supabase
          .channel(channelName)
          .on('broadcast', { event: 'new-prout' }, (payload) => {
            // 1. Le son est géré nativement (FCM), on s'occupe uniquement de l'UI ici.

            // 2. Forcer le rafraîchissement des messages
            setTimeout(() => {
              console.log('📡 [CLIENT] Timeout reached for new-prout broadcast, invalidating and reloading...');
              queryClient.invalidateQueries({ queryKey: ['pendingMessages'] });
              queryClient.invalidateQueries({ queryKey: ['friends'] });
            }, 1500);
          })
          .on('broadcast', { event: 'message-read' }, (payload) => {
            if (CHAT_VERBOSE_LOGS) {
              console.log(`📨 [CLIENT] Broadcast message-read reçu:`, {
                payload: payload.payload,
                timestamp: new Date().toISOString()
              });
            }
            
            const receiverId = payload.payload?.receiverId;
            const singleId = payload.payload?.id;
            const ids: string[] = Array.isArray(payload.payload?.ids)
              ? payload.payload.ids
              : (singleId ? [singleId] : []);
            
            if (CHAT_VERBOSE_LOGS) {
              console.log(`📨 [CLIENT] IDs extraits du broadcast:`, {
                idsCount: ids.length,
                ids: ids.slice(0, 5),
                receiverId,
                senderId: payload.payload?.senderId
              });
            }
            
            if (ids.length === 0) {
              console.warn(`⚠️ [CLIENT] Broadcast message-read reçu mais aucun ID valide`);
              return;
            }
            
            // Batch: 1 seule mise à jour de state pour tous les IDs (évite "seul le dernier")
            const idsSet = new Set(ids);
            ids.forEach((id) => {
              pendingReadIdsRef.current.add(id);
              readSentMessagesRef.current.add(id); // Mémoriser qu'ils sont lus pour filtrage futur
            });

            if (CHAT_VERBOSE_LOGS) {
              console.log(`📨 [CLIENT] IDs ajoutés à pendingReadIdsRef: ${pendingReadIdsRef.current.size}`);
            }

            setLastSentMessages((prev) => {
              const targetUserId: string | null = receiverId || null;
              if (!targetUserId) {
                console.warn(`⚠️ [CLIENT] Pas de receiverId dans le broadcast, impossible de mettre à jour`);
                return prev;
              }

              const msgs = prev[targetUserId] || [];
              const isChatOpen = expandedFriendIdRef.current === targetUserId;
              if (CHAT_VERBOSE_LOGS) {
                console.log(`📨 [CLIENT] Chat ouvert pour ${targetUserId}: ${isChatOpen}, Messages dans lastSentMessages: ${msgs.length}`);
              }
              
              // CORRECTION : Même si les messages ne sont pas encore dans lastSentMessages (pas encore récupérés depuis la DB),
              // on doit les ajouter au cache readSentMessagesRef pour qu'ils soient marqués comme lus quand ils seront récupérés
              ids.forEach((id) => {
                readSentMessagesRef.current.add(id);
                if (CHAT_VERBOSE_LOGS) console.log(`✅ [CLIENT] ID ${id} ajouté à readSentMessagesRef`);
              });

              if (!Array.isArray(msgs) || msgs.length === 0) {
                if (CHAT_VERBOSE_LOGS) {
                  console.log(`ℹ️ [CLIENT] Aucun message dans lastSentMessages pour ${targetUserId}, mais IDs ajoutés au cache pour traitement futur`);
                }
                // Même sans messages, on retourne prev pour déclencher un re-render qui pourrait déclencher loadData
                return prev;
              }

              let changed = false;

              if (!isChatOpen) {
                if (CHAT_VERBOSE_LOGS) console.log(`📨 [CLIENT] Chat fermé - Suppression des messages lus de lastSentMessages`);
                const kept = msgs.filter((m) => !m.id || !idsSet.has(m.id));
                if (kept.length !== msgs.length) changed = true;
                if (!changed) {
                  if (CHAT_VERBOSE_LOGS) console.log(`ℹ️ [CLIENT] Aucun changement nécessaire (messages déjà supprimés)`);
                  return prev;
                }

                if (CHAT_VERBOSE_LOGS) {
                  console.log(`✅ [CLIENT] Messages supprimés: ${msgs.length - kept.length} sur ${msgs.length}`);
                }
                const next: LastSentMap = { ...prev };
                if (kept.length > 0) next[targetUserId] = kept;
                else delete next[targetUserId];
                updateLastSentIndex(next);
                saveLastSentMessagesCache(next);
                return next;
              }

              if (CHAT_VERBOSE_LOGS) console.log(`📨 [CLIENT] Chat ouvert - Marquage des messages comme lus`);
              const readAt = Date.now();
              const updated = msgs.map((m) => {
                // Matching par ID ou par Texte/Son (fallback si l'ID n'est pas encore arrivé)
                const idMatch = m.id && idsSet.has(m.id);
                const textMatch = !m.id && msgs.length === 1 && ids.length === 1; // Simplifié: si un seul message en attente
                
                if ((idMatch || textMatch) && m.status !== 'read') {
                  changed = true;
                  return { ...m, status: 'read' as const, readAt };
                }
                return m;
              });

              if (!changed) {
                if (CHAT_VERBOSE_LOGS) {
                  console.log(`ℹ️ [CLIENT] Aucun changement nécessaire (messages déjà marqués comme lus ou pas encore dans lastSentMessages)`);
                }
                // Déclencher un rafraîchissement global pour synchroniser
                DeviceEventEmitter.emit('REFRESH_DATA', { source: 'friendslist_update' });
                return prev;
              }
              
              // Déclencher aussi un rafraîchissement global en arrière-plan
              setTimeout(() => DeviceEventEmitter.emit('REFRESH_DATA', { source: 'friendslist_update_timeout' }), 500);
              
              const readCount = updated.filter(m => m.status === 'read').length;
              if (CHAT_VERBOSE_LOGS) {
                console.log(`✅ [CLIENT] Broadcast READ appliqué pour ${targetUserId}, ${readCount} messages marqués comme lus`);
              }
              if (CHAT_VERBOSE_LOGS && __DEV__) console.log('[CHAT_DEBUG] Broadcast READ applied for', targetUserId, 'updated:', readCount);
              const next: LastSentMap = { ...prev, [targetUserId]: updated };
              updateLastSentIndex(next);
              saveLastSentMessagesCache(next);
              return next;
            });

            // Un seul refresh après le batch, MAIS éviter de re-fetcher immédiatement pour ne pas écraser l'état local
            // avec des données serveur potentiellement pas encore à jour (suppression asynchrone).
            // Le broadcast suffit pour l'UI immédiate.
            // loadData(false, false, false); 
          })
          .on('broadcast', { event: 'message-received' }, (payload) => {
            console.log('📡 [CLIENT] Broadcast message-received event triggered:', JSON.stringify(payload));
            const senderId = payload.payload?.from;
            if (senderId) {
              const now = new Date().toISOString();
              const customMessage =
                typeof payload.payload?.customMessage === 'string'
                  ? payload.payload.customMessage.trim()
                  : '';
              const proutKey =
                typeof payload.payload?.proutKey === 'string'
                  ? payload.payload.proutKey
                  : null;

              if (customMessage) {
                console.log('📡 [CLIENT] Injecting optimistic message from broadcast...');
                const optimisticMessage: PendingMessage = {
                  id: `broadcast-${senderId}-${Date.now()}`,
                  from_user_id: senderId,
                  to_user_id: user.id,
                  message_content: `${proutKey ? `[${proutKey}]` : ''}${customMessage}`,
                  created_at: now,
                  isPendingDelete: false,
                };

                setPendingMessages((prev) => {
                  const hasEquivalent = prev.some((msg) => {
                    if (msg.from_user_id !== senderId) return false;
                    if ((msg.message_content || '') !== optimisticMessage.message_content) return false;
                    return Math.abs(new Date(msg.created_at).getTime() - new Date(now).getTime()) < 5000;
                  });
                  if (hasEquivalent) {
                    console.log('📡 [CLIENT] Equivalent optimistic message from broadcast already exists.');
                    return prev;
                  }
                  console.log('📡 [CLIENT] Added optimistic message from broadcast to state.');
                  return [...prev, optimisticMessage].sort(
                    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                  );
                });
              } else {
                 console.log('📡 [CLIENT] Broadcast missing customMessage, skipping optimistic injection.');
              }

              setAppUsers((prev) => {
                const updated = prev.map((friend) =>
                  friend.id === senderId ? { ...friend, last_interaction_at: now } : friend
                );
                return sortFriends(updated);
              });
            } else {
               console.log('📡 [CLIENT] Broadcast missing senderId.');
            }
            
            setTimeout(() => {
              console.log('📡 [CLIENT] Timeout reached for message-received broadcast, invalidating and reloading...');
              queryClient.invalidateQueries({ queryKey: ['pendingMessages'] });
              queryClient.invalidateQueries({ queryKey: ['friends'] });
            }, 1500);
          })
          .subscribe((status) => {
            if (CHAT_VERBOSE_LOGS) console.log(`📡 [CLIENT] Canal broadcast subscription status: ${status} pour ${channelName}`);
            if (status === 'SUBSCRIBED') {
              broadcastRetryAttemptsRef.current = 0;
              if (broadcastRetryTimeoutRef.current) {
                clearTimeout(broadcastRetryTimeoutRef.current);
                broadcastRetryTimeoutRef.current = null;
              }
              if (CHAT_VERBOSE_LOGS) console.log(`✅ [CLIENT] Canal broadcast souscrit avec succès pour ${channelName}`);
              return;
            }
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              const attempt = ++broadcastRetryAttemptsRef.current;
              const MAX_RETRY_ATTEMPTS = 5;
              if (attempt > MAX_RETRY_ATTEMPTS) {
                console.warn(`⚠️ [CLIENT] Canal broadcast ${status} pour ${channelName} - Arrêt après ${MAX_RETRY_ATTEMPTS} tentatives. Le polling prendra le relais.`);
                return;
              }
              const retryDelayMs = Math.min(30000, 1000 * Math.pow(2, Math.max(0, attempt - 1)));
              console.warn(`⚠️ [CLIENT] Canal broadcast ${status} pour ${channelName} (tentative ${attempt}/${MAX_RETRY_ATTEMPTS}). Retry dans ${retryDelayMs}ms.`);
              if (broadcastRetryTimeoutRef.current) {
                clearTimeout(broadcastRetryTimeoutRef.current);
              }
              broadcastRetryTimeoutRef.current = setTimeout(() => {
                if (broadcastSubscriptionRef.current === broadcastChannel) {
                  supabase.removeChannel(broadcastChannel);
                  broadcastSubscriptionRef.current = null;
                }
                subscribeBroadcastChannel();
              }, retryDelayMs) as unknown as NodeJS.Timeout;
            }
          });
        broadcastSubscriptionRef.current = broadcastChannel;
      };
      subscribeBroadcastChannel();

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

  const isUuid = (value?: string | null) =>
    !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  const submitReport = useCallback(
    async (reason: ReportReason, reportTarget: ReportableMessage) => {
      if (!currentUserId) return;
      try {
        const { error } = await supabase.from('reports').insert({
          reporter_user_id: currentUserId,
          reported_user_id: reportTarget.senderId,
          message_id: isUuid(reportTarget.sourceMessageId || undefined) ? reportTarget.sourceMessageId : null,
          message_created_at: reportTarget.createdAt ?? null,
          reason,
        });

        if (error) {
          console.error('❌ Erreur signalement:', error);
          Alert.alert(i18n.t('error'), i18n.t('report_submit_error'));
          return;
        }

        Alert.alert(i18n.t('report_submit_success_title'), i18n.t('report_submit_success_body'));
      } catch (error) {
        console.error('❌ Erreur signalement:', error);
        Alert.alert(i18n.t('error'), i18n.t('report_submit_error'));
      }
    },
    [currentUserId]
  );

  const openReportReasonSheet = useCallback(
    (reportTarget: ReportableMessage) => {
      if (Platform.OS === 'android') {
        if (reportReasonModalEnableTimeoutRef.current) {
          clearTimeout(reportReasonModalEnableTimeoutRef.current);
          reportReasonModalEnableTimeoutRef.current = null;
        }
        setReportReasonModalReady(false);
        setPendingReportTarget(reportTarget);
        setReportReasonModalVisible(true);
        return;
      }
      Alert.alert(
        i18n.t('report_message_title'),
        i18n.t('report_message_reason_prompt'),
        [
          { text: i18n.t('report_reason_spam'), onPress: () => submitReport('spam', reportTarget) },
          { text: i18n.t('report_reason_harassment'), onPress: () => submitReport('harassment', reportTarget) },
          { text: i18n.t('report_reason_hate_speech'), onPress: () => submitReport('hate_speech', reportTarget) },
          { text: i18n.t('report_reason_explicit_content'), onPress: () => submitReport('explicit_content', reportTarget) },
          { text: i18n.t('report_reason_other'), onPress: () => submitReport('other', reportTarget) },
          { text: i18n.t('cancel'), style: 'cancel' },
        ]
      );
    },
    [submitReport]
  );

  const closeReportReasonModal = useCallback(() => {
    if (reportReasonModalEnableTimeoutRef.current) {
      clearTimeout(reportReasonModalEnableTimeoutRef.current);
      reportReasonModalEnableTimeoutRef.current = null;
    }
    setReportReasonModalReady(false);
    setReportReasonModalVisible(false);
    setPendingReportTarget(null);
  }, []);

  const handleAndroidReportReason = useCallback(
    (reason: ReportReason) => {
      if (!reportReasonModalReady) return;
      const reportTarget = pendingReportTarget;
      closeReportReasonModal();
      if (!reportTarget) return;
      void submitReport(reason, reportTarget);
    },
    [closeReportReasonModal, pendingReportTarget, reportReasonModalReady, submitReport]
  );

  useEffect(() => {
    return () => {
      if (reportReasonModalEnableTimeoutRef.current) {
        clearTimeout(reportReasonModalEnableTimeoutRef.current);
        reportReasonModalEnableTimeoutRef.current = null;
      }
    };
  }, []);

  const handleDeleteFriend = async (friend: any) => {
    if (!currentUserId) return;

    Alert.alert(
      i18n.t('block_user_confirm_title'),
      i18n.t('block_user_confirm_body', { pseudo: friend.pseudo }),
      [
        {
          text: i18n.t('cancel'),
          style: 'cancel',
        },
        {
          text: i18n.t('block_user'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error: blockError } = await supabase
                .from('blocked_users')
                .upsert(
                  {
                    blocker_id: currentUserId,
                    blocked_user_id: friend.id,
                  },
                  { onConflict: 'blocker_id,blocked_user_id' }
                );

              if (blockError) {
                console.error('❌ Erreur blocage:', blockError);
                Alert.alert(i18n.t('error'), 'Impossible de bloquer cet utilisateur.');
                return;
              }

              // Supprime les relations d'amitié dans les deux sens.
              await supabase
                .from('friends')
                .delete()
                .eq('user_id', currentUserId)
                .eq('friend_id', friend.id);

              await supabase
                .from('friends')
                .delete()
                .eq('user_id', friend.id)
                .eq('friend_id', currentUserId);

              const nextBlocked = [...new Set([...blockedUserIds, friend.id])];
              setBlockedUserIds(nextBlocked);
              blockedUserIdsRef.current = new Set(nextBlocked);
              await AsyncStorage.setItem(CACHE_KEY_BLOCKED_USERS, JSON.stringify(nextBlocked));

              setAppUsers(prev => prev.filter(u => u.id !== friend.id));
              setPendingMessages(prev => prev.filter(m => m.from_user_id !== friend.id && m.to_user_id !== friend.id));
              setUnreadCache(prev => {
                const copy = { ...prev };
                delete copy[friend.id];
                return copy;
              });
              setLastSentMessages(prev => {
                const copy = { ...prev };
                delete copy[friend.id];
                return copy;
              });

              if (expandedFriendIdRef.current === friend.id) {
                setExpandedFriendId(null);
              }

              showToast(i18n.t('user_blocked_toast', { pseudo: friend.pseudo }));
            } catch (error) {
              console.error('Erreur lors du blocage:', error);
              Alert.alert(i18n.t('error'), 'Impossible de bloquer cet utilisateur.');
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
    if (isModalTransitionActive()) return;
    if (friendSoundModalVisible || isFirstFriendlistOnboardingVisible) return;
    markModalTransition();
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
      keyboardVisibleSV.value = true;
      // Fallback léger: seulement si la valeur worklet n'est pas encore montée.
      const eventHeight = Math.max(0, Number(event?.endCoordinates?.height || 0));
      if (eventHeight > 0 && keyboardBottomOffsetSV.value <= 0) {
        keyboardHeightSV.value = eventHeight;
        keyboardBottomOffsetSV.value = eventHeight;
      }
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
      keyboardVisibleSV.value = false;
      keyboardHeightSV.value = 0;
      keyboardBottomOffsetSV.value = 0;
      // Ne pas cacher la modale ici : Samsung peut fermer le clavier brièvement
    };

    // iOS: keyboardDidShow donne une mesure finale plus fiable (évite le sous-décalage sur XS).
    // Android: keyboardDidShow reste le plus sûr pour le layout.
    const showEvent = 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const frameEvent = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : null;
    
    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    const subFrame = frameEvent ? Keyboard.addListener(frameEvent, onShow) : null;
    
    return () => {
      subShow.remove();
      subHide.remove();
      subFrame?.remove();
    };
  }, [expandedFriendId, appUsers]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (keyboardVisible) return;
    if (!pendingChatSpecificSoundListCategory) return;
    if (!expandedFriendId) {
      setPendingChatSpecificSoundListCategory(null);
      return;
    }

    const t = setTimeout(() => {
      setChatSpecificSoundListCategory(pendingChatSpecificSoundListCategory);
      setPendingChatSpecificSoundListCategory(null);
    }, 40);

    return () => clearTimeout(t);
  }, [expandedFriendId, keyboardVisible, pendingChatSpecificSoundListCategory]);

  useEffect(() => {
    if (expandedFriendId) {
      lastStickyOpenAtRef.current = Date.now();
      refocusOnHideAttemptedRef.current = false;
      refocusOnBlurAttemptedRef.current = false;
      setIsChatSoundPickerVisible(false);
      // A l'ouverture du chat : pas d’icône catégorie active ; défaut proot pour les envois sans son listé.
      const ambient = getDefaultSoundCategoryForFirstLaunch() as ChatMessageSoundChoice;
      setChatMessageSoundChoice(ambient);
      AsyncStorage.setItem(CHAT_MESSAGE_SOUND_CHOICE_KEY, ambient).catch(() => {});
    } else {
      lastStickyOpenAtRef.current = null;
      setIsChatSoundPickerVisible(false);
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
    if (isModalTransitionActive()) return;
    if (friendSoundModalVisible || identityModalVisible || isFirstFriendlistOnboardingVisible || isFirstChatModalVisible) return;

    const now = Date.now();
    if (now - lastPressTime.current < 500) return;
    lastPressTime.current = now;

    Keyboard.dismiss();
    if (searchQuery.trim()) {
      onSearchQueryChange?.('');
      onSearchChange?.(false);
    }
    safePush(
      router,
      {
        pathname: '/chat',
        params: {
          friendId: friend.id,
          pseudo: friend.pseudo || '',
        },
      },
      { skipInitialCheck: false }
    );
  };

  const handleSendProut = async (
    recipient: any,
    options?: { forcedCustomMessage?: string; forcedSoundKey?: string }
  ) => {
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
      const forcedCustomMessage = (options?.forcedCustomMessage || '').trim().slice(0, 140);
      const customMessage = forcedCustomMessage || (messageDrafts[recipient.id] || '').trim().slice(0, 140);
      const isChatTextMessage = customMessage.length > 0;
      const pendingChatSoundKey = pendingChatSoundKeyByFriend[recipient.id];

      // Override chat uniquement : trll / bzzz / mute
      let randomKey: string;
      let isSilentMessage = false;
      if (options?.forcedSoundKey) {
        randomKey = options.forcedSoundKey;
      } else if (isChatTextMessage) {
        if (isChatMuteEnabled) {
          // En chat, le mute explicite doit toujours l'emporter,
          // même si un son one-shot a été sélectionné.
          randomKey = 'mute';
          isSilentMessage = true;
        } else if (pendingChatSoundKey && SOUND_ASSETS[pendingChatSoundKey]) {
          // Son spécifique sélectionné en appui long (one-shot).
          randomKey = pendingChatSoundKey;
        } else {
          const candidates = SOUND_KEYS_BY_CATEGORY[chatMessageSoundChoice] || SOUND_KEYS_BY_CATEGORY.trll;
          const noRepeat = pickRandomWithoutImmediateRepeat(candidates, lastRandomSoundByFriendRef.current[recipient.id]);
          randomKey = noRepeat || pickRandom(candidates);
          lastRandomSoundByFriendRef.current[recipient.id] = randomKey;
        }
      } else {
        const forcedFriendSoundKey = friendSoundKeyByFriend[recipient.id];
        if (forcedFriendSoundKey && SOUND_ASSETS[forcedFriendSoundKey]) {
          randomKey = forcedFriendSoundKey;
          // Son spécifique = one-shot : on le consomme pour cet envoi uniquement.
          setFriendSoundKeyByFriend((prev) => {
            if (!prev[recipient.id]) return prev;
            const { [recipient.id]: _removed, ...rest } = prev;
            return rest;
          });
        } else {
        const friendCategory = friendSoundCategoryByFriend[recipient.id];
        const selectedCategory = friendCategory || await getSelectedSoundCategory();
        const categoryKeys = SOUND_KEYS_BY_CATEGORY[selectedCategory];
        const fallbackKeys = SOUND_KEYS_BY_CATEGORY[DIRECT_SEND_FALLBACK_CATEGORY] || SOUND_KEYS_BY_CATEGORY.trll;
        const candidates = categoryKeys || fallbackKeys;
        const noRepeat = pickRandomWithoutImmediateRepeat(candidates, lastRandomSoundByFriendRef.current[recipient.id]);
        randomKey = noRepeat || pickRandom(candidates);
        lastRandomSoundByFriendRef.current[recipient.id] = randomKey;
        }
      }

      // Feedback immédiat côté expéditeur
      const proutName = isSilentMessage ? 'Silencieux' : getDisplaySoundLabel(randomKey);
      showToast(`${proutName} !`);
      if (onProutSent) {
        onProutSent();
      }
      triggerOutgoingMessageHaptic();

      // Jouer localement (si pas silencieux)
      if (!isSilentMessage && !isSilentMode) {
        playSound(randomKey);
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
      if (CHAT_VERBOSE_LOGS) console.log(`📤 [CLIENT] Envoi message via backend pour ${recipient.id}, customMessage: ${customMessage ? 'OUI' : 'NON'}`);
      // 🚀 ENVOI OPTIMISTE via TanStack Query Mutation
      sendProutMutation.mutate({
        recipientToken: fcmToken,
        senderPseudo: senderPseudo,
        proutKey: randomKey,
        platform: targetPlatform || 'android',
        receiverId: recipient.id, // Pour le signal direct
        extraData: { 
          customMessage,
          senderId: user.id,
          receiverId: recipient.id,
        },
      });

      if (CHAT_VERBOSE_LOGS) console.log(`✅ [CLIENT] Message envoyé via backend, attente de la création dans pending_messages...`);
      
      // Mise à jour optimiste locale immédiate : mettre à jour last_interaction_at localement
      // pour que le tri soit instantané, puis recharger depuis Supabase pour la synchronisation
      const now = new Date().toISOString();
      setAppUsers(prevUsers => {
        const updatedUsers = prevUsers.map(friend => 
          friend.id === recipient.id 
            ? { ...friend, last_interaction_at: now }
            : friend
        );
        const sorted = sortFriends(updatedUsers);
        
        // Stabilisation : recaler sur le premier élément après réorganisation (iOS & Android)
        scheduleAlignFriendListTop(100);
        
        return sorted;
      });
      if (customMessage) {
        if (CHAT_VERBOSE_LOGS) console.log(`📤 [CLIENT] Ajout message envoyé à lastSentMessages (sans ID pour l'instant) pour ${recipient.id}`);
        setLastSentMessages(prev => {
          const existingMessages = prev[recipient.id] || [];
          
          // DÉDUPLICATION : Vérifier si ce message (même texte, même son) n'est pas déjà présent
          // (cas où le broadcast INSERT arrive avant que l'état local ne soit mis à jour)
          const nowTime = new Date(now).getTime();
          const isDuplicate = existingMessages.some(m => {
             const mTime = new Date(m.ts).getTime();
             return m.text === customMessage && m.soundKey === randomKey && Math.abs(nowTime - mTime) < 5000;
          });
          
          if (isDuplicate) {
            if (CHAT_VERBOSE_LOGS) console.log(`📤 [CLIENT] Message déjà présent (doublon ignoré) pour ${recipient.id}`);
            return prev;
          }

          // Ajouter 1ms au timestamp pour garantir que le message de A apparaît après les messages de B
          const messageTs = new Date(nowTime + 1).toISOString();
          const newMessage: LastSentMessage = { text: customMessage, ts: messageTs, soundKey: randomKey };
          // Ajouter le nouveau message au tableau (accumulation)
          const next = { 
            ...prev, 
            [recipient.id]: [...existingMessages, newMessage] 
          };
          lastSentSetAtRef.current = Date.now();
          saveLastSentMessagesCache(next);
          if (CHAT_VERBOSE_LOGS) console.log(`📤 [CLIENT] Message envoyé ajouté (total: ${next[recipient.id]?.length || 0} messages pour ${recipient.id})`);
          return next;
        });
      }
      
      // Le backend met à jour last_interaction_at pour les deux relations (A→B et B→A)
      // Recharger les données depuis Supabase pour synchroniser avec le backend
      // IMPORTANT : Attendre un peu pour que le message soit créé dans pending_messages avant de charger
      if (CHAT_VERBOSE_LOGS) console.log(`🔄 [CLIENT] Émission REFRESH_DATA après envoi du message...`);
      setTimeout(() => {
        if (CHAT_VERBOSE_LOGS) console.log(`🔄 [CLIENT] REFRESH_DATA émis après délai de 500ms`);
        DeviceEventEmitter.emit('REFRESH_DATA', { source: 'friendslist_update' });
      }, 500);

      // Nettoyer le brouillon sans fermer le sticky
      if (!forcedCustomMessage) {
        setMessageDrafts(prev => ({ ...prev, [recipient.id]: '' }));
      }
      // Le son spécifique de chat est consommé pour un seul envoi.
      setPendingChatSoundKeyByFriend((prev) => {
        if (!prev[recipient.id]) return prev;
        const next = { ...prev };
        delete next[recipient.id];
        return next;
      });
      // Revenir au défaut proot : aucune catégorie « sélectionnée » visuellement pour le prochain message.
      const ambientAfterSend = getDefaultSoundCategoryForFirstLaunch() as ChatMessageSoundChoice;
      setChatMessageSoundChoice(ambientAfterSend);
      AsyncStorage.setItem(CHAT_MESSAGE_SOUND_CHOICE_KEY, ambientAfterSend).catch(() => {});
      // Si A répond, PRRT! Protocol v2 : NE PAS FAIRE DISPARAÎTRE les messages de B tant que le chat est ouvert.
      // Le code précédent qui faisait un fade-out + clear cache est SUPPRIMÉ.
      // Les messages resteront visibles (soit via pendingMessages soit via keptReadMessagesRef)
      // jusqu'à ce que A ferme le chat.

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
    // Toujours afficher le contenu dès qu'un chat est actif.
    // Évite un état "modale visible mais contenu masqué" qui bloque la liste.
    setIsModalContentVisible(true);
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
    const keyboardOffset = keyboardVisibleSV.value ? Math.max(0, keyboardHeightSV.value) : 0;
    const availableHeight = SCREEN_HEIGHT - CHAT_MODAL_TOP_SAFE_MARGIN - keyboardOffset - 140;

    return {
      maxHeight: Math.max(220, availableHeight),
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
    const activeMessagesToShow = Array.from(mergedMap.values()) as PendingMessage[];
    
    const mySentMessages = (lastSentMessages[displayFriend.id] || []);

        // Fusion et tri
    if (__DEV__ && displayFriend) {
        // console.log('[CHAT_DEBUG] Rendering sticky content for', displayFriend.pseudo, 'sent:', mySentMessages.length, 'received:', activeMessagesToShow.length);
    }
    const allMessages = [
        ...activeMessagesToShow.map((m, idx) => {
            const parsed = parseMessageContent(m.message_content);
            return {
                id: m.id || `received-${idx}-${m.created_at}`,
                sourceMessageId: m.id || null,
                text: parsed.text,
                soundKey: parsed.soundKey,
                ts: m.created_at,
                isMe: false,
                senderId: displayFriend.id,
                createdAt: m.created_at,
                // CORRECTION: Les reçus ne doivent JAMAIS être grisés (même si "READ:" est présent).
                // Le "READ:" sur un reçu signifie juste que JE l'ai lu, ça ne doit pas affecter l'affichage.
                // On grise uniquement si pending delete (en train de disparaître).
                dimmed: !!m.isPendingDelete, 
                original: undefined
            };
        }),
        ...(Array.isArray(mySentMessages) ? mySentMessages.map((msg, idx) => ({
            id: msg.id || `temp-sent-${displayFriend.id}-${idx}-${msg.ts || Date.now()}`,
            text: msg.text,
            soundKey: msg.soundKey,
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
        // Tri chronologique strict : utiliser le timestamp uniquement
        // Si timestamps égaux : garder l'ordre d'ajout (pas de réorganisation arbitraire)
        if (timeA === timeB && timeA > 0) return 0;
        // Si timestamp manquant : placer à la fin (mais garder l'ordre relatif entre eux)
        if (timeA === 0 && timeB === 0) return 0;
        if (timeA === 0) return 1;
        if (timeB === 0) return -1;
        // Tri chronologique strict : plus ancien = avant, plus récent = après
        return timeA - timeB;
    });

    // Liste de sons ouverte (ou en attente Android) : la catégorie affichée = long press initial ou changée au tap.
    const chatListCategoryActive =
      chatSpecificSoundListCategory ?? pendingChatSpecificSoundListCategory ?? null;
    const shouldShowChatSoundPicker =
      isChatSoundPickerVisible || chatListCategoryActive != null;
    const chatSoundListOpen = chatListCategoryActive != null;
    const chatCategoryIconInactive = (cat: ChatMessageSoundChoice) =>
      !chatSoundListOpen || chatListCategoryActive !== cat;

    return (
      <View style={styles.stickyContentLayout}>
        <TouchableOpacity 
          style={styles.stickyHeader} 
          onPress={() => handlePressHeaderRef.current()}
          activeOpacity={0.9}
        >
           <Text style={styles.stickyPseudo}>
             {i18n.t('sticky_chat_with', { pseudo: displayFriend.pseudo })}
           </Text>
           <View style={styles.stickyHeaderActions}>
             <TouchableOpacity onPress={toggleChatMute} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}} style={{ marginRight: 12 }}>
               <Ionicons
                 name={isChatMuteEnabled ? 'volume-mute' : 'volume-medium'}
                 size={28}
                 color="#604a3e"
                 style={!isChatMuteEnabled ? { opacity: 0.4 } : undefined}
               />
             </TouchableOpacity>
             <TouchableOpacity onPress={() => handlePressHeaderRef.current()} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
               <Ionicons name="close-circle" size={24} color="#604a3e" />
             </TouchableOpacity>
           </View>
        </TouchableOpacity>

        {isFirstChatModalVisible && (
          <View style={[styles.firstFooterModalCard, styles.chatOnboardingInlineCard]}>
            <ScrollView
              style={styles.chatOnboardingScroll}
              contentContainerStyle={styles.chatOnboardingScrollContent}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.firstFooterModalTitleRow}>
                <Text style={styles.firstFooterModalTitleText}>{i18n.t('tuto_chat_title')}</Text>
              </View>
              <View style={styles.firstFooterModalFeatureRow}>
                <View style={styles.chatOnboardingIconSlot}>
                  <Image
                    source={require('../assets/images/proothail.png')}
                    style={styles.chatOnboardingProothailImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.firstFooterModalFeatureText}>
                  {i18n.t('chat_onboarding_choose_specific_sound')}
                </Text>
              </View>
              <View style={[styles.firstFooterModalFeatureRow, { marginTop: 12 }]}>
                <Ionicons name="volume-mute" size={22} color="#604a3e" />
                <Text style={styles.firstFooterModalFeatureText}>
                  {i18n.t('chat_onboarding_mute')}
                </Text>
              </View>
              <View style={[styles.firstFooterModalFeatureRow, { marginTop: 12 }]}>
                <Ionicons name="flag-outline" size={22} color="#604a3e" />
                <Text style={styles.firstFooterModalFeatureText}>
                  {i18n.t('chat_onboarding_report_conversation')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.firstFooterModalOkButton, { marginTop: 20 }]}
                onPress={closeFirstChatModal}
                activeOpacity={0.85}
              >
                <Text style={styles.firstFooterModalOkText}>{i18n.t('ok')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {Platform.OS === 'android' ? (
          <Animated.ScrollView
            ref={stickyScrollViewAnimatedRef}
            style={[styles.stickyMessages, stickyMessagesAnimatedStyle]}
            contentContainerStyle={styles.stickyMessagesContent}
            onContentSizeChange={() => stickyScrollViewAnimatedRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="always"
            onTouchStart={closeChatSpecificSoundList}
          >
            {allMessages.map((msg) => (
              msg.isMe ? (
                <SentMessageStatus key={msg.id} message={msg.original!} />
              ) : (
                <ReceivedMessageFade
                  key={msg.id}
                  message={{ id: msg.id, text: msg.text, senderId: (msg as any).senderId, sourceMessageId: (msg as any).sourceMessageId, createdAt: (msg as any).createdAt }}
                  soundKey={msg.soundKey}
                  dimmed={(msg as any).dimmed}
                  shouldFadeOut={fadingOutReceivedMessages.has(msg.id)}
                  onLongPressReport={openReportReasonSheet}
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
            contentContainerStyle={styles.stickyMessagesContent}
            onContentSizeChange={() => stickyScrollViewRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="always"
            onTouchStart={closeChatSpecificSoundList}
          >
            {allMessages.map((msg) => (
              msg.isMe ? (
                <SentMessageStatus key={msg.id} message={msg.original!} />
              ) : (
                <ReceivedMessageFade
                  key={msg.id}
                  message={{ id: msg.id, text: msg.text, senderId: (msg as any).senderId, sourceMessageId: (msg as any).sourceMessageId, createdAt: (msg as any).createdAt }}
                  soundKey={msg.soundKey}
                  dimmed={(msg as any).dimmed}
                  shouldFadeOut={fadingOutReceivedMessages.has(msg.id)}
                  onLongPressReport={openReportReasonSheet}
                  onFadeComplete={() => {
                    // L'animation est terminée, le message sera supprimé par le setTimeout dans handleSendProut
                  }}
                />
              )
            ))}
          </ScrollView>
        )}

        {!!pendingChatSoundKeyByFriend[displayFriend.id] && (
          <TouchableOpacity
            style={styles.chatPendingSoundTag}
            onPress={() => {
              setPendingChatSoundKeyByFriend((prev) => {
                const { [displayFriend.id]: _removed, ...rest } = prev;
                return rest;
              });
              const ambient = getDefaultSoundCategoryForFirstLaunch() as ChatMessageSoundChoice;
              setChatMessageSoundChoice(ambient);
              AsyncStorage.setItem(CHAT_MESSAGE_SOUND_CHOICE_KEY, ambient).catch(() => {});
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.chatPendingSoundTagText}>
              {getDisplaySoundLabel(pendingChatSoundKeyByFriend[displayFriend.id])}
            </Text>
            <Ionicons name="close-circle" size={14} color="#604a3e" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        )}
        <View style={[styles.messageInputRow, { alignItems: 'flex-end', marginBottom: 5 }]}>
          <View style={styles.chatMessageInputLeftChunk}>
            <TouchableOpacity
              style={[styles.chatSoundPickerEntryThumbTouchable, styles.chatSoundPickerEntryThumbFlushLeft]}
              onPress={openChatSoundPicker}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('chat_sound_picker_inline_button')}
              hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
            >
              <Image
                source={CHAT_PROOTHAIL_THUMB}
                style={styles.chatSoundPickerThumbImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
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
              setIsChatSoundPickerVisible(false);
              if (pendingChatSpecificSoundListCategory) {
                setPendingChatSpecificSoundListCategory(null);
              }
              if (chatSpecificSoundListCategory) {
                setChatSpecificSoundListCategory(null);
              }
            }}
            // Plus de onBlur agressif qui ferme le clavier sur Samsung
            onLayout={() => {}}
            {...oldAndroidInputProps}
          />
          </View>
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
        {shouldShowChatSoundPicker && (
        <View
          style={[
            styles.chatSoundZone,
            !chatSoundListOpen && {
              borderBottomWidth: 0,
            },
          ]}
        >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chatSoundChoiceScroller}
          contentContainerStyle={styles.chatSoundChoiceRow}
          keyboardShouldPersistTaps="always"
        >
          {Platform.OS === 'android' && (
            <Pressable
              style={styles.chatSoundChoiceButton}
              onPress={() => switchChatSoundListCategoryIfOpen('toot')}
            >
              <Image
                source={TOOT_LOGO_IMAGE}
                style={[
                  styles.chatSoundChoiceImage,
                  TOOT_CHAT_ICON_SIZE,
                  chatCategoryIconInactive('toot') && styles.chatSoundChoiceImageInactive,
                ]}
                resizeMode="contain"
              />
            </Pressable>
          )}
          <Pressable
            style={styles.chatSoundChoiceButton}
            onPress={() => switchChatSoundListCategoryIfOpen('mood')}
          >
            <Image
              source={require('../assets/images/mood.png')}
              style={[
                styles.chatSoundChoiceImage,
                chatCategoryIconInactive('mood') && styles.chatSoundChoiceImageInactive,
              ]}
              resizeMode="contain"
            />
          </Pressable>
          <Pressable
            style={styles.chatSoundChoiceButton}
            onPress={() => switchChatSoundListCategoryIfOpen('pop')}
          >
            <Image
              source={require('../assets/images/pop.png')}
              style={[
                styles.chatSoundChoiceImage,
                { width: 62, height: 42 },
                chatCategoryIconInactive('pop') && styles.chatSoundChoiceImageInactive,
              ]}
              resizeMode="contain"
            />
          </Pressable>
          {Platform.OS !== 'android' && (
            <Pressable
              style={styles.chatSoundChoiceButton}
              onPress={() => switchChatSoundListCategoryIfOpen('toot')}
            >
              <Image
                source={TOOT_LOGO_IMAGE}
                style={[
                  styles.chatSoundChoiceImage,
                  TOOT_CHAT_ICON_SIZE,
                  chatCategoryIconInactive('toot') && styles.chatSoundChoiceImageInactive,
                ]}
                resizeMode="contain"
              />
            </Pressable>
          )}
          <Pressable
            style={styles.chatSoundChoiceButton}
            onPress={() => switchChatSoundListCategoryIfOpen('trll')}
          >
            <Image
              source={require('../assets/images/tweet.png')}
              style={[
                styles.chatSoundChoiceImage,
                chatCategoryIconInactive('trll') && styles.chatSoundChoiceImageInactive,
              ]}
              resizeMode="contain"
            />
          </Pressable>
          <Pressable
            style={styles.chatSoundChoiceButton}
            onPress={() => switchChatSoundListCategoryIfOpen('bzzz')}
          >
            <Image
              source={require('../assets/images/buzz.png')}
              style={[
                styles.chatSoundChoiceImage,
                chatCategoryIconInactive('bzzz') && styles.chatSoundChoiceImageInactive,
              ]}
              resizeMode="contain"
            />
          </Pressable>
        </ScrollView>
        {!!chatSpecificSoundListCategory && (
          <View>
          <View style={styles.chatSoundZoneSeparator} />
          <ScrollView
            style={[styles.chatSpecificSoundList, { height: CHAT_SPECIFIC_MIN_HEIGHT }]}
            contentContainerStyle={styles.chatSpecificSoundListContent}
            showsVerticalScrollIndicator
          >
            {(chatSpecificSoundListCategory === 'trll'
              ? PICKUP_TRLL_KEYS
              : chatSpecificSoundListCategory === 'toot'
              ? PICKUP_TOOT_KEYS
              : chatSpecificSoundListCategory === 'bzzz'
              ? PICKUP_BZZZ_KEYS
              : chatSpecificSoundListCategory === 'pop'
              ? PICKUP_POP_KEYS
              : PICKUP_MOOD_KEYS).map((soundKey) => (
              <TouchableOpacity
                key={soundKey}
                style={[
                  styles.chatSpecificSoundButton,
                  pendingChatSoundKeyByFriend[displayFriend.id] === soundKey && styles.chatSpecificSoundButtonActive,
                ]}
                onPress={() => handleSelectChatSpecificSound(soundKey)}
                activeOpacity={0.85}
              >
                <Text style={styles.chatSpecificSoundButtonText}>{getDisplaySoundLabel(soundKey)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          </View>
        )}
        </View>
        )}
      </View>
    );
  }, [
    displayFriendId,
    pendingMessages,
    unreadCache,
    lastSentMessages,
    displayDraft,
    isChatMuteEnabled,
    isChatSoundPickerVisible,
    chatSpecificSoundListCategory,
    pendingChatSpecificSoundListCategory,
    pendingChatSoundKeyByFriend,
    sendingFriendId,
    displayBackgroundColor,
    fadingOutReceivedMessages,
    openChatSpecificSoundList,
    openChatSoundPicker,
    switchChatSoundListCategoryIfOpen,
    closeChatSpecificSoundList,
    handleSelectChatSpecificSound,
    toggleChatMute,
    openReportReasonSheet,
    isFirstChatModalVisible,
    closeFirstChatModal,
    // PAS de keyboardVisible ici !
    // PAS de handlePressHeader ici ! (on utilise la Ref)
  ]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (__DEV__) console.log('🔄 [FriendsList] Refresh manuel...');
    try {
      await Promise.all([
        refetchMessages(),
        refetchSentMessages(),
        loadData(false, false, true) // loadData est maintenant "silent" (pas de flash)
      ]);
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


  const lastValidUsersRef = useRef<any[]>([]);
  
  // Mémoriser la dernière liste valide pour éviter le flash blanc
  useEffect(() => {
    if (appUsers && appUsers.length > 0) {
      lastValidUsersRef.current = appUsers;
    }
  }, [appUsers]);

  const filteredUsers = useMemo(() => {
    // Si on est en train de charger mais qu'on a déjà eu des données, on garde les anciennes
    const baseUsers = (appUsers.length === 0 && isRefreshing) 
      ? lastValidUsersRef.current 
      : appUsers;

    if (!searchQuery.trim()) return baseUsers;
    const query = searchQuery.toLowerCase().trim();
    return baseUsers.filter((u: any) => 
      (u.pseudo || '').toLowerCase().includes(query)
    );
  }, [appUsers, searchQuery, isRefreshing]);

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

      <FlashList
        ref={flatListRef}
        data={filteredUsers}
        extraData={{
          pendingMessages,
          unreadCache,
          expandedUnreadId,
        }}
        estimatedItemSize={65} // Hauteur 60 + Marge 5
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
                // Message par défaut (friendlist vide, hors recherche)
                <>
                  <Text style={styles.emptyText}>{i18n.t('no_friends')}</Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      // Ouvrir la même modale de recherche que depuis le menu liste
                      DeviceEventEmitter.emit('OPEN_SEARCH_MODAL');
                    }}
                    style={styles.emptyActionRow}
                  >
                    <Ionicons name="search" size={18} color="#604a3e" style={styles.emptyActionIcon} />
                    <Text style={styles.emptyActionText}>{i18n.t('empty_friendlist_search_pseudo')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => void handleInviteFriendsPress()}
                    style={[styles.emptyActionRow, { marginTop: 10 }]}
                  >
                    <Ionicons name="share-social-outline" size={18} color="#604a3e" style={styles.emptyActionIcon} />
                    <Text style={styles.emptyActionText}>{i18n.t('empty_friendlist_invite_friends')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      // Ouvrir la même page profil que le header (vue interne dans index.tsx)
                      DeviceEventEmitter.emit('OPEN_PROFILE_VIEW');
                    }}
                    style={[styles.emptyActionRow, { marginTop: 10 }]}
                  >
                    <Ionicons name="person-circle-outline" size={19} color="#604a3e" style={styles.emptyActionIcon} />
                    <Text style={styles.emptyActionText}>{i18n.t('no_friends_phone_hint')}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )
        }
        renderItem={({ item, index }) => {
          const unreadMessages = pendingMessages.filter(
            m =>
              m.from_user_id === item.id &&
              !m.isPendingDelete &&
              !(m.message_content?.startsWith('READ:') ?? false)
          );
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
            <SwipeableFriendRow
              ref={(ref) => { rowRefs.current[item.id] = ref; }}
              friend={item}
              backgroundColor={backgroundColor}
              getDisplaySoundLabel={getDisplaySoundLabel}
              onSendProut={() => handleSendProut(item)}
              onLongPressAvatar={() => handleLongPressName(item)}
              onLongPressRow={() => handleLongPressSoundCategory(item)}
              onPressName={() => handlePressFriend(item)}
              hasUnread={hasUnread}
              unreadMessage={truncateContactPreview(lastUnread?.message_content) || (hasUnread && unreadMessages.length > 1 ? `${unreadMessages.length} messages` : null)}
              onDeleteFriend={() => handleDeleteFriend(item)}
              onMuteFriend={() => handleMuteFriend(item)}
              onUnmuteFriend={() => handleUnmuteFriend(item)}
              isMuted={item.is_muted || false}
              introDelay={index * 40}
              introTrigger={listIntroTrigger}
              selectedSoundKey={friendSoundKeyByFriend[item.id]}
              onClearSelectedSound={() => {
                setFriendSoundKeyByFriend((prev) => {
                  if (!prev[item.id]) return prev;
                  const { [item.id]: _removed, ...rest } = prev;
                  return rest;
                });
              }}
            />
          );
        }}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          appUsers.length > 0 ? (
            <View style={styles.footerHelp}>
              <View style={styles.footerHelpLines}>
                <View style={styles.footerHelpLine}>
                  <Image
                    source={require('../assets/images/tip.png')}
                    style={styles.footerHelpTip}
                    resizeMode="contain"
                  />
                  <Text style={styles.footerHelpText}>{i18n.t('friendlist_onboarding_swipe')}</Text>
                </View>
                <View style={styles.footerHelpLine}>
                  <Image
                    source={require('../assets/images/tip.png')}
                    style={styles.footerHelpTip}
                    resizeMode="contain"
                  />
                  <Text style={styles.footerHelpText}>{i18n.t('friendlist_onboarding_tap')}</Text>
                </View>
                <View style={styles.footerHelpLine}>
                  <Image
                    source={require('../assets/images/tip.png')}
                    style={styles.footerHelpTip}
                    resizeMode="contain"
                  />
                  <Text style={styles.footerHelpText}>{i18n.t('friendlist_onboarding_long_press')}</Text>
                </View>
              </View>
            </View>
          ) : null
        }
      />

      <Modal
        isVisible={isFirstFriendlistOnboardingVisible}
        onBackButtonPress={closeFirstFriendlistOnboarding}
        backdropOpacity={0.55}
        animationIn="fadeIn"
        animationOut="fadeOut"
        useNativeDriver
      >
        <View style={styles.firstFooterModalCard}>
          {firstFriendlistOnboardingStep === 'footer' ? (
            <>
              <View style={styles.firstFooterModalTitleRow}>
                <Text style={styles.firstFooterModalTitleText}>{i18n.t('tuto_list_title')}</Text>
              </View>
              <View style={styles.firstFooterModalFeatureRow}>
                <Ionicons name="arrow-forward" size={22} color="#604a3e" />
                <Text style={styles.firstFooterModalFeatureText}>
                  {i18n.t('friendlist_onboarding_swipe')}
                </Text>
              </View>
              <View style={[styles.firstFooterModalFeatureRow, { marginTop: 12 }]}>
                <Image
                  source={require('../assets/images/tap-gesture.png')}
                  style={styles.firstFooterTapImage}
                  resizeMode="contain"
                />
                <Text style={styles.firstFooterModalFeatureText}>
                  {i18n.t('friendlist_onboarding_tap')}
                </Text>
              </View>
              <View style={[styles.firstFooterModalFeatureRow, { marginTop: 12 }]}>
                <Ionicons name="finger-print" size={22} color="#604a3e" />
                <Text style={styles.firstFooterModalFeatureText}>
                  {i18n.t('friendlist_onboarding_long_press')}
                </Text>
              </View>
              <View style={[styles.firstFooterModalFeatureRow, { marginTop: 12 }]}>
                <Ionicons name="arrow-back" size={22} color="#604a3e" />
                <Text style={styles.firstFooterModalFeatureText}>
                  {i18n.t('friendlist_onboarding_swipe_left_block')}
                </Text>
              </View>
            </>
          ) : null}

          <TouchableOpacity
            style={styles.firstFooterModalOkButton}
            onPress={handleFirstFriendlistOnboardingOk}
            activeOpacity={0.85}
          >
            <Text style={styles.firstFooterModalOkText}>OK</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal
        isVisible={!!expandedFriendId}
        onBackdropPress={() => {
          markModalTransition();
          // 1. Cacher visuellement tout de suite
          setIsModalContentVisible(false);
          // 2. Fermer le clavier
          Keyboard.dismiss();
          // 3. Fermer aussi la recherche si elle est active
          if (isSearchVisible) {
            onSearchChange?.(false);
            onSearchQueryChange?.('');
          }
          // 4. Fermeture immédiate sans animation de disparition visible
          setExpandedFriendId(null);
        }}
        onBackButtonPress={() => {
          markModalTransition();
          setIsModalContentVisible(false);
          Keyboard.dismiss();
          // Fermer aussi la recherche si elle est active
          if (isSearchVisible) {
            onSearchChange?.(false);
            onSearchQueryChange?.('');
          }
          setExpandedFriendId(null);
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
        backdropOpacity={CHAT_MODAL_BACKDROP_OPACITY}
        useNativeDriver={USE_NATIVE_MODAL_DRIVER}
        useNativeDriverForBackdrop={USE_NATIVE_MODAL_DRIVER}
        hideModalContentWhileAnimating
        animationIn="fadeIn"
        animationOut="fadeOut"
        animationInTiming={150}
        animationOutTiming={Platform.OS === 'android' ? 0 : 1} // Instantané à la fermeture
        backdropTransitionOutTiming={0}
        avoidKeyboard={false} // Ancrage clavier géré de façon unifiée via keyboardHeightSV
      >
        <Animated.View
          style={[
            {
              width: '100%',
              backgroundColor: '#ebb89b',
              borderTopLeftRadius: 15,
              borderTopRightRadius: 15,
              padding: 10,
              paddingBottom: 0,
              opacity: isModalContentVisible ? 1 : 0,
              overflow: 'hidden',
            },
            chatModalKeyboardStyle,
          ]}
        >
          {expandedFriendId && !isClosingModalRef.current && stickyInnerContent}
        </Animated.View>
      </Modal>

      {toastMessage && (
        <RNAnimated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </RNAnimated.View>
      )}

      {/* Modal d'identité avec avatar en grand */}
      <Modal
        isVisible={friendSoundModalVisible}
        onBackdropPress={closeFriendSoundModal}
        onBackButtonPress={closeFriendSoundModal}
        onModalShow={() => {
          setIsFriendSoundModalContentVisible(true);
        }}
        onModalHide={() => {
          setIsFriendSoundModalContentVisible(false);
        }}
        style={styles.friendSoundModal}
        backdropOpacity={FRIEND_SOUND_MODAL_BACKDROP_OPACITY}
        animationIn="fadeIn"
        animationOut="fadeOut"
        animationOutTiming={ANDROID_MODAL_CLOSE_TIMING}
        useNativeDriver={USE_NATIVE_MODAL_DRIVER}
        useNativeDriverForBackdrop={USE_NATIVE_MODAL_DRIVER}
        hideModalContentWhileAnimating
        backdropTransitionOutTiming={0}
      >
        <View
          style={[
            styles.friendSoundModalCard,
            styles.friendSoundModalCardExpanded,
            { opacity: isFriendSoundModalContentVisible ? 1 : 0 },
          ]}
        >
          <View style={styles.friendSoundPickTitleRow}>
            <View style={styles.friendSoundPickTitleContent}>
              <Image
                source={require('../assets/images/proothail.png')}
                style={styles.friendSoundPickTitleTail}
                resizeMode="contain"
              />
              <Text style={styles.friendSoundPickTitleText}>{i18n.t('friend_sound_modal_pick_title')}</Text>
            </View>
            <TouchableOpacity
              onPress={closeFriendSoundPickModal}
              style={styles.friendSoundPickCloseButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={26} color="#604a3e" />
            </TouchableOpacity>
          </View>
          <ScrollView
                style={styles.friendSoundPickScroll}
                contentContainerStyle={styles.friendSoundPickScrollContent}
                showsVerticalScrollIndicator
              >
                <View style={styles.friendSoundPickColumns}>
                  <View style={styles.friendSoundPickColumn}>
                    {Platform.OS === 'android' && (
                      <>
                        <View style={styles.friendSoundPickHeaderCell}>
                          <AnimatedCategoryHeaderImage
                            source={TOOT_LOGO_IMAGE}
                            style={[styles.friendSoundPickHeaderImage, TOOT_PICK_HEADER_SIZE]}
                            isActive={previewingFriendSoundCategory === 'toot'}
                          />
                          <Text style={styles.friendSoundPickHeaderSubtitle}>
                            {i18n.t(getChooseSoundCategorySubtitleKey('toot'))}
                          </Text>
                        </View>
                        {PICKUP_TOOT_KEYS.map(renderFriendSoundPickItem)}
                        <View style={[styles.friendSoundPickHeaderCell, { marginTop: 12 }]}>
                          <AnimatedCategoryHeaderImage
                            source={require('../assets/images/buzz.png')}
                            style={styles.friendSoundPickHeaderImage}
                            isActive={previewingFriendSoundCategory === 'bzzz'}
                          />
                          <Text style={styles.friendSoundPickHeaderSubtitle}>
                            {i18n.t(getChooseSoundCategorySubtitleKey('bzzz'))}
                          </Text>
                        </View>
                        {PICKUP_BZZZ_KEYS.map(renderFriendSoundPickItem)}
                      </>
                    )}
                    {Platform.OS !== 'android' && (
                      <>
                        <View style={styles.friendSoundPickHeaderCell}>
                          <AnimatedCategoryHeaderImage
                            source={require('../assets/images/mood.png')}
                            style={[styles.friendSoundPickHeaderImage, MOOD_PICK_HEADER_SIZE]}
                            isActive={previewingFriendSoundCategory === 'mood'}
                          />
                          <Text style={styles.friendSoundPickHeaderSubtitle}>
                            {i18n.t(getChooseSoundCategorySubtitleKey('mood'))}
                          </Text>
                        </View>
                        {PICKUP_MOOD_KEYS.map(renderFriendSoundPickItem)}
                      </>
                    )}
                    {/* iOS : Tweet + Buzz sous Mood, en colonne 1 */}
                    {Platform.OS === 'ios' && (
                      <>
                        <View style={[styles.friendSoundPickHeaderCell, { marginTop: 12 }]}>
                          <AnimatedCategoryHeaderImage
                            source={require('../assets/images/tweet.png')}
                            style={styles.friendSoundPickHeaderImage}
                            isActive={previewingFriendSoundCategory === 'trll'}
                          />
                          <Text style={styles.friendSoundPickHeaderSubtitle}>
                            {i18n.t(getChooseSoundCategorySubtitleKey('trll'))}
                          </Text>
                        </View>
                        {PICKUP_TRLL_KEYS.map(renderFriendSoundPickItem)}
                        <View style={[styles.friendSoundPickHeaderCell, { marginTop: 12 }]}>
                          <AnimatedCategoryHeaderImage
                            source={require('../assets/images/buzz.png')}
                            style={styles.friendSoundPickHeaderImage}
                            isActive={previewingFriendSoundCategory === 'bzzz'}
                          />
                          <Text style={styles.friendSoundPickHeaderSubtitle}>
                            {i18n.t(getChooseSoundCategorySubtitleKey('bzzz'))}
                          </Text>
                        </View>
                        {PICKUP_BZZZ_KEYS.map(renderFriendSoundPickItem)}
                      </>
                    )}
                  </View>
                  <View style={styles.friendSoundPickColumn}>
                    <View style={styles.friendSoundPickHeaderCell}>
                      <AnimatedCategoryHeaderImage
                        source={require('../assets/images/pop.png')}
                        style={[styles.friendSoundPickHeaderImage, { width: 68, height: 29 }]}
                        isActive={previewingFriendSoundCategory === 'pop'}
                      />
                      <Text style={styles.friendSoundPickHeaderSubtitle}>
                        {i18n.t(getChooseSoundCategorySubtitleKey('pop'))}
                      </Text>
                    </View>
                    {PICKUP_POP_KEYS.map(renderFriendSoundPickItem)}
                    {Platform.OS === 'android' && (
                      <>
                        <View style={[styles.friendSoundPickHeaderCell, { marginTop: 12 }]}>
                          <AnimatedCategoryHeaderImage
                            source={require('../assets/images/mood.png')}
                            style={[styles.friendSoundPickHeaderImage, MOOD_PICK_HEADER_SIZE]}
                            isActive={previewingFriendSoundCategory === 'mood'}
                          />
                          <Text style={styles.friendSoundPickHeaderSubtitle}>
                            {i18n.t(getChooseSoundCategorySubtitleKey('mood'))}
                          </Text>
                        </View>
                        {PICKUP_MOOD_KEYS.map(renderFriendSoundPickItem)}
                    <View style={[styles.friendSoundPickHeaderCell, { marginTop: 12 }]}>
                      <AnimatedCategoryHeaderImage
                        source={require('../assets/images/tweet.png')}
                        style={styles.friendSoundPickHeaderImage}
                        isActive={previewingFriendSoundCategory === 'trll'}
                      />
                      <Text style={styles.friendSoundPickHeaderSubtitle}>
                        {i18n.t(getChooseSoundCategorySubtitleKey('trll'))}
                      </Text>
                    </View>
                    {PICKUP_TRLL_KEYS.map(renderFriendSoundPickItem)}
                      </>
                    )}
                    {Platform.OS !== 'android' && (
                      <>
                        <View style={[styles.friendSoundPickHeaderCell, { marginTop: 12 }]}>
                          <AnimatedCategoryHeaderImage
                            source={TOOT_LOGO_IMAGE}
                            style={[styles.friendSoundPickHeaderImage, TOOT_PICK_HEADER_SIZE]}
                            isActive={previewingFriendSoundCategory === 'toot'}
                          />
                          <Text style={styles.friendSoundPickHeaderSubtitle}>
                            {i18n.t(getChooseSoundCategorySubtitleKey('toot'))}
                          </Text>
                        </View>
                        {PICKUP_TOOT_KEYS.map(renderFriendSoundPickItem)}
                      </>
                    )}
                  </View>
                </View>
              </ScrollView>
              {SHOW_DEFAULT_SOUND_CATEGORY_CURSOR && (
              <View style={styles.pickDefaultCategorySection}>
                <Text style={styles.pickDefaultCategoryTitle}>{i18n.t('default_sound_category_title')}</Text>
                <View style={styles.pickDefaultCategoryGrid}>
                  {DEFAULT_SOUND_OPTION_ROWS.map((row, rowIndex) => (
                    <View
                      key={`default-row-${rowIndex}`}
                      style={[
                        styles.pickDefaultCategoryTrack,
                        rowIndex > 0 && styles.pickDefaultCategoryTrackSecondRow,
                      ]}
                    >
                      {row.map((option) => (
                        <TouchableOpacity
                          key={option.category}
                          style={[
                            styles.pickDefaultCategoryStep,
                            rowIndex > 0 && styles.pickDefaultCategoryStepSecondRow,
                            option.category === globalDefaultCategory && styles.pickDefaultCategoryStepActive,
                          ]}
                          onPress={() => handleSelectGlobalDefaultCategory(option.category)}
                          activeOpacity={0.85}
                        >
                          {/* Zone fixe : évite que le cadre actif / la taille proot redimensionne la cellule */}
                          <View style={styles.pickDefaultCategoryIconWrap}>
                            <Image
                              source={option.image}
                              style={[
                                styles.pickDefaultCategoryIcon,
                                option.category === 'mood' && MOOD_DEFAULT_CATEGORY_CURSOR_SIZE,
                                option.category === 'pop' && { width: 62, height: 24 },
                                option.category === 'trll' && { width: 90, height: 34 },
                                option.category === 'toot' && TOOT_CURSOR_ICON_SIZE,
                              ]}
                              resizeMode="contain"
                            />
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </View>
              </View>
              )}
        </View>
      </Modal>

      <Modal
        isVisible={reportReasonModalVisible}
        onBackdropPress={closeReportReasonModal}
        onBackButtonPress={closeReportReasonModal}
        onModalShow={() => {
          if (reportReasonModalEnableTimeoutRef.current) {
            clearTimeout(reportReasonModalEnableTimeoutRef.current);
          }
          reportReasonModalEnableTimeoutRef.current = setTimeout(() => {
            setReportReasonModalReady(true);
            reportReasonModalEnableTimeoutRef.current = null;
          }, 350);
        }}
        style={styles.reportReasonModal}
        backdropOpacity={0.4}
        animationIn="fadeIn"
        animationOut="fadeOut"
        useNativeDriver={USE_NATIVE_MODAL_DRIVER}
        useNativeDriverForBackdrop={USE_NATIVE_MODAL_DRIVER}
      >
        <View style={styles.reportReasonCard}>
          <Text style={styles.reportReasonTitle}>{i18n.t('report_message_title')}</Text>
          <Text style={styles.reportReasonSubtitle}>{i18n.t('report_message_reason_prompt')}</Text>
          {([
            ['spam', i18n.t('report_reason_spam')],
            ['harassment', i18n.t('report_reason_harassment')],
            ['hate_speech', i18n.t('report_reason_hate_speech')],
            ['explicit_content', i18n.t('report_reason_explicit_content')],
            ['other', i18n.t('report_reason_other')],
          ] as Array<[ReportReason, string]>).map(([reason, label]) => (
            <TouchableOpacity
              key={reason}
              style={[
                styles.reportReasonOption,
                !reportReasonModalReady && styles.reportReasonOptionDisabled,
              ]}
              onPress={() => handleAndroidReportReason(reason)}
              disabled={!reportReasonModalReady}
              activeOpacity={0.85}
            >
              <Text style={styles.reportReasonOptionText}>{label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.reportReasonCancel}
            onPress={closeReportReasonModal}
            activeOpacity={0.85}
          >
            <Text style={styles.reportReasonCancelText}>{i18n.t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal
        isVisible={identityModalVisible}
        onBackdropPress={closeIdentityModal}
        onBackButtonPress={closeIdentityModal}
        style={styles.identityModal}
        backdropOpacity={0.5}
        animationIn="fadeIn"
        animationOut="fadeOut"
        animationOutTiming={ANDROID_MODAL_CLOSE_TIMING}
        useNativeDriver={USE_NATIVE_MODAL_DRIVER}
        useNativeDriverForBackdrop={USE_NATIVE_MODAL_DRIVER}
        hideModalContentWhileAnimating
        backdropTransitionOutTiming={0}
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
                      onPress={closeIdentityModal}
                    >
                      <Text style={styles.identityRequestButtonTextCancel}>
                        {i18n.t('cancel')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.identityRequestButton, styles.identityRequestButtonAsk]}
                      onPress={() => {
                        closeIdentityModal();
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
                  onPress={closeIdentityModal}
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
  listContent: { paddingTop: 8, paddingBottom: 20 },
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
  emptyActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  emptyActionIcon: { marginRight: 10, marginTop: 1 },
  emptyActionText: { color: '#604a3e', fontSize: 14, fontWeight: '600', textAlign: 'left', flexShrink: 1 },
  subText: { color: '#888', fontSize: 14, marginTop: 5 },
  messageInputContainer: { backgroundColor: 'rgba(255,255,255,0.9)', marginTop: 0, marginBottom: 4, padding: 6, paddingBottom: 6, borderRadius: 12, borderWidth: 1, borderColor: '#d9e6e3' },
  messageInputContainerAndroid: { marginBottom: 0, paddingBottom: 0 },
  messageLabel: { color: '#604a3e', fontWeight: '600', marginBottom: 6 },
  messageInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 0, gap: 8 },
  /** Proothail collé au champ ; le `gap` du parent sépare ce bloc du bouton envoyer */
  chatMessageInputLeftChunk: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minWidth: 0,
    gap: 0,
  },
  chatSoundPickerEntryThumbTouchable: {
    padding: 0,
    paddingHorizontal: 0,
    marginLeft: 0,
    marginRight: 0,
    backgroundColor: 'transparent',
  },
  /** Compense le padding du panneau chat (10) pour coller proothail au bord gauche */
  chatSoundPickerEntryThumbFlushLeft: {
    marginLeft: -10,
  },
  chatSoundPickerThumbImage: {
    width: 56,
    height: 40,
    marginLeft: 0,
    marginRight: 0,
  },
  chatSoundZone: {
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(96, 74, 62, 0.45)',
    marginTop: 4,
    marginHorizontal: -10,
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 2,
  },
  chatSoundZoneSeparator: {
    display: 'none',
  },
  chatSoundChoiceScroller: {
    marginTop: 4,
    marginBottom: 4,
    maxHeight: 44,
    alignSelf: 'center',
    flexGrow: 0,
  },
  chatSoundChoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 0,
  },
  chatSoundChoiceButton: {
    width: 96,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatPendingSoundTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#A2E4D4',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
    marginLeft: 4,
  },
  chatPendingSoundTagText: {
    color: '#604a3e',
    fontSize: 13,
    fontWeight: '600',
  },
  chatMuteChoiceButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatSoundChoiceImage: {
    width: 75,
    height: 51,
  },
  chatSpecificSoundList: {
    marginTop: 4,
    backgroundColor: 'rgba(96, 74, 62, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.1)',
    borderRadius: 8,
  },
  chatSpecificSoundListContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignContent: 'flex-start',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 50,
  },
  chatSpecificSoundButton: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chatSpecificSoundButtonActive: {
    backgroundColor: '#A2E4D4',
    borderColor: '#1a1a1a',
  },
  chatSpecificSoundButtonText: {
    color: '#604a3e',
    fontWeight: '600',
    fontSize: 12,
  },
  chatSoundChoiceImageInactive: {
    opacity: 0.4,
  },
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
  // Wrapper sans overflow pour que l'ombre iOS soit visible (overflow: hidden coupe l'ombre).
  // iOS : backgroundColor est appliqué dynamiquement (couleur de la ligne) pour que l'ombre se projette.
  swipeableRowShadowWrapper: {
    marginBottom: 6,
    borderRadius: 15,
    ...Platform.select({
      ios: {
        overflow: 'visible',
        shadowColor: '#5c4a3d',
        shadowOffset: { width: -5, height: 3 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
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
  swipeForeground: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    height: '100%',
    width: '100%',
  },
  friendSelectedSoundBadge: {
    position: 'absolute',
    top: 6,
    right: 8,
    maxWidth: '52%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8b99a',
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.4)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    zIndex: 3,
  },
  friendSelectedSoundBadgeText: {
    color: '#3a2a22',
    fontWeight: '600',
    fontSize: 11,
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
    width: '100%',
  },
  footerHelpLines: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    alignItems: 'center',
  },
  footerHelpLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    maxWidth: '100%',
  },
  footerHelpTip: {
    width: 15,
    height: 15,
    marginTop: 1,
    marginRight: 2,
  },
  footerHelpText: {
    color: '#604a3e',
    fontSize: 14,
    textAlign: 'left',
    fontStyle: 'italic',
    opacity: 0.7,
    flexShrink: 1,
  },
  footerHelpTextSecondary: {
    marginTop: 10,
    fontSize: 13,
    opacity: 0.75,
  },

  firstFooterModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.12)',
  },
  firstFooterModalText: {
    color: '#604a3e',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.85,
  },
  firstFooterModalTextSecondary: {
    marginTop: 10,
    fontSize: 13,
    opacity: 0.8,
  },
  firstFooterModalOkButton: {
    marginTop: 16,
    alignSelf: 'center',
    backgroundColor: '#604a3e',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  firstFooterModalOkText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  firstFooterModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  firstFooterModalTitleText: {
    color: '#604a3e',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  firstFooterModalTitleIcon: {
    width: 24,
    height: 24,
    marginLeft: 8,
  },
  firstFooterModalFeatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  firstFooterTapImage: {
    width: 22,
    height: 22,
    marginTop: 1,
  },
  firstFooterInlineImage: {
    width: 104,
    height: 104,
    marginTop: -24,
    flexShrink: 0,
  },
  firstFooterInlineImageRow: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  firstFooterCenteredTextRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  firstFooterCenteredText: {
    color: '#604a3e',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.88,
    lineHeight: 19,
  },
  /** Légèrement plus grand que les Ionicons 22 pour la queue */
  chatOnboardingIconSlot: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginLeft: -4,
  },
  chatOnboardingProothailImage: {
    width: 30,
    height: 30,
  },
  firstFooterModalFeatureText: {
    flex: 1,
    marginLeft: 12,
    color: '#604a3e',
    fontSize: 14,
    textAlign: 'left',
    fontStyle: 'italic',
    opacity: 0.88,
    lineHeight: 19,
  },
  chatOnboardingInlineCard: {
    marginBottom: 0,
  },
  chatOnboardingScroll: {
    flexGrow: 0,
  },
  chatOnboardingScrollContent: {
    paddingBottom: 8,
  },
  chatOnboardingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    marginBottom: 12,
  },
  chatOnboardingHeaderImage: {
    width: 62,
    height: 62,
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
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 10 : 6, // Padding safe area basique réduite
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
  stickyHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stickyPseudo: {
    fontWeight: 'bold',
    color: '#604a3e',
    fontSize: 16,
  },
  stickyContentLayout: {
    flex: 1,
    minHeight: 0,
  },
  stickyMessages: {
    marginBottom: 8,
    minHeight: 0,
    flex: 1,
  },
  stickyMessagesContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    width: '100%',
  },
  bubbleReceivedWrapper: {
    alignSelf: 'flex-start',
    width: '100%',
    maxWidth: '100%',
  },
  bubbleReceived: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    position: 'relative',
  },
  bubbleReceivedPlaying: {
    backgroundColor: '#A2E4D4',
    borderColor: '#1a1a1a',
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
    position: 'relative',
  },
  bubbleTextReceived: {
    color: '#333',
    fontSize: 18,
    flexShrink: 1,
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
  friendSoundModal: {
    justifyContent: 'center',
    margin: 0,
    paddingTop: Platform.OS === 'android' ? 20 : 0,
  },
  identityModalContent: {
    backgroundColor: '#ebb89b',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '85%',
    maxWidth: 400,
  },
  friendSoundModalCard: {
    backgroundColor: '#ebb89b',
    borderRadius: 0,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 54 : 26,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.12)',
    maxHeight: Platform.OS === 'android' ? SCREEN_HEIGHT - 20 : SCREEN_HEIGHT,
  },
  friendSoundModalCardExpanded: {
    minHeight: Platform.OS === 'android' ? SCREEN_HEIGHT - 20 : SCREEN_HEIGHT,
  },
  friendSoundPickModalCard: {
    backgroundColor: '#ebb89b',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.12)',
    maxHeight: '80%',
  },
  friendSoundPickModalTitle: {
    color: '#604a3e',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  friendSoundPickHeaderCell: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  friendSoundPickHeaderSubtitle: {
    color: '#604a3e',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 1,
    marginBottom: 0,
  },
  friendSoundPickHeaderImage: {
    width: 92,
    height: 40,
  },
  friendSoundPickScroll: {
    flex: 1,
    marginBottom: 10,
  },
  friendSoundPickScrollContent: {
    paddingBottom: 2,
  },
  friendSoundPickTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  friendSoundPickTitleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingLeft: 28,
  },
  friendSoundPickTitleTail: {
    width: 54,
    height: 34,
    marginRight: -2,
  },
  friendSoundPickTitleText: {
    color: '#604a3e',
    fontSize: 16,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
  friendSoundPickCloseButton: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  friendSoundPickSoundcheckLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(96, 74, 62, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  friendSoundPickSoundcheckText: {
    color: '#604a3e',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    marginRight: 6,
  },
  friendSoundPickSoundcheckImage: {
    width: 120,
    height: 24,
  },
  friendSoundPickColumns: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  friendSoundPickColumn: {
    flex: 1,
  },
  friendSoundPickItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  friendSoundPickPlayButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  friendSoundPickPlayButtonActive: {
    backgroundColor: 'rgba(162, 228, 212, 0.9)',
  },
  friendSoundPickPlayIcon: {
    marginLeft: 1,
  },
  friendSoundPickItemButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  reportReasonModal: {
    justifyContent: 'center',
    margin: 0,
    paddingHorizontal: 20,
  },
  reportReasonCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
  },
  reportReasonTitle: {
    color: '#604a3e',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  reportReasonSubtitle: {
    color: '#604a3e',
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
    marginTop: 6,
    marginBottom: 14,
  },
  reportReasonOption: {
    backgroundColor: '#d2f1ef',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  reportReasonOptionDisabled: {
    opacity: 0.55,
  },
  reportReasonOptionText: {
    color: '#604a3e',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  reportReasonCancel: {
    marginTop: 6,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  reportReasonCancelText: {
    color: '#604a3e',
    fontSize: 15,
    fontWeight: '700',
  },
  friendSoundPickItemButtonActive: {
    backgroundColor: 'rgba(162, 228, 212, 0.72)',
    borderColor: 'rgba(96, 74, 62, 0.45)',
  },
  friendSoundPickItemText: {
    color: '#604a3e',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  pickDefaultCategorySection: {
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 6,
  },
  pickDefaultCategoryTitle: {
    color: '#604a3e',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  pickDefaultCategoryGrid: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.18)',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.32)',
    overflow: 'hidden',
  },
  pickDefaultCategoryTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
  },
  pickDefaultCategoryTrackSecondRow: {
    justifyContent: 'center',
  },
  pickDefaultCategoryStep: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 10,
  },
  pickDefaultCategoryStepActive: {
    backgroundColor: 'rgba(162, 228, 212, 0.72)',
    borderColor: 'rgba(96, 74, 62, 0.45)',
  },
  pickDefaultCategoryIconWrap: {
    width: 90,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickDefaultCategoryStepSecondRow: {
    flex: 0,
    marginHorizontal: 12,
  },
  pickDefaultCategoryIcon: {
    width: 80,
    height: 30,
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
