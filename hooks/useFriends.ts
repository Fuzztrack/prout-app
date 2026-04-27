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
      const [_key, uid] = queryKey as [string, string];
      if (!uid) return [];

      // 1. Récupérer les bloqués (pour les exclure de la liste d'amis)
      const { data: blockedUsersRows } = await supabase
        .from('blocked_users')
        .select('blocked_user_id')
        .eq('blocker_id', uid);
      const blockedSet = new Set((blockedUsersRows || []).map((row: any) => row.blocked_user_id).filter(Boolean));

      // 2. Charger les relations acceptées dans les deux sens
      const [addedFriendsResult, friendsWhereIAmFriendResult] = await Promise.all([
        supabase
          .from('friends')
          .select('friend_id')
          .eq('user_id', uid)
          .eq('status', 'accepted'),
        supabase
          .from('friends')
          .select('user_id')
          .eq('friend_id', uid)
          .eq('status', 'accepted')
      ]);
      
      const addedFriendsIds = addedFriendsResult.data?.map(f => f.friend_id) || [];
      const friendsWhereIAmFriendIds = friendsWhereIAmFriendResult.data?.map(f => f.user_id) || [];
      
      // Combiner tous les IDs d'amis et exclure les bloqués
      const allFriendIds = [...new Set([...addedFriendsIds, ...friendsWhereIAmFriendIds])]
        .filter((id) => !blockedSet.has(id));

      if (allFriendIds.length === 0) return [];

      // 3. Récupérer les profils et les métadonnées en parallèle
      const [
        { data: finalFriends },
        { data: revealsData },
        { data: mutedFriendsData },
        { data: mutedByFriendsData },
        { data: myFriendsRelationsData }
      ] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, pseudo, avatar_url, is_zen_mode')
          .in('id', allFriendIds),
        supabase
          .from('identity_reveals')
          .select('friend_id, alias, status')
          .eq('requester_id', uid)
          .in('friend_id', allFriendIds),
        supabase
          .from('friends')
          .select('friend_id, is_muted')
          .eq('user_id', uid)
          .in('friend_id', allFriendIds),
        supabase
          .from('friends')
          .select('user_id, is_muted')
          .eq('friend_id', uid)
          .in('user_id', allFriendIds)
          .eq('is_muted', true),
        supabase
          .from('friends')
          .select('friend_id, last_interaction_at')
          .eq('user_id', uid)
          .in('friend_id', allFriendIds)
      ]);

      const identityAliasMap = (revealsData || []).reduce((acc: any, reveal: any) => {
        acc[reveal.friend_id] = { alias: reveal.alias, status: reveal.status };
        return acc;
      }, {});

      const mutedMap = (mutedFriendsData || []).reduce((acc: any, f: any) => {
        acc[f.friend_id] = f.is_muted || false;
        return acc;
      }, {});

      const mutedByMap = (mutedByFriendsData || []).reduce((acc: any, f: any) => {
        acc[f.user_id] = true;
        return acc;
      }, {});

      const lastInteractionMap = (myFriendsRelationsData || []).reduce((acc: any, rel: any) => {
        if (rel.last_interaction_at) acc[rel.friend_id] = rel.last_interaction_at;
        return acc;
      }, {});

      // 4. Formater les amis
      const formattedFriends = (finalFriends || []).map(friend => {
        const isMutedByMe = mutedMap[friend.id] || false;
        const hasMutedMe = mutedByMap[friend.id] || false;
        
        return {
          ...friend,
          identityAlias: identityAliasMap[friend.id]?.alias || null,
          identityStatus: identityAliasMap[friend.id]?.status || null,
          is_muted: isMutedByMe,
          isZenMode: friend.is_zen_mode || hasMutedMe,
          last_interaction_at: lastInteractionMap[friend.id] || null,
        };
      });

      // 5. Trier par date d'interaction (le plus récent en premier)
      return formattedFriends.sort((a, b) => {
        const timeA = a.last_interaction_at ? new Date(a.last_interaction_at).getTime() : 0;
        const timeB = b.last_interaction_at ? new Date(b.last_interaction_at).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return (a.pseudo || '').localeCompare(b.pseudo || '');
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

export const useBlockedUsers = (userId: string | null) => {
  return useQuery({
    queryKey: ['blockedUsers', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data: blockedUsersRows, error } = await supabase
        .from('blocked_users')
        .select('blocked_user_id')
        .eq('blocker_id', userId);

      if (error) throw error;
      
      return (blockedUsersRows || []).map((row: any) => row.blocked_user_id).filter(Boolean) as string[];
    },
    enabled: !!userId,
    refetchInterval: 60000, // Une fois par minute suffit pour les blocages
  });
};
