import React, { forwardRef, useImperativeHandle, useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, Dimensions, Alert, TouchableOpacity as GHTouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue, 
  type SharedValue,
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  withDelay, 
  withSequence,
  Easing,
  interpolate, 
  Extrapolation, 
  runOnJS, 
  cancelAnimation 
} from 'react-native-reanimated';
import i18n from '../../lib/i18n';
import { isProotBot, isProotBotGestureHintSeenSync } from '../../lib/prootBot';
import { ProotBotGestureHint } from './ProotBotGestureHint';
import { triggerProutThresholdHaptic } from '../../lib/proutHaptics';
import { useAppStore } from '../../lib/store';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 150;
const TAP_THRESHOLD = 12;
const MAX_SWIPE_RIGHT = SCREEN_WIDTH * 0.7;
const MAX_SWIPE_LEFT = SCREEN_WIDTH * 0.7;
const FRIEND_ROW_LONG_PRESS_DELAY_MS = 320;

const IOS_SOUNDWAVE_IMAGE = require('../../assets/images/proothail.png');
const IOS_SENT_IMAGE = require('../../assets/images/animprout4.png');
const PROOT_BOT_AVATAR = require('../../assets/images/proothail2.png');

export type SwipeableFriendRowHandle = {
  startHoldSend: () => void;
  cancelHoldSend: () => void;
  animateBlastSwipe: () => void;
};

type SwipeableFriendRowProps = { 
  friend: any; 
  backgroundColor: string; 
  onSendProut: (friend: any) => void; 
  onPressAvatar?: (friend: any) => void;
  onLongPressAvatar: (friend: any) => void;
  onLongPressRow: (friend: any) => void;
  onPressName?: (friend: any) => void;
  hasUnread?: boolean;
  unreadMessage?: string | null;
  onDeleteFriend: (friend: any) => void;
  onMuteFriend: (friend: any) => void;
  onUnmuteFriend?: (friend: any) => void;
  isMuted?: boolean;
  introDelay?: number;
  introTrigger?: number;
  selectedSoundKey?: string;
  swipeImageSource?: any;
  onClearSelectedSound?: (friend: any) => void;
  getDisplaySoundLabel: (key: string) => string;
  isBlastMode?: boolean;
  isBlastSelected?: boolean;
  onToggleBlastSelect?: (friend: any) => void;
  isBlastAnimating?: boolean;
  hasBlastSelectedFriends?: boolean;
  blastDragX?: SharedValue<number>;
  blastActiveRowId?: SharedValue<string | null>;
};

