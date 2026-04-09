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
  
  // Rétention en heures (0 = immédiat, 12, 24)
  retentionHours: number;

  // Actions
  addReceivedMessages: (friendId: string, messages: PendingMessage[]) => void;
  addSentMessages: (friendId: string, messages: VisibleSentMessage[]) => void;
  setRetentionHours: (hours: number) => void;
  clearHistory: (friendId: string) => void;
  cleanupExpired: () => void;
}

const MS_PER_HOUR = 3600000;

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      receivedByFriend: {},
      sentByFriend: {},
      retentionHours: 12,

      addReceivedMessages: (friendId, newMsgs) => {
        const { receivedByFriend, retentionHours } = get();
        if (retentionHours === 0) return; // Mode immédiat, on ne stocke rien en persistant

        const current = receivedByFriend[friendId] || [];
        const existingIds = new Set(current.map(m => m.id));
        
        // On ne garde que les nouveaux et on ajoute le timestamp local
        const toAdd = newMsgs
          .filter(m => !existingIds.has(m.id))
          .map(m => ({ ...m, local_ts: m.local_ts || Date.now() }));

        if (toAdd.length === 0) return;

        set({
          receivedByFriend: {
            ...receivedByFriend,
            [friendId]: [...current, ...toAdd].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            ),
          },
        });
      },

      addSentMessages: (friendId, newMsgs) => {
        const { sentByFriend, retentionHours } = get();
        if (retentionHours === 0) return;

        const current = sentByFriend[friendId] || [];
        const existingIds = new Set(current.map(m => m.id));
        
        const toAdd = newMsgs
          .filter(m => !existingIds.has(m.id))
          .map(m => ({ ...m, local_ts: m.local_ts || Date.now() }));

        if (toAdd.length === 0) return;

        set({
          sentByFriend: {
            ...sentByFriend,
            [friendId]: [...current, ...toAdd].sort(
              (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
            ),
          },
        });
      },

      setRetentionHours: (hours) => {
        if (hours === 0) {
          // Si on passe en immédiat, on vide tout l'historique
          set({ retentionHours: 0, receivedByFriend: {}, sentByFriend: {} });
        } else {
          set({ retentionHours: hours });
        }
      },

      clearHistory: (friendId) => {
        const { receivedByFriend, sentByFriend } = get();
        const newReceived = { ...receivedByFriend };
        const newSent = { ...sentByFriend };
        delete newReceived[friendId];
        delete newSent[friendId];
        set({ receivedByFriend: newReceived, sentByFriend: newSent });
      },

      cleanupExpired: () => {
        const { receivedByFriend, sentByFriend, retentionHours } = get();
        if (retentionHours === 0) return;

        const now = Date.now();
        const threshold = now - (retentionHours * MS_PER_HOUR);

        const newReceived: Record<string, PendingMessage[]> = {};
        const newSent: Record<string, VisibleSentMessage[]> = {};

        Object.keys(receivedByFriend).forEach(fid => {
          const filtered = receivedByFriend[fid].filter(m => m.local_ts > threshold);
          if (filtered.length > 0) newReceived[fid] = filtered;
        });

        Object.keys(sentByFriend).forEach(fid => {
          const filtered = sentByFriend[fid].filter(m => m.local_ts > threshold);
          if (filtered.length > 0) newSent[fid] = filtered;
        });

        set({ receivedByFriend: newReceived, sentByFriend: newSent });
      },
    }),
    {
      name: 'prout-chat-history',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
