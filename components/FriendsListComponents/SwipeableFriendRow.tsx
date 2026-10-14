import React, { forwardRef, useImperativeHandle, useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, Dimensions, Alert, TouchableOpacity as GHTouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  withDelay, 
  interpolate, 
  Extrapolation, 
  runOnJS, 
  cancelAnimation 
} from 'react-native-reanimated';
import i18n from '../../lib/i18n';
import { isProotBot, isProotBotGestureHintSeenSync } from '../../lib/prootBot';
import { ProotBotGestureHint } from './ProotBotGestureHint';

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
}, ref) => {
  const translationX = useSharedValue(0);
  const introOffset = useSharedValue(0);
  const selectedSoundBadgeOffset = useSharedValue(selectedSoundKey ? 0 : 160);
  const [showSentImage, setShowSentImage] = useState(false);
  const [isRowTouchActive, setIsRowTouchActive] = useState(false);
  const introDirectionRef = useRef(Math.random() > 0.5 ? 1 : -1);
  const avatarPressActiveRef = useRef(false);
  const suppressNextPressRef = useRef(false);
  const suppressPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panGestureHandledRef = useRef(false);
  const lastPressTimeRef = useRef(0);

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
    })
    .onUpdate((e) => {
      if (!panGestureHandledRef.current && (Math.abs(e.translationX) >= TAP_THRESHOLD || Math.abs(e.translationY) >= TAP_THRESHOLD)) {
        panGestureHandledRef.current = true;
        runOnJS(markPressSuppressed)();
      }
      translationX.value = Math.max(-MAX_SWIPE_LEFT, Math.min(e.translationX, MAX_SWIPE_RIGHT));
    })
    .onEnd((e) => {
      const finalX = e.translationX;
      const finalY = e.translationY;

      // Uniquement si le geste n'a PAS été considéré comme un swipe (panGestureHandledRef)
      if (!panGestureHandledRef.current && Math.abs(finalX) < TAP_THRESHOLD && Math.abs(finalY || 0) < TAP_THRESHOLD) {
        runOnJS(handleSafePressName)();
        translationX.value = withSpring(0, { damping: 15, stiffness: 150 });
        return;
      }
      
      if (finalX >= SWIPE_THRESHOLD) {
        runOnJS(triggerAction)();
        translationX.value = withSpring(0, { damping: 15, stiffness: 150 });
      } else if (finalX <= -SWIPE_THRESHOLD) {
        runOnJS(setIsRowTouchActive)(false);
        translationX.value = withSpring(0, { damping: 15, stiffness: 150 });
        runOnJS(showMuteDeleteAlert)();
      } else {
        runOnJS(setIsRowTouchActive)(false);
        translationX.value = withSpring(0, { damping: 15, stiffness: 150 });
      }
    });

  const animatedLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translationX.value + introOffset.value }],
  }));

  const animatedImageScale = useAnimatedStyle(() => {
    const positiveX = Math.max(0, translationX.value);
    const scale = interpolate(positiveX, [0, MAX_SWIPE_RIGHT * 0.3, MAX_SWIPE_RIGHT], [0.8, 1.2, 4.0], Extrapolation.CLAMP);
    const translateX = interpolate(positiveX, [0, MAX_SWIPE_RIGHT], [-20, 34], Extrapolation.CLAMP);
    return {
      transform: [{ translateX }, { translateY: -8 }, { scale }],
      opacity: translationX.value > 0 ? 1 : 0,
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
    <View style={styles.swipeableRowShadowWrapper}>
      <View style={[styles.swipeableRow, { backgroundColor }]} collapsable={false}>
        <Animated.View style={[styles.deleteBackground, animatedRedBackground]} collapsable={false}>
          <Text style={styles.deleteText}>{i18n.t('block_user')}</Text>
        </Animated.View>

        <View style={styles.swipeBackground} collapsable={false}>
          <Animated.Image
            source={showSentImage ? IOS_SENT_IMAGE : (swipeImageSource || IOS_SOUNDWAVE_IMAGE)}
            style={[styles.animImage, animatedImageScale]}
            resizeMode="contain"
          />
        </View>

        <GestureDetector gesture={gesture}>
          <Animated.View
            style={[
              styles.swipeForeground,
              { backgroundColor: isRowTouchActive ? '#9fc5b8' : backgroundColor },
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
                    <View style={styles.botAvatarWrapper}>
                      <Image 
                        source={PROOT_BOT_AVATAR} 
                        style={styles.botAvatarImage}
                        contentFit="contain"
                      />
                    </View>
                  ) : friend.isGroup ? (
                    <View style={styles.groupAvatarWrapper}>
                      {friend.avatar_url ? (
                        <Image 
                          source={{ uri: friend.avatar_url }} 
                          style={{ width: '100%', height: '100%' }}
                          contentFit="cover"
                          transition={200}
                          cachePolicy="disk"
                        />
                      ) : (
                        <Ionicons name="people" size={22} color="#604a3e" />
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
                    <View style={styles.friendAvatarPlaceholder}>
                      <Text style={styles.friendAvatarPlaceholderText}>
                        {friend.pseudo ? friend.pseudo.charAt(0).toUpperCase() : '?'}
                      </Text>
                    </View>
                  )}
                </GHTouchableOpacity>
                <View style={{ width: 10 }} />

                {/* 1. GAUCHE : Pseudo + Icônes */}
                <Text style={styles.pseudo} numberOfLines={1}>{friend.pseudo}</Text>
                {friend.isGroup ? (
                  <View style={styles.groupBadgesRow}>
                    <View style={styles.groupCountBadge}>
                      <Ionicons name="people" size={11} color="#604a3e" style={{ marginRight: 2 }} />
                      <Text style={styles.groupCountText}>{friend.groupMembersCount || 2}</Text>
                    </View>
                    {friend.retentionMode === 'permanent' ? (
                      <Ionicons name="flash" size={16} color="#604a3e" style={styles.groupFlashIcon} />
                    ) : (
                      <View style={styles.retentionBadge}>
                        <Ionicons name="timer-outline" size={11} color="#604a3e" style={{ marginRight: 2 }} />
                        <Text style={styles.retentionBadgeText}>24h</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <>
                    {friend.isZenMode && <Ionicons name="moon" size={16} color="#ebb89b" style={{ marginLeft: 4 }} />}
                    {friend.is_muted && <Ionicons name="volume-mute-outline" size={16} color="#666" style={{ marginLeft: 4 }} />}
                  </>
                )}

                {/* 2. MILIEU : Aperçu du message + Pastille verte d'avant */}
                <View style={styles.unreadMiddleContainer}>
                  {hasUnread && unreadMessage ? (
                    <View style={styles.unreadInline}>
                      <Text style={styles.unreadMessage} numberOfLines={1} ellipsizeMode="tail">"{unreadMessage}"</Text>
                      <View style={styles.greenDot} />
                    </View>
                  ) : hasUnread ? (
                    <View style={styles.greenDot} />
                  ) : null}
                </View>

                {/* 3. DROITE : Badge Prout/Vent 💨 */}
                {!friend.isGroup && typeof friend.flame_streak === 'number' && friend.flame_streak > 0 && (
                  <View style={styles.proutStreakBadge}>
                    <Text style={styles.proutStreakBadgeText}>💨 {friend.flame_streak}</Text>
                  </View>
                )}
              </View>
            </GHTouchableOpacity>
            {selectedSoundKey && (
              <Animated.View style={[styles.friendSelectedSoundBadge, animatedSelectedSoundBadgeStyle]}>
                <Text style={styles.friendSelectedSoundBadgeText} numberOfLines={1}>
                  {getDisplaySoundLabel(selectedSoundKey)}
                </Text>
                <GHTouchableOpacity
                  onPress={() => onClearSelectedSound?.(friend)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginLeft: 4 }}
                >
                  <Ionicons name="close-circle" size={14} color="#3a2a22" />
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
  );
}));

const styles = StyleSheet.create({
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
