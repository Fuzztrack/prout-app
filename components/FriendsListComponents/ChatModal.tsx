import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Platform,
  Dimensions,
  Pressable,
  Keyboard,
  Animated as RNAnimated,
} from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
  withTiming,
} from 'react-native-reanimated';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import i18n from '@/lib/i18n';
import type { ChatMessageSoundChoice } from '@/hooks/useProotAudio';
import { 
  SentMessageStatus, 
  ReceivedMessageFade, 
  parseMessageContent,
  stripReadPrefix,
  type ReportableMessage 
} from './ChatMessages';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const CHAT_MODAL_TOP_SAFE_MARGIN = Platform.OS === 'ios' ? 96 : 84;
const CHAT_MODAL_BACKDROP_OPACITY = Platform.OS === 'android' ? 0 : 0.3;
const USE_NATIVE_MODAL_DRIVER = Platform.OS !== 'android';

// Props Interface
export type ChatModalProps = {
  expandedFriendId: string | null;
  onClose: () => void;
  displayFriend: any;
  appUsers: any[];
  pendingMessages: any[];
  unreadCache: Record<string, any[]>;
  lastSentMessages: Record<string, any[]>;
  messageDrafts: Record<string, string>;
  onDraftChange: (friendId: string, text: string) => void;
  onSendMessage: (friend: any) => void;
  sendingFriendId: string | null;
  isChatMuteEnabled: boolean;
  toggleChatMute: () => void;
  isChatSoundPickerVisible: boolean;
  chatSpecificSoundListCategory: ChatMessageSoundChoice | null;
  pendingChatSpecificSoundListCategory: ChatMessageSoundChoice | null;
  pendingChatSoundKeyByFriend: Record<string, string>;
  openChatSoundPicker: () => void;
  switchChatSoundListCategoryIfOpen: (category: ChatMessageSoundChoice) => void;
  closeChatSpecificSoundList: () => void;
  handleSelectChatSpecificSound: (soundKey: string) => void;
  openReportReasonSheet: (message: ReportableMessage) => void;
  isFirstChatModalVisible: boolean;
  closeFirstChatModal: () => void;
  playLocalSound: (soundKey: string, options?: any) => void;
  fadingOutReceivedMessages: Set<string>;
  insets: any;
  getDisplaySoundLabel: (key: string) => string;
  setPendingChatSoundKeyByFriend: (setter: (prev: Record<string, string>) => Record<string, string>) => void;
  setChatMessageSoundChoice: (choice: ChatMessageSoundChoice) => void;
  getDefaultSoundCategoryForFirstLaunch: () => string;
  
  // Platform flags
  isSamsungDevice: boolean;
  isHuaweiDevice: boolean;
  isOldAndroid: boolean;
  oldAndroidInputProps: any;
  
  // Visuals
  CHAT_PROOTHAIL_THUMB: any;
  TOOT_LOGO_IMAGE: any;
  TOOT_CHAT_ICON_SIZE: any;
  CHAT_SPECIFIC_MIN_HEIGHT: number;
  PICKUP_TRLL_KEYS: string[];
  PICKUP_TOOT_KEYS: string[];
  PICKUP_BZZZ_KEYS: string[];
  PICKUP_POP_KEYS: string[];
  PICKUP_MOOD_KEYS: string[];

  // For Search sync
  isSearchVisible: boolean;
  onSearchChange: (visible: boolean) => void;
  onSearchQueryChange: (query: string) => void;
};

