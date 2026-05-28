import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Friend } from '../hooks/useFriends';

interface FriendsState {
  friends: Friend[];
  setFriends: (friends: Friend[]) => void;
  updateFriendInteraction: (friendId: string, timestamp: string) => void;
}

export const useFriendsStore = create<FriendsState>()(
  persist(
    (set) => ({
      friends: [],
      setFriends: (friends) => set({ friends }),
      updateFriendInteraction: (friendId, timestamp) => set((state) => {
        const updated = state.friends.map(f => 
          f.id === friendId ? { ...f, last_interaction_at: timestamp } : f
        );
        const sorted = [...updated].sort((a, b) => {
          const timeA = a.last_interaction_at ? new Date(a.last_interaction_at).getTime() : 0;
          const timeB = b.last_interaction_at ? new Date(b.last_interaction_at).getTime() : 0;
          if (timeA !== timeB) return timeB - timeA;
          return (a.pseudo || '').localeCompare(b.pseudo || '');
        });
        return { friends: sorted };
      }),
    }),
    {
      name: 'friends-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
