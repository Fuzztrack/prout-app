import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  ActionSheetIOS,
  Alert,
  DeviceEventEmitter,
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import i18n from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { sendProutViaBackend, editMessageViaBackend } from '@/lib/sendProutBackend';
import { uploadEphemeralPhoto } from '@/lib/services/ephemeralPhotoService';
import { sendGroupMessage } from '@/lib/groopProotService';
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
import { useChatStore, type VisibleSentMessage } from '@/lib/chatStore';
import { PROOT_BOT_ID, triggerProotBotResponse } from '@/lib/prootBot';
import { triggerProutHaptic } from '@/lib/proutHaptics';

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
  isGroup?: boolean;
  groupId?: string;
  groupName?: string;
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
  inputRef: React.RefObject<TextInput | null> | any;
  /** false tant que le profil destinataire n'est pas confirmé côté serveur (évite envoi avec jeton push absent). */
  isProfileHydrated?: boolean;
  editingMessage?: VisibleSentMessage | null;
  onCancelEdit?: () => void;
  onMessageEdited?: (messageId: string, newText: string) => void;
  onMessageConfirmed?: () => void;
}

export const ChatComposer = React.memo(({
  friend,
  isGroup = false,
  groupId,
  groupName,
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
  onMessageConfirmed,
}: ChatComposerProps) => {
  const [draft, setDraft] = useState('');
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [isViewOnce, setIsViewOnce] = useState(false);
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

  const handlePickPhoto = useCallback(() => {
    Keyboard.dismiss();

    const handleCameraPick = async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(i18n.t('error'), i18n.t('camera_permission_required') || 'Permission d\'accès à la caméra requise');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.6,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPendingPhotoUri(result.assets[0].uri);
      }
    };

    const handleGalleryPick = async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.6,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPendingPhotoUri(result.assets[0].uri);
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [i18n.t('cancel'), i18n.t('camera'), i18n.t('gallery')],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) await handleCameraPick();
          else if (buttonIndex === 2) await handleGalleryPick();
        }
      );
    } else {
      Alert.alert(
        i18n.t('choose_photo_source') || 'Photo',
        '',
        [
          { text: i18n.t('cancel'), style: 'cancel' },
          { text: i18n.t('camera'), onPress: () => void handleCameraPick() },
          { text: i18n.t('gallery'), onPress: () => void handleGalleryPick() },
        ]
      );
    }
  }, []);

  const handleSend = useCallback(async () => {
    const rawDraft = draft.trim().slice(0, 240);
    if (!rawDraft && !pendingPhotoUri) return;

    if (isZenMode) {
      Alert.alert(i18n.t('zen_mode_active_me_title'), i18n.t('zen_mode_active_me_body'));
      return;
    }

    setSending(true);

    try {
      if (editingMessage) {
        // MODE ÉDITION
        if (friend.id === PROOT_BOT_ID) {
          onMessageEdited?.(editingMessage.id, rawDraft);
          setDraft('');
          if (Platform.OS === 'ios' && isHapticEnabled) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          }
          return;
        }

        const result = await editMessageViaBackend(editingMessage.id, rawDraft, currentUserId);
        if (result.success) {
          onMessageEdited?.(editingMessage.id, rawDraft);
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

      // Upload de la photo éphémère si présente
      let uploadedImageUrl: string | null = null;
      if (pendingPhotoUri) {
        uploadedImageUrl = await uploadEphemeralPhoto(pendingPhotoUri, currentUserId);
        if (!uploadedImageUrl && !rawDraft) {
          Alert.alert(i18n.t('error'), "Impossible d'envoyer la photo.");
          setSending(false);
          return;
        }
      }

      const customMessage = uploadedImageUrl
        ? (isViewOnce ? `[IMG_ONCE:${uploadedImageUrl}]${rawDraft}` : `[IMG:${uploadedImageUrl}]${rawDraft}`)
        : rawDraft;

      // MODE ENVOI
      if (friend.id === PROOT_BOT_ID) {
        let randomKey: string;
        if (isChatMuteEnabled) {
          randomKey = 'mute';
        } else if (pendingChatSoundKey) {
          randomKey = pendingChatSoundKey;
        } else {
          const candidates = SOUND_KEYS_BY_CATEGORY.toot;
          randomKey =
            pickRandomWithoutImmediateRepeat(candidates, lastRandomSoundRef.current) || pickRandom(candidates);
        }
        lastRandomSoundRef.current = randomKey;

        const botSentMessage: VisibleSentMessage = {
          id: `bot-sent-${Date.now()}`,
          text: rawDraft,
          imageUrl: uploadedImageUrl || undefined,
          isViewOnce: !!uploadedImageUrl && isViewOnce,
          ts: new Date().toISOString(),
          soundKey: randomKey,
          local_ts: Date.now(),
        };

        useChatStore.getState().addSentMessages(PROOT_BOT_ID, [botSentMessage]);
        onMessageSent(botSentMessage);
        setDraft('');
        setPendingPhotoUri(null);
        setIsViewOnce(false);
        setPendingChatSoundKey(null);

        if (Platform.OS === 'ios' && isHapticEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }

        if (randomKey !== 'mute' && !isSilentMode && !isZenMode) {
          playSound(randomKey);
        }
        triggerProutHaptic(randomKey, isHapticEnabled);

        // Réponse automatique de ProotBot (son + haptique + notif + injection dans le chat store)
        void triggerProotBotResponse(isHapticEnabled, () => {
          useChatStore.getState().markMessagesAsRead(PROOT_BOT_ID, [botSentMessage.id]);
        });

        onMessageConfirmed?.();
        setSending(false);
        return;
      }

      if (!isGroup) {
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
      }

      let randomKey: string;
      let isSilentMessage = false;
      let isZenMessage = false;

      if (!isGroup && friend.is_zen_mode) {
        // En mode Zen, on force le silence absolu mais on garde le son du chat dans la DB pour la lecture
        isZenMessage = true;
      }

      if (isChatMuteEnabled) {
        randomKey = 'mute';
        isSilentMessage = true;
      } else if (pendingChatSoundKey) {
        randomKey = pendingChatSoundKey;
      } else {
        const savedMap = await AsyncStorage.getItem(FRIEND_SOUND_CATEGORY_MAP_KEY);
        const parsedMap = savedMap ? JSON.parse(savedMap) : {};
        const selectedCategory = (!isGroup && parsedMap?.[friend.id]) || (await getSelectedSoundCategory());
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
        text: rawDraft,
        imageUrl: uploadedImageUrl || undefined,
        isViewOnce: !!uploadedImageUrl && isViewOnce,
        ts: new Date().toISOString(),
        soundKey: randomKey,
        optimistic: true,
        local_ts: Date.now()
      };

      onMessageSent(optimisticMessage);
      setDraft('');
      setPendingPhotoUri(null);
      setIsViewOnce(false);
      setPendingChatSoundKey(null);

      if (Platform.OS === 'ios' && isHapticEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      if (!isSilentMessage && !isSilentMode && !isZenMessage) {
        playSound(randomKey);
      }
      if (!isSilentMessage && !isZenMessage) {
        triggerProutHaptic(randomKey, isHapticEnabled);
      }

      if (isZenMessage) {
        Alert.alert(
          i18n.t('zen_mode_active_friend_title'),
          i18n.t('zen_message_sent_toast')
        );
      }

      if (isGroup && groupId) {
        await sendGroupMessage({
          groupId,
          groupName: groupName || friend.pseudo,
          senderId: currentUserId,
          senderPseudo: currentPseudo || 'Un ami',
          text: rawDraft,
          soundKey: isSilentMessage ? undefined : randomKey,
          imageUrl: uploadedImageUrl || undefined,
          isViewOnce: !!uploadedImageUrl && isViewOnce,
        });
      } else {
        await sendProutViaBackend(
          friend.expo_push_token!,
          currentPseudo || 'Un ami',
          randomKey,
          friend.push_platform || 'android',
          {
            customMessage,
            senderId: currentUserId,
            receiverId: friend.id,
            isSilentMessage: isZenMessage || isSilentMessage // On passe le flag au backend
          }
        );
      }

      console.log('🟡 [CHAT_SEND] send success. Calling invalidateQueries...');
      if (!isGroup) {
        DeviceEventEmitter.emit('CLEAR_FRIENDLIST_PENDING_SOUND', { friendId: friend.id });
      }
      queryClient.invalidateQueries({ queryKey: ['pendingMessages', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['pendingSentMessages', currentUserId] });
      onMessageConfirmed?.();
      console.log('🟡 [CHAT_SEND] invalidateQueries called.');
    } catch (error: any) {
      console.error("Erreur lors de l'envoi/modif du message:", error?.message || error);
      Alert.alert(i18n.t('error'), "Une erreur est survenue.");
      if (!editingMessage) setDraft(rawDraft);
    } finally {
      setSending(false);
    }
  }, [
    currentPseudo,
    currentUserId,
    draft,
    friend,
    isGroup,
    groupId,
    groupName,
    isHapticEnabled,
    isChatMuteEnabled,
    isSilentMode,
    isZenMode,
    pendingChatSoundKey,
    pendingPhotoUri,
    isViewOnce,
    onMessageSent,
    setPendingChatSoundKey,
    queryClient,
    editingMessage,
    onMessageEdited,
    onCancelEdit,
    onMessageConfirmed,
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

      {!!pendingPhotoUri && !editingMessage && (
        <View style={styles.photoPreviewBar}>
          <View style={styles.photoPreviewThumbContainer}>
            <Image source={{ uri: pendingPhotoUri }} style={styles.photoPreviewThumb} resizeMode="cover" />
            {isViewOnce ? (
              <View style={[styles.photoEphemeralTag, styles.photoEphemeralTagViewOnce]}>
                <Text style={styles.photoEphemeralTagText}>① 1x</Text>
              </View>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.viewOnceToggle, isViewOnce && styles.viewOnceToggleActive]}
            onPress={() => {
              if (Platform.OS === 'ios' && isHapticEnabled) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }
              setIsViewOnce((prev) => !prev);
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('view_once')}
          >
            <View style={[styles.viewOnceIconBadge, isViewOnce && styles.viewOnceIconBadgeActive]}>
              <Text style={[styles.viewOnceIconText, isViewOnce && styles.viewOnceIconTextActive]}>①</Text>
            </View>
            <Text style={[styles.viewOnceText, isViewOnce && styles.viewOnceTextActive]}>
              {i18n.t('view_once')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.photoPreviewCancel}
            onPress={() => {
              setPendingPhotoUri(null);
              setIsViewOnce(false);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={20} color="#604a3e" />
          </TouchableOpacity>
        </View>
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

        <View style={[styles.inputContainer, editingMessage && styles.inputContainerEditing]}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={i18n.t('add_message_placeholder')}
            placeholderTextColor="#777"
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={240}
            autoCorrect={false}
            autoComplete="off"
            keyboardAppearance="light"
          />
          {!editingMessage && (
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={handlePickPhoto}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              activeOpacity={0.7}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('photo') || 'Photo'}
            >
              <Ionicons
                name="camera"
                size={22}
                color={pendingPhotoUri ? '#FF8A3D' : '#604a3e'}
              />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={() => void handleSend()}
          style={[
            styles.sendButton,
            ((!draft.trim() && !pendingPhotoUri) || sending || !isProfileHydrated) && styles.sendButtonDisabled,
            editingMessage && styles.editConfirmButton,
          ]}
          disabled={(!draft.trim() && !pendingPhotoUri) || sending || !isProfileHydrated}
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
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 10,
    backgroundColor: '#ebb89b',
    borderTopWidth: 1,
    borderTopColor: 'rgba(96, 74, 62, 0.12)',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
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
  photoPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    padding: 6,
    marginBottom: 8,
    marginHorizontal: 4,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.15)',
  },
  photoPreviewThumbContainer: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoPreviewThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  photoEphemeralTag: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  photoEphemeralTagText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  photoEphemeralTagViewOnce: {
    backgroundColor: '#FF8A3D',
  },
  viewOnceToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#FAF5EE',
    borderWidth: 1.5,
    borderColor: '#D4C4B5',
  },
  viewOnceToggleActive: {
    backgroundColor: '#FF8A3D',
    borderColor: '#E06F24',
  },
  viewOnceIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#8D7B6F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewOnceIconBadgeActive: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  viewOnceIconText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#8D7B6F',
    marginTop: Platform.OS === 'android' ? -1 : 0,
  },
  viewOnceIconTextActive: {
    color: '#FFFFFF',
  },
  viewOnceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#604A3E',
  },
  viewOnceTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  photoPreviewCancel: {
    padding: 4,
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
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: '#c5d7d3',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingLeft: 12,
    paddingRight: 6,
  },
  inputContainerEditing: {
    borderColor: '#604a3e',
    backgroundColor: '#fffcf5',
  },
  input: {
    flex: 1,
    paddingVertical: 8,
    paddingRight: 4,
    color: '#333',
    fontSize: 18,
  },
  cameraButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