export const ChatModal = ({
  expandedFriendId,
  onClose,
  displayFriend,
  appUsers,
  pendingMessages,
  unreadCache,
  lastSentMessages,
  messageDrafts,
  onDraftChange,
  onSendMessage,
  sendingFriendId,
  isChatMuteEnabled,
  toggleChatMute,
  isChatSoundPickerVisible,
  chatSpecificSoundListCategory,
  pendingChatSpecificSoundListCategory,
  pendingChatSoundKeyByFriend,
  openChatSoundPicker,
  switchChatSoundListCategoryIfOpen,
  closeChatSpecificSoundList,
  handleSelectChatSpecificSound,
  openReportReasonSheet,
  isFirstChatModalVisible,
  closeFirstChatModal,
  playLocalSound,
  fadingOutReceivedMessages,
  insets,
  getDisplaySoundLabel,
  setPendingChatSoundKeyByFriend,
  setChatMessageSoundChoice,
  getDefaultSoundCategoryForFirstLaunch,
  isSamsungDevice,
  isHuaweiDevice,
  isOldAndroid,
  oldAndroidInputProps,
  CHAT_PROOTHAIL_THUMB,
  TOOT_LOGO_IMAGE,
  TOOT_CHAT_ICON_SIZE,
  CHAT_SPECIFIC_MIN_HEIGHT,
  PICKUP_TRLL_KEYS,
  PICKUP_TOOT_KEYS,
  PICKUP_BZZZ_KEYS,
  PICKUP_POP_KEYS,
  PICKUP_MOOD_KEYS,
  isSearchVisible,
  onSearchChange,
  onSearchQueryChange,
}: ChatModalProps) => {
  const [isModalContentVisible, setIsModalContentVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const stickyScrollViewRef = useRef<ScrollView>(null);
  const stickyScrollViewAnimatedRef = useRef<Animated.ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);

  // Keyboard shared values
  const keyboardHeightSV = useSharedValue(0);
  const keyboardBottomOffsetSV = useSharedValue(0);
  const keyboardVisibleSV = useSharedValue(false);

  useKeyboardHandler({
    onMove: (e: { height: number }) => {
      'worklet';
      keyboardHeightSV.value = e.height;
      keyboardBottomOffsetSV.value = Math.max(0, e.height);
      keyboardVisibleSV.value = e.height > 0;
      runOnJS(setKeyboardVisible)(e.height > 0);
    },
    onInteractive: (e: { height: number }) => {
      'worklet';
      keyboardHeightSV.value = e.height;
      keyboardBottomOffsetSV.value = Math.max(0, e.height);
      keyboardVisibleSV.value = e.height > 0;
      runOnJS(setKeyboardVisible)(e.height > 0);
    },
    onEnd: (e: { height: number }) => {
      'worklet';
      keyboardHeightSV.value = e.height;
      keyboardBottomOffsetSV.value = Math.max(0, e.height);
      keyboardVisibleSV.value = e.height > 0;
      runOnJS(setKeyboardVisible)(e.height > 0);
    },
  });

  const chatModalKeyboardStyle = useAnimatedStyle(() => {
    const rawKeyboardOffset = keyboardVisibleSV.value ? Math.max(0, keyboardBottomOffsetSV.value) : 0;
    const closedBottomGap = Platform.OS === 'android' ? Math.max(insets.bottom, 12) : 0;
    const openKeyboardGap = Platform.OS === 'android' 
      ? Math.max(0, rawKeyboardOffset - Math.max(insets.bottom, 10)) 
      : rawKeyboardOffset;
    
    const isKeyboardOpen = rawKeyboardOffset > 0;
    const marginBottom = isKeyboardOpen ? openKeyboardGap : 0;
    const internalBottomPadding = isKeyboardOpen ? 0 : closedBottomGap;
    
    return {
      marginBottom,
      paddingBottom: internalBottomPadding,
    };
  });

  const stickyMessagesAnimatedStyle = useAnimatedStyle(() => {
    if (Platform.OS !== 'android') return {};
    const keyboardOffset = keyboardVisibleSV.value ? Math.max(0, keyboardHeightSV.value) : 0;
    const availableHeight = SCREEN_HEIGHT - CHAT_MODAL_TOP_SAFE_MARGIN - keyboardOffset - 140;

    return {
      maxHeight: Math.max(220, availableHeight),
    };
  });

  const displayFriendId = displayFriend?.id ?? null;
  const displayFriendIndex = displayFriend ? appUsers.findIndex(u => u.id === displayFriend.id) : -1;
  const displayBackgroundColor = displayFriendIndex !== -1 ? '#8fb3a5' : '#d4a88a';
  const displayDraft = displayFriend ? (messageDrafts[displayFriend.id] || '') : '';

  const chatListCategoryActive = chatSpecificSoundListCategory ?? pendingChatSpecificSoundListCategory ?? null;
  const shouldShowChatSoundPicker = isChatSoundPickerVisible || chatListCategoryActive != null;
  const chatSoundListOpen = chatListCategoryActive != null;
  const chatCategoryIconInactive = (cat: ChatMessageSoundChoice) => !chatSoundListOpen || chatListCategoryActive !== cat;

  const allMessages = useMemo(() => {
    if (!displayFriend) return [];
    
    const activeUnreadMessages = pendingMessages.filter(m => m.from_user_id === displayFriend.id);
    const cachedForFriend = unreadCache[displayFriend.id] || [];
    const mergedMap = new Map<string, any>();
    cachedForFriend.forEach(m => mergedMap.set(m.id, m));
    activeUnreadMessages.forEach(m => mergedMap.set(m.id, m));
    const activeMessagesToShow = Array.from(mergedMap.values());
    
    const mySentMessages = (lastSentMessages[displayFriend.id] || []);

    const merged = [
      ...activeMessagesToShow.map((m: any, idx) => {
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
    ];

    return merged.sort((a, b) => {
      const getTs = (d: string) => {
        if (!d) return 0;
        const t = new Date(d).getTime();
        return isNaN(t) ? 0 : t;
      };
      const timeA = getTs(a.ts);
      const timeB = getTs(b.ts);
      if (timeA === timeB && timeA > 0) return 0;
      if (timeA === 0 && timeB === 0) return 0;
      if (timeA === 0) return 1;
      if (timeB === 0) return -1;
      return timeA - timeB;
    });
  }, [displayFriend, pendingMessages, unreadCache, lastSentMessages]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
    if (isSearchVisible) {
      onSearchChange(false);
      onSearchQueryChange('');
    }
  }, [onClose, isSearchVisible, onSearchChange, onSearchQueryChange]);

  return (
    <Modal
      isVisible={!!expandedFriendId}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      onModalShow={() => {
        setIsModalContentVisible(true);
        setTimeout(() => {
          textInputRef.current?.focus();
        }, Platform.OS === 'android' ? 100 : 0);
      }}
      onModalHide={() => {
        setIsModalContentVisible(false);
        if (isSearchVisible) {
          onSearchChange(false);
          onSearchQueryChange('');
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
      animationOutTiming={1}
      backdropTransitionOutTiming={1}
      avoidKeyboard={false}
    >
      <Animated.View
        style={[
          styles.modalContainer,
          { opacity: isModalContentVisible ? 1 : 0 },
          chatModalKeyboardStyle,
        ]}
      >
        {expandedFriendId && (
          <View style={styles.stickyContentLayout}>
            <TouchableOpacity 
              style={styles.stickyHeader} 
              onPress={handleClose}
              activeOpacity={0.9}
            >
              <Text style={styles.stickyPseudo}>
                {i18n.t('sticky_chat_with', { pseudo: displayFriend?.pseudo || '' })}
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
                <TouchableOpacity onPress={handleClose} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
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
                        source={CHAT_PROOTHAIL_THUMB}
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
                      playLocalSound={playLocalSound}
                      onFadeComplete={() => {}}
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
                      playLocalSound={playLocalSound}
                      onFadeComplete={() => {}}
                    />
                  )
                ))}
              </ScrollView>
            )}

            {!!pendingChatSoundKeyByFriend[displayFriend?.id] && (
              <TouchableOpacity
                style={styles.chatPendingSoundTag}
                onPress={() => {
                  setPendingChatSoundKeyByFriend((prev) => {
                    const { [displayFriend.id]: _removed, ...rest } = prev;
                    return rest;
                  });
                  const ambient = getDefaultSoundCategoryForFirstLaunch() as ChatMessageSoundChoice;
                  setChatMessageSoundChoice(ambient);
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
                  hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
                >
                  <Image
                    source={CHAT_PROOTHAIL_THUMB}
                    style={styles.chatSoundPickerThumbImage}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
                <TextInput
                  ref={textInputRef}
                  style={styles.messageInput}
                  placeholder={i18n.t('add_message_placeholder')}
                  placeholderTextColor="#777"
                  value={displayDraft}
                  onChangeText={(text) => onDraftChange(displayFriend.id, text)}
                  maxLength={140}
                  multiline
                  keyboardType="default"
                  {...((isSamsungDevice || isHuaweiDevice || isOldAndroid) ? {
                    autoCorrect: false,
                    autoComplete: 'off',
                    importantForAutofill: 'no', 
                    spellCheck: false,
                    textContentType: 'none',
                  } : {})}
                  keyboardAppearance="dark"
                  onFocus={() => {
                    closeChatSpecificSoundList();
                  }}
                  {...oldAndroidInputProps}
                />
              </View>
              <TouchableOpacity
                onPress={() => displayDraft.trim() && onSendMessage(displayFriend)}
                style={[
                  styles.messageSendButton,
                  { backgroundColor: sendingFriendId === displayFriend?.id ? '#a8d5ba' : displayBackgroundColor },
                  !displayDraft.trim() && styles.messageSendButtonDisabled,
                ]}
                activeOpacity={displayDraft.trim() ? 0.8 : 1}
                disabled={!displayDraft.trim()}
              >
                <Ionicons name="send" size={18} color="#604a3e" />
              </TouchableOpacity>
            </View>

            {shouldShowChatSoundPicker && (
              <View style={[styles.chatSoundZone, !chatSoundListOpen && { borderBottomWidth: 0 }]}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chatSoundChoiceScroller}
                  contentContainerStyle={styles.chatSoundChoiceRow}
                  keyboardShouldPersistTaps="always"
                >
                  {Platform.OS === 'android' && (
                    <Pressable style={styles.chatSoundChoiceButton} onPress={() => switchChatSoundListCategoryIfOpen('toot')}>
                      <Image
                        source={TOOT_LOGO_IMAGE}
                        style={[styles.chatSoundChoiceImage, TOOT_CHAT_ICON_SIZE, chatCategoryIconInactive('toot') && styles.chatSoundChoiceImageInactive]}
                        resizeMode="contain"
                      />
                    </Pressable>
                  )}
                  <Pressable style={styles.chatSoundChoiceButton} onPress={() => switchChatSoundListCategoryIfOpen('mood')}>
                    <Image
                      source={require('@/assets/images/mood.png')}
                      style={[styles.chatSoundChoiceImage, chatCategoryIconInactive('mood') && styles.chatSoundChoiceImageInactive]}
                      resizeMode="contain"
                    />
                  </Pressable>
                  <Pressable style={styles.chatSoundChoiceButton} onPress={() => switchChatSoundListCategoryIfOpen('pop')}>
                    <Image
                      source={require('@/assets/images/pop.png')}
                      style={[styles.chatSoundChoiceImage, { width: 62, height: 42 }, chatCategoryIconInactive('pop') && styles.chatSoundChoiceImageInactive]}
                      resizeMode="contain"
                    />
                  </Pressable>
                  {Platform.OS !== 'android' && (
                    <Pressable style={styles.chatSoundChoiceButton} onPress={() => switchChatSoundListCategoryIfOpen('toot')}>
                      <Image
                        source={TOOT_LOGO_IMAGE}
                        style={[styles.chatSoundChoiceImage, TOOT_CHAT_ICON_SIZE, chatCategoryIconInactive('toot') && styles.chatSoundChoiceImageInactive]}
                        resizeMode="contain"
                      />
                    </Pressable>
                  )}
                  <Pressable style={styles.chatSoundChoiceButton} onPress={() => switchChatSoundListCategoryIfOpen('trll')}>
                    <Image
                      source={require('@/assets/images/tweet.png')}
                      style={[styles.chatSoundChoiceImage, chatCategoryIconInactive('trll') && styles.chatSoundChoiceImageInactive]}
                      resizeMode="contain"
                    />
                  </Pressable>
                  <Pressable style={styles.chatSoundChoiceButton} onPress={() => switchChatSoundListCategoryIfOpen('bzzz')}>
                    <Image
                      source={require('@/assets/images/buzz.png')}
                      style={[styles.chatSoundChoiceImage, chatCategoryIconInactive('bzzz') && styles.chatSoundChoiceImageInactive]}
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
        )}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    width: '100%',
    backgroundColor: '#ebb89b',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    padding: 10,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  stickyContentLayout: {
    flex: 1,
    minHeight: 0,
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
  stickyHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  messageInputRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 0, 
    gap: 8 
  },
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
  chatSoundPickerEntryThumbFlushLeft: {
    marginLeft: -10,
  },
  chatSoundPickerThumbImage: {
    width: 56,
    height: 40,
    marginLeft: 0,
    marginRight: 0,
  },
  messageInput: { 
    flex: 1, 
    minHeight: 40, 
    maxHeight: 80, 
    borderWidth: 1, 
    borderColor: '#c5d7d3', 
    borderRadius: 10, 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    color: '#333', 
    backgroundColor: '#fff', 
    fontSize: 18 
  },
  messageSendButton: { 
    backgroundColor: '#ebb89b', 
    padding: 10, 
    borderRadius: 999, 
    justifyContent: 'center', 
    alignItems: 'center', 
    minWidth: 40, 
    minHeight: 40 
  },
  messageSendButtonDisabled: { 
    backgroundColor: '#d9d9d9' 
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
  chatSoundChoiceImage: {
    width: 75,
    height: 51,
  },
  chatSoundChoiceImageInactive: {
    opacity: 0.4,
  },
  chatSoundZoneSeparator: {
    display: 'none',
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
  firstFooterModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.12)',
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
  firstFooterModalFeatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
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
});
