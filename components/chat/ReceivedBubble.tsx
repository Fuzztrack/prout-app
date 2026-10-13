import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import i18n from '@/lib/i18n';
import { chatStyles as styles } from './chatStyles';

interface ReceivedBubbleProps {
  message: {
    id: string;
    text: string;
    soundKey?: string;
    createdAt?: string;
    senderId: string;
    imageUrl?: string;
    isViewOnce?: boolean;
    isImageExpired?: boolean;
  };
  onLongPressReact: (messageId: string) => void;
  onOpenImage?: (imageUrl: string, isViewOnce?: boolean, messageId?: string) => void;
  reaction?: string;
  isSaved: boolean;
  onToggleSave: () => void;
}

export const ReceivedBubble = React.memo(({
  message,
  onLongPressReact,
  onOpenImage,
  reaction,
  isSaved,
  onToggleSave,
}: ReceivedBubbleProps) => {
  const [showLabel, setShowLabel] = useState(false);
  const labelTimeoutRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (labelTimeoutRef.current) clearTimeout(labelTimeoutRef.current);
    };
  }, []);

  const translateX = useSharedValue(0);

  const handlePress = () => {
    const willBeSaved = !isSaved;
    if (willBeSaved) {
      translateX.value = withSequence(
        withTiming(15, { duration: 150 }),
        withTiming(0, { duration: 150 })
      );
      setShowLabel(true);
      if (labelTimeoutRef.current) clearTimeout(labelTimeoutRef.current);
      labelTimeoutRef.current = setTimeout(() => setShowLabel(false), 1500);
    } else {
      translateX.value = withSequence(
        withTiming(-10, { duration: 100 }),
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
    <View style={styles.receivedBubbleWrapper}>
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, animatedStyle]}>
        <View style={{ position: 'relative' }}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={handlePress}
            onLongPress={() => onLongPressReact(message.id)}
            style={styles.receivedBubble}
          >
            {message.imageUrl ? (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => onOpenImage?.(message.imageUrl!, message.isViewOnce, message.id)}
                onLongPress={() => onLongPressReact(message.id)}
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
              <Text style={[styles.receivedText, (!!message.imageUrl || message.isImageExpired) && styles.photoCaptionText]}>
                {message.text}
              </Text>
            )}
          </TouchableOpacity>
          
          <View style={[styles.saveBar, styles.saveBarReceived, { width: isSaved ? 4 : 0 }]} />

          {reaction ? (
            <View style={styles.receivedReactionBadge}>
              <Text style={styles.reactionBadgeText}>{reaction}</Text>
            </View>
          ) : null}
        </View>

        {showLabel && (
          <Text style={[styles.savedLabel, styles.savedLabelReceived]}>{i18n.t('message_saved')}</Text>
        )}
      </Animated.View>
    </View>
  );
});

ReceivedBubble.displayName = 'ReceivedBubble';
