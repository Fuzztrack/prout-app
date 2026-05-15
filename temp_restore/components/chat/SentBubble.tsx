import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/lib/i18n';
import { type VisibleSentMessage } from '@/lib/chatStore';
import { chatStyles as styles } from './chatStyles';

interface SentBubbleProps {
  message: VisibleSentMessage;
  onLongPressReact: (messageId: string) => void;
  onLongPressEdit?: (message: VisibleSentMessage) => void;
  reaction?: string;
}

export const SentBubble = React.memo(({
  message,
  onLongPressReact,
  onLongPressEdit,
  reaction,
}: SentBubbleProps) => {
  const handleLongPress = () => {
    if (message.status !== 'read' && onLongPressEdit) {
      onLongPressEdit(message);
    } else {
      onLongPressReact(message.id);
    }
  };

  return (
    <View style={styles.sentBubbleWrapper}>
      <View style={{ position: 'relative' }}>
        <TouchableOpacity activeOpacity={0.92} onLongPress={handleLongPress}>
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