export const SwipeableFriendRow = React.memo(forwardRef<SwipeableFriendRowHandle, SwipeableFriendRowProps>(({
  friend, 
  backgroundColor, 
  onSendProut, 
  onPressAvatar,
  onLongPressAvatar,
  onLongPressRow,
  onPressName, 
  hasUnread = false, 
  unreadMessage, 
  onDeleteFriend, 
  onMuteFriend, 
  onUnmuteFriend, 
  isMuted = false, 
  introDelay = 0,
  introTrigger = 0,
  selectedSoundKey,
  swipeImageSource,
  onClearSelectedSound,
  getDisplaySoundLabel,
  isBlastMode = false,
  isBlastSelected = false,
  onToggleBlastSelect,
  isBlastAnimating = false,
  hasBlastSelectedFriends = false,
  blastDragX,
  blastActiveRowId,
}, ref) => {
  const translationX = useSharedValue(0);
  const introOffset = useSharedValue(0);
  const selectedSoundBadgeOffset = useSharedValue(selectedSoundKey ? 0 : 160);
  const blastAnim = useSharedValue(isBlastMode ? 1 : 0);
  const isHapticEnabled = useAppStore(state => state.isHapticEnabled);
  const isNightMode = useAppStore(state => state.isNightMode);
  const thresholdPassedRef = useRef(false);
  const [showSentImage, setShowSentImage] = useState(false);
  const [isRowTouchActive, setIsRowTouchActive] = useState(false);
  const introDirectionRef = useRef(Math.random() > 0.5 ? 1 : -1);
  const avatarPressActiveRef = useRef(false);
  const suppressNextPressRef = useRef(false);
  const suppressPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panGestureHandledRef = useRef(false);
  const lastPressTimeRef = useRef(0);

  useEffect(() => {
    if (isBlastAnimating) {
      if (blastActiveRowId?.value !== null && blastActiveRowId?.value !== undefined) {
        return;
      }
      cancelAnimation(translationX);
      setShowSentImage(true);
      translationX.value = withSequence(
        withTiming(MAX_SWIPE_RIGHT, { duration: 320, easing: Easing.out(Easing.quad) }),
        withDelay(180, withSpring(0, { damping: 15, stiffness: 150 }))
      );
      const timer = setTimeout(() => {
        setShowSentImage(false);
      }, 650);
      return () => clearTimeout(timer);
    }
  }, [isBlastAnimating]);

  useEffect(() => {
    blastAnim.value = withTiming(isBlastMode ? 1 : 0, {
      duration: 250,
      easing: Easing.out(Easing.cubic),
    });
  }, [isBlastMode, blastAnim]);

  const animatedBlastCheckboxStyle = useAnimatedStyle(() => {
    const width = interpolate(blastAnim.value, [0, 1], [0, 36], Extrapolation.CLAMP);
    const opacity = interpolate(blastAnim.value, [0, 0.3, 1], [0, 0, 1], Extrapolation.CLAMP);
    const scale = interpolate(blastAnim.value, [0, 1], [0.4, 1], Extrapolation.CLAMP);
    const marginRight = interpolate(blastAnim.value, [0, 1], [0, 8], Extrapolation.CLAMP);
    return {
      width,
      opacity,
      marginRight,
      transform: [{ scale }],
    };
  });

  const handleThresholdHaptic = useCallback(() => {
    triggerProutThresholdHaptic(isHapticEnabled);
  }, [isHapticEnabled]);

  const markPressSuppressed = () => {
    suppressNextPressRef.current = true;
    if (suppressPressTimerRef.current) {
      clearTimeout(suppressPressTimerRef.current);
    }
    suppressPressTimerRef.current = setTimeout(() => {
      suppressNextPressRef.current = false;
      suppressPressTimerRef.current = null;
    }, 1200); // Augmenté à 1200ms pour les swipes hésitants
  };

  const handleSafePressName = () => {
    setIsRowTouchActive(false);

    // Anti-double-déclenchement (throttle)
    const now = Date.now();
    if (now - lastPressTimeRef.current < 300) {
      return;
    }
    lastPressTimeRef.current = now;

    if (suppressNextPressRef.current) {
      suppressNextPressRef.current = false;
      if (suppressPressTimerRef.current) {
        clearTimeout(suppressPressTimerRef.current);
        suppressPressTimerRef.current = null;
      }
      return;
    }

    if (isBlastMode) {
      onToggleBlastSelect?.(friend);
      return;
    }

    onPressName?.(friend);
  };

  const handleAvatarPress = () => {
    avatarPressActiveRef.current = false;
    setIsRowTouchActive(false);
    markPressSuppressed();
    const triggerModal = onPressAvatar || onLongPressAvatar;
    triggerModal?.(friend);
  };

  useEffect(() => {
    return () => {
      if (suppressPressTimerRef.current) {
        clearTimeout(suppressPressTimerRef.current);
        suppressPressTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // 🔄 RÉINITIALISATION lors du recyclage ou réorganisation
    // Si l'ID de l'ami change sur cette ligne, on remet tout à zéro immédiatement
    translationX.value = 0;
    introOffset.value = 0;
    setShowSentImage(false);
    setIsRowTouchActive(false);
    panGestureHandledRef.current = false;
  }, [friend.id]);

  useEffect(() => {
    // On ne déclenche l'animation d'entrée QUE si introTrigger change
    // et on s'assure que c'est bien une nouvelle demande d'animation
    if (introTrigger > 0) {
      // Petit délai basé sur l'index pour l'effet "cascade"
      const delay = introDelay || 0;
      introOffset.value = introDirectionRef.current * 24;
      introOffset.value = withDelay(
        delay,
        withSpring(0, { damping: 12, stiffness: 140 })
      );
    }
  }, [introTrigger]); // On ne dépend QUE de introTrigger ici

  useEffect(() => {
    if (selectedSoundKey) {
      selectedSoundBadgeOffset.value = 160;
      selectedSoundBadgeOffset.value = withTiming(0, { duration: 280 });
    } else {
      selectedSoundBadgeOffset.value = withTiming(160, { duration: 160 });
    }
  }, [selectedSoundKey]);
  
  const triggerAction = () => {
    setShowSentImage(true);
    onSendProut(friend);
    setTimeout(() => setShowSentImage(false), 600);
  };

  useImperativeHandle(ref, () => ({
    startHoldSend: () => {
      cancelAnimation(translationX);
      translationX.value = withTiming(MAX_SWIPE_RIGHT, { duration: 800 }, (finished) => {
        if (finished) {
          runOnJS(triggerAction)();
          translationX.value = withSpring(0, { damping: 15, stiffness: 150 });
        }
      });
    },
    cancelHoldSend: () => {
      cancelAnimation(translationX);
      translationX.value = withSpring(0, { damping: 15, stiffness: 150 });
    },
    animateBlastSwipe: () => {
      if (blastActiveRowId?.value !== null && blastActiveRowId?.value !== undefined) {
        return;
      }
      cancelAnimation(translationX);
      setShowSentImage(true);
      translationX.value = withSequence(
        withTiming(MAX_SWIPE_RIGHT, { duration: 320, easing: Easing.out(Easing.quad) }),
        withDelay(180, withSpring(0, { damping: 15, stiffness: 150 }))
      );
      setTimeout(() => {
        setShowSentImage(false);
      }, 650);
    },
  }));

  const showMuteDeleteAlert = useCallback(() => {
    Alert.alert(
      i18n.t('safety_actions_title'),
      '',
      [
        { text: i18n.t('cancel'), style: 'cancel' },
        { text: i18n.t('block_user'), style: 'destructive', onPress: () => onDeleteFriend(friend) },
      ]
    );
  }, [onDeleteFriend, friend]);

  const gesture = Gesture.Pan()
    .activeOffsetX(Platform.OS === 'android' ? [-25, 25] : [-20, 20])
    .failOffsetY(Platform.OS === 'android' ? [-25, 25] : [-20, 20])
    .onBegin(() => {
      panGestureHandledRef.current = false;
      thresholdPassedRef.current = false;
      if (isBlastMode && (isBlastSelected || hasBlastSelectedFriends) && blastActiveRowId && blastDragX) {
        blastActiveRowId.value = friend.id;
        blastDragX.value = 0;
      }
    })
    .onUpdate((e) => {
      if (!panGestureHandledRef.current && (Math.abs(e.translationX) >= TAP_THRESHOLD || Math.abs(e.translationY) >= TAP_THRESHOLD)) {
        panGestureHandledRef.current = true;
        runOnJS(markPressSuppressed)();
      }
      if (e.translationX >= SWIPE_THRESHOLD && !thresholdPassedRef.current) {
        thresholdPassedRef.current = true;
        runOnJS(handleThresholdHaptic)();
      } else if (e.translationX < SWIPE_THRESHOLD && thresholdPassedRef.current) {
        thresholdPassedRef.current = false;
      }
      const clampedX = Math.max(-MAX_SWIPE_LEFT, Math.min(e.translationX, MAX_SWIPE_RIGHT));
      translationX.value = clampedX;
      if (isBlastMode && (isBlastSelected || hasBlastSelectedFriends) && blastActiveRowId && blastDragX && blastActiveRowId.value === friend.id) {
        blastDragX.value = Math.max(0, clampedX);
      }
    })
    .onEnd((e) => {
      thresholdPassedRef.current = false;
      const finalX = e.translationX;
      const finalY = e.translationY;
      const isBlastLeader = Boolean(
        isBlastMode &&
        (isBlastSelected || hasBlastSelectedFriends) &&
        blastActiveRowId &&
        blastDragX &&
        blastActiveRowId.value === friend.id
      );

      // Uniquement si le geste n'a PAS été considéré comme un swipe (panGestureHandledRef)
      if (!panGestureHandledRef.current && Math.abs(finalX) < TAP_THRESHOLD && Math.abs(finalY || 0) < TAP_THRESHOLD) {
        runOnJS(handleSafePressName)();
        if (isBlastLeader && blastDragX && blastActiveRowId) {
          blastDragX.value = withSpring(0, { damping: 15, stiffness: 150 }, (finished) => {
            if (finished) {
              blastActiveRowId.value = null;
            }
          });
        }
        translationX.value = withSpring(0, { damping: 15, stiffness: 150 });
        return;
      }
      
      if (finalX >= SWIPE_THRESHOLD) {
        if (isBlastLeader && blastDragX && blastActiveRowId) {
          translationX.value = withSequence(
            withTiming(MAX_SWIPE_RIGHT, { duration: 180, easing: Easing.out(Easing.quad) }),
            withDelay(180, withSpring(0, { damping: 15, stiffness: 150 }))
          );
          blastDragX.value = withSequence(
            withTiming(MAX_SWIPE_RIGHT, { duration: 180, easing: Easing.out(Easing.quad) }),
            withDelay(180, withSpring(0, { damping: 15, stiffness: 150 }, (finished) => {
              if (finished) {
                blastActiveRowId.value = null;
              }
            }))
          );
          runOnJS(triggerAction)();
        } else {
          runOnJS(triggerAction)();
          translationX.value = withSpring(0, { damping: 15, stiffness: 150 });
        }
      } else if (finalX <= -SWIPE_THRESHOLD) {
        runOnJS(setIsRowTouchActive)(false);
        if (isBlastLeader && blastDragX && blastActiveRowId) {
          blastDragX.value = 0;
          blastActiveRowId.value = null;
        }
        translationX.value = withSpring(0, { damping: 15, stiffness: 150 });
        runOnJS(showMuteDeleteAlert)();
      } else {
        runOnJS(setIsRowTouchActive)(false);
        if (isBlastLeader && blastDragX && blastActiveRowId) {
          blastDragX.value = withSpring(0, { damping: 15, stiffness: 150 }, (finished) => {
            if (finished) {
              blastActiveRowId.value = null;
            }
          });
        }
        translationX.value = withSpring(0, { damping: 15, stiffness: 150 });
      }
    })
    .onFinalize((e, success) => {
      if (!success) {
        if (isBlastMode && blastActiveRowId && blastDragX && blastActiveRowId.value === friend.id) {
          blastDragX.value = withSpring(0, { damping: 15, stiffness: 150 }, (finished) => {
            if (finished) {
              blastActiveRowId.value = null;
            }
          });
        }
      }
    });

  const animatedLineStyle = useAnimatedStyle(() => {
    const isFollower = Boolean(
      isBlastMode &&
      isBlastSelected &&
      blastActiveRowId?.value !== null &&
      blastActiveRowId?.value !== undefined &&
      blastActiveRowId?.value !== friend.id
    );
    const currentX = isFollower && blastDragX ? blastDragX.value : translationX.value;
    return {
      transform: [{ translateX: currentX + introOffset.value }],
    };
  });

  const animatedImageScale = useAnimatedStyle(() => {
    const isFollower = Boolean(
      isBlastMode &&
      isBlastSelected &&
      blastActiveRowId?.value !== null &&
      blastActiveRowId?.value !== undefined &&
      blastActiveRowId?.value !== friend.id
    );
    const currentX = isFollower && blastDragX ? blastDragX.value : translationX.value;
    const positiveX = Math.max(0, currentX);
    const scale = interpolate(positiveX, [0, MAX_SWIPE_RIGHT * 0.3, MAX_SWIPE_RIGHT], [0.8, 1.2, 4.0], Extrapolation.CLAMP);
    const translateX = interpolate(positiveX, [0, MAX_SWIPE_RIGHT], [-20, 34], Extrapolation.CLAMP);
    return {
      transform: [{ translateX }, { translateY: -8 }, { scale }],
      opacity: currentX > 0 ? 1 : 0,
    };
  });

  const animatedRedBackground = useAnimatedStyle(() => {
    const opacity = interpolate(Math.abs(Math.min(0, translationX.value)), [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP);
    return { opacity };
  });

  const animatedSelectedSoundBadgeStyle = useAnimatedStyle(() => {
    const opacity = interpolate(selectedSoundBadgeOffset.value, [0, 160], [1, 0], Extrapolation.CLAMP);
    return { transform: [{ translateX: selectedSoundBadgeOffset.value }], opacity };
  });

  return (
    <View style={styles.outerRowContainer}>
      <Animated.View style={[styles.blastCheckboxWrapper, animatedBlastCheckboxStyle]}>
        <GHTouchableOpacity
          onPress={() => onToggleBlastSelect?.(friend)}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[
            styles.blastCheckbox,
            isNightMode && { borderColor: '#ebb89b', backgroundColor: 'rgba(30, 24, 20, 0.8)' },
            isBlastSelected && styles.blastCheckboxSelected,
          ]}
        >
          {isBlastSelected && (
            <Ionicons name="checkmark" size={18} color="#ffffff" />
          )}
        </GHTouchableOpacity>
      </Animated.View>
      <View style={[styles.swipeableRowShadowWrapper, { flex: 1 }]}>
        <View style={[styles.swipeableRow, { backgroundColor }]} collapsable={false}>
          <Animated.View style={[styles.deleteBackground, animatedRedBackground]} collapsable={false}>
            <Text style={styles.deleteText}>{i18n.t('block_user')}</Text>
          </Animated.View>

          <View style={[styles.swipeBackground, isNightMode && { backgroundColor: 'rgba(28, 22, 19, 0.4)' }]} collapsable={false}>
            <Animated.Image
              source={(showSentImage || isBlastAnimating) ? IOS_SENT_IMAGE : (swipeImageSource || IOS_SOUNDWAVE_IMAGE)}
              style={[styles.animImage, animatedImageScale]}
              resizeMode="contain"
            />
          </View>

          <GestureDetector gesture={gesture}>
            <Animated.View
              style={[
                styles.swipeForeground,
                { backgroundColor: isRowTouchActive ? (isNightMode ? '#34524e' : '#9fc5b8') : backgroundColor },
                animatedLineStyle,
              ]}
            >
              <GHTouchableOpacity
                onPress={handleSafePressName}
                onPressIn={() => !avatarPressActiveRef.current && setIsRowTouchActive(true)}
                onPressOut={() => setIsRowTouchActive(false)}
                onLongPress={() => {
                  if (avatarPressActiveRef.current) return;
                  setIsRowTouchActive(false);
                  markPressSuppressed();
                  onLongPressRow(friend);
                }}
                delayLongPress={FRIEND_ROW_LONG_PRESS_DELAY_MS}
                activeOpacity={1}
                style={[styles.userInfo, { flex: 1 }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <GHTouchableOpacity
                    onPress={handleAvatarPress}
                    onPressIn={() => { avatarPressActiveRef.current = true; setIsRowTouchActive(false); }}
                    onPressOut={() => { avatarPressActiveRef.current = false; }}
                    onLongPress={handleAvatarPress}
                    delayLongPress={300}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    {isProotBot(friend.id) ? (
                      <View style={[styles.botAvatarWrapper, isNightMode && { backgroundColor: '#3d2f28' }]}>
                        <Image 
                          source={PROOT_BOT_AVATAR} 
                          style={styles.botAvatarImage}
                          contentFit="contain"
                        />
                      </View>
                    ) : friend.isGroup ? (
                      <View style={[styles.groupAvatarWrapper, isNightMode && { backgroundColor: '#3d2f28' }]}>
                        {friend.avatar_url ? (
                          <Image 
                            source={{ uri: friend.avatar_url }} 
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                            transition={200}
                            cachePolicy="disk"
                          />
                        ) : (
                          <Ionicons name="people" size={22} color={isNightMode ? "#ebb89b" : "#604a3e"} />
                        )}
                      </View>
                    ) : friend.avatar_url ? (
                      <Image 
                        source={{ uri: friend.avatar_url }} 
                        style={styles.friendAvatar}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="disk"
                      />
                    ) : (
                      <View style={[styles.friendAvatarPlaceholder, isNightMode && { backgroundColor: '#3d2f28' }]}>
                        <Text style={[styles.friendAvatarPlaceholderText, isNightMode && { color: '#ebb89b' }]}>
                          {friend.pseudo ? friend.pseudo.charAt(0).toUpperCase() : '?'}
                        </Text>
                      </View>
                    )}
                  </GHTouchableOpacity>
                  <View style={{ width: 10 }} />

                  {/* 1. GAUCHE : Pseudo + Icônes */}
                  <Text style={[styles.pseudo, isNightMode && { color: '#f5e6dc' }]} numberOfLines={1}>{friend.pseudo}</Text>
                  {friend.isGroup ? (
                    <View style={styles.groupBadgesRow}>
                      <View style={[styles.groupCountBadge, isNightMode && { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                        <Ionicons name="people" size={11} color={isNightMode ? "#ebb89b" : "#604a3e"} style={{ marginRight: 2 }} />
                        <Text style={[styles.groupCountText, isNightMode && { color: '#f5e6dc' }]}>{friend.groupMembersCount || 2}</Text>
                      </View>
                      {friend.retentionMode === 'permanent' ? (
                        <Ionicons name="flash" size={16} color={isNightMode ? "#ebb89b" : "#604a3e"} style={styles.groupFlashIcon} />
                      ) : (
                        <View style={[styles.retentionBadge, isNightMode && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                          <Ionicons name="timer-outline" size={11} color={isNightMode ? "#ebb89b" : "#604a3e"} style={{ marginRight: 2 }} />
                          <Text style={[styles.retentionBadgeText, isNightMode && { color: '#f5e6dc' }]}>24h</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <>
                      {friend.isZenMode && <Ionicons name="moon" size={16} color="#ebb89b" style={{ marginLeft: 4 }} />}
                      {friend.is_muted && <Ionicons name="volume-mute-outline" size={16} color={isNightMode ? "#a0887a" : "#666"} style={{ marginLeft: 4 }} />}
                    </>
                  )}

                  {/* 2. MILIEU : Aperçu du message + Pastille verte d'avant */}
                  <View style={styles.unreadMiddleContainer}>
                    {hasUnread && unreadMessage ? (
                      <View style={styles.unreadInline}>
                        <Text style={[styles.unreadMessage, isNightMode && { color: '#f5e6dc' }]} numberOfLines={1} ellipsizeMode="tail">{`"${unreadMessage}"`}</Text>
                        <View style={styles.greenDot} />
                      </View>
                    ) : hasUnread ? (
                      <View style={styles.greenDot} />
                    ) : null}
                  </View>

                  {/* 3. DROITE : Badge Prout/Vent 💨 */}
                  {!friend.isGroup && typeof friend.flame_streak === 'number' && friend.flame_streak > 0 && (
                    <View style={[styles.proutStreakBadge, isNightMode && { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                      <Text style={[styles.proutStreakBadgeText, isNightMode && { color: '#f5e6dc' }]}>💨 {friend.flame_streak}</Text>
                    </View>
                  )}
                </View>
              </GHTouchableOpacity>
              {selectedSoundKey && (
                <Animated.View style={[styles.friendSelectedSoundBadge, animatedSelectedSoundBadgeStyle, isNightMode && { backgroundColor: '#3d2f28' }]}>
                  <Text style={[styles.friendSelectedSoundBadgeText, isNightMode && { color: '#f5e6dc' }]} numberOfLines={1}>
                    {getDisplaySoundLabel(selectedSoundKey)}
                  </Text>
                  <GHTouchableOpacity
                    onPress={() => onClearSelectedSound?.(friend)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ marginLeft: 4 }}
                  >
                    <Ionicons name="close-circle" size={14} color={isNightMode ? "#ebb89b" : "#3a2a22"} />
                  </GHTouchableOpacity>
                </Animated.View>
              )}
            </Animated.View>
          </GestureDetector>
        </View>
        {isProotBot(friend.id) && !isProotBotGestureHintSeenSync() && (
          <ProotBotGestureHint isRowActive={isRowTouchActive} />
        )}
      </View>
    </View>
  );
}));

const styles = StyleSheet.create({
  outerRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  blastCheckboxWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    height: 60,
    marginBottom: 5,
  },
  blastCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#604a3e',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blastCheckboxSelected: {
    backgroundColor: '#ff5722',
    borderColor: '#ff5722',
  },
  swipeableRowShadowWrapper: {
    position: 'relative',
    marginBottom: 5, // Espace de 5px entre chaque bouton
    borderRadius: 15, // Angles arrondis d'origine
    ...Platform.select({
      ios: {
        shadowColor: '#5c4a3d',
        shadowOffset: { width: -5, height: 3 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  swipeableRow: {
    height: 60, // Hauteur réduite d'origine
    borderRadius: 15, // Appliquer aussi ici pour le contenu
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  swipeBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.4)', // Fond blanc translucide d'origine
    justifyContent: 'center',
    paddingLeft: 20,
    overflow: 'hidden',
  },
  swipeForeground: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: '100%',
    width: '100%',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendAvatar: {
    width: 44, // Réduit pour s'adapter à 60 de hauteur
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eee',
  },
  botAvatarWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ebb89b',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  botAvatarImage: {
    width: 38,
    height: 38,
  },
  friendAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#604a3e', // Marron chocolat d'origine
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendAvatarPlaceholderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff', // Texte blanc sur fond marron
  },
  pseudo: {
    fontSize: 17,
    fontWeight: '700',
    color: '#604a3e',
    maxWidth: 130,
    flexShrink: 1,
  },
  unreadMiddleContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  unreadMessage: {
    fontSize: 13,
    color: '#604a3e',
    fontStyle: 'italic',
    marginRight: 5,
    flexShrink: 1,
  },
  greenDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50', // Pastille verte d'avant
  },
  proutStreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(96, 74, 62, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.22)',
  },
  proutStreakBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#604a3e',
  },
  animImage: {
    width: Platform.OS === 'android' ? 74 : 60,
    height: Platform.OS === 'android' ? 74 : 60,
  },
  deleteBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ff5252',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 24,
  },
  deleteText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  friendSelectedSoundBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ebb89b', // Couleur de fond de l'app
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.2)', // Bordure discrète pour le relief
  },
  friendSelectedSoundBadgeText: {
    fontSize: 11,
    color: '#3a2a22',
    fontWeight: 'bold',
    // maxWidth supprimé pour afficher le nom en entier
  },
  groupAvatarWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff5eb',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#604a3e',
    overflow: 'hidden',
  },
  groupBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
    gap: 4,
  },
  groupCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(96, 74, 62, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  groupCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#604a3e',
  },
  retentionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(96, 74, 62, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  retentionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#604a3e',
  },
  groupFlashIcon: {
    marginLeft: 1,
  },
});
