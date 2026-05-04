import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { FlashList, FlashListRef } from '@shopify/flash-list';
// Force git update 2
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import * as Contacts from 'expo-contacts';
import { Audio } from 'expo-av';
import { useFocusEffect, useRouter } from 'expo-router';
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, DeviceEventEmitter, Dimensions, FlatList, Image, Keyboard, Linking, NativeModules, Platform, Animated as RNAnimated, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SwipeableFriendRow, SwipeableFriendRowHandle } from './FriendsListComponents/SwipeableFriendRow';
import { useAppStore } from '../lib/store';
import { useFriends, usePendingMessages, usePendingSentMessages, useBlockedUsers } from '../hooks/useFriends';
import { usePendingRequests, useIdentityRequests } from '../hooks/useRequests';
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
import { useProotAudio, type ChatMessageSoundChoice } from '../hooks/useProotAudio';
import { getPickupKeys, getDisplaySoundLabel, getDefaultSoundCategoryForFirstLaunch, stopCurrentPlayback } from '../lib/audioService';
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
import ProotSilenceChallenge from './ProotSilenceChallenge';
import { 
  parseMessageContent, 
  stripReadPrefix, 
  type ReportableMessage 
} from './FriendsListComponents/ChatMessages';
import { ChatModal } from './FriendsListComponents/ChatModal';
import { FriendSoundPickModal } from './FriendsListComponents/Modals/FriendSoundPickModal';
import { ReportReasonModal } from './FriendsListComponents/Modals/ReportReasonModal';
import { IdentityModal } from './FriendsListComponents/Modals/IdentityModal';

const FIRST_CHAT_MODAL_KEY = 'first_chat_modal_seen_v2';
const CHAT_MESSAGE_SOUND_CHOICE_KEY = 'chat_message_sound_choice_v1';
const CHAT_MESSAGE_MUTE_KEY = 'chat_message_mute_v2';
const FRIEND_SOUND_CATEGORY_MAP_KEY = 'friend_sound_category_map_v1';
const CACHE_KEY_LAST_SENT_MESSAGES = 'cached_last_sent_messages_v1';
const IOS_SOUNDWAVE_IMAGE = require('../assets/images/proothail.png');
const ANDROID_ADAPTIVE_SOUNDWAVE_IMAGE = require('../assets/images/proothail2.png');
const IOS_SENT_IMAGE = require('../assets/images/animprout4.png');
const IOS_PRIMARY_SOUNDWAVE_IMAGE = require('../assets/images/proothail2.png');

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const CHAT_MODAL_TOP_SAFE_MARGIN = Platform.OS === 'ios' ? 96 : 84;
const SWIPE_THRESHOLD = 150; // Seuil pour déclencher l'action
const TAP_THRESHOLD = 12; // Distance max pour considérer un tap

/** Helper local pour initialiser les listes de sons par catégorie */
const getPickupKeysLocal = (category: string) => {
  return (SOUND_KEYS_BY_CATEGORY[category] || []).filter((key) => !!SOUND_ASSETS[key]);
};

const PICKUP_TRLL_KEYS = getPickupKeysLocal('trll');
const PICKUP_BZZZ_KEYS = getPickupKeysLocal('bzzz');
const PICKUP_POP_KEYS = getPickupKeysLocal('pop');
const PICKUP_MOOD_KEYS = getPickupKeysLocal('mood');
const PICKUP_TOOT_KEYS = getPickupKeysLocal('toot');
const MAX_PICKUP_ROWS = Math.ceil(Math.max(PICKUP_TRLL_KEYS.length, PICKUP_BZZZ_KEYS.length, PICKUP_POP_KEYS.length, PICKUP_MOOD_KEYS.length, PICKUP_TOOT_KEYS.length) / 2);
const CHAT_SPECIFIC_ROW_HEIGHT = 34;
const CHAT_SPECIFIC_BOTTOM_GAP = 30;
const CHAT_SPECIFIC_MIN_HEIGHT = MAX_PICKUP_ROWS * CHAT_SPECIFIC_ROW_HEIGHT + 50 + CHAT_SPECIFIC_BOTTOM_GAP;
const USE_NATIVE_MODAL_DRIVER = Platform.OS !== 'android';
const ANDROID_MODAL_CLOSE_TIMING = Platform.OS === 'android' ? 1 : 120;
const CHAT_MODAL_BACKDROP_OPACITY = Platform.OS === 'android' ? 0 : 0.3;
const FRIEND_SOUND_MODAL_BACKDROP_OPACITY = Platform.OS === 'android' ? 0 : 0.45;
const FRIEND_ROW_LONG_PRESS_DELAY_MS = 320;
// Uniformisation : on affiche toujours `proot.png` pour la catégorie toot/proot,
// y compris sur iOS en locale US/anglais.
const USE_PROOT_TOOT_LOGO = true;
const TOOT_LOGO_IMAGE = require('../assets/images/proot.png');
/** Miniature cliquable sous le chat pour ouvrir le sélecteur de sons */
const CHAT_PROOTHAIL_THUMB = Platform.OS === 'android'
  ? ANDROID_ADAPTIVE_SOUNDWAVE_IMAGE
  : IOS_PRIMARY_SOUNDWAVE_IMAGE;
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

