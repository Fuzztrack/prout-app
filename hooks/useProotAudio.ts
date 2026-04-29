import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '@/lib/store';
import { 
  playSound, 
  stopCurrentPlayback, 
  pickRandom, 
  pickRandomWithoutImmediateRepeat, 
  getDefaultSoundCategoryForFirstLaunch,
  getSelectedSoundCategory,
  getDisplaySoundLabel
} from '@/lib/audioService';
import { 
  SOUND_ASSETS, 
  SOUND_KEYS_BY_CATEGORY,
  PICKUP_TOOT_KEYS
} from '@/lib/runtimeSounds';
import type { SoundCategory } from '@/components/SoundcheckSelector';

const CHAT_MESSAGE_SOUND_CHOICE_KEY = 'chat_message_sound_choice_v1';
const FRIEND_SOUND_CATEGORY_MAP_KEY = 'friend_sound_category_map_v1';

export type ChatMessageSoundChoice = 'trll' | 'bzzz' | 'pop' | 'mood' | 'toot';

export function useProotAudio() {
  const { isSilentMode } = useAppStore();
  
  // States
  const [chatMessageSoundChoice, setChatMessageSoundChoice] = useState<ChatMessageSoundChoice>(
    getDefaultSoundCategoryForFirstLaunch() as ChatMessageSoundChoice
  );
  const [isChatMuteEnabled, setIsChatMuteEnabled] = useState(false);
  const [friendSoundCategoryByFriend, setFriendSoundCategoryByFriend] = useState<Record<string, SoundCategory>>({});
  const [friendSoundKeyByFriend, setFriendSoundKeyByFriend] = useState<Record<string, string>>({});
  const [previewingFriendSoundKey, setPreviewingFriendSoundKey] = useState<string | null>(null);

  // Refs
  const lastRandomSoundByFriendRef = useRef<Record<string, string>>({});

  // Load preferences
  useEffect(() => {
    const loadAudioPrefs = async () => {
      try {
        const [savedChatChoice, savedFriendCategories] = await Promise.all([
          AsyncStorage.getItem(CHAT_MESSAGE_SOUND_CHOICE_KEY),
          AsyncStorage.getItem(FRIEND_SOUND_CATEGORY_MAP_KEY),
        ]);

        if (savedChatChoice) {
          setChatMessageSoundChoice(savedChatChoice as ChatMessageSoundChoice);
        }
        if (savedFriendCategories) {
          setFriendSoundCategoryByFriend(JSON.parse(savedFriendCategories));
        }
      } catch (e) {
        console.error('❌ [useProotAudio] Error loading prefs:', e);
      }
    };
    loadAudioPrefs();
  }, []);

  const playLocalSound = useCallback((soundKey: string, options?: any) => {
    if (!isSilentMode) {
      playSound(soundKey, options);
    }
  }, [isSilentMode]);

  const toggleChatMute = useCallback(() => {
    setIsChatMuteEnabled(prev => !prev);
  }, []);

  const updateChatMessageSoundChoice = useCallback(async (choice: ChatMessageSoundChoice) => {
    setChatMessageSoundChoice(choice);
    try {
      await AsyncStorage.setItem(CHAT_MESSAGE_SOUND_CHOICE_KEY, choice);
    } catch (e) {
      console.error('❌ [useProotAudio] Error saving chat choice:', e);
    }
  }, []);

  const setFriendSoundCategory = useCallback(async (friendId: string, category: SoundCategory) => {
    setFriendSoundCategoryByFriend(prev => {
      const next = { ...prev, [friendId]: category };
      AsyncStorage.setItem(FRIEND_SOUND_CATEGORY_MAP_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setFriendSpecificSoundKey = useCallback((friendId: string, soundKey: string | null) => {
    setFriendSoundKeyByFriend(prev => {
      if (soundKey === null) {
        const { [friendId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [friendId]: soundKey };
    });
  }, []);

  const getNextRandomSound = useCallback(async (friendId: string, category?: SoundCategory) => {
    const selectedCategory = category || friendSoundCategoryByFriend[friendId] || await getSelectedSoundCategory();
    const candidates = SOUND_KEYS_BY_CATEGORY[selectedCategory] || SOUND_KEYS_BY_CATEGORY.trll;
    const noRepeat = pickRandomWithoutImmediateRepeat(candidates, lastRandomSoundByFriendRef.current[friendId]);
    const soundKey = noRepeat || pickRandom(candidates);
    lastRandomSoundByFriendRef.current[friendId] = soundKey;
    return soundKey;
  }, [friendSoundCategoryByFriend]);

  const getChatRandomSound = useCallback((friendId: string) => {
    const candidates = SOUND_KEYS_BY_CATEGORY[chatMessageSoundChoice] || SOUND_KEYS_BY_CATEGORY.trll;
    const noRepeat = pickRandomWithoutImmediateRepeat(candidates, lastRandomSoundByFriendRef.current[friendId]);
    const soundKey = noRepeat || pickRandom(candidates);
    lastRandomSoundByFriendRef.current[friendId] = soundKey;
    return soundKey;
  }, [chatMessageSoundChoice]);

  return {
    // State
    chatMessageSoundChoice,
    isChatMuteEnabled,
    friendSoundCategoryByFriend,
    friendSoundKeyByFriend,
    previewingFriendSoundKey,
    
    // Actions
    setChatMessageSoundChoice: updateChatMessageSoundChoice,
    setIsChatMuteEnabled,
    toggleChatMute,
    setFriendSoundCategory,
    setFriendSpecificSoundKey,
    setPreviewingFriendSoundKey,
    playLocalSound,
    stopCurrentPlayback,
    getNextRandomSound,
    getChatRandomSound,
    
    // Utils
    getDisplaySoundLabel,
  };
}
