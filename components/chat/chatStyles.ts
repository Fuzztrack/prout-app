import { Platform, StyleSheet } from 'react-native';

const ANDROID_CHAT_BACKGROUND_HERO_SIZE = 520;

export const chatStyles = StyleSheet.create({
  receivedRow: {
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  sentRow: {
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  sentBubbleWrapper: {
    alignItems: 'flex-end',
    maxWidth: '84%',
    position: 'relative',
    paddingBottom: 12,
  },
  receivedBubbleWrapper: {
    alignItems: 'flex-start',
    position: 'relative',
    maxWidth: '88%',
    paddingBottom: 12,
  },
  receivedBubble: {
    maxWidth: '88%',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  receivedBubbleWithIcon: {
    paddingLeft: 34,
  },
  receivedPlayIcon: {
    position: 'absolute',
    left: 12,
    top: 11,
    opacity: 0.9,
  },
  receivedText: {
    color: '#333',
    fontSize: 18,
  },
  receivedBubbleActive: {
    backgroundColor: '#A2E4D4',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  sentBubble: {
    backgroundColor: '#e3f2fd',
    borderRadius: 16,
    borderTopRightRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sentBubbleRead: {
    opacity: 0.75,
  },
  receivedReactionBadge: {
    position: 'absolute',
    right: -6,
    bottom: -10,
    minWidth: 28,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#fff5ee',
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentReactionBadge: {
    position: 'absolute',
    left: -6,
    bottom: -10,
    minWidth: 28,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#fff5ee',
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionBadgeText: {
    fontSize: 15,
  },
  sentText: {
    color: '#333',
    fontSize: 18,
  },
  sentRead: {
    color: '#604a3e',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
    textAlign: 'right',
    alignSelf: 'flex-end',
  },
});
