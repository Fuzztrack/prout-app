import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import i18n from '@/lib/i18n';
import { type VisibleSentMessage } from '@/lib/chatStore';
import { chatStyles as styles } from './chatStyles';

interface SentBubbleProps {
  message: VisibleSentMessage;
  onLongPressReact: (messageId: string) => void;
  reaction?: string;
}

export const SentBubble = React.memo(({
  message,
  onLongPressReact,
  reaction,
}: SentBubbleProps) => {
  return (
    <View style={styles.sentBubbleWrapper}>
      <View style={{ position: 'relative' }}>
        <TouchableOpacity activeOpacity={0.92} onLongPress={() => onLongPressReact(message.id)}>
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
      {message.status === 'read' ? <Text style={styles.sentRead}>{i18n.t('message_read')}</Text> : null}
    </View>
  );
});
