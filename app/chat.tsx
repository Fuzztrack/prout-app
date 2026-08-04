import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated as RNAnimated,
  DeviceEventEmitter,
  FlatList,
  Image,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  NativeModules,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Modal from 'react-native-modal';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import Animated, {
  FadeInUp,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import { useChatStore, type PendingMessage, type VisibleSentMessage } from '@/lib/chatStore';
import i18n from '@/lib/i18n';
import { safePush } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import {
  fetchPendingReceivedViaBackend,
  fetchPendingSentViaBackend,
  markConversationReadViaBackend,
  purgeChatViaBackend,
  sendProutViaBackend,
} from '@/lib/sendProutBackend';
import {
  getDefaultSoundCategoryForFirstLaunch,
  getDisplaySoundLabel,
  getPickupKeys,
  getSelectedSoundCategory,
  pickRandom,
  pickRandomWithoutImmediateRepeat,
  playSound,
} from '@/lib/audioService';
import {
  DIRECT_SEND_FALLBACK_CATEGORY,
  SOUND_ASSETS,
  SOUND_KEYS_BY_CATEGORY,
} from '@/lib/runtimeSounds';

import { ReceivedBubble } from '@/components/chat/ReceivedBubble';
import { SentBubble } from '@/components/chat/SentBubble';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { chatStyles as bubbleStyles } from '@/components/chat/chatStyles';

type ParsedMessage = {
  text: string;
  isRead: boolean;
  soundKey?: string;
};

type FriendProfile = {
  id: string;
  pseudo: string;
  avatar_url: string | null;
  expo_push_token: string | null;
  push_platform: 'ios' | 'android' | null;
  is_zen_mode: boolean;
};

type ReportReason = 'spam' | 'harassment' | 'hate_speech' | 'explicit_content' | 'other';

type ReportTarget = {
  senderId: string;
  sourceMessageId?: string | null;
  createdAt?: string;
};

type MessageReaction = {
  message_id: string;
  reactor_user_id: string;
  emoji: string;
  message_sender_id: string;
  message_receiver_id: string;
  updated_at?: string;
};

type PendingReactionTarget = {
  messageId: string;
  messageSenderId: string;
  messageReceiverId: string;
};

const FRIEND_SOUND_CATEGORY_MAP_KEY = 'friend_sound_category_map_v1';
const CHAT_MESSAGE_MUTE_KEY = 'chat_message_mute_v2';
/** Même clé que FriendsList : tuto « page chat » à la première ouverture d’un chat. */
const FIRST_CHAT_MODAL_KEY = 'first_chat_modal_seen_v2';
const ACTIVE_CHAT_FRIEND_ID_KEY = 'active_chat_friend_id_v1';
const QUICK_REACTIONS = ['❤️', '😂', '😘', '💨', '😍', '😮', '😢', '😡', '👍', '🔥'] as const;
type ChatMessageSoundChoice = 'trll' | 'bzzz' | 'pop' | 'mood' | 'toot';
const PICKUP_TRLL_KEYS = getPickupKeys('trll');
const PICKUP_BZZZ_KEYS = getPickupKeys('bzzz');
const PICKUP_POP_KEYS = getPickupKeys('pop');
const PICKUP_MOOD_KEYS = getPickupKeys('mood');
const PICKUP_TOOT_KEYS = getPickupKeys('toot');
const MAX_PICKUP_ROWS = Math.ceil(
  Math.max(
    PICKUP_TRLL_KEYS.length,
    PICKUP_BZZZ_KEYS.length,
    PICKUP_POP_KEYS.length,
    PICKUP_MOOD_KEYS.length,
    PICKUP_TOOT_KEYS.length
  ) / 2
);
const CHAT_SPECIFIC_ROW_HEIGHT = 34;
const CHAT_SPECIFIC_BOTTOM_GAP = 30;
const CHAT_SPECIFIC_MIN_HEIGHT = MAX_PICKUP_ROWS * CHAT_SPECIFIC_ROW_HEIGHT + 50 + CHAT_SPECIFIC_BOTTOM_GAP;
const TOOT_LOGO_IMAGE = require('../assets/images/proot.png');
const CHAT_PROOTHAIL_THUMB = Platform.OS === 'android'
  ? require('../assets/images/proothail2.png')
  : require('../assets/images/proothail2.png');
const TOOT_CHAT_ICON_SIZE = Platform.OS === 'android' ? { width: 82, height: 55 } : { width: 84, height: 56 };
const ANDROID_CHAT_BACKGROUND_HERO_SIZE = 520;
const ANDROID_CHAT_THUMB_SIZE = { width: 48, height: 48 };

const androidBrand = String((Platform.constants as { Brand?: string; Manufacturer?: string } | undefined)?.Brand
  || (Platform.constants as { Brand?: string; Manufacturer?: string } | undefined)?.Manufacturer
  || '');
const isSamsungAndroid = Platform.OS === 'android' && /samsung/i.test(androidBrand);

function parseMessageContent(raw?: string | null): ParsedMessage {
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
}

function stripReadPrefix(text?: string | null) {
  return parseMessageContent(text).text;
}

function isUuid(value?: string | null) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const AnimatedMessageRow = React.memo(({ isMe, messageId, isNew, children }: { isMe: boolean, messageId: string, isNew?: boolean, children: React.ReactNode }) => {
  const [hasEntered, setHasEntered] = useState(false);
  
  useEffect(() => {
    setHasEntered(true);
  }, [messageId]);

  return (
    <Animated.View 
      entering={(!hasEntered && isNew) ? FadeInUp.duration(300) : undefined}
      layout={LinearTransition.springify().damping(15)}
      style={isMe ? bubbleStyles.sentRow : bubbleStyles.receivedRow}
    >
      {children}
    </Animated.View>
  );
});

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ friendId?: string; pseudo?: string; pendingSoundKey?: string }>();
  const friendId = typeof params.friendId === 'string' ? params.friendId : '';
  const pseudoParam = typeof params.pseudo === 'string' ? params.pseudo : '';
  const pendingSoundKeyParam = typeof params.pendingSoundKey === 'string' ? params.pendingSoundKey : '';

  const isZenMode = useAppStore(state => state.isZenMode);
  const isSilentMode = useAppStore(state => state.isSilentMode);
  const isHapticEnabled = useAppStore(state => state.isHapticEnabled);
  const storePseudo = useAppStore(state => state.pseudo);
  const storeUserId = useAppStore(state => state.userId);

  const receivedByFriend = useChatStore(state => state.receivedByFriend);
  const sentByFriend = useChatStore(state => state.sentByFriend);
  const messageReactionsByFriend = useChatStore(state => state.messageReactionsByFriend);
  const addReceivedMessages = useChatStore(state => state.addReceivedMessages);
  const addSentMessages = useChatStore(state => state.addSentMessages);
  const setReactions = useChatStore(state => state.setReactions);
  const retentionByFriend = useChatStore(state => state.retentionByFriend);
  const setRetentionHours = useChatStore(state => state.setRetentionHours);
  const cleanupExpired = useChatStore(state => state.cleanupExpired);
  const clearHistory = useChatStore(state => state.clearHistory);
  const savedMessages = useChatStore(state => state.savedMessageIds);
  const toggleSaveMessage = useChatStore(state => state.toggleSavedMessage);

  const retentionHours = retentionByFriend[friendId] ?? 12;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentPseudo, setCurrentPseudo] = useState<string>(storePseudo || 'Un ami');
  const [serverFriend, setServerFriend] = useState<FriendProfile | null>(null);
  const [draft, setDraft] = useState('');
  const [editingMessage, setEditingMessage] = useState<VisibleSentMessage | null>(null);

  // Initialisation à partir du store local
  const [receivedMessages, setReceivedMessages] = useState<PendingMessage[]>(receivedByFriend[friendId] || []);
  const [sentMessages, setSentMessages] = useState<VisibleSentMessage[]>(sentByFriend[friendId] || []);

  const handleMessageEdited = useCallback((messageId: string, newText: string) => {
    // 1. Mettre à jour l'état UI local pour un feedback immédiat
    setSentMessages((prev) => 
      prev.map((msg) => msg.id === messageId ? { ...msg, text: newText } : msg)
    );
    
    // 2. Mettre à jour le store permanent. 
    // On récupère le message existant pour conserver ses autres propriétés (ts, soundKey, etc.)
    const existing = sentMessages.find(m => ((m as any).sourceMessageId || m.id) === messageId);
    if (existing) {
      addSentMessages(friendId, [{ ...existing, text: newText }]);
    }
    
    setEditingMessage(null);
  }, [friendId, sentMessages, addSentMessages]);

  const optimisticFriend = useMemo((): FriendProfile | null => {
    if (!friendId || !isUuid(friendId)) return null;
    return {
      id: friendId,
      pseudo: pseudoParam || 'Ami',
      avatar_url: null,
      expo_push_token: null,
      push_platform: null,
      is_zen_mode: false,
    };
  }, [friendId, pseudoParam]);

  const friend = serverFriend ?? optimisticFriend;
  const profileConfirmed = !!serverFriend;

  useEffect(() => {
    setServerFriend(null);
  }, [friendId]);
  const [isChatMuteEnabled, setIsChatMuteEnabled] = useState(false);
  const [chatSoundPickerVisible, setChatSoundPickerVisible] = useState(false);
  const [chatSoundCategory, setChatSoundCategory] = useState<ChatMessageSoundChoice>(
    getDefaultSoundCategoryForFirstLaunch() as ChatMessageSoundChoice
  );
  const [pendingChatSoundKey, setPendingChatSoundKey] = useState<string | null>(null);
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastOpacity] = useState(new RNAnimated.Value(0));

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    RNAnimated.sequence([
      RNAnimated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      RNAnimated.delay(2500),
      RNAnimated.timing(toastOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(() => setToastMessage(null));
  }, [toastOpacity]);

  const [reportReasonModalVisible, setReportReasonModalVisible] = useState(false);
  const [pendingReportTarget, setPendingReportTarget] = useState<ReportTarget | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, MessageReaction[]>>(messageReactionsByFriend[friendId] || {});
  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [pendingReactionTarget, setPendingReactionTarget] = useState<PendingReactionTarget | null>(null);
  const [showFirstChatOnboarding, setShowFirstChatOnboarding] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // On remplit le Set des IDs connus avec ceux déjà présents en cache
  const knownIncomingMessageIdsRef = useRef<Set<string>>(new Set(receivedMessages.map(m => m.id)));
  const hasHydratedIncomingMessagesRef = useRef(false);
  const inputRef = useRef<TextInput | null>(null);
  const reopenKeyboardAfterSoundPickRef = useRef(false);
  const keyboardHeightSV = useSharedValue(0);
  const messageKeyMapRef = useRef(new Map<string, string>());

  const pulseScale = useSharedValue(1);

  // Nettoyage des messages expirés au montage
  useEffect(() => {
    // Si aucune rétention n'est définie pour cet ami, on force 12h par défaut dans le store
    if (friendId && retentionByFriend[friendId] === undefined) {
      setRetentionHours(friendId, 24);
    }
    cleanupExpired();
  }, [cleanupExpired, friendId, retentionByFriend, setRetentionHours]);

  const handleMessageSent = useCallback((msg: VisibleSentMessage) => {
    setSentMessages((prev) => [...prev, msg]);
  }, []);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 400 }),
        withTiming(1, { duration: 400 }),
        withTiming(1, { duration: 4200 }) // Wait the rest of the 5s
      ),
      -1,
      false
    );
  }, [pulseScale]);

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const currentUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useLayoutEffect(() => {
    if (storeUserId) {
      setCurrentUserId(storeUserId);
      return;
    }
    let cancelled = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && session?.user?.id) {
        setCurrentUserId(session.user.id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [storeUserId, friendId]);

  useEffect(() => {
    return () => {
      Keyboard.dismiss();
    };
  }, []);

  // --- SÉCURITÉ CLAVIER ---
  // On s'assure que le clavier est fermé quand on quitte l'écran (blur)
  useFocusEffect(
    useCallback(() => {
      return () => {
        Keyboard.dismiss();
      };
    }, [])
  );

  const loadChatContext = useCallback(async () => {
    if (!friendId) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      let user = sessionData?.session?.user ?? null;
      if (!user) {
        const { data: authData } = await supabase.auth.getUser();
        user = authData?.user ?? null;
      }
      if (!user) {
        safePush(router, '/(tabs)', { skipInitialCheck: false });
        return;
      }

      setCurrentUserId(user.id);

      let me = null;
      let friendProfile = null;
      
      try {
        const [meRes, friendRes] = await Promise.all([
          supabase.from('user_profiles').select('pseudo').eq('id', user.id).single(),
          supabase
            .from('user_profiles')
            .select('id, pseudo, avatar_url, expo_push_token, push_platform, is_zen_mode')
            .eq('id', friendId)
            .single(),
        ]);
        me = meRes.data;
        friendProfile = friendRes.data;
      } catch (e) {
        console.warn('⚠️ [Chat] Erreur réseau lors du chargement des profils:', e);
      }

      if (me?.pseudo) {
        setCurrentPseudo(me.pseudo);
      } else if (storePseudo) {
        setCurrentPseudo(storePseudo);
      }

      if (!friendProfile) {
        if (pseudoParam) {
          showToast("Impossible de se connecter...");
          setServerFriend(null);
          return;
        }

        Alert.alert(i18n.t('error'), 'Ami introuvable.');
        safePush(router, '/(tabs)', { skipInitialCheck: false });
        setServerFriend(null);
        return;
      }

      setServerFriend({
        id: friendProfile.id,
        pseudo: friendProfile.pseudo || pseudoParam || 'Ami',
        avatar_url: friendProfile.avatar_url || null,
        expo_push_token: friendProfile.expo_push_token || null,
        push_platform: (friendProfile.push_platform as 'ios' | 'android' | null) || null,
        is_zen_mode: !!friendProfile.is_zen_mode,
      });
    } catch (error) {
      console.error('❌ Erreur chargement chat:', error);
      showToast("Impossible de charger ce chat.");
    }
  }, [friendId, pseudoParam, router, storePseudo, showToast]);

  useEffect(() => {
    void loadChatContext();
  }, [loadChatContext]);

  useEffect(() => {
    if (!friendId) return;
    AsyncStorage.getItem(CHAT_MESSAGE_MUTE_KEY + '_' + friendId)
      .then((savedMute) => {
        setIsChatMuteEnabled(savedMute === '1');
      })
      .catch(() => {});
  }, [friendId]);

  useEffect(() => {
    if (pendingSoundKeyParam && SOUND_ASSETS[pendingSoundKeyParam]) {
      setPendingChatSoundKey(pendingSoundKeyParam);
      return;
    }
    setPendingChatSoundKey(null);
  }, [friendId, pendingSoundKeyParam]);

  useEffect(() => {
    if (!friend || !profileConfirmed) return;
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(FIRST_CHAT_MODAL_KEY);
        if (!cancelled && !seen) {
          setShowFirstChatOnboarding(true);
        }
      } catch {
        // non bloquant
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [friend, profileConfirmed]);

  const dismissFirstChatOnboarding = useCallback(async () => {
    setShowFirstChatOnboarding(false);
    try {
      await AsyncStorage.setItem(FIRST_CHAT_MODAL_KEY, '1');
    } catch {
      // non bloquant
    }
  }, []);

  const refreshMessages = useCallback(async () => {
    if (!currentUserId || !friendId) return;
    const [incoming, outgoing] = await Promise.all([
      fetchPendingReceivedViaBackend(currentUserId),
      fetchPendingSentViaBackend(currentUserId),
    ]);

    const filteredIncoming = (incoming || [])
      .filter((m: any) => m.from_user_id === friendId)
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) as PendingMessage[];

    // Sauvegarde dans le store persistant
    addReceivedMessages(friendId, filteredIncoming);

    const incomingIds = filteredIncoming.map((m) => m.id);
    const newIncoming = filteredIncoming.filter((m) => !knownIncomingMessageIdsRef.current.has(m.id));
    // knownIncomingMessageIdsRef est mis à jour dans le useEffect de sync

    if (!hasHydratedIncomingMessagesRef.current) {
      hasHydratedIncomingMessagesRef.current = true;
    } else if (newIncoming.length > 0 && Platform.OS === 'ios' && isHapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }

    const serverSent = ((outgoing || []) as any[])
      .filter((m) => m.to_user_id === friendId)
      .map((m) => {
        const parsed = parseMessageContent(m.message_content || '');
        return {
          id: m.id,
          text: parsed.text,
          soundKey: parsed.soundKey,
          ts: m.created_at,
          status: parsed.isRead ? ('read' as const) : undefined,
          readAt: parsed.isRead ? Date.now() : undefined,
          local_ts: 0,
        } satisfies VisibleSentMessage;
      })
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    // Sauvegarde dans le store persistant
    // ✅ On passe isFullSync: true car fetchPendingSentViaBackend nous donne TOUS les messages en attente
    // MAIS seulement si on a bien reçu une réponse du serveur (pas null)
    if (outgoing !== null) {
      addSentMessages(friendId, serverSent, true);
    } else {
      addSentMessages(friendId, serverSent, false);
    }
  }, [currentUserId, friendId, isHapticEnabled, addReceivedMessages, addSentMessages, retentionHours]);

  const triggerGlobalMessageRefresh = useCallback(() => {
    if (!currentUserId) return;
    queryClient.invalidateQueries({ queryKey: ['pendingMessages', currentUserId] });
    queryClient.invalidateQueries({ queryKey: ['pendingSentMessages', currentUserId] });
    queryClient.invalidateQueries({ queryKey: ['friends', currentUserId] });
    DeviceEventEmitter.emit('REFRESH_DATA', { source: 'triggerGlobalMessageRefresh' });
    void refreshMessages();
  }, [currentUserId, queryClient, refreshMessages]);

  useFocusEffect(
    useCallback(() => {
      void refreshMessages();
    }, [refreshMessages])
  );

  useFocusEffect(
    useCallback(() => {
      if (!friendId) return;

      const nativeSoundSettingsModule = NativeModules.SoundSettingsModule;
      AsyncStorage.setItem(ACTIVE_CHAT_FRIEND_ID_KEY, friendId).catch(() => {});
      nativeSoundSettingsModule?.setActiveChatFriendId?.(friendId);

      return () => {
        AsyncStorage.removeItem(ACTIVE_CHAT_FRIEND_ID_KEY).catch(() => {});
        nativeSoundSettingsModule?.clearActiveChatFriendId?.();
      };
    }, [friendId])
  );

  // Synchronisation avec le store persistant (pour l'hydratation et l'historique 12h)
  useEffect(() => {
    const fromStore = receivedByFriend[friendId] || [];
    setReceivedMessages(prev => {
      const next = [...prev];
      fromStore.forEach(m => {
        if (!next.some(em => em.id === m.id)) {
          next.push(m);
        }
      });
      return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
    knownIncomingMessageIdsRef.current = new Set(fromStore.map(m => m.id));
  }, [receivedByFriend, friendId]);

  useEffect(() => {
    const fromStore = sentByFriend[friendId] || [];
    
    // Migrate saved state for confirmed messages
    const state = useChatStore.getState();
    const migrations: { oldId: string, newId: string }[] = [];

    setSentMessages(prev => {
      const next = [...fromStore];
      
      prev.forEach(existing => {
        const matchingStoreMsg = fromStore.find(m => 
          m.id === existing.id || 
          (m.text === existing.text && m.soundKey === existing.soundKey)
        );
        const isRepresented = !!matchingStoreMsg;

        if (isRepresented && matchingStoreMsg && existing.id.startsWith('local-')) {
          messageKeyMapRef.current.set(matchingStoreMsg.id, existing.id);
          
          if (state.savedMessageIds[existing.id] && !state.savedMessageIds[matchingStoreMsg.id]) {
            migrations.push({ oldId: existing.id, newId: matchingStoreMsg.id });
          }
        }

        if (!isRepresented) {
          if (existing.optimistic) {
            next.push(existing);
          }
        }
      });

      return next.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    });

    if (migrations.length > 0) {
      migrations.forEach(mig => {
        state.toggleSavedMessage(mig.newId);
        state.toggleSavedMessage(mig.oldId);
      });
    }
  }, [sentByFriend, friendId, retentionHours]);

  const replaceReactionForMessage = useCallback((row: MessageReaction) => {
    setMessageReactions((prev) => {
      const nextRows = [...(prev[row.message_id] || []).filter((item) => item.reactor_user_id !== row.reactor_user_id), row]
        .sort((a, b) => (a.updated_at || '').localeCompare(b.updated_at || ''));

      const next = {
        ...prev,
        [row.message_id]: nextRows,
      };
      setReactions(friendId, next);
      return next;
    });
  }, [friendId, setReactions]);

  const removeReactionForMessage = useCallback((messageId: string, reactorUserId: string) => {
    setMessageReactions((prev) => {
      const existing = prev[messageId] || [];
      const nextRows = existing.filter((item) => item.reactor_user_id !== reactorUserId);

      let next;
      if (nextRows.length === 0) {
        const { [messageId]: _removed, ...rest } = prev;
        next = rest;
      } else {
        next = {
          ...prev,
          [messageId]: nextRows,
        };
      }
      setReactions(friendId, next);
      return next;
    });
  }, [friendId, setReactions]);

  const hydrateConversationReactions = useCallback((rows: MessageReaction[]) => {
    const grouped: Record<string, MessageReaction[]> = {};

    rows.forEach((row) => {
      if (!grouped[row.message_id]) {
        grouped[row.message_id] = [];
      }
      grouped[row.message_id].push(row);
    });

    Object.values(grouped).forEach((items) => {
      items.sort((a, b) => (a.updated_at || '').localeCompare(b.updated_at || ''));
    });

    setMessageReactions(grouped);
    setReactions(friendId, grouped);
  }, [friendId, setReactions]);

  const isReactionForCurrentConversation = useCallback(
    (row?: Partial<MessageReaction> | null) => {
      if (!row?.message_sender_id || !row?.message_receiver_id || !currentUserId || !friendId) return false;
      return (
        (row.message_sender_id === currentUserId && row.message_receiver_id === friendId) ||
        (row.message_sender_id === friendId && row.message_receiver_id === currentUserId)
      );
    },
    [currentUserId, friendId]
  );

  const loadConversationReactions = useCallback(async () => {
    if (!currentUserId || !friendId) return;

    const { data, error } = await supabase
      .from('message_reactions')
      .select('message_id, reactor_user_id, emoji, message_sender_id, message_receiver_id, updated_at')
      .or(
        `and(message_sender_id.eq.${currentUserId},message_receiver_id.eq.${friendId}),and(message_sender_id.eq.${friendId},message_receiver_id.eq.${currentUserId})`
      )
      .order('updated_at', { ascending: true });

    if (error) {
      console.error('❌ Erreur chargement réactions:', error);
      return;
    }

    hydrateConversationReactions((data || []) as MessageReaction[]);
  }, [currentUserId, friendId, hydrateConversationReactions]);

  useFocusEffect(
    useCallback(() => {
      void loadConversationReactions();
    }, [loadConversationReactions])
  );

  useFocusEffect(
    useCallback(() => {
      if (!currentUserId || !friendId) return;

      const channel = supabase
        .channel(`chat-direct-${currentUserId}-${friendId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pending_messages',
          },
          (payload: any) => {
            console.log('🔴 [CHAT_DEBUG] Realtime Event:', payload.eventType, payload);
            const { eventType, new: newData, old: oldData } = payload;

            if (eventType === 'INSERT') {
              const msg = newData as PendingMessage;
              if (!msg || msg.to_user_id !== currentUserId || msg.from_user_id !== friendId) return;

              const parsedMessage = parseMessageContent(msg.message_content);
              addReceivedMessages(friendId, [{ ...msg, local_ts: Date.now() }]);

              queryClient.invalidateQueries({ queryKey: ['pendingMessages', currentUserId] });
              queryClient.invalidateQueries({ queryKey: ['friends', currentUserId] });
              DeviceEventEmitter.emit('REFRESH_DATA', { source: 'chat_insert' });

              if (parsedMessage.soundKey && parsedMessage.soundKey !== 'mute') {
                void playSound(parsedMessage.soundKey);
              }

              if (Platform.OS === 'ios' && isHapticEnabled) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
              }
            } else if (eventType === 'UPDATE') {
              const updated = newData;
              if (!updated?.id) return;

              // 1. Si c'est un message que j'ai reçu qui a été édité
              if (updated.to_user_id === currentUserId && updated.from_user_id === friendId) {
                addReceivedMessages(friendId, [{ ...updated, local_ts: Date.now() }]);
                setReceivedMessages((prev) =>
                  prev.map((m) => (m.id === updated.id ? { ...m, message_content: updated.message_content } : m))
                );
              }

              // 2. Si c'est un message que j'ai envoyé qui a été marqué LU ou édité
              const currentSentByFriend = useChatStore.getState().sentByFriend[friendId] || [];
              const isMySentMsg = currentSentByFriend.some((m) => m.id === updated.id);
              if (isMySentMsg || updated.from_user_id === currentUserId) {
                console.log('✨ [CHAT_DEBUG] Message envoyé marqué LU en base de données:', updated.id);
                const parsed = parseMessageContent(updated.message_content);
                const serverSent: VisibleSentMessage = {
                  id: updated.id,
                  text: parsed.text,
                  soundKey: parsed.soundKey,
                  ts: updated.created_at || new Date().toISOString(),
                  status: parsed.isRead ? 'read' : undefined,
                  readAt: parsed.isRead ? Date.now() : undefined,
                  local_ts: 0,
                };

                addSentMessages(friendId, [serverSent]);
                triggerGlobalMessageRefresh();
              }
            } else if (eventType === 'DELETE') {
              if (!oldData) return;

              if (oldData.from_user_id === currentUserId && oldData.to_user_id === friendId) {
                triggerGlobalMessageRefresh();
              }

              if (oldData.to_user_id === currentUserId) {
                queryClient.invalidateQueries({ queryKey: ['pendingMessages', currentUserId] });
                queryClient.invalidateQueries({ queryKey: ['friends', currentUserId] });
                DeviceEventEmitter.emit('REFRESH_DATA', { source: 'chat_delete' });
              }
            }
          }
        )
        .on('broadcast', { event: 'message-read' }, (payload: any) => {
          console.log('📡 [CHAT_DEBUG] Broadcast message-read reçu direct:', payload);
          const readIds: string[] = Array.isArray(payload.payload?.ids) ? payload.payload.ids : [];
          
          if (readIds.length > 0) {
            useChatStore.getState().markMessagesAsRead(friendId, readIds);
            triggerGlobalMessageRefresh();
          } else {
            const currentSentByFriend = useChatStore.getState().sentByFriend[friendId] || [];
            if (currentSentByFriend.length > 0) {
              const updatedSent = currentSentByFriend.map(m => ({ ...m, status: 'read' as const, readAt: Date.now() }));
              addSentMessages(friendId, updatedSent);
              triggerGlobalMessageRefresh();
            }
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [currentUserId, friendId, isHapticEnabled, queryClient, triggerGlobalMessageRefresh, retentionHours, addReceivedMessages, addSentMessages])
  );

  useFocusEffect(
    useCallback(() => {
      if (!currentUserId || !friendId) return;

      const channel = supabase
        .channel(`chat-reactions-${currentUserId}-${friendId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'message_reactions',
          },
          (payload: any) => {
            const candidate = (payload.new || payload.old) as MessageReaction | undefined;
            if (!isReactionForCurrentConversation(candidate)) return;

            if (payload.eventType === 'DELETE' && payload.old) {
              const oldRow = payload.old as MessageReaction;
              removeReactionForMessage(oldRow.message_id, oldRow.reactor_user_id);
              return;
            }

            if (payload.new) {
              replaceReactionForMessage(payload.new as MessageReaction);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [currentUserId, friendId, isReactionForCurrentConversation, removeReactionForMessage, replaceReactionForMessage])
  );

  useEffect(() => {
    if (!currentUserId || !friendId) return;
    
    // On ne marque comme lu que s'il y a des messages reçus qui ne sont pas encore marqués READ:
    const hasUnread = receivedMessages.some((m) => {
      if (m.from_user_id !== friendId) return false;
      const parsed = parseMessageContent(m.message_content);
      return !parsed.isRead;
    });

    if (!hasUnread) return;
    
    console.log(`🚀 [PROOT_v1.1.41] Passage en lecture de la conversation avec ${friendId}`);

    // ✅ Mise à jour optimiste IMMÉDIATE du store local pour que FriendsList se mette à jour sans attendre le réseau
    const updatedMessages = receivedMessages.map(m => {
      if (m.from_user_id === friendId) {
        const parsed = parseMessageContent(m.message_content);
        if (!parsed.isRead) {
          return { ...m, message_content: `READ:${m.message_content || ''}` };
        }
      }
      return m;
    });
    useChatStore.getState().addReceivedMessages(friendId, updatedMessages);

    // ✅ 1. Mise à jour directe dans Supabase DB + Émission Broadcast immédiate vers l'expéditeur
    const unreadMsgs = receivedMessages.filter(m => m.from_user_id === friendId && !(m.message_content?.startsWith('READ:') ?? false));
    const unreadIds = unreadMsgs.map(m => m.id);

    if (unreadMsgs.length > 0) {
      console.log(`🚀 [PROOT_v1.1.41] Execution UPDATE Supabase direct pour ${unreadMsgs.length} messages non lus`);
      unreadMsgs.forEach(m => {
        const readContent = `READ:${m.message_content || ''}`;
        void supabase
          .from('pending_messages')
          .update({ message_content: readContent })
          .eq('id', m.id)
          .eq('to_user_id', currentUserId);
      });
    }

    // Broadcast ultra-rapide et garanti vers l'expéditeur (attente de l'état SUBSCRIBED WebSocket)
    const broadcastChannel = supabase.channel(`chat-direct-${friendId}-${currentUserId}`);
    broadcastChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await broadcastChannel.send({
          type: 'broadcast',
          event: 'message-read',
          payload: {
            senderId: friendId,
            receiverId: currentUserId,
            ids: unreadIds,
          },
        });
        setTimeout(() => {
          supabase.removeChannel(broadcastChannel);
        }, 1000);
      }
    });

    // Ensuite on confirme au backend
    // ✅ Nettoyage optimiste du cache TanStack Query pour éliminer la pastille verte dans la liste
    queryClient.setQueryData(['pendingMessages', currentUserId], (old: any[] | undefined) => {
      if (!old) return [];
      return old.filter((m: any) => m.from_user_id !== friendId);
    });

    void markConversationReadViaBackend(friendId, currentUserId).then(() => {
      console.log(`✅ [CHAT_DEBUG] Confirmation backend markConversationReadViaBackend terminée`);
      // ✅ Invalider TanStack Query pour synchroniser avec l'état serveur
      void queryClient.invalidateQueries({ queryKey: ['pendingMessages', currentUserId] });
    });
  }, [currentUserId, friendId, receivedMessages, queryClient]);

  useEffect(() => {
    return () => {
      // On utilise les refs pour avoir les valeurs à jour au moment du démontage réel
      const finalUserId = currentUserIdRef.current;
      const hours = useChatStore.getState().retentionByFriend[friendId] ?? 24;

      console.log(`🚪 [CHAT_DEBUG] Démontage du chat avec ${friendId} (retention: ${hours}h)`);

      if (finalUserId) {
        if (hours === 0 && friendId) {
          console.log(`🔥 [CHAT_DEBUG] Purge instantanée déclenchée pour friendId ${friendId}`);
          
          // 1. Nettoyage synchrone immédiat des caches locaux (Zustand + TanStack Query)
          queryClient.setQueryData(['pendingMessages', finalUserId], (old: any[] | undefined) => {
            if (!old) return [];
            return old.filter((m: any) => m.from_user_id !== friendId);
          });
          clearHistory(friendId);

          // 2. Attendre que la purge direct Supabase et backend se terminent avant d'invalider le cache
          const directDelete = supabase
            .from('pending_messages')
            .delete()
            .or(`and(from_user_id.eq.${finalUserId},to_user_id.eq.${friendId}),and(from_user_id.eq.${friendId},to_user_id.eq.${finalUserId})`);

          void Promise.all([directDelete, purgeChatViaBackend(finalUserId, friendId)]).then(([directRes]) => {
            console.log(`✅ [CHAT_DEBUG] Purge directe Supabase (${directRes.error ? directRes.error.message : 'OK'}) + backend terminée`);
            void queryClient.invalidateQueries({ queryKey: ['pendingMessages', finalUserId] });
            void queryClient.invalidateQueries({ queryKey: ['friends', finalUserId] });
          });
        } else {
          void queryClient.invalidateQueries({ queryKey: ['pendingMessages', finalUserId] });
        }
      }
    };
  }, [friendId, clearHistory, queryClient]); // On dépend de friendId car c'est lui qui définit la conversation

  useKeyboardHandler({
    onMove: (e: { height: number }) => {
      'worklet';
      if (Platform.OS !== 'android') return;
      keyboardHeightSV.value = e.height;
    },
    onStart: (e: { height: number }) => {
      'worklet';
      if (e.height > 0) {
        runOnJS(setIsKeyboardVisible)(true);
      }
    },
    onEnd: (e: { height: number }) => {
      'worklet';
      if (Platform.OS === 'android') {
        keyboardHeightSV.value = e.height;
      }
      runOnJS(setIsKeyboardVisible)(e.height > 0);
    },
  });

  // Ref pour traquer l'heure d'ouverture du chat
  const chatOpenedAtRef = useRef<number>(Date.now());

  const composerKeyboardStyle = useAnimatedStyle(() => {
    if (Platform.OS !== 'android') return {};
    const keyboardOffset = Math.max(0, keyboardHeightSV.value);
    return {
      marginBottom: keyboardOffset > 0 ? keyboardOffset + 5 : 0,
    };
  });

  const timeline = useMemo(() => {
    const incoming = receivedMessages.map((m) => {
      const parsed = parseMessageContent(m.message_content);
      const isNew = new Date(m.created_at).getTime() > chatOpenedAtRef.current;
      return {
        id: `received-${m.id}`,
        ts: m.created_at,
        isMe: false,
        text: parsed.text,
        soundKey: parsed.soundKey,
        sourceMessageId: m.id,
        isNew,
      };
    });

    // 1. Séparer les messages confirmés (UUID) et optimistes (local-)
    const confirmedSent = sentMessages.filter(m => !m.id.startsWith('local-'));
    const optimisticSent = sentMessages.filter(m => m.id.startsWith('local-'));

    // 2. Associer les ID optimistes aux ID confirmés
    // On parcourt les optimistes et on cherche le premier confirmé qui a le même contenu.
    const filteredOptimistic = optimisticSent.filter(opt => {
      // On cherche un message confirmé qui correspond
      const matchingConf = confirmedSent.find(conf => {
         const sameText = (conf.text || '') === (opt.text || '');
         const sameSound = (conf.soundKey || '') === (opt.soundKey || '');
         return sameText && sameSound;
      });

      if (matchingConf) {
        // Le miracle opère ici : on dit explicitement que le vrai message serveur (UUID)
        // DOIT utiliser l'identifiant local comme clé React, pour ne pas détruire le composant.
        messageKeyMapRef.current.set(matchingConf.id, opt.id);
        return false; // On cache le message optimiste puisqu'on a le vrai
      }
      return true; // Pas encore confirmé, on le garde visible
    });

    const outgoing = [...confirmedSent, ...filteredOptimistic].map((m) => {
      // Si le message est confirmé, on force l'utilisation de son ancienne clé 'local-'
      // s'il en a une. Sinon, on utilise son ID normal.
      const stableId = messageKeyMapRef.current.get(m.id) || m.id;
      const isNew = new Date(m.ts).getTime() > chatOpenedAtRef.current;

      return {
        id: `sent-${stableId}`,
        ts: m.ts,
        isMe: true,
        text: m.text,
        soundKey: m.soundKey,
        status: m.status,
        readAt: m.readAt,
        sourceMessageId: m.id,
        optimistic: m.id.startsWith('local-'),
        isNew,
      };
    });

    return [...incoming, ...outgoing].sort(
      (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
    );
  }, [receivedMessages, sentMessages]);

  const currentSoundChoices = useMemo(() => {
    switch (chatSoundCategory) {
      case 'trll':
        return PICKUP_TRLL_KEYS;
      case 'bzzz':
        return PICKUP_BZZZ_KEYS;
      case 'pop':
        return PICKUP_POP_KEYS;
      case 'mood':
        return PICKUP_MOOD_KEYS;
      case 'toot':
      default:
        return PICKUP_TOOT_KEYS;
    }
  }, [chatSoundCategory]);

  const chatCategoryIconInactive = useCallback(
    (category: ChatMessageSoundChoice) => chatSoundCategory !== category,
    [chatSoundCategory]
  );

  useEffect(() => {
    const fromStore = messageReactionsByFriend[friendId] || {};
    setMessageReactions(fromStore);
  }, [messageReactionsByFriend, friendId]);

  const getReactionBadgeText = useCallback(
    (messageId: string) => {
      const reactions = messageReactions[messageId] || [];
      return reactions.map((item) => item.emoji).filter(Boolean).join(' ');
    },
    [messageReactions]
  );

  const closeReportReasonModal = useCallback(() => {
    setReportReasonModalVisible(false);
    setPendingReportTarget(null);
  }, []);

  const submitReport = useCallback(
    async (reason: ReportReason, reportTarget: ReportTarget) => {
      if (!currentUserId) return;
      try {
        const { error } = await supabase.from('reports').insert({
          reporter_user_id: currentUserId,
          reported_user_id: reportTarget.senderId,
          message_id: isUuid(reportTarget.sourceMessageId) ? reportTarget.sourceMessageId : null,
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

  const openReportReasonSheet = useCallback((reportTarget: ReportTarget) => {
    if (Platform.OS === 'android') {
      setPendingReportTarget(reportTarget);
      setReportReasonModalVisible(true);
      return;
    }

    Alert.alert(i18n.t('report_conversation_title'), i18n.t('report_conversation_reason_prompt'), [
      { text: i18n.t('report_reason_spam'), onPress: () => void submitReport('spam', reportTarget) },
      { text: i18n.t('report_reason_harassment'), onPress: () => void submitReport('harassment', reportTarget) },
      { text: i18n.t('report_reason_hate_speech'), onPress: () => void submitReport('harassment', reportTarget) },
      { text: i18n.t('report_reason_explicit_content'), onPress: () => void submitReport('explicit_content', reportTarget) },
      { text: i18n.t('report_reason_other'), onPress: () => void submitReport('other', reportTarget) },
      { text: i18n.t('cancel'), style: 'cancel' },
    ]);
  }, [submitReport]);

  const handleAndroidReportReason = useCallback(
    (reason: ReportReason) => {
      const reportTarget = pendingReportTarget;
      closeReportReasonModal();
      if (!reportTarget) return;
      void submitReport(reason, reportTarget);
    },
    [closeReportReasonModal, pendingReportTarget, submitReport]
  );

  const openConversationReportSheet = useCallback(() => {
    if (!friend) return;
    openReportReasonSheet({
      senderId: friend.id,
    });
  }, [friend, openReportReasonSheet]);

  const openReactionPicker = useCallback(
    (messageId: string, isOwnMessage: boolean) => {
      if (!currentUserId || !friendId) return;
      setPendingReactionTarget({
        messageId,
        messageSenderId: isOwnMessage ? currentUserId : friendId,
        messageReceiverId: isOwnMessage ? friendId : currentUserId,
      });
      setReactionPickerVisible(true);
    },
    [currentUserId, friendId]
  );

  const closeReactionPicker = useCallback(() => {
    setReactionPickerVisible(false);
    setPendingReactionTarget(null);
  }, []);

  const handleReactionSelect = useCallback(
    async (emoji: string) => {
      if (!pendingReactionTarget || !currentUserId) return;

      const optimisticRow: MessageReaction = {
        message_id: pendingReactionTarget.messageId,
        reactor_user_id: currentUserId,
        emoji,
        message_sender_id: pendingReactionTarget.messageSenderId,
        message_receiver_id: pendingReactionTarget.messageReceiverId,
        updated_at: new Date().toISOString(),
      };

      replaceReactionForMessage(optimisticRow);
      closeReactionPicker();

      const { error } = await supabase.from('message_reactions').upsert(
        {
          message_id: pendingReactionTarget.messageId,
          reactor_user_id: currentUserId,
          emoji,
          message_sender_id: pendingReactionTarget.messageSenderId,
          message_receiver_id: pendingReactionTarget.messageReceiverId,
        },
        {
          onConflict: 'message_id,reactor_user_id',
        }
      );

      if (error) {
        console.error('❌ Erreur enregistrement réaction:', error);
        removeReactionForMessage(pendingReactionTarget.messageId, currentUserId);
        Alert.alert(i18n.t('error'), "Impossible d'enregistrer la réaction.");
      }
    },
    [closeReactionPicker, currentUserId, pendingReactionTarget, removeReactionForMessage, replaceReactionForMessage]
  );

  const toggleChatMute = useCallback(() => {
    setChatSoundPickerVisible(false);
    setIsChatMuteEnabled((prev) => {
      const next = !prev;
      if (friendId) {
        AsyncStorage.setItem(CHAT_MESSAGE_MUTE_KEY + '_' + friendId, next ? '1' : '0').catch(() => {});
      }
      return next;
    });
  }, [friendId]);

  const openChatSoundPicker = useCallback(() => {
        Keyboard.dismiss();
    setChatSoundPickerVisible(true);
  }, []);

  const closeChatSoundPicker = useCallback(() => {
    setChatSoundPickerVisible(false);
  }, []);

  const reopenChatKeyboard = useCallback(() => {
    const focusInput = () => {
      inputRef.current?.focus();
    };

    if (Platform.OS === 'android') {
      inputRef.current?.blur();
      setTimeout(focusInput, 150);
      setTimeout(focusInput, 350);
    } else {
      requestAnimationFrame(focusInput);
    }
  }, []);

  if (!friendId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Chat introuvable.</Text>
      </View>
    );
  }

  if (!isUuid(friendId)) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Chat introuvable.</Text>
      </View>
    );
  }

  if (!friend || !currentUserId) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#604a3e" />
      </View>
    );
  }

  const composerBottomPadding =
    Platform.OS === 'android'
      ? isKeyboardVisible
        ? 10
        : Math.max(insets.bottom + 5, 5)
      : isKeyboardVisible
        ? 5
        : Math.max(insets.bottom, 10);

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : undefined}
      >
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              if (router.canGoBack()) {
                if (Platform.OS === 'android') {
                  requestAnimationFrame(() => router.back());
                } else {
                  router.back();
                }
              } else {
                router.replace('/(tabs)');
              }
            }}
            style={styles.headerIcon}
          >
            <Ionicons name="chevron-back" size={26} color="#604a3e" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{i18n.t('sticky_chat_with', { pseudo: friend.pseudo })}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={openConversationReportSheet}
              style={[styles.headerIcon, styles.headerReportIcon]}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('report_conversation_title')}
            >
              <Ionicons name="flag-outline" size={21} color="#604a3e" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                const next = retentionHours === 24 ? 0 : 24;
                setRetentionHours(friendId, next);
                if (next === 24) {
                  // ✅ IMPORTANT : Sauvegarder ce qui est déjà à l'écran dans le store permanent
                  // Cela permet de maintenir les messages reçus/envoyés pendant qu'on était en mode 0h
                  addReceivedMessages(friendId, receivedMessages);
                  addSentMessages(friendId, sentMessages);
                  void refreshMessages();
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }}
              style={styles.headerIcon}
              activeOpacity={0.85}
            >
              <View style={[styles.retentionBadge, retentionHours === 24 && styles.retentionBadgeActive]}>
                <Ionicons 
                  name={retentionHours === 24 ? "timer-outline" : "flash"} 
                  size={12} 
                  color="#604a3e" 
                />
                <Text style={styles.retentionBadgeText}>
                  {retentionHours === 24 ? "24h" : "0"}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleChatMute}
              style={styles.headerIcon}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={isChatMuteEnabled ? 'Desactiver mute' : 'Activer mute'}
            >
              <Ionicons
                name={isChatMuteEnabled ? 'volume-mute' : 'volume-medium'}
                size={22}
                color="#604a3e"
                style={!isChatMuteEnabled ? styles.headerIconInactive : undefined}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.messagesArea}>
          <View pointerEvents="none" style={styles.chatBackgroundOverlay}>
            <Image source={CHAT_PROOTHAIL_THUMB} style={styles.chatBackgroundHero} resizeMode="cover" />
          </View>

          <FlatList
            inverted
            data={timeline}
            keyExtractor={(item) => item.id}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: message }) =>
              message.isMe ? (
                <AnimatedMessageRow isMe={true} messageId={message.id} isNew={(message as any).isNew}>
                  <SentBubble
                    message={{
                      id: message.sourceMessageId || message.id,
                      text: message.text,
                      ts: message.ts,
                      soundKey: message.soundKey,
                      status: (message as any).status,
                      readAt: (message as any).readAt,
                      optimistic: (message as any).optimistic,
                      local_ts: 0
                    } as any}
                    reaction={getReactionBadgeText(message.sourceMessageId || message.id)}
                    onLongPressReact={() => openReactionPicker(message.sourceMessageId || message.id, true)}
                    onLongPressEdit={(msg) => setEditingMessage(msg)}
                    isSaved={!!savedMessages[message.sourceMessageId || message.id]}
                    onToggleSave={() => toggleSaveMessage(message.sourceMessageId || message.id)}
                  />
                </AnimatedMessageRow>
              ) : (
                <AnimatedMessageRow isMe={false} messageId={message.id} isNew={(message as any).isNew}>
                  <ReceivedBubble
                    message={{
                      id: message.sourceMessageId || message.id,
                      text: message.text,
                      soundKey: message.soundKey,
                      createdAt: message.ts,
                      senderId: friend.id,
                    }}
                    reaction={getReactionBadgeText(message.sourceMessageId || message.id)}
                    onLongPressReact={() => openReactionPicker(message.sourceMessageId || message.id, false)}
                    isSaved={!!savedMessages[message.sourceMessageId || message.id]}
                    onToggleSave={() => toggleSaveMessage(message.sourceMessageId || message.id)}
                  />
                </AnimatedMessageRow>
              )
            }
          />
        </View>

        <Animated.View style={composerKeyboardStyle}>
          <ChatComposer
            friend={friend}
            currentUserId={currentUserId}
            currentPseudo={currentPseudo}
            isZenMode={isZenMode}
            isSilentMode={isSilentMode}
            isHapticEnabled={isHapticEnabled}
            onMessageSent={handleMessageSent}
            onOpenSoundPicker={openChatSoundPicker}
            pendingChatSoundKey={pendingChatSoundKey}
            setPendingChatSoundKey={setPendingChatSoundKey}
            isChatMuteEnabled={isChatMuteEnabled}
            pulseAnimatedStyle={pulseAnimatedStyle}
            composerBottomPadding={composerBottomPadding}
            inputRef={inputRef}
            isProfileHydrated={profileConfirmed}
            editingMessage={editingMessage}
            onCancelEdit={() => setEditingMessage(null)}
            onMessageEdited={handleMessageEdited}
            onMessageConfirmed={triggerGlobalMessageRefresh}
          />
        </Animated.View>
      </KeyboardAvoidingView>

      {toastMessage && (
        <RNAnimated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </RNAnimated.View>
      )}

      <Modal
        isVisible={chatSoundPickerVisible}
        onBackdropPress={closeChatSoundPicker}
        onBackButtonPress={closeChatSoundPicker}
        onModalHide={() => {
          if (!reopenKeyboardAfterSoundPickRef.current) return;
          reopenKeyboardAfterSoundPickRef.current = false;
          reopenChatKeyboard();
        }}
        style={styles.soundPickerModal}
        backdropOpacity={0.35}
      >
        <View style={styles.soundPickerCard}>
          <View style={styles.soundPickerHeader}>
            <View />
            <TouchableOpacity onPress={closeChatSoundPicker} activeOpacity={0.8}>
              <Ionicons name="close" size={22} color="#604a3e" />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.soundCategoryScroller}
            contentContainerStyle={styles.soundCategoryScrollerContent}
            keyboardShouldPersistTaps="always"
          >
            {Platform.OS === 'android' && (
              <Pressable style={styles.soundChoiceButton} onPress={() => setChatSoundCategory('toot')}>
                <Image
                  source={TOOT_LOGO_IMAGE}
                  style={[
                    styles.soundChoiceImage,
                    TOOT_CHAT_ICON_SIZE,
                    chatCategoryIconInactive('toot') && styles.soundChoiceImageInactive,
                  ]}
                  resizeMode="contain"
                />
              </Pressable>
            )}
            <Pressable style={styles.soundChoiceButton} onPress={() => setChatSoundCategory('mood')}>
              <Image
                source={require('../assets/images/mood.png')}
                style={[
                  styles.soundChoiceImage,
                  chatCategoryIconInactive('mood') && styles.soundChoiceImageInactive,
                ]}
                resizeMode="contain"
              />
            </Pressable>
            <Pressable style={styles.soundChoiceButton} onPress={() => setChatSoundCategory('pop')}>
              <Image
                source={require('../assets/images/pop.png')}
                style={[
                  styles.soundChoiceImage,
                  styles.soundChoiceImagePop,
                  chatCategoryIconInactive('pop') && styles.soundChoiceImageInactive,
                ]}
                resizeMode="contain"
              />
            </Pressable>
            {Platform.OS !== 'android' && (
              <Pressable style={styles.soundChoiceButton} onPress={() => setChatSoundCategory('toot')}>
                <Image
                  source={TOOT_LOGO_IMAGE}
                  style={[
                    styles.soundChoiceImage,
                    TOOT_CHAT_ICON_SIZE,
                    chatCategoryIconInactive('toot') && styles.soundChoiceImageInactive,
                  ]}
                  resizeMode="contain"
                />
              </Pressable>
            )}
            <Pressable style={styles.soundChoiceButton} onPress={() => setChatSoundCategory('trll')}>
              <Image
                source={require('../assets/images/tweet.png')}
                style={[
                  styles.soundChoiceImage,
                  chatCategoryIconInactive('trll') && styles.soundChoiceImageInactive,
                ]}
                resizeMode="contain"
              />
            </Pressable>
            <Pressable style={styles.soundChoiceButton} onPress={() => setChatSoundCategory('bzzz')}>
              <Image
                source={require('../assets/images/buzz.png')}
                style={[
                  styles.soundChoiceImage,
                  chatCategoryIconInactive('bzzz') && styles.soundChoiceImageInactive,
                ]}
                resizeMode="contain"
              />
            </Pressable>
          </ScrollView>

          <ScrollView
            style={[styles.soundOptionsList, { height: CHAT_SPECIFIC_MIN_HEIGHT }]}
            contentContainerStyle={[
              styles.soundOptionsListContent,
              {
                paddingBottom:
                  Platform.OS === 'android'
                    ? Math.max(insets.bottom + 50, 94)
                    : 50,
              },
            ]}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="always"
          >
            {currentSoundChoices.map((soundKey) => (
              <TouchableOpacity
                key={soundKey}
                style={[
                  styles.soundOptionButton,
                  pendingChatSoundKey === soundKey && styles.soundOptionButtonActive,
                ]}
                onPress={() => {
                  reopenKeyboardAfterSoundPickRef.current = true;
                  setPendingChatSoundKey(soundKey);
                  closeChatSoundPicker();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.soundOptionButtonText}>{getDisplaySoundLabel(soundKey)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        isVisible={reportReasonModalVisible}
        onBackdropPress={closeReportReasonModal}
        onBackButtonPress={closeReportReasonModal}
        style={styles.reportReasonModal}
        backdropOpacity={0.4}
      >
        <View style={styles.reportReasonCard}>
          <Text style={styles.reportReasonTitle}>{i18n.t('report_conversation_title')}</Text>
          <Text style={styles.reportReasonSubtitle}>{i18n.t('report_conversation_reason_prompt')}</Text>
          {([
            ['spam', i18n.t('report_reason_spam')],
            ['harassment', i18n.t('report_reason_harassment')],
            ['hate_speech', i18n.t('report_reason_hate_speech')],
            ['explicit_content', i18n.t('report_reason_explicit_content')],
            ['other', i18n.t('report_reason_other')],
          ] as Array<[ReportReason, string]>).map(([reason, label]) => (
            <TouchableOpacity
              key={reason}
              style={styles.reportReasonOption}
              onPress={() => handleAndroidReportReason(reason)}
              activeOpacity={0.85}
            >
              <Text style={styles.reportReasonOptionText}>{label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.reportReasonCancel} onPress={closeReportReasonModal} activeOpacity={0.85}>
            <Text style={styles.reportReasonCancelText}>{i18n.t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal
        isVisible={reactionPickerVisible}
        onBackdropPress={closeReactionPicker}
        onBackButtonPress={closeReactionPicker}
        style={styles.reactionPickerModal}
        backdropOpacity={0.25}
      >
        <View style={styles.reactionPickerCard}>
          <Text style={styles.reactionPickerTitle}>Reagir au message</Text>
          <View style={styles.reactionPickerRow}>
            {QUICK_REACTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionOption}
                onPress={() => handleReactionSelect(emoji)}
                activeOpacity={0.85}
              >
                <Text style={styles.reactionOptionText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.reactionPickerCancel} onPress={closeReactionPicker} activeOpacity={0.85}>
            <Text style={styles.reactionPickerCancelText}>{i18n.t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal
        isVisible={showFirstChatOnboarding}
        onBackdropPress={dismissFirstChatOnboarding}
        onBackButtonPress={dismissFirstChatOnboarding}
        backdropOpacity={0.55}
        animationIn="fadeIn"
        animationOut="fadeOut"
        useNativeDriver
        style={styles.firstChatOnboardingModal}
      >
        <View style={styles.firstChatOnboardingCard}>
          <View style={styles.firstChatOnboardingTitleRow}>
            <Text style={styles.firstChatOnboardingTitleText}>{i18n.t('tuto_chat_title')}</Text>
          </View>
          <View style={styles.firstChatOnboardingFeatureRow}>
            <View style={styles.firstChatOnboardingIconSlot}>
              <Image source={CHAT_PROOTHAIL_THUMB} style={styles.firstChatOnboardingProothail} resizeMode="contain" />
            </View>
            <Text style={styles.firstChatOnboardingFeatureText}>
              {i18n.t('chat_onboarding_choose_specific_sound')}
            </Text>
          </View>
          <View style={[styles.firstChatOnboardingFeatureRow, { marginTop: 12 }]}>
            <Ionicons name="volume-mute" size={22} color="#604a3e" />
            <Text style={styles.firstChatOnboardingFeatureText}>{i18n.t('chat_onboarding_mute')}</Text>
          </View>
          <View style={[styles.firstChatOnboardingFeatureRow, { marginTop: 12 }]}>
            <Ionicons name="timer-outline" size={22} color="#604a3e" />
            <Text style={styles.firstChatOnboardingFeatureText}>{i18n.t('chat_onboarding_retention')}</Text>
          </View>
          <View style={[styles.firstChatOnboardingFeatureRow, { marginTop: 12 }]}>
            <Ionicons name="bookmark-outline" size={22} color="#604a3e" />
            <Text style={styles.firstChatOnboardingFeatureText}>{i18n.t('chat_onboarding_save')}</Text>
          </View>
          <View style={[styles.firstChatOnboardingFeatureRow, { marginTop: 12 }]}>
            <Ionicons name="flag-outline" size={22} color="#604a3e" />
            <Text style={styles.firstChatOnboardingFeatureText}>
              {i18n.t('chat_onboarding_report_conversation')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.firstChatOnboardingOkButton}
            onPress={() => void dismissFirstChatOnboarding()}
            activeOpacity={0.85}
          >
            <Text style={styles.firstChatOnboardingOkText}>{i18n.t('ok')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ebb89b',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ebb89b',
  },
  errorText: {
    color: '#604a3e',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(96, 74, 62, 0.12)',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  headerIcon: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconInactive: {
    opacity: 0.4,
  },
  headerActions: {
    width: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerReportIcon: {
    opacity: 0.55,
  },
  retentionBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#604a3e',
    opacity: 0.4,
    minWidth: 28,
    alignItems: 'center',
  },
  retentionBadgeActive: {
    opacity: 1,
    backgroundColor: 'rgba(96, 74, 62, 0.1)',
  },
  retentionBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#604a3e',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#604a3e',
    fontSize: 18,
    fontWeight: '700',
    marginHorizontal: 8,
  },
  messages: {
    flex: 1,
  },
  messagesArea: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  chatBackgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.075,
  },
  chatBackgroundHero: {
    position: 'absolute',
    width: Platform.OS === 'android' ? ANDROID_CHAT_BACKGROUND_HERO_SIZE : 420,
    height: Platform.OS === 'android' ? ANDROID_CHAT_BACKGROUND_HERO_SIZE : 420,
    right: Platform.OS === 'android' ? -150 : -120,
    top: '18%',
    transform: [{ rotate: '-8deg' }],
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    flexGrow: 1,
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
  soundPickerModal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  soundPickerCard: {
    backgroundColor: '#ebb89b',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.12)',
    maxHeight: '80%',
  },
  soundPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    minHeight: 14,
  },
  soundPickerTitle: {
    color: '#604a3e',
    fontSize: 16,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
  soundCategoryScroller: {
    marginTop: 0,
    marginBottom: 0,
    maxHeight: 40,
    alignSelf: 'center',
    flexGrow: 0,
  },
  soundCategoryScrollerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 0,
  },
  soundChoiceButton: {
    width: 96,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundChoiceImage: {
    width: 75,
    height: 51,
  },
  soundChoiceImagePop: {
    width: 62,
    height: 42,
  },
  soundChoiceImageInactive: {
    opacity: 0.4,
  },
  soundOptionsList: {
    marginTop: 0,
    backgroundColor: 'rgba(96, 74, 62, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.1)',
    borderRadius: 8,
  },
  soundOptionsListContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignContent: 'flex-start',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 50,
  },
  soundOptionButton: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  soundOptionButtonActive: {
    backgroundColor: 'rgba(162, 228, 212, 0.72)',
    borderColor: 'rgba(96, 74, 62, 0.45)',
  },
  soundOptionButtonText: {
    color: '#604a3e',
    fontSize: 13,
    fontWeight: '600',
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
  reportReasonOptionText: {
    color: '#604a3e',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  reportReasonCancel: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  reportReasonCancelText: {
    color: '#604a3e',
    fontSize: 15,
    fontWeight: '700',
  },
  reactionPickerModal: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 24,
  },
  reactionPickerCard: {
    width: '100%',
    backgroundColor: '#fff7f1',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.12)',
  },
  reactionPickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#604a3e',
    textAlign: 'center',
    marginBottom: 14,
  },
  reactionPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  reactionOption: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.12)',
  },
  reactionOptionText: {
    fontSize: 24,
  },
  reactionPickerCancel: {
    marginTop: 14,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reactionPickerCancelText: {
    color: '#604a3e',
    fontSize: 15,
    fontWeight: '700',
  },
  firstChatOnboardingModal: {
    justifyContent: 'center',
    margin: 20,
  },
  firstChatOnboardingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.12)',
  },
  firstChatOnboardingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  firstChatOnboardingTitleText: {
    color: '#604a3e',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  firstChatOnboardingFeatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  firstChatOnboardingIconSlot: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginLeft: -4,
  },
  firstChatOnboardingProothail: {
    width: 30,
    height: 30,
  },
  firstChatOnboardingFeatureText: {
    flex: 1,
    marginLeft: 12,
    color: '#604a3e',
    fontSize: 14,
    textAlign: 'left',
    fontStyle: 'italic',
    opacity: 0.88,
    lineHeight: 19,
  },
  firstChatOnboardingOkButton: {
    marginTop: 16,
    alignSelf: 'center',
    backgroundColor: '#604a3e',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  firstChatOnboardingOkText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
