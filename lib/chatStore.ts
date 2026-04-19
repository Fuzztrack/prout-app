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

  // Actions
  addReceivedMessages: (friendId: string, messages: PendingMessage[]) => void;
  addSentMessages: (friendId: string, messages: VisibleSentMessage[]) => void;
  setReactions: (friendId: string, reactions: Record<string, any[]>) => void;
  setRetentionHours: (friendId: string, hours: number) => void;
  clearHistory: (friendId: string) => void;
  cleanupExpired: () => void;
}

const MS_PER_HOUR = 3600000;
const DEFAULT_RETENTION = 12;

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      receivedByFriend: {},
      sentByFriend: {},
      messageReactionsByFriend: {},
      retentionByFriend: {},

      addReceivedMessages: (friendId, newMsgs) => {
        const { receivedByFriend, retentionByFriend } = get();
        const retentionHours = retentionByFriend[friendId] ?? DEFAULT_RETENTION;
        if (retentionHours === 0) return;

        const current = receivedByFriend[friendId] || [];
        const currentMap = new Map(current.map(m => [m.id, m]));
        
        let changed = false;
        newMsgs.forEach(m => {
          const existing = currentMap.get(m.id);
          if (!existing) {
            // Nouveau message : on garde le local_ts s'il existe déjà (cas rare) ou on en crée un
            currentMap.set(m.id, { ...m, local_ts: m.local_ts || Date.now() });
            changed = true;
          } else {
            // Message existant : on met à jour le contenu MAIS on préserve absolument le local_ts d'origine
            if (m.message_content !== existing.message_content) {
              currentMap.set(m.id, { ...existing, ...m, local_ts: existing.local_ts });
              changed = true;
            }
          }
        });

        if (!changed) return;

        set({
          receivedByFriend: {
            ...receivedByFriend,
            [friendId]: Array.from(currentMap.values()).sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            ),
          },
        });
      },

      addSentMessages: (friendId, newMsgs) => {
        const { sentByFriend, retentionByFriend } = get();
        const retentionHours = retentionByFriend[friendId] ?? DEFAULT_RETENTION;
        if (retentionHours === 0) return;

        const current = sentByFriend[friendId] || [];
        const currentMap = new Map(current.map(m => [m.id, m]));
        
        let changed = false;
        newMsgs.forEach(m => {
          const existing = currentMap.get(m.id);
          if (!existing) {
            currentMap.set(m.id, { ...m, local_ts: m.local_ts || Date.now() });
            changed = true;
          } else {
            // Crucial : mettre à jour le statut (ex: 'read') OU le texte (édition) MAIS préserver local_ts
            if (
              m.status !== existing.status || 
              m.readAt !== existing.readAt || 
              (m.text !== undefined && m.text !== existing.text)
            ) {
              currentMap.set(m.id, { ...existing, ...m, local_ts: existing.local_ts });
              changed = true;
            }
          }
        });

        if (!changed) return;

        set({
          sentByFriend: {
            ...sentByFriend,
            [friendId]: Array.from(currentMap.values()).sort(
              (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
            ),
          },
        });
      },

      setReactions: (friendId, reactions) => {
        const { messageReactionsByFriend } = get();
        set({
          messageReactionsByFriend: {
            ...messageReactionsByFriend,
            [friendId]: reactions,
          },
        });
      },

      setRetentionHours: (friendId, hours) => {
        const { retentionByFriend } = get();
        set({ 
          retentionByFriend: {
            ...retentionByFriend,
            [friendId]: hours
          }
        });
      },

      clearHistory: (friendId) => {
        const { receivedByFriend, sentByFriend, messageReactionsByFriend } = get();
        const newReceived = { ...receivedByFriend };
        const newSent = { ...sentByFriend };
        const newReactions = { ...messageReactionsByFriend };
        delete newReceived[friendId];
        delete newSent[friendId];
        delete newReactions[friendId];
        set({ receivedByFriend: newReceived, sentByFriend: newSent, messageReactionsByFriend: newReactions });
      },

      cleanupExpired: () => {
        const { receivedByFriend, sentByFriend, messageReactionsByFriend, retentionByFriend } = get();
        
        const now = Date.now();
        const newReceived: Record<string, PendingMessage[]> = {};
        const newSent: Record<string, VisibleSentMessage[]> = {};
        const newReactions: Record<string, Record<string, any[]>> = {};

        // 1. Nettoyage des messages reçus
        Object.keys(receivedByFriend).forEach(fid => {
          const hours = retentionByFriend[fid] ?? DEFAULT_RETENTION;
          if (hours === 0) return; 

          const threshold = now - (hours * MS_PER_HOUR);
          const filtered = receivedByFriend[fid].filter(m => {
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
          if (hours === 0) return;

          const threshold = now - (hours * MS_PER_HOUR);
          const filtered = sentByFriend[fid].filter(m => {
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
    }
  )
);
