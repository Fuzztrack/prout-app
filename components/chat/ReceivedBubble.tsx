import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { playSound } from '@/lib/audioService';
import i18n from '@/lib/i18n';
import { chatStyles as styles } from './chatStyles';

interface ReceivedBubbleProps {
  message: { id: string; text: string; soundKey?: string; createdAt?: string; senderId: string };
  onReplay: (soundKey?: string) => void;
  onLongPressReact: (messageId: string) => void;
  reaction?: string;
}

export const ReceivedBubble = React.memo(({
  message,
  onReplay,
  onLongPressReact,
  reaction,
}: ReceivedBubbleProps) => {
  const [isReplayActive, setIsReplayActive] = useState(false);
  const canReplaySound = !!message.soundKey && message.soundKey !== 'mute';

  return (
    <View style={styles.receivedBubbleWrapper}>
      <View style={{ position: 'relative' }}>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => {
            if (!canReplaySound) return;
            setIsReplayActive(true);
            playSound(message.soundKey, {
              onEnd: () => setIsReplayActive(false),
            });
            onReplay(message.soundKey);
          }}
          onLongPress={() => onLongPressReact(message.id)}
          style={[
            styles.receivedBubble,
            canReplaySound ? styles.receivedBubbleWithIcon : undefined,
            isReplayActive && styles.receivedBubbleActive,
          ]}
        >
          {canReplaySound ? (
            <Ionicons
              name="play"
              size={16}
              color="#604a3e"
              style={styles.receivedPlayIcon}
              accessibilityLabel={i18n.t('chat_replay_sound_hint')}
            />
          ) : null}
          <Text style={styles.receivedText}>{message.text}</Text>
        </TouchableOpacity>
        {reaction ? (
          <View style={styles.receivedReactionBadge}>
            <Text style={styles.reactionBadgeText}>{reaction}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});
