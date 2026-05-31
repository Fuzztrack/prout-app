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

  // Hydratation
  hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;

  // Actions
  addReceivedMessages: (friendId: string, messages: PendingMessage[]) => void;
  addSentMessages: (friendId: string, messages: VisibleSentMessage[], isFullSync?: boolean) => void;
  setReactions: (friendId: string, reactions: Record<string, any[]>) => void;
  setRetentionHours: (friendId: string, hours: number) => void;
  toggleSavedMessage: (messageId: string) => void;
  clearHistory: (friendId: string) => void;
  cleanupExpired: () => void;
}

const MS_PER_HOUR = 3600000;
const DEFAULT_RETENTION = 24;

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      receivedByFriend: {},
      sentByFriend: {},
      messageReactionsByFriend: {},
      retentionByFriend: {},
      savedMessageIds: {},
      hasHydrated: false,

      setHasHydrated: (val) => set({ hasHydrated: val }),

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
          const { receivedByFriend, retentionByFriend } = state;
          // IMPORTANT : On ne bloque plus l'insertion si retentionHours === 0.
          // Sinon l'injection de notifications (Cold Start) et les mises à jour optimistes (READ:) échouent silencieusement.
          // La purge est gérée par cleanupExpired et par la fermeture du chat.

          const current = receivedByFriend[friendId] || [];
          const currentMap = new Map(current.map((m) => [m.id, m]));

          let changed = false;
          newMsgs.forEach((m) => {
            const existing = currentMap.get(m.id);
            if (!existing) {
              currentMap.set(m.id, { ...m, local_ts: m.local_ts || Date.now() });
              changed = true;
            } else {
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
          const { sentByFriend } = state;
          const current = sentByFriend[friendId] || [];
          const currentMap = new Map(current.map((m) => [m.id, m]));

          let changed = false;

          newMsgs.forEach((m) => {
            const existing = currentMap.get(m.id);
            if (!existing) {
              currentMap.set(m.id, { ...m, local_ts: m.local_ts || Date.now() });
              changed = true;
            } else {
              // On ne met à jour que si le statut change (ex: passage à 'read') ou le texte change.
              const statusChanged = m.status !== existing.status;
              const textChanged = m.text !== undefined && m.text !== existing.text;

              if (statusChanged || textChanged) {
                currentMap.set(m.id, { ...existing, ...m, local_ts: existing.local_ts });
                changed = true;
              }
            }
          });

          // 2. Fallback "Disparu du serveur = Lu"
          // Si on fait un sync complet (ex: via refreshMessages), tout message UUID qui n'est plus dans newMsgs
          // est considéré comme lu par le serveur (et donc par le destinataire).
          if (isFullSync) {
             const incomingIds = new Set(newMsgs.map(m => m.id));
             current.forEach(existing => {
               // On ne touche pas aux messages optimistes (pas encore sur le serveur)
               // On ne touche pas aux messages déjà marqués comme lus
               if (!existing.id.startsWith('local-') && !incomingIds.has(existing.id) && existing.status !== 'read') {
                 currentMap.set(existing.id, { ...existing, status: 'read', readAt: Date.now() });
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
            if (hours === 0) return false;
            
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
            if (hours === 0) return false;

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
