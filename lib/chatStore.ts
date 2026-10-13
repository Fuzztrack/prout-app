import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PendingMessage = {
  id: string;
  from_user_id: string;
  to_user_id?: string;
  message_content?: string | null;
  created_at: string;
  local_ts: number; // Date de réception locale pour l'expiration
};

export type VisibleSentMessage = {
  id: string;
  text: string;
  ts: string;
  soundKey?: string;
  imageUrl?: string;
  isViewOnce?: boolean;
  isImageExpired?: boolean;
  status?: 'read';
  readAt?: number;
  optimistic?: boolean;
  local_ts: number; // Date d'envoi locale pour l'expiration
};

interface ChatState {
  // Messages indexés par friendId
  receivedByFriend: Record<string, PendingMessage[]>;
  sentByFriend: Record<string, VisibleSentMessage[]>;
  
  // Réactions indexées par friendId puis messageId
  messageReactionsByFriend: Record<string, Record<string, any[]>>;

  // Rétention par ami (id_ami -> heures, 0 = immédiat, 12, etc.)
  retentionByFriend: Record<string, number>;

  // Messages sauvegardés (messageId -> boolean)
  savedMessageIds: Record<string, boolean>;

  // Pour gérer les race conditions où le broadcast de lecture arrive avant la confirmation du serveur
  pendingReadReceipts: Record<string, number>;

  // Photos expirées (messageId -> true, photoUrl -> true)
  expiredPhotoMessageIds: Record<string, boolean>;
  expiredPhotoUrls: Record<string, boolean>;
  markPhotoAsExpired: (messageId: string, url?: string) => void;

  // Hydratation
  hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;

  // Actions
  markMessagesAsRead: (friendId: string, messageIds: string[]) => void;
  addReceivedMessages: (friendId: string, messages: PendingMessage[]) => void;
  addSentMessages: (friendId: string, messages: VisibleSentMessage[], isFullSync?: boolean) => void;
  setReactions: (friendId: string, reactions: Record<string, any[]>) => void;
  setRetentionHours: (friendId: string, hours: number) => void;
  toggleSavedMessage: (messageId: string) => void;
  clearHistory: (friendId: string) => void;
  expireEphemeralPhotos: (friendId: string, onlyViewOnce?: boolean) => void;
  cleanupExpired: () => void;
}

const MS_PER_HOUR = 3600000;
const DEFAULT_RETENTION = 24;