function getSwipeImageForSoundKey(selectedSoundKey?: string | null) {
  if (Platform.OS === 'android') {
    if (!selectedSoundKey) return ANDROID_ADAPTIVE_SOUNDWAVE_IMAGE;
    return PICKUP_TOOT_KEYS.includes(selectedSoundKey)
      ? ANDROID_ADAPTIVE_SOUNDWAVE_IMAGE
      : IOS_SOUNDWAVE_IMAGE;
  }

  // iOS : même logique visuelle que Android (proothail2 par défaut),
  // mais on garde proothail.png pour les sons non toot/proot.
  if (!selectedSoundKey) return IOS_PRIMARY_SOUNDWAVE_IMAGE;
  return PICKUP_TOOT_KEYS.includes(selectedSoundKey)
    ? IOS_PRIMARY_SOUNDWAVE_IMAGE
    : IOS_SOUNDWAVE_IMAGE;
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

type LastSentMessage = { text: string; ts: string; id?: string; status?: 'read'; readAt?: number; soundKey?: string };
type LastSentMap = Record<string, LastSentMessage[]>; // Tableau de messages pour accumulation

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

const LAST_SENT_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 jours

// Cache pour les derniers messages envoyés (map userId -> [{text, ts, id?, status?}])
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
    // On garde les messages (lus ou non) tant qu'ils sont "frais" (TTL 24h)
    // Cela évite qu'ils ne disparaissent brutalement au redémarrage
    const cleaned: LastSentMap = {};
    Object.entries(map).forEach(([userId, messages]) => {
      if (Array.isArray(messages)) {
        const freshMessages = messages.filter(msg => isFreshSentMessage(msg));
        if (freshMessages.length > 0) {
          cleaned[userId] = freshMessages;
        }
      } else if (
        messages &&
        typeof messages === 'object' &&
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
  const useStableCallback = <T extends (...args: any[]) => any>(callback: T) => {
    const ref = useRef(callback);
    useEffect(() => {
      ref.current = callback;
    });
    return useCallback((...args: Parameters<T>) => ref.current(...args), []) as T;
  };

  const refreshAllData = useStableCallback(async () => {
    if (__DEV__) console.log('🔄 [FriendsList] Refreshing all data via TanStack Query...');
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['friends', currentUserId] }),
        queryClient.invalidateQueries({ queryKey: ['pendingMessages', currentUserId] }),
        queryClient.invalidateQueries({ queryKey: ['pendingSentMessages', currentUserId] }),
        queryClient.invalidateQueries({ queryKey: ['pendingRequests', currentUserId] }),
        queryClient.invalidateQueries({ queryKey: ['identityRequests', currentUserId] }),
      ]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  });

  const insets = useSafeAreaInsets();
  const isZenMode = useAppStore(state => state.isZenMode);
  const isSilentMode = useAppStore(state => state.isSilentMode);
  const isHapticEnabled = useAppStore(state => state.isHapticEnabled);
  const storePseudo = useAppStore(state => state.pseudo);
  const queryClient = useQueryClient();
  
  const [appUsers, setAppUsers] = useState<any[]>([]);
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [isGameVisible, setIsGameVisible] = useState(false);
  const [currentPseudo, setCurrentPseudo] = useState<string>("Un ami");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const { data: friendsFromQuery, isLoading: isFriendsLoading } = useFriends(currentUserId);
  const { data: pendingMessagesData } = usePendingMessages(currentUserId);
  const { data: pendingSentData } = usePendingSentMessages(currentUserId);
  const { data: pendingRequestsData } = usePendingRequests(currentUserId);
  const { data: identityRequestsData } = useIdentityRequests(currentUserId);
  const { data: blockedUsersFromQuery } = useBlockedUsers(currentUserId);

  // Synchronisation TanStack pour les Utilisateurs Bloqués
  useEffect(() => {
    if (blockedUsersFromQuery) {
      setBlockedUserIds(blockedUsersFromQuery);
      blockedUserIdsRef.current = new Set(blockedUsersFromQuery);
    }
  }, [blockedUsersFromQuery]);

  // Synchronisation TanStack pour les Demandes
  useEffect(() => {
    if (pendingRequestsData) {
      setPendingRequests(pendingRequestsData);
    }
  }, [pendingRequestsData]);

  useEffect(() => {
    if (identityRequestsData) {
      setIdentityRequests(identityRequestsData);
    }
  }, [identityRequestsData]);

  // Synchronisation des messages envoyés (TanStack -> UI)
  useEffect(() => {
    if (pendingSentData) {
      setLastSentMessages(prev => {
        const newMap = { ...prev };
        let changed = false;
        const now = Date.now();

        // 1. Marquer comme "lu" les messages qui ne sont plus sur le serveur
        // (Sauf s'ils sont très récents pour éviter les faux-positifs pendant l'envoi)
        Object.entries(newMap).forEach(([userId, messages]) => {
          if (!Array.isArray(messages)) return;
          
          const updatedMessages = messages.map(msg => {
            // Si le message a un ID et n'est pas déjà marqué lu
            if (msg.id && msg.status !== 'read') {
              const stillOnServer = pendingSentData.some(m => m.id === msg.id);
              // Sécurité : on attend 15s après l'envoi avant de conclure qu'un message disparu de la DB est "lu"
              // (évite les problèmes de réplication ou de délais serveur)
              const isOldEnough = (now - new Date(msg.ts).getTime()) > 15000;
              
              if (!stillOnServer && isOldEnough) {
                changed = true;
                if (CHAT_VERBOSE_LOGS) console.log(`✅ [SYNC] Message ${msg.id} marqué comme lu (absent du serveur)`);
                return { ...msg, status: 'read' as const, readAt: now };
              }
            }
            return msg;
          });

          if (changed) {
            newMap[userId] = updatedMessages;
          }
        });

        // 2. Ajouter les nouveaux messages du serveur ou mettre à jour les optimistes
        pendingSentData.forEach((m: any) => {
          if (m.message_content?.startsWith('READ:')) return;
          const targetUserId = m.to_user_id;
          const currentForUser = newMap[targetUserId] || [];
          
          // Vérifier si le message existe déjà par ID
          const existsById = currentForUser.some(msg => msg.id === m.id);
          if (existsById) return;

          // Sinon, essayer de trouver un message optimiste correspondant (même texte, même son, timestamp proche)
          const parsed = parseMessageContent(m.message_content);
          const optimisticIndex = currentForUser.findIndex(msg => 
            !msg.id && 
            msg.text === parsed.text && 
            msg.soundKey === parsed.soundKey &&
            Math.abs(new Date(msg.ts).getTime() - new Date(m.created_at).getTime()) < 30000
          );

          if (optimisticIndex !== -1) {
            // Mettre à jour l'optimiste avec l'ID du serveur
            const updatedList = [...currentForUser];
            updatedList[optimisticIndex] = { 
              ...updatedList[optimisticIndex], 
              id: m.id, 
              ts: m.created_at 
            };
            newMap[targetUserId] = updatedList;
            changed = true;
            if (CHAT_VERBOSE_LOGS) console.log(`✅ [SYNC] Message optimiste rapproché avec ID ${m.id}`);
          } else {
            // C'est un nouveau message pas encore connu localement (ex: envoyé depuis un autre device)
            newMap[targetUserId] = [...currentForUser, { 
              text: parsed.text, 
              ts: m.created_at, 
              id: m.id,
              soundKey: parsed.soundKey
            }];
            changed = true;
            if (CHAT_VERBOSE_LOGS) console.log(`✅ [SYNC] Nouveau message serveur ajouté: ${m.id}`);
          }
        });

        if (changed) {
          updateLastSentIndex(newMap);
          saveLastSentMessagesCache(newMap);
          return newMap;
        }
        return prev;
      });
    }
  }, [pendingSentData]);

  const sendProutMutation = useSendProut(currentUserId);

  // Synchronisation des messages reçus (TanStack -> UI)
  useEffect(() => {
    if (pendingMessagesData) {
      setPendingMessages(prev => {
        // 1. Filtrer les messages du serveur (exclure bloqués et supprimés localement)
        const blockedSet = blockedUserIdsRef.current || new Set();
        const serverMessages = pendingMessagesData
          .filter(m => !blockedSet.has(m.from_user_id))
          .filter(m => !deletedMessagesCache.has(m.id))
          .map(m => ({ ...m, isPendingDelete: false }));

        // 2. Identifier les messages locaux récents à conserver (optimistes)
        const now = Date.now();
        const survivingRecent = prev.filter(localMsg => {
          // Garder messages < 10s (FCM/Broadcast/INSERT récents) s'ils ne sont pas encore sur le serveur
          const isRecent = (now - new Date(localMsg.created_at).getTime()) < 10000;
          if (!isRecent) return false;

          const alreadyOnServer = serverMessages.some(serverMsg => {
            if (serverMsg.id === localMsg.id && !serverMsg.id.startsWith('notif-') && !serverMsg.id.startsWith('broadcast-')) {
              return true;
            }
            return serverMsg.from_user_id === localMsg.from_user_id &&
                   (serverMsg.message_content || '') === localMsg.message_content &&
                   Math.abs(new Date(serverMsg.created_at).getTime() - new Date(localMsg.created_at).getTime()) < 15000;
          });
          return !alreadyOnServer;
        });

        // 3. Fusionner avec keptReadMessagesRef (Session Gelée)
        // Les messages lus sont gardés en mémoire tant que le chat est ouvert
        const mergedById = new Map<string, PendingMessage>();
        
        // D'abord les messages du serveur
        serverMessages.forEach(m => mergedById.set(m.id, m as PendingMessage));
        
        // Ensuite les messages optimistes récents
        survivingRecent.forEach(m => mergedById.set(m.id, m));

        // Enfin, réinjecter les messages gardés en mémoire (Session Gelée)
        const activeId = expandedFriendIdRef.current;
        if (activeId) {
          const kept = keptReadMessagesRef.current.get(activeId) || [];
          kept.forEach(m => {
            if (!mergedById.has(m.id)) mergedById.set(m.id, m);
          });

          // Conserver aussi les messages locaux qui sont marqués "READ:" ou "isPendingDelete"
          prev.forEach(m => {
            if (m.from_user_id === activeId && (m.isPendingDelete || m.message_content?.startsWith('READ:'))) {
              if (!mergedById.has(m.id)) mergedById.set(m.id, m);
            }
          });
        }

        const next = Array.from(mergedById.values());
        next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        // 4. Haptic pour nouveaux messages
        if (hasHydratedIncomingMessagesRef.current) {
          const newMessages = serverMessages.filter(m => !knownIncomingMessageIdsRef.current.has(m.id));
          if (newMessages.length > 0) {
            triggerIncomingMessageHaptic();
          }
        }
        knownIncomingMessageIdsRef.current = new Set(serverMessages.map(m => m.id));
        hasHydratedIncomingMessagesRef.current = true;

        return next;
      });
    }
  }, [pendingMessagesData]);

  const appUsersRef = useRef<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [identityRequests, setIdentityRequests] = useState<any[]>([]);

  const [loading, setLoading] = useState(true); // Commencer à true, TanStack Query gérera la suite
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFriendlistRecoveryCard, setShowFriendlistRecoveryCard] = useState(false);

  const {
    chatMessageSoundChoice,
    isChatMuteEnabled,
    friendSoundCategoryByFriend,
    friendSoundKeyByFriend,
    previewingFriendSoundKey,
    setChatMessageSoundChoice,
    setIsChatMuteEnabled,
    toggleChatMute,
    setFriendSoundCategory,
    setFriendSpecificSoundKey,
    setPreviewingFriendSoundKey,
    playLocalSound,
    getNextRandomSound,
    getChatRandomSound
  } = useProotAudio();

  const [isChatSoundPickerVisible, setIsChatSoundPickerVisible] = useState(false);
  const [chatSpecificSoundListCategory, setChatSpecificSoundListCategory] = useState<ChatMessageSoundChoice | null>(null);
  const [pendingChatSpecificSoundListCategory, setPendingChatSpecificSoundListCategory] = useState<ChatMessageSoundChoice | null>(null);
  const [pendingChatSoundKeyByFriend, setPendingChatSoundKeyByFriend] = useState<Record<string, string>>({});
  const [friendSoundModalVisible, setFriendSoundModalVisible] = useState(false);
  const [isFriendSoundModalContentVisible, setIsFriendSoundModalContentVisible] = useState(false);
  const [friendSoundModalFriend, setFriendSoundModalFriend] = useState<any>(null);
  const [reportReasonModalVisible, setReportReasonModalVisible] = useState(false);
  const [reportReasonModalReady, setReportReasonModalReady] = useState(false);
  const [pendingReportTarget, setPendingReportTarget] = useState<ReportableMessage | null>(null);
  const [globalDefaultCategory, setGlobalDefaultCategory] = useState<SoundCategory>(
    getDefaultSoundCategoryForFirstLaunch()
  );
  const [isFirstChatModalVisible, setIsFirstChatModalVisible] = useState(false);
  const [firstFriendlistOnboardingStep, setFirstFriendlistOnboardingStep] = useState<'footer' | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (appUsers.length < 1) return;
      let cancelled = false;
      (async () => {
        try {
          const seenFooter = await AsyncStorage.getItem('first_friendlist_footer_modal_seen_v1');
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
  
  // 1. Chargement instantané du cache local (Mémoire de 30 jours)
  useEffect(() => {
    const loadFastCache = async () => {
      try {
        const cached = await AsyncStorage.getItem('CACHE_KEY_FRIENDS_V2');
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 jours
          if (age < MAX_AGE && Array.isArray(data)) {
            // On ne l'applique que si la liste actuelle est vide (pour ne pas écraser une réponse serveur rapide)
            setAppUsers((prev) => prev.length > 0 ? prev : data);
            setLoading(false); // Cache trouvé, on désactive le spinner
          }
        }
      } catch (e) {
        // Ignorer silencieusement
      }
    };
    loadFastCache();
  }, []);

  // 2. Synchronisation et sauvegarde du cache quand TanStack Query répond
  useEffect(() => {
    if (friendsFromQuery !== undefined) {
      setAppUsers(friendsFromQuery);
      setLoading(false); // Le serveur a répondu, on désactive le spinner
      AsyncStorage.setItem('CACHE_KEY_FRIENDS_V2', JSON.stringify({
        data: friendsFromQuery,
        timestamp: Date.now()
      })).catch(() => {});
    }
  }, [friendsFromQuery]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastSentMessages, setLastSentMessages] = useState<LastSentMap>({});
  const [showSilentWarning, setShowSilentWarning] = useState(false);
  const [showPermissionWarning, setShowPermissionWarning] = useState(false);
  const [dismissedPermissionWarning, setDismissedPermissionWarning] = useState(false);
  const [dismissedSilentWarning, setDismissedSilentWarning] = useState(dismissedSilentWarningSession); // reste à true pour toute la session après clic OK
  const dismissedSilentWarningRef = useRef(dismissedSilentWarningSession);
  const [expandedFriendId, setExpandedFriendId] = useState<string | null>(null);
  const expandedFriendIdRef = useRef<string | null>(null);
  const friendSoundPickCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isClosingFriendSoundModalRef = useRef<boolean>(false);
  
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

  const keyboardVisibleRef = useRef(false);
  const lastFocusAttemptRef = useRef<{ friendId: string | null; at: number }>({ friendId: null, at: 0 });
  const lastStickyOpenAtRef = useRef<number | null>(null);
  const refocusOnHideAttemptedRef = useRef(false);
  const refocusOnBlurAttemptedRef = useRef(false);
  const lastSearchOpenAtRef = useRef<number | null>(null);
  const refocusSearchOnBlurAttemptedRef = useRef(false);
  const isClosingModalRef = useRef(false);

  const handleDraftChange = useCallback((friendId: string, text: string) => {
    setMessageDrafts(prev => ({ ...prev, [friendId]: text }));
  }, []);

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
  const listTopAlignTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeFirstChatModal = useCallback(async () => {
    setIsFirstChatModalVisible(false);
    try {
      await AsyncStorage.setItem(FIRST_CHAT_MODAL_KEY, '1');
    } catch {
      // non bloquant
    }
  }, []);

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
        console.error("❌ [SoundSettings] Erreur lors de l'accès au module:", e);
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

  // Polling simple (sans backoff exponentiel)
  const flatListRef = useRef<FlashListRef<any> | null>(null);
  const refreshTriggerRef = useRef(refreshTrigger);
  const rowRefs = useRef<Record<string, SwipeableFriendRowHandle | null>>({});
  const searchInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    appUsersRef.current = appUsers;
  }, [appUsers]);

  useEffect(() => {
    if (appUsers.length > 0) {
      setShowFriendlistRecoveryCard(false);
    }
  }, [appUsers.length]);

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
    const unreadOnly = fromFriend
      .filter((m) => !(m.message_content?.startsWith('READ:') ?? false))
      .map(m => ({ ...m, message_content: parseMessageContent(m.message_content).text || '' }));
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
          const newMsgs = unreadForActive
            .filter(u => !currentCache.some(c => c.id === u.id))
            .map(m => ({
              id: m.id,
              message_content: parseMessageContent(m.message_content).text || '',
              created_at: m.created_at
            }));
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
      refreshAllData();
    }
    prevExpandedRef.current = expandedFriendId;
  }, [expandedFriendId, unreadCache]);


  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (expandedFriendId) {
      // Polling de sécurité toutes les 5s quand un chat est ouvert
      // Garantit que le statut "Lu" arrive même si le Realtime échoue
      interval = setInterval(() => {
        if (CHAT_VERBOSE_LOGS) console.log(`🔍 [CLIENT] Polling de sécurité (chat ouvert)...`);
        refreshAllData();
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
  }, [currentUserId, isSilentMode, queryClient, refreshAllData]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('CLEAR_FRIENDLIST_PENDING_SOUND', (data?: any) => {
      const friendId = typeof data?.friendId === 'string' ? data.friendId : null;
      if (!friendId) return;

      setFriendSpecificSoundKey(friendId, null);
    });

    return () => {
      subscription.remove();
    };
  }, []);

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
      // Forcer la fermeture du clavier dès qu'on arrive sur cet écran
      Keyboard.dismiss();
      
      // Recharger les données à chaque fois que l'écran gagne le focus
      // Le tri se fait maintenant uniquement via last_interaction_at depuis Supabase
      refreshAllData();
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        } catch {}
      }, 120);
    }, [refreshAllData])
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
      // 1. Récupérer l'utilisateur courant (indispensable pour les hooks TanStack Query)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        
        // Optionnel : récupérer le pseudo si on en a besoin dans l'UI
        const { data: profile } = await supabase.from('user_profiles').select('pseudo').eq('id', user.id).single();
        if (profile) {
          setCurrentPseudo(profile.pseudo);
        }
      }

      // 2. Configurer uniquement les abonnements Realtime.
      setupRealtimeSubscription();
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
    Object.entries(cached).forEach(([userId, messages]) => {
      if (Array.isArray(messages)) {
        const unreadMessages = messages.filter(msg => {
          const keep = msg.status !== 'read' && isFreshSentMessage(msg);
          return keep;
        });
        if (unreadMessages.length > 0) {
          filtered[userId] = unreadMessages;
        }
      } else if (
        messages &&
        typeof messages === 'object' &&
        isFreshSentMessage(messages as LastSentMessage)
      ) {
        // Format ancien (un seul message) - migration
        filtered[userId] = [messages as LastSentMessage];
      }
    });
    updateLastSentIndex(filtered);
    setLastSentMessages(filtered);
    // Sauvegarder le cache nettoyé
    if (JSON.stringify(filtered) !== JSON.stringify(cached)) {
      saveLastSentMessagesCache(filtered);
    }
  };
  loadCache();
}, []);

