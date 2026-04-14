import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fetchPendingReceivedViaBackend, fetchPendingSentViaBackend } from '../lib/sendProutBackend';

export type Friend = {
  id: string;
  pseudo: string;
  avatar_url: string | null;
  last_interaction_at: string | null;
  is_zen_mode: boolean;
  is_muted: boolean;
};

export const useFriends = (userId: string | null) => {
  return useQuery({
    queryKey: ['friends', userId],
    queryFn: async ({ queryKey }) => {
      const [_key, uid] = queryKey;
      if (!uid) return [];

      const { data: friends, error } = await supabase
        .from('friends')
        .select(`
          friend_id,
          user_profiles!friends_friend_id_fkey (
            id,
            pseudo,
            avatar_url,
            is_zen_mode,
            last_interaction_at
          )
        `)
        .eq('user_id', uid)
        .eq('status', 'accepted');

      if (error) throw error;

      const formattedFriends = (friends || []).map((f: any) => ({
        id: f.user_profiles.id,
        pseudo: f.user_profiles.pseudo,
        avatar_url: f.user_profiles.avatar_url,
        last_interaction_at: f.user_profiles.last_interaction_at,
        is_zen_mode: f.user_profiles.is_zen_mode,
        is_muted: false,
      }));

      return formattedFriends.sort((a, b) => {
        const timeA = a.last_interaction_at ? new Date(a.last_interaction_at).getTime() : 0;
        const timeB = b.last_interaction_at ? new Date(b.last_interaction_at).getTime() : 0;
        return timeB - timeA;
      });
    },
    enabled: !!userId,
    placeholderData: (previousData) => previousData, // Garder les anciennes données pendant le chargement ou si erreur
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

export const usePendingMessages = (userId: string | null) => {
  return useQuery({
    queryKey: ['pendingMessages', userId],
    queryFn: async () => {
      if (!userId) return [];
      try {
        const data = await fetchPendingReceivedViaBackend(userId);
        return data || [];
      } catch (e) {
        console.warn('⚠️ [usePendingMessages] Network error, server might be starting up...');
        return []; // On retourne une liste vide pour ne pas faire planter l'UI
      }
    },
    enabled: !!userId,
    refetchInterval: 5000,
    retry: 1, // On retente moins souvent pour les messages éphémères
  });
};

export const usePendingSentMessages = (userId: string | null) => {
  return useQuery({
    queryKey: ['pendingSentMessages', userId],
    queryFn: async () => {
      if (!userId) return [];
      try {
        const data = await fetchPendingSentViaBackend(userId);
        return data || [];
      } catch (e) {
        console.warn('⚠️ [usePendingSentMessages] Network error, server might be starting up...');
        return [];
      }
    },
    enabled: !!userId,
    refetchInterval: 8000, // On peut rafraîchir un peu moins souvent les messages envoyés
  });
};