export const isPhotoExpired = (messageId?: string, imageUrl?: string): boolean => {
  if (!messageId && !imageUrl) return false;
  const state = useChatStore.getState();
  if (messageId && state.expiredPhotoMessageIds?.[messageId]) return true;
  if (imageUrl && state.expiredPhotoUrls?.[imageUrl]) return true;
  return false;
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      receivedByFriend: {},
      sentByFriend: {},
      messageReactionsByFriend: {},
      retentionByFriend: {},
      savedMessageIds: {},
      pendingReadReceipts: {},
      expiredPhotoMessageIds: {},
      expiredPhotoUrls: {},
      hasHydrated: false,

      setHasHydrated: (val) => set({ hasHydrated: val }),

      markPhotoAsExpired: (messageId: string, url?: string) => {
        set((state) => {
          const nextIds = { ...(state.expiredPhotoMessageIds || {}) };
          if (messageId) nextIds[messageId] = true;
          const nextUrls = { ...(state.expiredPhotoUrls || {}) };
          if (url) nextUrls[url] = true;

          const nextSentByFriend = { ...state.sentByFriend };
          let changedSent = false;
          Object.keys(nextSentByFriend).forEach((fId) => {
            const list = nextSentByFriend[fId];
            if (list) {
              const updated = list.map((m) => {
                if (m.id === messageId || (url && (m.imageUrl === url || m.text?.includes(url)))) {
                  changedSent = true;
                  const cleanText = (m.text || '').replace(/\[(IMG|IMG_ONCE):[^\]]+\]/, '').trim();
                  return {
                    ...m,
                    imageUrl: undefined,
                    isImageExpired: true,
                    text: cleanText,
                  };
                }
                return m;
              });
              if (changedSent) nextSentByFriend[fId] = updated;
            }
          });

          const nextReceivedByFriend = { ...state.receivedByFriend };
          let changedRecv = false;
          Object.keys(nextReceivedByFriend).forEach((fId) => {
            const list = nextReceivedByFriend[fId];
            if (list) {
              const updated = list.map((m) => {
                if (m.id === messageId || (url && m.message_content?.includes(url))) {
                  changedRecv = true;
                  let content = m.message_content || '';
                  let readPrefix = content.startsWith('READ:') ? 'READ:' : '';
                  if (content.startsWith('READ:')) content = content.slice(5);
                  let soundPrefix = '';
                  if (content.startsWith('[')) {
                    const endBracket = content.indexOf(']');
                    if (endBracket !== -1) {
                      const tag = content.slice(1, endBracket);
                      if (!tag.startsWith('IMG:') && !tag.startsWith('IMG_ONCE:') && tag !== 'EXPIRED_IMG') {
                        soundPrefix = `[${tag}]`;
                        content = content.slice(endBracket + 1);
                      }
                    }
                  }
                  const cleanText = content.replace(/\[(IMG|IMG_ONCE):[^\]]+\]/, '').replace(/\[EXPIRED_IMG\]/, '').trim();
                  return {
                    ...m,
                    message_content: `${readPrefix}${soundPrefix}[EXPIRED_IMG]${cleanText}`,
                  };
                }
                return m;
              });
              if (changedRecv) nextReceivedByFriend[fId] = updated;
            }
          });

          return {
            expiredPhotoMessageIds: nextIds,
            expiredPhotoUrls: nextUrls,
            ...(changedSent ? { sentByFriend: nextSentByFriend } : {}),
            ...(changedRecv ? { receivedByFriend: nextReceivedByFriend } : {}),
          };
        });
      },

      markMessagesAsRead: (friendId, messageIds) => {
        set((state) => {
          const now = Date.now();
          const nextReceipts = { ...state.pendingReadReceipts };
          messageIds.forEach(id => {
            nextReceipts[id] = now;
          });

          const currentSent = state.sentByFriend[friendId] || [];
          let changed = false;
          
          const nextSent = currentSent.map(m => {
            if (messageIds.includes(m.id) && m.status !== 'read') {
              changed = true;
              return { ...m, status: 'read' as const, readAt: now };
            }
            return m;
          });

          if (!changed) {
            return { pendingReadReceipts: nextReceipts };
          }

          return {
            pendingReadReceipts: nextReceipts,
            sentByFriend: {
              ...state.sentByFriend,
              [friendId]: nextSent,
            }
          };
        });
      },

      toggleSavedMessage: (messageId) => {
        set((state) => {
          const next = { ...state.savedMessageIds };
          if (next[messageId]) {
            delete next[messageId];
          } else {
            next[messageId] = true;
          }
          return { savedMessageIds: next };
        });
      },

      addReceivedMessages: (friendId, newMsgs) => {
        set((state) => {
          const { receivedByFriend, retentionByFriend, expiredPhotoUrls, expiredPhotoMessageIds } = state;
          // IMPORTANT : On ne bloque plus l'insertion si retentionHours === 0.
          // Sinon l'injection de notifications (Cold Start) et les mises à jour optimistes (READ:) échouent silencieusement.
          // La purge est gérée par cleanupExpired et par la fermeture du chat.

          const current = receivedByFriend[friendId] || [];
          const currentMap = new Map(current.map((m) => [m.id, m]));

          let changed = false;
          newMsgs.forEach((rawMsg) => {
            let m = rawMsg;
            let content = m.message_content || '';
            const imgMatch = content.match(/\[(IMG|IMG_ONCE):(https:\/\/[^\]]+)\]/);
            const url = imgMatch ? imgMatch[2] : undefined;
            const isExpired = (!!url && !!expiredPhotoUrls?.[url]) || !!expiredPhotoMessageIds?.[m.id];
            if (isExpired && (!!url || content.includes('[IMG:') || content.includes('[IMG_ONCE:'))) {
              let readPrefix = content.startsWith('READ:') ? 'READ:' : '';
              if (content.startsWith('READ:')) content = content.slice(5);
              let soundPrefix = '';
              if (content.startsWith('[')) {
                const endBracket = content.indexOf(']');
                if (endBracket !== -1) {
                  const tag = content.slice(1, endBracket);
                  if (!tag.startsWith('IMG:') && !tag.startsWith('IMG_ONCE:') && tag !== 'EXPIRED_IMG') {
                    soundPrefix = `[${tag}]`;
                    content = content.slice(endBracket + 1);
                  }
                }
              }
              const cleanText = content.replace(/\[(IMG|IMG_ONCE):[^\]]+\]/, '').replace(/\[EXPIRED_IMG\]/, '').trim();
              m = {
                ...m,
                message_content: `${readPrefix}${soundPrefix}[EXPIRED_IMG]${cleanText}`,
              };
            }

            const existing = currentMap.get(m.id);
            if (!existing) {
              currentMap.set(m.id, { ...m, local_ts: m.local_ts || Date.now() });
              changed = true;
            } else {
              const existingIsExpired = existing.message_content?.includes('[EXPIRED_IMG]') ?? false;
              if (existingIsExpired && !m.message_content?.includes('[EXPIRED_IMG]')) {
                // Ne JAMAIS remplacer un message expiré par une version contenant une photo active
                return;
              }
              // Si le message existant est marqué comme "READ:" localement, on ne l'écrase pas avec une version non-lue du serveur
              const existingIsRead = existing.message_content?.startsWith('READ:') ?? false;
              const newIsRead = m.message_content?.startsWith('READ:') ?? false;
              
              if (m.message_content !== existing.message_content) {
                // On écrase seulement si on ne remplace pas un "READ:..." par sa version originale non-lue
                if (!(existingIsRead && !newIsRead)) {
                  currentMap.set(m.id, { ...existing, ...m, local_ts: existing.local_ts });
                  changed = true;
                }
              }
            }
          });

          if (!changed) return state;

          return {
            receivedByFriend: {
              ...receivedByFriend,
              [friendId]: Array.from(currentMap.values()).sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              ),
            },
          };
        });
      },

      addSentMessages: (friendId, newMsgs, isFullSync = false) => {
        set((state) => {
          const { sentByFriend, expiredPhotoUrls, expiredPhotoMessageIds } = state;
          const current = sentByFriend[friendId] || [];
          const currentMap = new Map(current.map((m) => [m.id, m]));

          let changed = false;

          newMsgs.forEach((rawMsg) => {
            const isExpired = !!rawMsg.isImageExpired || (!!rawMsg.imageUrl && !!expiredPhotoUrls?.[rawMsg.imageUrl]) || !!expiredPhotoMessageIds?.[rawMsg.id];
            const m = isExpired ? { ...rawMsg, imageUrl: undefined, isImageExpired: true } : rawMsg;

            const existing = currentMap.get(m.id);
            if (!existing) {
              const isPendingRead = !!state.pendingReadReceipts[m.id];
              currentMap.set(m.id, { 
                ...m, 
                status: isPendingRead ? 'read' : m.status,
                readAt: isPendingRead ? state.pendingReadReceipts[m.id] : m.readAt,
                local_ts: m.local_ts || Date.now() 
              });
              changed = true;
            } else {
              const existingIsExpired = !!existing.isImageExpired;
              const finalImageExpired = existingIsExpired || isExpired;
              const finalImageUrl = finalImageExpired ? undefined : (m.imageUrl ?? existing.imageUrl);
              const finalIsViewOnce = m.isViewOnce ?? existing.isViewOnce;

              // Preserve 'read' status if the server sends an unread status (stale data during sync)
              // AND force 'read' if it's in our pendingReadReceipts (race condition fix)
              const isPendingRead = !!state.pendingReadReceipts[m.id];
              const finalStatus = (existing.status === 'read' || isPendingRead) ? 'read' : m.status;
              const finalReadAt = (existing.status === 'read') 
                ? (existing.readAt || m.readAt) 
                : (isPendingRead ? state.pendingReadReceipts[m.id] : m.readAt);

              const statusChanged = finalStatus !== existing.status;
              const textChanged = m.text !== undefined && m.text !== existing.text;
              const imageChanged = existing.imageUrl !== finalImageUrl || existing.isImageExpired !== finalImageExpired;

              if (statusChanged || textChanged || imageChanged) {
                currentMap.set(m.id, { 
                  ...existing, 
                  ...m, 
                  imageUrl: finalImageUrl,
                  isViewOnce: finalIsViewOnce,
                  isImageExpired: finalImageExpired,
                  status: finalStatus,
                  readAt: finalReadAt,
                  local_ts: existing.local_ts 
                });
                changed = true;
              }
            }
          });

          // 2. Fallback "Disparu du serveur = Lu"
          // Si on fait un sync complet (ex: via refreshMessages), tout message UUID qui n'est plus dans newMsgs
          // est considéré comme lu par le serveur (et donc par le destinataire).
          if (isFullSync) {
             const retentionHours = state.retentionByFriend[friendId] ?? DEFAULT_RETENTION;
             const incomingIds = new Set(newMsgs.map(m => m.id));
             current.forEach(existing => {
               // On ne touche pas aux messages optimistes (pas encore sur le serveur)
               // On ne touche pas aux messages déjà marqués comme lus
               if (!existing.id.startsWith('local-') && !incomingIds.has(existing.id) && existing.status !== 'read') {
                 if (retentionHours === 0 && !state.savedMessageIds[existing.id]) {
                   currentMap.delete(existing.id);
                 } else {
                   currentMap.set(existing.id, { ...existing, status: 'read', readAt: Date.now() });
                 }
                 changed = true;
               }
             });
          }

          if (!changed) return state;

          return {
            sentByFriend: {
              ...sentByFriend,
              [friendId]: Array.from(currentMap.values()).sort(
                (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
              ),
            },
          };
        });
      },

      setReactions: (friendId, reactions) => {
        set((state) => {
          const { messageReactionsByFriend } = state;
          return {
            messageReactionsByFriend: {
              ...messageReactionsByFriend,
              [friendId]: reactions,
            },
          };
        });
      },

      setRetentionHours: (friendId, hours) => {
        set((state) => {
          const { retentionByFriend } = state;
          return {
            retentionByFriend: {
              ...retentionByFriend,
              [friendId]: hours,
            },
          };
        });
      },

      clearHistory: (friendId) => {
        set((state) => {
          const { receivedByFriend, sentByFriend, messageReactionsByFriend, savedMessageIds } = state;
          
          const newReceived = { ...receivedByFriend };
          const newSent = { ...sentByFriend };
          const newReactions = { ...messageReactionsByFriend };

          const savedReceived = (receivedByFriend[friendId] || []).filter(m => savedMessageIds[m.id]);
          const savedSent = (sentByFriend[friendId] || []).filter(m => savedMessageIds[m.id]);

          if (savedReceived.length > 0) {
            newReceived[friendId] = savedReceived;
          } else {
            delete newReceived[friendId];
          }

          if (savedSent.length > 0) {
            newSent[friendId] = savedSent;
          } else {
            delete newSent[friendId];
          }

          // Preserve reactions only for saved messages
          if (newReactions[friendId]) {
            const keptReactions: Record<string, any[]> = {};
            const validIds = new Set([...savedReceived.map(m => m.id), ...savedSent.map(m => m.id)]);
            Object.keys(newReactions[friendId]).forEach(msgId => {
              if (validIds.has(msgId)) {
                keptReactions[msgId] = newReactions[friendId][msgId];
              }
            });
            if (Object.keys(keptReactions).length > 0) {
              newReactions[friendId] = keptReactions;
            } else {
              delete newReactions[friendId];
            }
          }

          return {
            receivedByFriend: newReceived,
            sentByFriend: newSent,
            messageReactionsByFriend: newReactions,
          };
        });
      },

      expireEphemeralPhotos: (friendId: string, onlyViewOnce: boolean = false) => {
        set((state) => {
          const { sentByFriend, receivedByFriend, expiredPhotoMessageIds, expiredPhotoUrls } = state;
          const currentSent = sentByFriend[friendId] || [];
          const currentReceived = receivedByFriend[friendId] || [];
          const nextExpiredIds = { ...(expiredPhotoMessageIds || {}) };
          const nextExpiredUrls = { ...(expiredPhotoUrls || {}) };

          let changed = false;

          const nextSent: VisibleSentMessage[] = [];
          for (const m of currentSent) {
            const imgMatch = m.text?.match(/\[(IMG|IMG_ONCE):(https:\/\/[^\]]+)\]/);
            const foundUrl = m.imageUrl || (imgMatch ? imgMatch[2] : undefined);
            const isViewOnceMsg = !!m.isViewOnce || (!!m.text && m.text.includes('[IMG_ONCE:'));
            const hasImg = !!foundUrl || (m.text && (m.text.includes('[IMG:') || m.text.includes('[IMG_ONCE:')));
            const shouldExpire = hasImg && (!onlyViewOnce || isViewOnceMsg);

            if (shouldExpire) {
              changed = true;
              nextExpiredIds[m.id] = true;
              if (foundUrl) nextExpiredUrls[foundUrl] = true;
              const cleanText = (m.text || '').replace(/\[(IMG|IMG_ONCE):[^\]]+\]/, '').trim();
              nextSent.push({
                ...m,
                imageUrl: undefined,
                isImageExpired: true,
                isViewOnce: isViewOnceMsg,
                text: cleanText,
              });
            } else {
              nextSent.push(m);
            }
          }

          const nextReceived: PendingMessage[] = [];
          for (const m of currentReceived) {
            let content = m.message_content || '';
            const imgMatch = content.match(/\[(IMG|IMG_ONCE):(https:\/\/[^\]]+)\]/);
            const foundUrl = imgMatch ? imgMatch[2] : undefined;
            const isViewOnceMsg = content.includes('[IMG_ONCE:');
            const hasImg = !!foundUrl || content.includes('[IMG:') || content.includes('[IMG_ONCE:');
            const shouldExpire = hasImg && (!onlyViewOnce || isViewOnceMsg);

            if (shouldExpire) {
              changed = true;
              nextExpiredIds[m.id] = true;
              if (foundUrl) nextExpiredUrls[foundUrl] = true;
              let readPrefix = '';
              if (content.startsWith('READ:')) {
                readPrefix = 'READ:';
                content = content.slice(5);
              }
              let soundPrefix = '';
              if (content.startsWith('[')) {
                const endBracket = content.indexOf(']');
                if (endBracket !== -1) {
                  const tag = content.slice(1, endBracket);
                  if (!tag.startsWith('IMG:') && !tag.startsWith('IMG_ONCE:') && tag !== 'EXPIRED_IMG') {
                    soundPrefix = `[${tag}]`;
                    content = content.slice(endBracket + 1);
                  }
                }
              }
              const cleanText = content.replace(/\[(IMG|IMG_ONCE):[^\]]+\]/, '').trim();
              nextReceived.push({
                ...m,
                message_content: `${readPrefix}${soundPrefix}[EXPIRED_IMG]${cleanText}`,
              });
            } else {
              nextReceived.push(m);
            }
          }

          if (!changed && Object.keys(nextExpiredIds).length === Object.keys(expiredPhotoMessageIds || {}).length) {
            return state;
          }

          return {
            expiredPhotoMessageIds: nextExpiredIds,
            expiredPhotoUrls: nextExpiredUrls,
            sentByFriend: {
              ...sentByFriend,
              [friendId]: nextSent,
            },
            receivedByFriend: {
              ...receivedByFriend,
              [friendId]: nextReceived,
            },
          };
        });
      },

      cleanupExpired: () => {
        const { receivedByFriend, sentByFriend, messageReactionsByFriend, retentionByFriend, savedMessageIds } = get();
        
        const now = Date.now();
        const newReceived: Record<string, PendingMessage[]> = {};
        const newSent: Record<string, VisibleSentMessage[]> = {};
        const newReactions: Record<string, Record<string, any[]>> = {};

        // 1. Nettoyage des messages reçus
        Object.keys(receivedByFriend).forEach(fid => {
          const hours = retentionByFriend[fid] ?? DEFAULT_RETENTION;

          const threshold = hours > 0 ? now - (hours * MS_PER_HOUR) : now;
          const filtered = receivedByFriend[fid].filter(m => {
            if (savedMessageIds[m.id]) return true;
            if (hours === 0) return true; // Purge 0h est gérée à la fermeture du chat (clearHistory)
            
            // Source de vérité : created_at (serveur)
            // Fallback : local_ts ou temps actuel
            const serverTs = new Date(m.created_at).getTime();
            const ts = isNaN(serverTs) ? (m.local_ts || now) : serverTs;
            return ts > threshold;
          });
          if (filtered.length > 0) newReceived[fid] = filtered;
        });

        // 2. Nettoyage des messages envoyés
        Object.keys(sentByFriend).forEach(fid => {
          const hours = retentionByFriend[fid] ?? DEFAULT_RETENTION;

          const threshold = hours > 0 ? now - (hours * MS_PER_HOUR) : now;
          const filtered = sentByFriend[fid].filter(m => {
            if (savedMessageIds[m.id]) return true;
            if (hours === 0) return true; // Purge 0h est gérée à la fermeture du chat (clearHistory)

            const serverTs = new Date(m.ts).getTime();
            const ts = isNaN(serverTs) ? (m.local_ts || now) : serverTs;
            return ts > threshold;
          });
          if (filtered.length > 0) newSent[fid] = filtered;
        });

        // Pour les réactions, on garde celles qui correspondent à des messages encore présents
        Object.keys(messageReactionsByFriend).forEach(fid => {
          const currentReactions = messageReactionsByFriend[fid];
          const keptReactions: Record<string, any[]> = {};
          
          const validMessageIds = new Set([
            ...(newReceived[fid] || []).map(m => m.id),
            ...(newSent[fid] || []).map(m => m.id)
          ]);

          Object.keys(currentReactions).forEach(mid => {
            if (validMessageIds.has(mid)) {
              keptReactions[mid] = currentReactions[mid];
            }
          });

          if (Object.keys(keptReactions).length > 0) {
            newReactions[fid] = keptReactions;
          }
        });

        set({ receivedByFriend: newReceived, sentByFriend: newSent, messageReactionsByFriend: newReactions });
      },
    }),
    {
      name: 'prout-chat-history',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        // console.log(`⏱️ [PERF] ${Date.now()} - Zustand ChatStore Hydratation terminée`);
      },
    }
  )
);
