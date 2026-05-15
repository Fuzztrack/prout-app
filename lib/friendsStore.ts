import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Friend } from '../hooks/useFriends';

interface FriendsState {
  friends: Friend[];
  setFriends: (friends: Friend[]) => void;
}

export const useFriendsStore = create<FriendsState>()(
  persist(
    (set) => ({
      friends: [],
      setFriends: (friends) => set({ friends }),
    }),
    {
      name: 'friends-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
