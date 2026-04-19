import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import i18n from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { sendProutViaBackend, editMessageViaBackend } from '@/lib/sendProutBackend';
import {
  getDisplaySoundLabel,
  getSelectedSoundCategory,
  pickRandom,
  pickRandomWithoutImmediateRepeat,
  playSound,
} from '@/lib/audioService';
import {
  DIRECT_SEND_FALLBACK_CATEGORY,
  SOUND_KEYS_BY_CATEGORY,
} from '@/lib/runtimeSounds';
import { type VisibleSentMessage } from '@/lib/chatStore';

const FRIEND_SOUND_CATEGORY_MAP_KEY = 'friend_sound_category_map_v1';
const CHAT_PROOTHAIL_THUMB = require('../../assets/images/proothail2.png');
const ANDROID_CHAT_THUMB_SIZE = { width: 48, height: 48 };

interface ChatComposerProps {
  friend: {
    id: string;
    pseudo: string;
    expo_push_token: string | null;
    push_platform: 'ios' | 'android' | null;
    is_zen_mode: boolean;
  };
  currentUserId: string;
  currentPseudo: string;
  isZenMode: boolean;
  isSilentMode: boolean;
  isHapticEnabled: boolean;
  onMessageSent: (message: VisibleSentMessage) => void;
  onOpenSoundPicker: () => void;
  pendingChatSoundKey: string | null;
  setPendingChatSoundKey: (key: string | null) => void;
  isChatMuteEnabled: boolean;
  pulseAnimatedStyle: any;
  composerBottomPadding: number;
  inputRef: React.RefObject<TextInput>;
  /** false tant que le profil destinataire n'est pas confirmé côté serveur (évite envoi avec jeton push absent). */
  isProfileHydrated?: boolean;
  editingMessage?: VisibleSentMessage | null;
  onCancelEdit?: () => void;
  onMessageEdited?: (messageId: string, newText: string) => void;
}

export const ChatComposer = React.memo(({
  friend,
  currentUserId,
  currentPseudo,
  isZenMode,
  isSilentMode,
  isHapticEnabled,
  onMessageSent,
  onOpenSoundPicker,
  pendingChatSoundKey,
  setPendingChatSoundKey,
  isChatMuteEnabled,
  pulseAnimatedStyle,
  composerBottomPadding,
  inputRef,
  isProfileHydrated = true,
  editingMessage,
  onCancelEdit,
  onMessageEdited,
}: ChatComposerProps) => {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const lastRandomSoundRef = useRef<string | undefined>(undefined);
  const queryClient = useQueryClient();

  // Remplir le draft quand on commence l'édition
  useEffect(() => {
    if (editingMessage) {
      setDraft(editingMessage.text);
      // Donner le focus à l'input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [editingMessage, inputRef]);

  const handleSend = useCallback(async () => {
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

    setSending(true);

    try {
      if (editingMessage) {
        // MODE ÉDITION
        const result = await editMessageViaBackend(editingMessage.id, customMessage, currentUserId);
        if (result.success) {
          onMessageEdited?.(editingMessage.id, customMessage);
          setDraft('');
          if (Platform.OS === 'ios' && isHapticEnabled) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          }
        } else {
          if (result.status === 403) {
            Alert.alert(i18n.t('error'), "Impossible de modifier un message déjà lu.");
            onCancelEdit?.();
            setDraft('');
          } else {
            Alert.alert(i18n.t('error'), "Erreur lors de la modification.");
          }
        }
        return;
      }

      // MODE ENVOI
      try {
        const { data: muteCheck } = await supabase
          .from('friends')
          .select('is_muted')
          .eq('friend_id', currentUserId)
          .eq('user_id', friend.id)
          .maybeSingle();

        if (muteCheck?.is_muted) {
          Alert.alert(
            i18n.t('mute_mode_active_title'),
            i18n.t('mute_mode_active_body', { pseudo: friend.pseudo })
          );
          setSending(false);
          return;
        }
      } catch (e) {
        console.error('❌ Erreur vérification sourdine:', e);
      }

      if (!friend.expo_push_token) {
        Alert.alert(
          i18n.t('error'), 
          i18n.t('notifications_not_enabled', { pseudo: friend.pseudo }),
          [{ text: i18n.t('ok'), style: 'cancel' }]
        );
        setSending(false);
        return;
      }

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
        local_ts: Date.now()
      };

      onMessageSent(optimisticMessage);
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
    } catch (error: any) {
      console.error("Erreur lors de l'envoi/modif du message:", error?.message || error);
      Alert.alert(i18n.t('error'), "Une erreur est survenue.");
      if (!editingMessage) setDraft(customMessage);
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
    onMessageSent,
    setPendingChatSoundKey,
    queryClient,
    editingMessage,
    onMessageEdited,
    onCancelEdit,
    inputRef
  ]);

  return (
    <View style={[styles.composer, { paddingBottom: composerBottomPadding }]}>
      {editingMessage && (
        <View style={styles.editingBanner}>
          <Text style={styles.editingBannerText}>Modification du message...</Text>
          <TouchableOpacity onPress={() => { setDraft(''); onCancelEdit?.(); }}>
            <Ionicons name="close-circle" size={20} color="#604a3e" />
          </TouchableOpacity>
        </View>
      )}
      {!!pendingChatSoundKey && !editingMessage && (
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
        {!editingMessage && (
          <TouchableOpacity
            style={styles.soundPickerButton}
            onPress={onOpenSoundPicker}
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
        )}
        <TextInput
          ref={inputRef}
          style={[styles.input, editingMessage && styles.inputEditing]}
          placeholder={i18n.t('add_message_placeholder')}
          placeholderTextColor="#777"
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={140}
          autoCorrect={false}
          autoComplete="off"
          autoFocus
          keyboardAppearance="light"
        />
        <TouchableOpacity
          onPress={() => void handleSend()}
          style={[
            styles.sendButton,
            (!draft.trim() || sending || !isProfileHydrated) && styles.sendButtonDisabled,
            editingMessage && styles.editConfirmButton,
          ]}
          disabled={!draft.trim() || sending || !isProfileHydrated}
          activeOpacity={0.85}
        >
          <Ionicons name={editingMessage ? "checkmark" : "send"} size={editingMessage ? 22 : 18} color="#604a3e" />
        </TouchableOpacity>
      </View>
    </View>
  );
});

ChatComposer.displayName = 'ChatComposer';

const styles = StyleSheet.create({
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
  editingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  editingBannerText: {
    color: '#604a3e',
    fontSize: 13,
    fontWeight: 'bold',
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
  inputEditing: {
    borderColor: '#604a3e',
    backgroundColor: '#fffcf5',
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
  editConfirmButton: {
    backgroundColor: '#A2E4D4',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
