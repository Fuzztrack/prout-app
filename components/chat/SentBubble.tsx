import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import i18n from '@/lib/i18n';
import { type VisibleSentMessage } from '@/lib/chatStore';
import { chatStyles as styles } from './chatStyles';

interface SentBubbleProps {
  message: VisibleSentMessage;
  onLongPressReact: (messageId: string) => void;
  onLongPressEdit?: (message: VisibleSentMessage) => void;
  reaction?: string;
  isSaved: boolean;
  onToggleSave: () => void;
}

export const SentBubble = React.memo(({
  message,
  onLongPressReact,
  onLongPressEdit,
  reaction,
  isSaved,
  onToggleSave,
}: SentBubbleProps) => {
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

  return (
    <View style={styles.sentBubbleWrapper}>
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, animatedStyle]}>
        {showLabel && (
          <Text style={[styles.savedLabel, styles.savedLabelSent]}>{i18n.t('message_saved')}</Text>
        )}

        <View style={{ position: 'relative' }}>
          <TouchableOpacity activeOpacity={0.92} onPress={handlePress} onLongPress={handleLongPress}>
            <View style={[styles.sentBubble, message.status === 'read' && styles.sentBubbleRead]}>
              <Text style={styles.sentText}>{message.text}</Text>
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
        <Ionicons 
          name="time-outline" 
          size={12} 
          color="#604a3e" 
          style={[styles.optimisticIcon, { opacity: message.optimistic ? 0.6 : 0 }]} 
        />
        <Text style={[styles.sentRead, { opacity: message.status === 'read' ? 1 : 0 }]}>
          {i18n.t('message_read')}
        </Text>
      </View>
    </View>
  );
});

SentBubble.displayName = 'SentBubble';
