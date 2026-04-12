import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Image,
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
const QUICK_REACTIONS = ['❤️', '😂', '😍', '😮', '😢', '😡', '👍', '🔥'] as const;
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

function ReceivedBubble({
  message,
  onReplay,
  onLongPressReact,
  reaction,
}: {
  message: { id: string; text: string; soundKey?: string; createdAt?: string; senderId: string };
  onReplay: (soundKey?: string) => void;
  onLongPressReact: (messageId: string) => void;
  reaction?: string;
}) {
  const [isReplayActive, setIsReplayActive] = useState(false);
  const canReplaySound = !!message.soundKey && message.soundKey !== 'mute';

  return (
    <View style={styles.receivedBubbleWrapper}>
      <View style={{ position: 'relative' }}>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => {
            if (!canReplaySound) return;
            setIsReplayActive(true);
            playSound(message.soundKey, {
              onEnd: () => setIsReplayActive(false),
            });
            onReplay(message.soundKey);
          }}
          onLongPress={() => onLongPressReact(message.id)}
          style={[
            styles.receivedBubble,
            canReplaySound ? styles.receivedBubbleWithIcon : undefined,
            isReplayActive && styles.receivedBubbleActive,
          ]}
        >
          {canReplaySound ? (
            <Ionicons
              name="play"
              size={16}
              color="#604a3e"
              style={styles.receivedPlayIcon}
              accessibilityLabel={i18n.t('chat_replay_sound_hint')}
            />
          ) : null}
          <Text style={styles.receivedText}>{message.text}</Text>
        </TouchableOpacity>
        {reaction ? (
          <View style={styles.receivedReactionBadge}>
            <Text style={styles.reactionBadgeText}>{reaction}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SentBubble({
  message,
  onLongPressReact,
  reaction,
}: {
  message: VisibleSentMessage;
  onLongPressReact: (messageId: string) => void;
  reaction?: string;
}) {
  return (
    <View style={styles.sentBubbleWrapper}>
      <View style={{ position: 'relative' }}>
        <TouchableOpacity activeOpacity={0.92} onLongPress={() => onLongPressReact(message.id)}>
          <View style={[styles.sentBubble, message.status === 'read' && styles.sentBubbleRead]}>
            <Text style={styles.sentText}>{message.text}</Text>
          </View>
        </TouchableOpacity>
        {reaction ? (
          <View style={styles.sentReactionBadge}>
            <Text style={styles.reactionBadgeText}>{reaction}</Text>
          </View>
        ) : null}
      </View>
      {message.status === 'read' ? <Text style={styles.sentRead}>{i18n.t('message_read')}</Text> : null}
    </View>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ friendId?: string; pseudo?: string; pendingSoundKey?: string }>();
  const friendId = typeof params.friendId === 'string' ? params.friendId : '';
  const pseudoParam = typeof params.pseudo === 'string' ? params.pseudo : '';
  const pendingSoundKeyParam = typeof params.pendingSoundKey === 'string' ? params.pendingSoundKey : '';

  const { isZenMode, isSilentMode, isHapticEnabled, pseudo: storePseudo } = useAppStore();
  const { 
    receivedByFriend, 
    sentByFriend, 
    messageReactionsByFriend,
    addReceivedMessages, 
    addSentMessages, 
    setReactions,
    retentionHours, 
    setRetentionHours, 
    cleanupExpired 
  } = useChatStore();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentPseudo, setCurrentPseudo] = useState<string>(storePseudo || 'Un ami');
  const [friend, setFriend] = useState<FriendProfile | null>(null);
  const [draft, setDraft] = useState('');
  const [loadingFriend, setLoadingFriend] = useState(true);
  const [sending, setSending] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isChatMuteEnabled, setIsChatMuteEnabled] = useState(false);
  const [chatSoundPickerVisible, setChatSoundPickerVisible] = useState(false);
  const [chatSoundCategory, setChatSoundCategory] = useState<ChatMessageSoundChoice>(
    getDefaultSoundCategoryForFirstLaunch() as ChatMessageSoundChoice
  );
  const [pendingChatSoundKey, setPendingChatSoundKey] = useState<string | null>(null);
  
  // Initialisation à partir du store local
  const [receivedMessages, setReceivedMessages] = useState<PendingMessage[]>(receivedByFriend[friendId] || []);
  const [sentMessages, setSentMessages] = useState<VisibleSentMessage[]>(sentByFriend[friendId] || []);
  
  const [reportReasonModalVisible, setReportReasonModalVisible] = useState(false);
  const [pendingReportTarget, setPendingReportTarget] = useState<ReportTarget | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, MessageReaction[]>>(messageReactionsByFriend[friendId] || {});
  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [pendingReactionTarget, setPendingReactionTarget] = useState<PendingReactionTarget | null>(null);
  const [showFirstChatOnboarding, setShowFirstChatOnboarding] = useState(false);

  const lastRandomSoundRef = useRef<string | undefined>(undefined);
  // On remplit le Set des IDs connus avec ceux déjà présents en cache
  const knownIncomingMessageIdsRef = useRef<Set<string>>(new Set(receivedMessages.map(m => m.id)));
  const hasHydratedIncomingMessagesRef = useRef(false);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const inputRef = useRef<TextInput | null>(null);
  const reopenKeyboardAfterSoundPickRef = useRef(false);
  const keyboardHeightSV = useSharedValue(0);
  const keyboardVisibleRef = useRef(false);

  const pulseScale = useSharedValue(1);

  // Nettoyage des messages expirés au montage
  useEffect(() => {
    cleanupExpired();
  }, [cleanupExpired]);

  useEffect(() => {
    const onShow = () => {
      keyboardVisibleRef.current = true;
    };
    const onHide = () => {
      keyboardVisibleRef.current = false;
    };
    const subShow = Keyboard.addListener('keyboardDidShow', onShow);
    const subHide = Keyboard.addListener('keyboardDidHide', onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
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

  useEffect(() => {
    return () => {
      Keyboard.dismiss();
    };
  }, []);

  const loadChatContext = useCallback(async () => {
    if (!friendId) return;
    setLoadingFriend(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        safePush(router, '/(tabs)', { skipInitialCheck: false });
        return;
      }

      setCurrentUserId(user.id);

      const [{ data: me }, { data: friendProfile }] = await Promise.all([
        supabase.from('user_profiles').select('pseudo').eq('id', user.id).single(),
        supabase
          .from('user_profiles')
          .select('id, pseudo, avatar_url, expo_push_token, push_platform, is_zen_mode')
          .eq('id', friendId)
          .single(),
      ]);

      if (me?.pseudo) {
        setCurrentPseudo(me.pseudo);
      } else if (storePseudo) {
        setCurrentPseudo(storePseudo);
      }

      if (!friendProfile) {
        Alert.alert(i18n.t('error'), 'Ami introuvable.');
        safePush(router, '/(tabs)', { skipInitialCheck: false });
        return;
      }

      setFriend({
        id: friendProfile.id,
        pseudo: friendProfile.pseudo || pseudoParam || 'Ami',
        avatar_url: friendProfile.avatar_url || null,
        expo_push_token: friendProfile.expo_push_token || null,
        push_platform: (friendProfile.push_platform as 'ios' | 'android' | null) || null,
        is_zen_mode: !!friendProfile.is_zen_mode,
      });
    } catch (error) {
      console.error('❌ Erreur chargement chat:', error);
      Alert.alert(i18n.t('error'), 'Impossible de charger ce chat.');
    } finally {
      setLoadingFriend(false);
    }
  }, [friendId, pseudoParam, router, storePseudo]);

  useEffect(() => {
    void loadChatContext();
  }, [loadChatContext]);

  useEffect(() => {
    AsyncStorage.getItem(CHAT_MESSAGE_MUTE_KEY)
      .then((savedMute) => {
        if (savedMute === '1') {
          setIsChatMuteEnabled(true);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (pendingSoundKeyParam && SOUND_ASSETS[pendingSoundKeyParam]) {
      setPendingChatSoundKey(pendingSoundKeyParam);
      return;
    }
    setPendingChatSoundKey(null);
  }, [friendId, pendingSoundKeyParam]);

  useEffect(() => {
    if (!friend || loadingFriend) return;
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
  }, [friend, loadingFriend]);

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

    const incomingWithTs = filteredIncoming.map(m => ({ ...m, local_ts: Date.now() }));
    
    // Sauvegarde dans le store persistant
    addReceivedMessages(friendId, incomingWithTs);

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
          local_ts: Date.now(),
        } satisfies VisibleSentMessage;
      })
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    // Sauvegarde dans le store persistant
    addSentMessages(friendId, serverSent);
  }, [currentUserId, friendId, isHapticEnabled, addReceivedMessages, addSentMessages]);

  const triggerGlobalMessageRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['pendingMessages'] });
    queryClient.invalidateQueries({ queryKey: ['pendingSentMessages'] });
    queryClient.invalidateQueries({ queryKey: ['friends'] });
    DeviceEventEmitter.emit('REFRESH_DATA', { source: 'triggerGlobalMessageRefresh' });
    void refreshMessages();
  }, [queryClient, refreshMessages]);

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

  useEffect(() => {
    if (!currentUserId || !friendId) return;
    const interval = setInterval(() => {
      void refreshMessages();
    }, 5000);
    return () => clearInterval(interval);
  }, [currentUserId, friendId, refreshMessages]);

  // Synchronisation avec le store persistant (pour l'hydratation et l'historique 12h)
  useEffect(() => {
    const fromStore = receivedByFriend[friendId] || [];
    setReceivedMessages(fromStore);
    knownIncomingMessageIdsRef.current = new Set(fromStore.map(m => m.id));
  }, [receivedByFriend, friendId]);

  useEffect(() => {
    const fromStore = sentByFriend[friendId] || [];
    setSentMessages(prev => {
      const optimistic = prev.filter(m => m.optimistic);
      // On fusionne le store avec les messages optimistiques non encore confirmés
      const next = [...fromStore];
      optimistic.forEach(opt => {
        const alreadyInStore = fromStore.some(m => 
          m.id === opt.id || (m.text === opt.text && m.soundKey === opt.soundKey && Math.abs(new Date(m.ts).getTime() - new Date(opt.ts).getTime()) < 10000)
        );
        if (!alreadyInStore) {
          next.push(opt);
        }
      });
      return next.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    });
  }, [sentByFriend, friendId]);

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
            event: 'INSERT',
            schema: 'public',
            table: 'pending_messages',
            filter: `to_user_id=eq.${currentUserId}`,
          },
          (payload: any) => {
            const newMessage = payload.new as PendingMessage;
            if (!newMessage || newMessage.from_user_id !== friendId) return;
            const parsedMessage = parseMessageContent(newMessage.message_content);

            // Mise à jour du store persistant IMMEDIATEMENT
            addReceivedMessages(friendId, [{ ...newMessage, local_ts: Date.now() }]);

            queryClient.invalidateQueries({ queryKey: ['pendingMessages'] });
            queryClient.invalidateQueries({ queryKey: ['friends'] });
            DeviceEventEmitter.emit('REFRESH_DATA', { source: 'chat_insert' });

            if (parsedMessage.soundKey && parsedMessage.soundKey !== 'mute') {
              void playSound(parsedMessage.soundKey);
            }

            if (Platform.OS === 'ios' && isHapticEnabled) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pending_messages',
            filter: `from_user_id=eq.${currentUserId}`,
          },
          (payload: any) => {
            const targetUserId =
              payload.eventType === 'DELETE'
                ? (payload.old as any)?.to_user_id
                : (payload.new as any)?.to_user_id;
            if (targetUserId !== friendId) return;
            triggerGlobalMessageRefresh();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'pending_messages',
            filter: `to_user_id=eq.${currentUserId}`,
          },
          (payload: any) => {
            const deletedId = (payload.old as any)?.id;
            if (!deletedId) return;
            queryClient.invalidateQueries({ queryKey: ['pendingMessages'] });
            queryClient.invalidateQueries({ queryKey: ['friends'] });
            DeviceEventEmitter.emit('REFRESH_DATA', { source: 'chat_delete' });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [currentUserId, friendId, isHapticEnabled, queryClient, triggerGlobalMessageRefresh])
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
    const unreadIds = receivedMessages
      .filter((m) => m.from_user_id === friendId)
      .map((m) => m.id)
      .filter(Boolean);
    if (unreadIds.length === 0) return;
    void markConversationReadViaBackend(friendId, currentUserId);
  }, [currentUserId, friendId, receivedMessages]);

  useKeyboardHandler({
    onMove: (e: { height: number }) => {
      'worklet';
      if (Platform.OS !== 'android') return;
      keyboardHeightSV.value = e.height;
      runOnJS(setKeyboardVisible)(e.height > 0);
    },
    onInteractive: (e: { height: number }) => {
      'worklet';
      if (Platform.OS !== 'android') return;
      keyboardHeightSV.value = e.height;
      runOnJS(setKeyboardVisible)(e.height > 0);
    },
    onEnd: (e: { height: number }) => {
      'worklet';
      if (Platform.OS !== 'android') return;
      keyboardHeightSV.value = e.height;
      runOnJS(setKeyboardVisible)(e.height > 0);
    },
  });

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const subShow = Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true));
    const subHide = Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

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
      return {
        id: `received-${m.id}`,
        ts: m.created_at,
        isMe: false,
        text: parsed.text,
        soundKey: parsed.soundKey,
        sourceMessageId: m.id,
      };
    });

    const outgoing = sentMessages.map((m) => ({
      id: `sent-${m.id}`,
      ts: m.ts,
      isMe: true,
      text: m.text,
      soundKey: m.soundKey,
      status: m.status,
      readAt: m.readAt,
      sourceMessageId: m.id,
    }));

    return [...incoming, ...outgoing].sort(
      (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
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
      { text: i18n.t('report_reason_hate_speech'), onPress: () => void submitReport('hate_speech', reportTarget) },
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
      AsyncStorage.setItem(CHAT_MESSAGE_MUTE_KEY, next ? '1' : '0').catch(() => {});
      return next;
    });
  }, []);

  const openChatSoundPicker = useCallback(() => {
    reopenKeyboardAfterSoundPickRef.current = keyboardVisibleRef.current;
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

  const handleSend = useCallback(async () => {
    if (!friend || !currentUserId) return;

    const customMessage = draft.trim().slice(0, 140);
    if (!customMessage) return;

    if (isZenMode) {
      Alert.alert(i18n.t('zen_mode_active_me_title'), i18n.t('zen_mode_active_me_body'));
      return;
    }

    if (friend.is_zen_mode) {
      Alert.alert(
        i18n.t('zen_mode_active_friend_title'),
        i18n.t('zen_mode_active_friend_body', { pseudo: friend.pseudo })
      );
      return;
    }

    try {
      const { data: muteCheck } = await supabase
        .from('friends')
        .select('is_muted')
        .eq('user_id', friend.id)
        .eq('friend_id', currentUserId)
        .maybeSingle();

      if (muteCheck?.is_muted) {
        Alert.alert(
          i18n.t('mute_mode_active_title'),
          i18n.t('mute_mode_active_body', { pseudo: friend.pseudo })
        );
        return;
      }
    } catch (e) {
      console.error('❌ Erreur vérification sourdine:', e);
    }

    if (!friend.expo_push_token) {
      Alert.alert(
        i18n.t('error'), 
        i18n.t('notifications_not_enabled', { pseudo: friend.pseudo }),
        [
          { text: i18n.t('ok'), style: 'cancel' },
          { 
            text: i18n.t('retry'), 
            onPress: async () => {
              // Rafraîchir le profil de l'ami pour voir si le token est arrivé
              const { data: profile } = await supabase
                .from('user_profiles')
                .select('expo_push_token, push_platform')
                .eq('id', friend.id)
                .single();
              
              if (profile?.expo_push_token) {
                setFriend(prev => prev ? ({ ...prev, expo_push_token: profile.expo_push_token, push_platform: profile.push_platform || prev.push_platform }) : null);
              } else {
                // Toujours pas de token, on peut ré-afficher l'alerte ou ne rien faire
              }
            } 
          }
        ]
      );
      return;
    }

    setSending(true);

    try {
      let randomKey: string;
      let isSilentMessage = false;

      if (isChatMuteEnabled) {
        randomKey = 'mute';
        isSilentMessage = true;
      } else if (pendingChatSoundKey) {
        randomKey = pendingChatSoundKey;
      } else {
        const savedMap = await AsyncStorage.getItem(FRIEND_SOUND_CATEGORY_MAP_KEY);
        const parsedMap = savedMap ? JSON.parse(savedMap) : {};
        const selectedCategory = parsedMap?.[friend.id] || (await getSelectedSoundCategory());
        const candidates =
          SOUND_KEYS_BY_CATEGORY[selectedCategory] ||
          SOUND_KEYS_BY_CATEGORY[DIRECT_SEND_FALLBACK_CATEGORY] ||
          SOUND_KEYS_BY_CATEGORY.trll;
        randomKey =
          pickRandomWithoutImmediateRepeat(candidates, lastRandomSoundRef.current) || pickRandom(candidates);
      }
      lastRandomSoundRef.current = randomKey;

      const optimisticMessage: VisibleSentMessage = {
        id: `local-${Date.now()}`,
        text: customMessage,
        ts: new Date().toISOString(),
        soundKey: randomKey,
        optimistic: true,
      };

      setSentMessages((prev) => [...prev, optimisticMessage]);
      setDraft('');
      setPendingChatSoundKey(null);

      if (Platform.OS === 'ios' && isHapticEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      if (!isSilentMessage && !isSilentMode) {
        playSound(randomKey);
      }

      await sendProutViaBackend(
        friend.expo_push_token,
        currentPseudo || 'Un ami',
        randomKey,
        friend.push_platform || 'android',
        {
          customMessage,
          senderId: currentUserId,
          receiverId: friend.id,
        }
      );

      DeviceEventEmitter.emit('CLEAR_FRIENDLIST_PENDING_SOUND', { friendId: friend.id });

      queryClient.invalidateQueries({ queryKey: ['pendingMessages', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['pendingSentMessages', currentUserId] });
      setTimeout(() => {
        void refreshMessages();
      }, 500);
    } catch (error: any) {
      console.error("Erreur lors de l'envoi du message:", error?.message || error);
      Alert.alert(i18n.t('error'), "Impossible d'envoyer le message.");
      setDraft(customMessage);
      setSentMessages((prev) => prev.filter((msg) => !msg.optimistic));
    } finally {
      setSending(false);
    }
  }, [
    currentPseudo,
    currentUserId,
    draft,
    friend,
    isHapticEnabled,
    isChatMuteEnabled,
    isSilentMode,
    isZenMode,
    pendingChatSoundKey,
    queryClient,
    refreshMessages,
  ]);

  if (!friendId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Chat introuvable.</Text>
      </View>
    );
  }

  if (loadingFriend || !friend) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#604a3e" />
      </View>
    );
  }

  const composerBottomPadding =
    Platform.OS === 'android'
      ? keyboardVisible
        ? 10
        : Math.max(insets.bottom + 5, 5)
      : keyboardVisible
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
          <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
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
                const next = retentionHours === 12 ? 0 : 12;
                setRetentionHours(next);
                if (next === 0) {
                  setReceivedMessages([]);
                  setSentMessages([]);
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }}
              style={styles.headerIcon}
              activeOpacity={0.85}
            >
              <View style={[styles.retentionBadge, retentionHours === 12 && styles.retentionBadgeActive]}>
                <Ionicons 
                  name={retentionHours === 12 ? "timer-outline" : "flash"} 
                  size={12} 
                  color="#604a3e" 
                />
                <Text style={styles.retentionBadgeText}>
                  {retentionHours === 12 ? "12h" : "0"}
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

          <ScrollView
            ref={scrollViewRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {timeline.map((message) =>
              message.isMe ? (
                <View key={message.id} style={styles.sentRow}>
                  <SentBubble
                    message={{
                      id: message.sourceMessageId || message.id,
                      text: message.text,
                      ts: message.ts,
                      soundKey: message.soundKey,
                      status: message.status,
                      readAt: message.readAt,
                    }}
                    reaction={getReactionBadgeText(message.sourceMessageId || message.id)}
                    onLongPressReact={() => openReactionPicker(message.sourceMessageId || message.id, true)}
                  />
                </View>
              ) : (
                <View key={message.id} style={styles.receivedRow}>
                  <ReceivedBubble
                    message={{
                      id: message.sourceMessageId || message.id,
                      text: message.text,
                      soundKey: message.soundKey,
                      createdAt: message.ts,
                      senderId: friend.id,
                    }}
                    reaction={getReactionBadgeText(message.sourceMessageId || message.id)}
                    onReplay={() => {}}
                    onLongPressReact={() => openReactionPicker(message.sourceMessageId || message.id, false)}
                  />
                </View>
              )
            )}
          </ScrollView>
        </View>

        <Animated.View style={composerKeyboardStyle}>
          <View style={[styles.composer, { paddingBottom: composerBottomPadding }]}>
            {!!pendingChatSoundKey && (
              <TouchableOpacity
                style={styles.pendingSoundTag}
                onPress={() => setPendingChatSoundKey(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.pendingSoundTagText}>{getDisplaySoundLabel(pendingChatSoundKey)}</Text>
                <Ionicons name="close-circle" size={14} color="#604a3e" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            )}
            <View style={styles.composerRow}>
              <TouchableOpacity
                style={styles.soundPickerButton}
                onPress={openChatSoundPicker}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={i18n.t('chat_sound_picker_inline_button')}
              >
                <Animated.Image
                  source={CHAT_PROOTHAIL_THUMB}
                  style={[styles.soundPickerThumbImage, pulseAnimatedStyle]}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder={i18n.t('add_message_placeholder')}
              placeholderTextColor="#777"
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={140}
              autoCorrect={false}
              autoComplete="off"
              autoFocus
            />
              <TouchableOpacity
                onPress={() => void handleSend()}
                style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]}
                disabled={!draft.trim() || sending}
                activeOpacity={0.85}
              >
                <Ionicons name="send" size={18} color="#604a3e" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>

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
    justifyContent: 'flex-end',
  },
  receivedRow: {
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  sentRow: {
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  sentBubbleWrapper: {
    alignItems: 'flex-end',
    maxWidth: '84%',
    position: 'relative',
    paddingBottom: 12,
  },
  receivedBubbleWrapper: {
    alignItems: 'flex-start',
    position: 'relative',
    maxWidth: '88%',
    paddingBottom: 12,
  },
  receivedBubble: {
    maxWidth: '88%',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  receivedBubbleWithIcon: {
    paddingLeft: 34,
  },
  receivedPlayIcon: {
    position: 'absolute',
    left: 12,
    top: 11,
    opacity: 0.9,
  },
  receivedText: {
    color: '#333',
    fontSize: 18,
  },
  receivedBubbleActive: {
    backgroundColor: '#A2E4D4',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  sentBubble: {
    backgroundColor: '#e3f2fd',
    borderRadius: 16,
    borderTopRightRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sentBubbleRead: {
    opacity: 0.75,
  },
  receivedReactionBadge: {
    position: 'absolute',
    right: -6,
    bottom: -10,
    minWidth: 28,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#fff5ee',
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentReactionBadge: {
    position: 'absolute',
    left: -6,
    bottom: -10,
    minWidth: 28,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#fff5ee',
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionBadgeText: {
    fontSize: 15,
  },
  sentText: {
    color: '#333',
    fontSize: 18,
  },
  sentRead: {
    color: '#604a3e',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
    textAlign: 'right',
    alignSelf: 'flex-end',
  },
  composer: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingLeft: 6,
    paddingRight: 12,
    paddingTop: 10,
    backgroundColor: '#ebb89b',
    borderTopWidth: 1,
    borderTopColor: 'rgba(96, 74, 62, 0.12)',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  pendingSoundTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#A2E4D4',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
    marginLeft: 4,
  },
  pendingSoundTagText: {
    color: '#604a3e',
    fontSize: 13,
    fontWeight: '600',
  },
  soundPickerButton: {
    width: Platform.OS === 'android' ? 48 : 34,
    height: Platform.OS === 'android' ? 52 : 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 0,
    marginRight: 0,
    paddingHorizontal: 0,
    paddingLeft: 0,
    paddingRight: 0,
  },
  soundPickerThumbImage: {
    width: Platform.OS === 'android' ? ANDROID_CHAT_THUMB_SIZE.width : 34,
    height: Platform.OS === 'android' ? ANDROID_CHAT_THUMB_SIZE.height : 34,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: '#c5d7d3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    color: '#333',
    fontSize: 18,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d2f1ef',
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.15)',
  },
  sendButtonDisabled: {
    opacity: 0.5,
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
