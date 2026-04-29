import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated as RNAnimated, Platform } from 'react-native';
import i18n from '@/lib/i18n';
import { playSound } from '@/lib/audioService';

// Types partagés
export type ReportableMessage = {
  senderId: string;
  sourceMessageId?: string | null;
  createdAt?: string;
};

export type ParsedMessage = {
  text: string;
  isRead: boolean;
  soundKey?: string;
};

// Fonctions de parsing extraites
export const parseMessageContent = (raw?: string | null): ParsedMessage => {
  if (!raw) return { text: '', isRead: false };
  let isRead = false;
  let text = raw;
  if (text.startsWith('READ:')) {
    isRead = true;
    text = text.slice(5);
  }
  let soundKey: string | undefined;
  if (text.startsWith('[')) {
    const endBracket = text.indexOf(']');
    if (endBracket !== -1) {
      soundKey = text.slice(1, endBracket);
      text = text.slice(endBracket + 1);
    }
  }
  return { text, isRead, soundKey };
};

export const stripReadPrefix = (text?: string | null) => {
  return parseMessageContent(text).text;
};

const DIMMED_OPACITY_READ = 0.72;

/**
 * Composant pour les messages envoyés (Status Lu/En cours)
 */
export const SentMessageStatus = ({ message }: { 
  message: { text: string; status?: 'read'; id?: string } | undefined;
}) => {
  const [displayedMessage, setDisplayedMessage] = useState(message);
  const opacity = useRef(new RNAnimated.Value(message?.status === 'read' ? DIMMED_OPACITY_READ : 1)).current;
  const [isRead, setIsRead] = useState(message?.status === 'read');

  useEffect(() => {
    if (message && message.status !== 'read') {
      setDisplayedMessage(message);
      setIsRead(false);
      opacity.setValue(1);
    } else if (displayedMessage && (message?.status === 'read' || !message)) {
      if (!isRead) {
          setIsRead(true);
          // PRRT! : grisé léger quand lu (reste lisible)
          RNAnimated.timing(opacity, {
            toValue: DIMMED_OPACITY_READ,
            duration: 300,
            useNativeDriver: true,
          }).start();
      }
    }
  }, [message?.status, message?.id, isRead, displayedMessage, opacity]);

  if (!displayedMessage) return null;

  return (
    <RNAnimated.View style={[styles.bubbleSentWrapper, { opacity }]}>
      <View style={styles.bubbleSent}>
        <Text style={styles.bubbleTextSent}>{displayedMessage.text}</Text>
      </View>
      {isRead && (
        <Text style={styles.messageReadText}>
          {i18n.t('message_read')}
        </Text>
      )}
    </RNAnimated.View>
  );
};

/**
 * Composant pour les messages reçus (Fade out et Replay)
 */
export const ReceivedMessageFade = ({ 
  message, 
  soundKey, 
  dimmed, 
  shouldFadeOut, 
  onFadeComplete, 
  onLongPressReport,
  playLocalSound // On passe la fonction filtrée par le hook
}: {
  message: { id: string; text: string; senderId?: string; sourceMessageId?: string | null; createdAt?: string };
  soundKey?: string;
  dimmed?: boolean;
  shouldFadeOut: boolean;
  onFadeComplete: () => void;
  onLongPressReport?: (message: ReportableMessage) => void;
  playLocalSound?: (key: string, options?: any) => void;
}) => {
  const opacity = useRef(new RNAnimated.Value(dimmed ? 0.3 : 1)).current;
  const [isReplayActive, setIsReplayActive] = useState(false);

  useEffect(() => {
    if (shouldFadeOut) {
      RNAnimated.sequence([
        RNAnimated.delay(500),
        RNAnimated.timing(opacity, {
          // Session gelée: ne jamais disparaître complètement
          toValue: 0.3,
          duration: 500,
          useNativeDriver: true,
        })
      ]).start(() => {
        onFadeComplete();
      });
    } else {
      opacity.setValue(dimmed ? 0.3 : 1);
    }
  }, [shouldFadeOut, dimmed, opacity]);

  const handleReplay = () => {
    if (!soundKey || isReplayActive) return;
    const playFunc = playLocalSound || playSound;
    playFunc(soundKey, {
      onStart: () => setIsReplayActive(true),
      onEnd: () => setIsReplayActive(false),
    });
  };

  return (
    <RNAnimated.View style={[styles.bubbleReceivedWrapper, { opacity }]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleReplay}
        onLongPress={() => {
          if (!onLongPressReport || !message.senderId) return;
          onLongPressReport({
            senderId: message.senderId,
            sourceMessageId: message.sourceMessageId ?? null,
            createdAt: message.createdAt,
          });
        }}
      >
        <View style={[styles.bubbleReceived, isReplayActive && styles.bubbleReceivedPlaying]}>
          <Text style={styles.bubbleTextReceived}>{stripReadPrefix(message.text)}</Text>
        </View>
      </TouchableOpacity>
    </RNAnimated.View>
  );
};

const styles = StyleSheet.create({
  bubbleSentWrapper: {
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  bubbleSent: {
    alignSelf: 'flex-end',
    backgroundColor: '#e3f2fd',
    borderRadius: 16,
    borderTopRightRadius: 4,
    padding: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    position: 'relative',
  },
  bubbleTextSent: {
    color: '#333',
    fontSize: 18,
  },
  messageReadText: {
    fontSize: 12,
    color: '#604a3e',
    marginRight: 12,
    marginBottom: 4,
    fontStyle: 'italic',
    opacity: 0.9,
    textAlign: 'right',
  },
  bubbleReceivedWrapper: {
    alignSelf: 'flex-start',
    width: '100%',
    maxWidth: '100%',
  },
  bubbleReceived: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    position: 'relative',
  },
  bubbleReceivedPlaying: {
    backgroundColor: '#A2E4D4',
    borderColor: '#1a1a1a',
  },
  bubbleTextReceived: {
    color: '#333',
    fontSize: 18,
    flexShrink: 1,
  },
});
