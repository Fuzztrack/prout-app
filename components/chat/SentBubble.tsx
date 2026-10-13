import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import i18n from '@/lib/i18n';
import { type VisibleSentMessage } from '@/lib/chatStore';
import { chatStyles as styles } from './chatStyles';

interface SentBubbleProps {
  message: VisibleSentMessage;
  onLongPressReact: (messageId: string) => void;
  onLongPressEdit?: (message: VisibleSentMessage) => void;
  onOpenImage?: (imageUrl: string, isViewOnce?: boolean, messageId?: string) => void;
  reaction?: string;
  isSaved: boolean;
  onToggleSave: () => void;
}

export const SentBubble = React.memo(({
  message,
  onLongPressReact,
  onLongPressEdit,
  onOpenImage,
  reaction,
  isSaved,
  onToggleSave,
}: SentBubbleProps) => {
  console.log(`🚀 [PROOT_v1.1.41] SentBubble render -> msgId: ${message.id}, status: ${message.status}, optimistic: ${message.optimistic}`);
  const [showLabel, setShowLabel] = useState(false);
  const labelTimeoutRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (labelTimeoutRef.current) clearTimeout(labelTimeoutRef.current);
    };
  }, []);

  const handleLongPress = () => {
    if (message.status !== 'read' && onLongPressEdit) {
      onLongPressEdit(message);
    } else {
      onLongPressReact(message.id);
    }
  };

  const translateX = useSharedValue(0);

  const handlePress = () => {
    const willBeSaved = !isSaved;
    if (willBeSaved) {
      translateX.value = withSequence(
        withTiming(-15, { duration: 150 }),
        withTiming(0, { duration: 150 })
      );
      setShowLabel(true);
      if (labelTimeoutRef.current) clearTimeout(labelTimeoutRef.current);
      labelTimeoutRef.current = setTimeout(() => setShowLabel(false), 1500);
    } else {
      translateX.value = withSequence(
        withTiming(10, { duration: 100 }),
        withTiming(0, { duration: 100 })
      );
      setShowLabel(false);
      if (labelTimeoutRef.current) clearTimeout(labelTimeoutRef.current);
    }
    onToggleSave();
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const hasText = !!message.text && message.text.trim().length > 0;
  const hasActiveImage = !!message.imageUrl && !message.isImageExpired;
  const hasExpiredImage = !!message.isImageExpired;

  if (!hasText && !hasActiveImage && !hasExpiredImage) {
    return null;
  }

  return (
    <View style={styles.sentBubbleWrapper}>
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, animatedStyle]}>
        {showLabel && (
          <Text style={[styles.savedLabel, styles.savedLabelSent]}>{i18n.t('message_saved')}</Text>
        )}

        <View style={{ position: 'relative' }}>
          <TouchableOpacity activeOpacity={0.92} onPress={handlePress} onLongPress={handleLongPress}>
            <View style={[styles.sentBubble, message.status === 'read' && styles.sentBubbleRead]}>
              {message.imageUrl ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => onOpenImage?.(message.imageUrl!, message.isViewOnce, message.id)}
                  onLongPress={handleLongPress}
                  style={styles.bubbleImageContainer}
                >
                  <Image
                    source={{ uri: message.imageUrl }}
                    style={styles.bubbleImage}
                    resizeMode="cover"
                    blurRadius={message.isViewOnce ? (Platform.OS === 'ios' ? 25 : 18) : 0}
                  />
                  {message.isViewOnce ? (
                    <View style={styles.viewOnceOverlay}>
                      <View style={styles.viewOnceCenterBadge}>
                        <Text style={styles.viewOnceBadgeNumber}>①</Text>
                        <Text style={styles.viewOnceBadgeText}>{i18n.t('tap_to_view')}</Text>
                      </View>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ) : message.isImageExpired ? (
                <View style={styles.expiredImageContainer}>
                  <Ionicons name="time-outline" size={15} color="#888" />
                  <Text style={styles.expiredImageText}>{i18n.t('photo_expired')}</Text>
                </View>
              ) : null}

              {!!message.text && (
                <Text style={[styles.sentText, (!!message.imageUrl || message.isImageExpired) && styles.photoCaptionText]}>
                  {message.text}
                </Text>
              )}
            </View>
          </TouchableOpacity>
          
          <View style={[styles.saveBar, styles.saveBarSent, { width: isSaved ? 4 : 0 }]} />

          {reaction ? (
            <View style={styles.sentReactionBadge}>
              <Text style={styles.reactionBadgeText}>{reaction}</Text>
            </View>
          ) : null}
        </View>
      </Animated.View>
      <View style={styles.sentFooter}>
        {message.optimistic ? (
          <Ionicons 
            name="time-outline" 
            size={12} 
            color="#604a3e" 
            style={styles.optimisticIcon} 
          />
        ) : null}
        {message.status === 'read' ? (
          <Text style={styles.sentRead}>
            {i18n.t('message_read')}
          </Text>
        ) : null}
      </View>
    </View>
  );
});

SentBubble.displayName = 'SentBubble';
