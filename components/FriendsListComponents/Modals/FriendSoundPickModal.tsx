import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Image,
  Platform,
  Dimensions,
  StyleSheet,
} from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/lib/i18n';
import { AnimatedCategoryHeaderImage } from '../AnimatedCategoryHeaderImage';
import type { ChatMessageSoundChoice } from '@/hooks/useProotAudio';
import type { SoundCategory } from '@/components/SoundcheckSelector';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const USE_NATIVE_MODAL_DRIVER = Platform.OS !== 'android';
const FRIEND_SOUND_MODAL_BACKDROP_OPACITY = Platform.OS === 'android' ? 0 : 0.45;
const ANDROID_MODAL_CLOSE_TIMING = 250;

export type FriendSoundPickModalProps = {
  isVisible: boolean;
  onClose: () => void;
  onModalShow: () => void;
  onModalHide: () => void;
  isContentVisible: boolean;
  friend: any;
  friendSoundKeyByFriend: Record<string, string>;
  previewingFriendSoundKey: string | null;
  onPreviewSound: (soundKey: string) => void;
  onSelectSound: (soundKey: string) => void;
  getDisplaySoundLabel: (soundKey: string) => string;
  getChooseSoundCategorySubtitleKey: (category: SoundCategory) => string;
  globalDefaultCategory: SoundCategory;
  onSelectGlobalDefaultCategory: (category: SoundCategory) => void;
  
  // Constants from FriendsList passed down
  CHAT_PROOTHAIL_THUMB: any;
  TOOT_LOGO_IMAGE: any;
  TOOT_PICK_HEADER_SIZE: any;
  MOOD_PICK_HEADER_SIZE: any;
  SHOW_DEFAULT_SOUND_CATEGORY_CURSOR: boolean;
  DEFAULT_SOUND_OPTION_ROWS: any[];
  MOOD_DEFAULT_CATEGORY_CURSOR_SIZE: any;
  TOOT_CURSOR_ICON_SIZE: any;
  PICKUP_TOOT_KEYS: string[];
  PICKUP_MOOD_KEYS: string[];
  PICKUP_POP_KEYS: string[];
  PICKUP_TRLL_KEYS: string[];
  PICKUP_BZZZ_KEYS: string[];
};

export const FriendSoundPickModal = ({
  isVisible,
  onClose,
  onModalShow,
  onModalHide,
  isContentVisible,
  friend,
  friendSoundKeyByFriend,
  previewingFriendSoundKey,
  onPreviewSound,
  onSelectSound,
  getDisplaySoundLabel,
  getChooseSoundCategorySubtitleKey,
  globalDefaultCategory,
  onSelectGlobalDefaultCategory,
  CHAT_PROOTHAIL_THUMB,
  TOOT_LOGO_IMAGE,
  TOOT_PICK_HEADER_SIZE,
  MOOD_PICK_HEADER_SIZE,
  SHOW_DEFAULT_SOUND_CATEGORY_CURSOR,
  DEFAULT_SOUND_OPTION_ROWS,
  MOOD_DEFAULT_CATEGORY_CURSOR_SIZE,
  TOOT_CURSOR_ICON_SIZE,
  PICKUP_TOOT_KEYS,
  PICKUP_MOOD_KEYS,
  PICKUP_POP_KEYS,
  PICKUP_TRLL_KEYS,
  PICKUP_BZZZ_KEYS,
}: FriendSoundPickModalProps) => {

  const previewingFriendSoundCategory = useMemo<ChatMessageSoundChoice | null>(() => {
    if (!previewingFriendSoundKey) return null;
    if (PICKUP_TOOT_KEYS.includes(previewingFriendSoundKey)) return 'toot';
    if (PICKUP_MOOD_KEYS.includes(previewingFriendSoundKey)) return 'mood';
    if (PICKUP_POP_KEYS.includes(previewingFriendSoundKey)) return 'pop';
    if (PICKUP_TRLL_KEYS.includes(previewingFriendSoundKey)) return 'trll';
    if (PICKUP_BZZZ_KEYS.includes(previewingFriendSoundKey)) return 'bzzz';
    return null;
  }, [previewingFriendSoundKey, PICKUP_TOOT_KEYS, PICKUP_MOOD_KEYS, PICKUP_POP_KEYS, PICKUP_TRLL_KEYS, PICKUP_BZZZ_KEYS]);

  const renderFriendSoundPickItem = useCallback((soundKey: string) => {
    const isActive = !!(friend?.id && friendSoundKeyByFriend[friend.id] === soundKey);
    const isPreviewing = previewingFriendSoundKey === soundKey;
    return (
      <View key={soundKey} style={styles.friendSoundPickItemRow}>
        <Pressable
          style={({ pressed }) => [
            styles.friendSoundPickPlayButton,
            isPreviewing && styles.friendSoundPickPlayButtonActive,
            pressed && { opacity: 0.7 }
          ]}
          onPress={() => onPreviewSound(soundKey)}
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
          onPress={() => onSelectSound(soundKey)}
        >
          <Text style={styles.friendSoundPickItemText}>{getDisplaySoundLabel(soundKey)}</Text>
        </Pressable>
      </View>
    );
  }, [
    friend?.id,
    friendSoundKeyByFriend,
    previewingFriendSoundKey,
    onPreviewSound,
    onSelectSound,
    getDisplaySoundLabel,
  ]);

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      onModalShow={onModalShow}
      onModalHide={onModalHide}
      style={styles.friendSoundModal}
      backdropOpacity={FRIEND_SOUND_MODAL_BACKDROP_OPACITY}
      animationIn="fadeIn"
      animationOut="fadeOut"
      animationOutTiming={ANDROID_MODAL_CLOSE_TIMING}
      useNativeDriver={USE_NATIVE_MODAL_DRIVER}
      useNativeDriverForBackdrop={USE_NATIVE_MODAL_DRIVER}
      hideModalContentWhileAnimating
      backdropTransitionOutTiming={1}
    >
      <View
        style={[
          styles.friendSoundModalCard,
          styles.friendSoundModalCardExpanded,
          { opacity: isContentVisible ? 1 : 0 },
        ]}
      >
        <View style={styles.friendSoundPickTitleRow}>
          <View style={styles.friendSoundPickTitleContent}>
            <Image
              source={CHAT_PROOTHAIL_THUMB}
              style={styles.friendSoundPickTitleTail}
              resizeMode="contain"
            />
            <Text style={styles.friendSoundPickTitleText}>{i18n.t('friend_sound_modal_pick_title')}</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
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
                      source={require('@/assets/images/buzz.png')}
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
                      source={require('@/assets/images/mood.png')}
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
                      source={require('@/assets/images/tweet.png')}
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
                      source={require('@/assets/images/buzz.png')}
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
                  source={require('@/assets/images/pop.png')}
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
                      source={require('@/assets/images/mood.png')}
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
                      source={require('@/assets/images/tweet.png')}
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
                      onPress={() => onSelectGlobalDefaultCategory(option.category)}
                      activeOpacity={0.85}
                    >
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
  );
};

const styles = StyleSheet.create({
  friendSoundModal: {
    justifyContent: 'center',
    margin: 0,
    paddingTop: Platform.OS === 'android' ? 20 : 0,
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
});