useEffect(() => {
  const loadChatMute = async () => {
    try {
      const savedMute = await AsyncStorage.getItem(CHAT_MESSAGE_MUTE_KEY);
      if (savedMute === '1') {
        setIsChatMuteEnabled(true);
      }
    } catch {
      // noop
    }
  };
  loadChatMute();
}, [setIsChatMuteEnabled]);

const closeChatSpecificSoundList = useCallback(() => {
  if (!isChatSoundPickerVisible && !chatSpecificSoundListCategory && !pendingChatSpecificSoundListCategory) return;
  setIsChatSoundPickerVisible(false);
  setPendingChatSpecificSoundListCategory(null);
  setChatSpecificSoundListCategory(null);
  if (expandedFriendId) {
    setTimeout(() => {
      // ChatModal gère déjà le focus
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

  // Rouvrir le clavier et refocus l'input après la sélection
  setTimeout(() => {
    // Le ChatModal gère déjà le focus
  }, 50);
}, [expandedFriendId, setChatMessageSoundChoice]);

const handleSelectGlobalDefaultCategory = useCallback(async (category: SoundCategory) => {
  setGlobalDefaultCategory(category);
  try {
    await AsyncStorage.setItem(SOUND_CATEGORY_KEY, category);
  } catch (_) {}
}, []);

const handleLongPressSoundCategory = useCallback((friend: any) => {
  if (isModalTransitionActive()) return;
  if (identityModalVisible || isFirstChatModalVisible) return;
  markModalTransition();
  isClosingFriendSoundModalRef.current = false;
  setIsFriendSoundModalContentVisible(true);
  setFriendSoundModalFriend(friend);
  setFriendSoundModalVisible(true);
}, [identityModalVisible, isFirstChatModalVisible, isModalTransitionActive, markModalTransition]);

const handleSelectFriendSpecificSoundKey = useCallback((soundKey: string) => {
  if (isClosingFriendSoundModalRef.current) return;
  isClosingFriendSoundModalRef.current = true;

  const friendId = friendSoundModalFriend?.id;
  if (!friendId || !SOUND_ASSETS[soundKey]) return;

  stopCurrentPlayback().catch(() => {});
  setPreviewingFriendSoundKey(null);
  setFriendSpecificSoundKey(friendId, soundKey);
  
  if (friendSoundPickCloseTimeoutRef.current) {
    clearTimeout(friendSoundPickCloseTimeoutRef.current);
    friendSoundPickCloseTimeoutRef.current = null;
  }
  setIsFriendSoundModalContentVisible(false);
  markModalTransition(0); // Libère immédiatement le verrou
  setFriendSoundModalVisible(false);
}, [friendSoundModalFriend?.id, markModalTransition, setFriendSpecificSoundKey, setPreviewingFriendSoundKey]);

const handlePreviewFriendSpecificSoundKey = useCallback((soundKey: string) => {
  if (!SOUND_ASSETS[soundKey]) return;
  playLocalSound(soundKey, {
    onStart: () => setPreviewingFriendSoundKey(soundKey),
    onEnd: () => {
      setPreviewingFriendSoundKey((prev) => (prev === soundKey ? null : prev));
    },
  });
}, [playLocalSound, setPreviewingFriendSoundKey]);

const handleClearSelectedSound = useCallback((friend: any) => {
  setFriendSpecificSoundKey(friend.id, null);
}, [setFriendSpecificSoundKey]);

const closeFriendSoundModal = useCallback(() => {
  if (isClosingFriendSoundModalRef.current) return;
  isClosingFriendSoundModalRef.current = true;

  if (friendSoundPickCloseTimeoutRef.current) {
    clearTimeout(friendSoundPickCloseTimeoutRef.current);
    friendSoundPickCloseTimeoutRef.current = null;
  }
  stopCurrentPlayback().catch(() => {});
  setPreviewingFriendSoundKey(null);
  setIsFriendSoundModalContentVisible(false);
  markModalTransition(0); // Libère immédiatement le verrou
  setFriendSoundModalVisible(false);
}, [markModalTransition]);

const closeFriendSoundPickModal = useCallback(() => {
  if (isClosingFriendSoundModalRef.current) return;
  isClosingFriendSoundModalRef.current = true;

  if (friendSoundPickCloseTimeoutRef.current) {
    clearTimeout(friendSoundPickCloseTimeoutRef.current);
    friendSoundPickCloseTimeoutRef.current = null;
  }
  stopCurrentPlayback().catch(() => {});
  setPreviewingFriendSoundKey(null);
  setIsFriendSoundModalContentVisible(false);
  markModalTransition(0); // Libère immédiatement le verrou
  setFriendSoundModalVisible(false);
}, [markModalTransition]);

const renderFriendSoundPickItem = useCallback((soundKey: string) => {
  const isActive = !!(
    friendSoundModalFriend?.id && friendSoundKeyByFriend[friendSoundModalFriend.id] === soundKey
  );
  const isPreviewing = previewingFriendSoundKey === soundKey;
  return (
    <View key={soundKey} style={styles.friendSoundPickItemRow}>
      <Pressable
        style={({ pressed }) => [
          styles.friendSoundPickPlayButton,
          isPreviewing && styles.friendSoundPickPlayButtonActive,
          pressed && { opacity: 0.7 }
        ]}
        onPress={() => handlePreviewFriendSpecificSoundKey(soundKey)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name="play"
          size={14}
          color={isPreviewing ? '#1a1a1a' : '#604a3e'}
          style={styles.friendSoundPickPlayIcon}
        />
      </Pressable>
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

// Vérifier les permissions de notifications
useEffect(() => {
  let mounted = true;
  const checkPermissions = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (mounted) {
        setShowPermissionWarning(status !== 'granted');
      }
    } catch (e) {
      console.error("Erreur lors de la vérification des permissions:", e);
    }
  };

  checkPermissions();

  const subscription = AppState.addEventListener('change', nextAppState => {
    if (nextAppState === 'active') {
      checkPermissions();
    }
  });

  return () => {
    mounted = false;
    subscription.remove();
  };
}, []);

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
              try {
                const res = await VolumeManager.getVolume();
                if (!res) return undefined;
                const v = res as any;
                // Priorité au flux notification, surtout sur Samsung
                if (typeof v.notification === 'number') return v.notification;
                if (typeof v.ring === 'number') return v.ring;
                if (typeof v.system === 'number') return v.system;
                if (typeof v.volume === 'number') return v.volume;
                return undefined;
              } catch (e) {
                return undefined;
              }
            };

            const mode = await VolumeManager.getRingerMode();
            if (mounted && typeof mode === 'number') {
              setRingerMode(mode);
            }

            const vol = await readNotificationVolume();
            if (mounted && vol !== undefined) {
              setNotificationVolume(vol);
              // On laisse le second useEffect gérer l'affichage de la bannière
            }

            // Écouter les changements de volume
            const volListener = VolumeManager.addVolumeListener((result) => {
              if (!mounted) return;
              const type = result?.type;
              const vol = result?.volume;
              if (vol === undefined) return;

              if (type === 'notification') {
                setNotificationVolume(vol);
              } else if (isSamsungDevice) {
                // Sur Samsung, OneUI peut router les changements de volume de manière complexe.
                // On re-lit systématiquement le volume des notifications pour tout type d'événement volume
                // (musique, alarme, etc.) au cas où cela impacterait indirectement les notifications.
                readNotificationVolume().then((v) => {
                  if (mounted && v !== undefined) setNotificationVolume(v);
                });
              } else if (!isSamsungDevice && (!type || ['notification', 'ring', 'system'].includes(type))) {
                // Pour les autres (Pixel...), on conserve le comportement de lien par défaut
                setNotificationVolume(vol);
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

              // Re-évaluer le volume de notification
              readNotificationVolume().then((notifVol) => {
                if (mounted && notifVol !== undefined) {
                  setNotificationVolume(notifVol);
                }
              });
            });
            ringerListenerRef.current = ringListener;
          } catch (e) {
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
    // Sur Samsung, on suit strictement le volume (isSilent) pour décider de l'affichage,
    // car l'utilisateur veut voir le message disparaître dès qu'il remonte le volume.
    const androidCanShow =
      Platform.OS === 'android'
        ? (isSamsungDevice ? isSilent : (ringerMode !== RINGER_MODE.normal || isSilent))
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
      showToast(`${i18n.t('connection_error_title')}\n${i18n.t('check_connection_body')}`);
      lastOfflineToastTimeRef.current = now;
    }
  };

  useEffect(() => {
    if (refreshTrigger === refreshTriggerRef.current) {
      return;
    }
    refreshTriggerRef.current = refreshTrigger;
    refreshAllData();
  }, [refreshTrigger, refreshAllData]);

  // Configurer la subscription Realtime pour écouter les changements sur friends
  const setupRealtimeSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('friends-changes')
        // 1. Changements sur les relations d'amitié (JE suis user_id ou friend_id)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'friends', filter: `user_id=eq.${user.id}` },
          () => {
            if (__DEV__) console.log('🔔 [Realtime] Change (I am user_id)');
            queryClient.invalidateQueries({ queryKey: ['friends', user.id] });
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'friends', filter: `friend_id=eq.${user.id}` },
          () => {
            if (__DEV__) console.log('🔔 [Realtime] Change (I am friend_id)');
            queryClient.invalidateQueries({ queryKey: ['friends', user.id] });
          }
        )
        // 2. Changements sur les demandes d'identité
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'identity_reveals' },
          () => {
            queryClient.invalidateQueries({ queryKey: ['identityRequests', user.id] });
          }
        )
        // 3. Messages entrants (optimisation UX + Invalidation)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pending_messages', filter: `to_user_id=eq.${user.id}` },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newMessage = payload.new as any;
              if (__DEV__) console.log('🔔 [Realtime] New Message incoming!');

              // Invalidation TanStack
              queryClient.invalidateQueries({ queryKey: ['pendingMessages', user.id] });
              queryClient.invalidateQueries({ queryKey: ['friends', user.id] });

              // Mise à jour optimiste du tri
              const now = newMessage.created_at || new Date().toISOString();
              setAppUsers((prev) => {
                const updated = prev.map((f) =>
                  f.id === newMessage.from_user_id ? { ...f, last_interaction_at: now } : f
                );
                return sortFriends(updated);
              });
              scheduleAlignFriendListTop();
            } else if (payload.eventType === 'DELETE') {
              queryClient.invalidateQueries({ queryKey: ['pendingMessages', user.id] });
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
        // 4. Messages sortants (INSERT, UPDATE, DELETE)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pending_messages', filter: `from_user_id=eq.${user.id}` },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const toUserId = (payload.new as any)?.to_user_id;
              const text = (payload.new as any)?.message_content;
              const ts = (payload.new as any)?.created_at || new Date().toISOString();
              const id = (payload.new as any)?.id;

              if (toUserId && text && id) {
                setLastSentMessages((prev) => {
                  const existingMessages = prev[toUserId] || [];
                  if (existingMessages.some(m => m.id === id)) return prev;
                  const parsed = parseMessageContent(text);
                  const nextList = [...existingMessages, { text: parsed.text, ts, id, soundKey: parsed.soundKey }];
                  const next = { ...prev, [toUserId]: nextList };
                  updateLastSentIndex(next);
                  saveLastSentMessagesCache(next);
                  return next;
                });
              }
            } else if (payload.eventType === 'UPDATE') {
              queryClient.invalidateQueries({ queryKey: ['pendingSentMessages', user.id] });
              const toUserId = (payload.new as any)?.to_user_id;
              const text = (payload.new as any)?.message_content;
              const id = (payload.new as any)?.id;
              if (text && toUserId) {
                const parsed = parseMessageContent(text);
                if (parsed.isRead) {
                  setLastSentMessages((prev) => {
                    const messages = prev[toUserId];
                    if (!Array.isArray(messages)) return prev;
                    const matchIndex = messages.findIndex(msg => msg.id === id);
                    if (matchIndex === -1) return prev;

                    const updatedMsg = {
                      ...messages[matchIndex],
                      status: 'read' as const,
                      readAt: Date.now(),
                    };
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
        // 5. Listener global DELETE pour synchroniser lastSentMessages
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'pending_messages' },
          (payload) => {
            const deletedId = (payload.old as any)?.id;
            if (deletedId) {
              setLastSentMessages((prev) => {
                const copy = { ...prev };
                let found = false;
                Object.entries(copy).forEach(([userId, messages]) => {
                  if (Array.isArray(messages)) {
                    const messageIndex = messages.findIndex(msg => msg.id === deletedId);
                    if (messageIndex !== -1) {
                      found = true;
                      // PRRT! Protocol v3 : On marque comme lu, on ne supprime pas localement
                      // même si le chat est fermé (pour que l'utilisateur voie le statut 'lu')
                      copy[userId] = messages.map((msg, idx) =>
                        idx === messageIndex ? { ...msg, status: 'read' as const, readAt: Date.now() } : msg
                      );
                    }
                  }
                });
                if (found) {
                  updateLastSentIndex(copy);
                  saveLastSentMessagesCache(copy);
                  return copy;
                }
                return prev;
              });
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

              // PRRT! Protocol v3 : On ne supprime JAMAIS un message dès qu'il est lu.
              // On le marque comme 'read' pour qu'il soit grisé. 
              // Il disparaîtra seulement après expiration du TTL (24h) ou purge manuelle.
              if (CHAT_VERBOSE_LOGS) console.log(`📨 [CLIENT] Marquage des messages comme lus (chat ouvert: ${isChatOpen})`);
              
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
                // Si on a reçu un broadcast mais qu'on ne trouve pas le message localement, 
                // on déclenche un refresh pour être sûr de synchroniser.
                DeviceEventEmitter.emit('REFRESH_DATA', { source: 'friendslist_update' });
                return prev;
              }
              
              // Déclencher aussi un rafraîchissement global en arrière-plan
              setTimeout(() => DeviceEventEmitter.emit('REFRESH_DATA', { source: 'friendslist_update_timeout' }), 500);
              
              const readCount = updated.filter(m => m.status === 'read').length;
              if (CHAT_VERBOSE_LOGS) {
                console.log(`✅ [CLIENT] Broadcast READ appliqué pour ${targetUserId}, ${readCount} messages marqués comme lus`);
              }
              const next: LastSentMap = { ...prev, [targetUserId]: updated };
              updateLastSentIndex(next);
              saveLastSentMessagesCache(next);
              return next;
            });

            // Un seul refresh après le batch, MAIS éviter de re-fetcher immédiatement pour ne pas écraser l'état local
            // avec des données serveur potentiellement pas encore à jour (suppression asynchrone).
            // Le broadcast suffit pour l'UI immédiate.
            // refreshAllData(); 
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
      
      queryClient.invalidateQueries({ queryKey: ['pendingRequests'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    } catch (e) { 
      console.error("Erreur handleAccept:", e);
      Alert.alert(i18n.t('error'), i18n.t('cannot_accept_request')); 
    }
  };

  const handleReject = async (requestId: string) => {
    try { 
      await supabase.from('friends').delete().eq('id', requestId); 
      queryClient.invalidateQueries({ queryKey: ['pendingRequests'] });
    } catch (e) {}
  };

  const handleMuteFriend = useStableCallback(async (friend: any) => {
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
      // On invalide simplement la query
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
    } catch (e) {
      console.error('❌ Erreur mise en sourdine:', e);
      Alert.alert(i18n.t('error'), "Impossible d'activer la sourdine.");
    }
  });

  const handleUnmuteFriend = useStableCallback(async (friend: any) => {
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
      // On invalide simplement la query
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
    } catch (e) {
      console.error('❌ Erreur désactivation sourdine:', e);
      Alert.alert(i18n.t('error'), i18n.t('cannot_disable_mute'));
    }
  });

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

  const handleDeleteFriend = useStableCallback(async (friend: any) => {
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
              await AsyncStorage.setItem('cached_blocked_users_v1', JSON.stringify(nextBlocked));
              
              // Invalider les requêtes pour rafraîchir globalement
              void queryClient.invalidateQueries({ queryKey: ['blockedUsers'] });
              void queryClient.invalidateQueries({ queryKey: ['friends'] });

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
  });

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

  const handleLongPressName = useStableCallback(async (friend: any) => {
    if (isModalTransitionActive()) return;
    if (friendSoundModalVisible) return;
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

            const matchingContact = contacts.find((contact: any) => {
              if (!contact.phoneNumbers || contact.phoneNumbers.length === 0) return false;
              return contact.phoneNumbers.some((phoneNumber: any) => {
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
  });

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
      refreshAllData();
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
    if (keyboardVisibleRef.current) {
      scrollToActiveFriend(expandedFriendId);
      pendingCenterScrollFriendIdRef.current = null;
      return;
    }
    // Sinon, on attend l'event clavier (voir onShow). Fallback si jamais le clavier ne s'affiche pas.
    const t = setTimeout(() => {
      if (
        pendingCenterScrollFriendIdRef.current === expandedFriendId &&
        !keyboardVisibleRef.current
      ) {
        scrollToActiveFriend(expandedFriendId);
        pendingCenterScrollFriendIdRef.current = null;
      }
    }, 350);
    return () => clearTimeout(t);
  }, [expandedFriendId, appUsers, searchQuery]);

  useEffect(() => {
    const onShow = (event?: { endCoordinates?: { height?: number } }) => {
      keyboardVisibleRef.current = true;
      
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
      keyboardVisibleRef.current = false;
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
    if (keyboardVisibleRef.current) return;
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
  }, [expandedFriendId, pendingChatSpecificSoundListCategory]);

  useEffect(() => {
    if (expandedFriendId) {
      lastStickyOpenAtRef.current = Date.now();
      refocusOnHideAttemptedRef.current = false;
      refocusOnBlurAttemptedRef.current = false;
      setIsChatSoundPickerVisible(false);
      // A l'ouverture du chat : pas d’icône catégorie active ; défaut proot pour les envois sans son listé.
      const ambient = getDefaultSoundCategoryForFirstLaunch() as ChatMessageSoundChoice;
      setChatMessageSoundChoice(ambient);
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

  const handlePressFriend = useStableCallback((friend: any) => {
    if (isModalTransitionActive()) return;
    if (identityModalVisible || isFirstChatModalVisible) return;

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
          pendingSoundKey: friendSoundKeyByFriend[friend.id] || '',
        },
      },
      { skipInitialCheck: true, immediate: true }
    );
  });

  const handleSendProut = useStableCallback(async (
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
          randomKey = getChatRandomSound(recipient.id);
        }
      } else {
        const forcedFriendSoundKey = friendSoundKeyByFriend[recipient.id];
        if (forcedFriendSoundKey && SOUND_ASSETS[forcedFriendSoundKey]) {
          randomKey = forcedFriendSoundKey;
          // Son spécifique = one-shot : on le consomme pour cet envoi uniquement.
          setFriendSpecificSoundKey(recipient.id, null);
        } else {
          randomKey = await getNextRandomSound(recipient.id);
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
      if (!isSilentMessage) {
        playLocalSound(randomKey);
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
            i18n.t('notifications_not_enabled', { pseudo: recipient.pseudo }),
            [
              { text: i18n.t('ok'), style: 'cancel' },
              { 
                text: i18n.t('retry'), 
                onPress: () => {
                  if (CHAT_VERBOSE_LOGS) console.log(`🔄 [CLIENT] Retry loadData suite à token manquant`);
                  refreshAllData();
                } 
              }
            ]
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
          if (CHAT_VERBOSE_LOGS) console.log(`📤 [CLIENT] Message envoyé ajouté (total: ${(next as LastSentMap)[recipient.id]?.length || 0} messages pour ${recipient.id})`);
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
      setMessageDrafts(prev => ({ ...prev, [recipient.id]: '' }));
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
        // Invalider les amis pour rafraîchir la liste
        void queryClient.invalidateQueries({ queryKey: ['friends'] });
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
  });


  const renderRequestsHeader = () => {
    const hasRequests = pendingRequests.length > 0 || identityRequests.length > 0;
    const shouldShowSilentWarning = showSilentWarning && !dismissedSilentWarning;
    const shouldShowPermissionWarning = showPermissionWarning && !dismissedPermissionWarning;

    if (!hasRequests && !shouldShowSilentWarning && !shouldShowPermissionWarning) return null;

    return (
      <View style={styles.requestsContainer}>
        {shouldShowPermissionWarning && (
          <View style={styles.silentWarning}>
            <Text style={styles.silentWarningText}>{i18n.t('notifications_disabled_warning')}</Text>
            <View style={styles.silentWarningActions}>
              <TouchableOpacity style={styles.silentWarningButton} onPress={() => Linking.openSettings()}>
                <Text style={styles.silentWarningButtonText}>{i18n.t('settings')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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

  const displayFriend = useMemo(() => {
    const activeFriend = expandedFriendId ? appUsers.find(u => u.id === expandedFriendId) : null;
    const lastActiveFriendRef = { current: null as any };
    if (activeFriend) {
      lastActiveFriendRef.current = activeFriend;
    }
    return activeFriend || lastActiveFriendRef.current;
  }, [expandedFriendId, appUsers]);

  const handlePressHeader = useCallback(() => {
    Keyboard.dismiss();
    setExpandedFriendId(null);
    if (searchQuery.trim()) {
      onSearchQueryChange?.('');
      onSearchChange?.(false);
    }
  }, [searchQuery, onSearchQueryChange, onSearchChange]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setShowFriendlistRecoveryCard(false);
    if ((appUsersRef.current?.length ?? 0) === 0) {
      setLoading(true);
    }
    if (__DEV__) console.log('🔄 [FriendsList] Refresh manuel...');
    await refreshAllData();
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

  const unreadMessagesMap = useMemo(() => {
    const map: Record<string, typeof pendingMessages> = {};
    pendingMessages.forEach(m => {
      if (!m.isPendingDelete && !(m.message_content?.startsWith('READ:') ?? false)) {
        if (!map[m.from_user_id]) {
          map[m.from_user_id] = [];
        }
        map[m.from_user_id].push(m);
      }
    });
    return map;
  }, [pendingMessages]);

  const content = (
    <View style={styles.container}>
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

        {/* @ts-expect-error - FlashList types might be incomplete but estimatedItemSize is required for performance */}
        <FlashList
        ref={flatListRef}
        data={filteredUsers}
        estimatedItemSize={70}
        extraData={{
          unreadMessagesMap,
          unreadCache,
          expandedUnreadId,
        }}
        keyExtractor={(item) => item.id}

        style={styles.list}        // Android a besoin de 'always' pour bien gérer les clics quand le clavier est là
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
          !(isSamsungDevice && expandedFriendId)
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 300 },
        ]}
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
          loading && !showFriendlistRecoveryCard ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 }}>
              <ActivityIndicator size="large" color="#604a3e" />
            </View>
          ) : (
            <View style={styles.emptyCard}>
              {showFriendlistRecoveryCard && !searchQuery.trim() ? (
                <>
                  <Text style={styles.emptyText}>{i18n.t('connection_error_title')}</Text>
                  <Text style={styles.subText}>{i18n.t('friendlist_loading_too_long')}</Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => void handleRefresh()}
                    style={styles.friendlistRecoveryButton}
                  >
                    <Text style={styles.friendlistRecoveryButtonText}>{i18n.t('reload_list')}</Text>
                  </TouchableOpacity>
                </>
              ) : searchQuery.trim() ? (
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
          const unreadMessages = unreadMessagesMap[item.id] || [];
          const hasUnread = unreadMessages.length > 0;
          
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
              swipeImageSource={getSwipeImageForSoundKey(friendSoundKeyByFriend[item.id])}
              onSendProut={handleSendProut}
              onLongPressAvatar={handleLongPressName}
              onLongPressRow={handleLongPressSoundCategory}
              onPressName={handlePressFriend}
              hasUnread={hasUnread}
              unreadMessage={truncateContactPreview(unreadMessages[unreadMessages.length - 1]?.message_content) || (hasUnread && unreadMessages.length > 1 ? `${unreadMessages.length} messages` : null)}
              onDeleteFriend={handleDeleteFriend}
              onMuteFriend={handleMuteFriend}
              onUnmuteFriend={handleUnmuteFriend}
              isMuted={item.is_muted || false}
              introDelay={index * 40}
              introTrigger={listIntroTrigger}
              selectedSoundKey={friendSoundKeyByFriend[item.id]}
              onClearSelectedSound={handleClearSelectedSound}
            />
          );
        }}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        showsVerticalScrollIndicator={false}
      />

      <ProotSilenceChallenge isVisible={isGameVisible} onClose={() => setIsGameVisible(false)} />

      <ChatModal
        expandedFriendId={expandedFriendId}
        onClose={handlePressHeader}
        displayFriend={displayFriend}
        appUsers={appUsers}
        pendingMessages={pendingMessages}
        unreadCache={unreadCache}
        lastSentMessages={lastSentMessages}
        messageDrafts={messageDrafts}
        onDraftChange={handleDraftChange}
        onSendMessage={handleSendProut}
        sendingFriendId={sendingFriendId}
        isChatMuteEnabled={isChatMuteEnabled}
        toggleChatMute={toggleChatMute}
        isChatSoundPickerVisible={isChatSoundPickerVisible}
        chatSpecificSoundListCategory={chatSpecificSoundListCategory}
        pendingChatSpecificSoundListCategory={pendingChatSpecificSoundListCategory}
        pendingChatSoundKeyByFriend={pendingChatSoundKeyByFriend}
        openChatSoundPicker={openChatSoundPicker}
        switchChatSoundListCategoryIfOpen={switchChatSoundListCategoryIfOpen}
        closeChatSpecificSoundList={closeChatSpecificSoundList}
        handleSelectChatSpecificSound={handleSelectChatSpecificSound}
        openReportReasonSheet={openReportReasonSheet}
        isFirstChatModalVisible={isFirstChatModalVisible}
        closeFirstChatModal={closeFirstChatModal}
        playLocalSound={playLocalSound}
        fadingOutReceivedMessages={fadingOutReceivedMessages}
        insets={insets}
        getDisplaySoundLabel={getDisplaySoundLabel}
        setPendingChatSoundKeyByFriend={setPendingChatSoundKeyByFriend}
        setChatMessageSoundChoice={setChatMessageSoundChoice}
        getDefaultSoundCategoryForFirstLaunch={getDefaultSoundCategoryForFirstLaunch}
        isSamsungDevice={isSamsungDevice}
        isHuaweiDevice={isHuaweiDevice}
        isOldAndroid={isOldAndroid}
        oldAndroidInputProps={oldAndroidInputProps}
        CHAT_PROOTHAIL_THUMB={CHAT_PROOTHAIL_THUMB}
        TOOT_LOGO_IMAGE={TOOT_LOGO_IMAGE}
        TOOT_CHAT_ICON_SIZE={TOOT_CHAT_ICON_SIZE}
        CHAT_SPECIFIC_MIN_HEIGHT={CHAT_SPECIFIC_MIN_HEIGHT}
        PICKUP_TRLL_KEYS={PICKUP_TRLL_KEYS}
        PICKUP_TOOT_KEYS={PICKUP_TOOT_KEYS}
        PICKUP_BZZZ_KEYS={PICKUP_BZZZ_KEYS}
        PICKUP_POP_KEYS={PICKUP_POP_KEYS}
        PICKUP_MOOD_KEYS={PICKUP_MOOD_KEYS}
        isSearchVisible={isSearchVisible}
        onSearchChange={onSearchChange || (() => {})}
        onSearchQueryChange={onSearchQueryChange || (() => {})}
      />

      {toastMessage && (
        <RNAnimated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </RNAnimated.View>
      )}

      <FriendSoundPickModal
        isVisible={friendSoundModalVisible}
        onClose={closeFriendSoundPickModal}
        onModalShow={() => setIsFriendSoundModalContentVisible(true)}
        onModalHide={() => setIsFriendSoundModalContentVisible(false)}
        isContentVisible={isFriendSoundModalContentVisible}
        friend={friendSoundModalFriend}
        friendSoundKeyByFriend={friendSoundKeyByFriend}
        previewingFriendSoundKey={previewingFriendSoundKey}
        onPreviewSound={handlePreviewFriendSpecificSoundKey}
        onSelectSound={handleSelectFriendSpecificSoundKey}
        getDisplaySoundLabel={getDisplaySoundLabel}
        getChooseSoundCategorySubtitleKey={getChooseSoundCategorySubtitleKey}
        globalDefaultCategory={globalDefaultCategory}
        onSelectGlobalDefaultCategory={handleSelectGlobalDefaultCategory}
        CHAT_PROOTHAIL_THUMB={CHAT_PROOTHAIL_THUMB}
        TOOT_LOGO_IMAGE={TOOT_LOGO_IMAGE}
        TOOT_PICK_HEADER_SIZE={TOOT_PICK_HEADER_SIZE}
        MOOD_PICK_HEADER_SIZE={MOOD_PICK_HEADER_SIZE}
        SHOW_DEFAULT_SOUND_CATEGORY_CURSOR={SHOW_DEFAULT_SOUND_CATEGORY_CURSOR}
        DEFAULT_SOUND_OPTION_ROWS={DEFAULT_SOUND_OPTION_ROWS}
        MOOD_DEFAULT_CATEGORY_CURSOR_SIZE={MOOD_DEFAULT_CATEGORY_CURSOR_SIZE}
        TOOT_CURSOR_ICON_SIZE={TOOT_CURSOR_ICON_SIZE}
        PICKUP_TOOT_KEYS={PICKUP_TOOT_KEYS}
        PICKUP_MOOD_KEYS={PICKUP_MOOD_KEYS}
        PICKUP_POP_KEYS={PICKUP_POP_KEYS}
        PICKUP_TRLL_KEYS={PICKUP_TRLL_KEYS}
        PICKUP_BZZZ_KEYS={PICKUP_BZZZ_KEYS}
      />

      <ReportReasonModal
        isVisible={reportReasonModalVisible}
        onClose={closeReportReasonModal}
        onModalShow={() => {
          if (reportReasonModalEnableTimeoutRef.current) {
            clearTimeout(reportReasonModalEnableTimeoutRef.current);
          }
          reportReasonModalEnableTimeoutRef.current = setTimeout(() => {
            setReportReasonModalReady(true);
            reportReasonModalEnableTimeoutRef.current = null;
          }, 350);
        }}
        isReady={reportReasonModalReady}
        onSelectReason={handleAndroidReportReason}
      />

      <IdentityModal
        isVisible={identityModalVisible}
        onClose={closeIdentityModal}
        friend={identityModalFriend}
        friendName={identityModalName}
        onModalShow={() => {}}
        onModalHide={() => {}}
        onRequestIdentityReveal={requestIdentityReveal}
      />
    </View>
  );

  if (isFriendsLoading && appUsers.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ebb89b' }}>
        <ActivityIndicator size="large" color="#604a3e" />
      </View>
    );
  }

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
  friendlistRecoveryButton: {
    marginTop: 16,
    alignSelf: 'center',
    backgroundColor: '#604a3e',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  friendlistRecoveryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
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
  identityModal: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 0,
  },
});
