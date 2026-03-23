import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppState {
  // Profil Utilisateur
  userId: string | null;
  pseudo: string;
  avatarUrl: string | null;
  setProfile: (profile: { userId?: string | null; pseudo?: string; avatarUrl?: string | null }) => void;

  // Réglages App
  isZenMode: boolean;
  isSilentMode: boolean;
  isHapticEnabled: boolean;
  setZenMode: (enabled: boolean) => void;
  setSilentMode: (enabled: boolean) => void;
  setHapticEnabled: (enabled: boolean) => void;

  // Navigation / UI
  activeView: 'list' | 'tutorial' | 'profile' | 'profileMenu';
  setActiveView: (view: 'list' | 'tutorial' | 'profile' | 'profileMenu') => void;
}

const CACHE_PSEUDO_KEY = 'cached_current_pseudo';
const SILENT_MODE_KEY = 'silent_mode_enabled';
const HAPTIC_ENABLED_KEY = 'haptic_feedback_enabled';

export const useAppStore = create<AppState>((set) => ({
  // Valeurs initiales
  userId: null,
  pseudo: '',
  avatarUrl: null,
  isZenMode: false,
  isSilentMode: false,
  isHapticEnabled: true,
  activeView: 'list',

  // Actions
  setProfile: (profile) => set((state) => ({ ...state, ...profile })),

  setZenMode: (enabled) => set({ isZenMode: enabled }),

  setSilentMode: (enabled) => {
    AsyncStorage.setItem(SILENT_MODE_KEY, String(enabled));
    set({ isSilentMode: enabled });
  },

  setHapticEnabled: (enabled) => {
    AsyncStorage.setItem(HAPTIC_ENABLED_KEY, String(enabled));
    set({ isHapticEnabled: enabled });
  },

  setActiveView: (view) => set({ activeView: view }),
}));
