import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fetchPendingReceivedViaBackend, fetchPendingSentViaBackend } from '../lib/sendProutBackend';

export type Friend = {
  id: string;
  pseudo: string;
  avatar_url: string | null;
  last_interaction_at: string | null;
  is_muted: boolean;
  isZenMode: boolean;
  identityAlias?: string | null;
  identityStatus?: string | null;
};

export const useFriends = (userId: string | null) => {
  return useQuery({
    queryKey: ['friends', userId],
    queryFn: async ({ queryKey }) => {
      const [_key, uid] = queryKey as [string, string];
      if (!uid) return [];

      if (__DEV__) console.log(`🔍 [useFriends] Fetching friends for ${uid}...`);

      try {
        // 1. Récupérer les bloqués (pour les exclure de la liste d'amis)
        const { data: blockedUsersRows, error: blockedError } = await supabase
          .from('blocked_users')
          .select('blocked_user_id')
          .eq('blocker_id', uid);
        
        if (blockedError) {
          console.error('❌ [useFriends] Error fetching blocked users:', JSON.stringify(blockedError));
          throw blockedError;
        }
        if (!blockedUsersRows) {
          console.error('❌ [useFriends] No data for blocked users and no error');
          throw new Error('No data for blocked users');
        }
        const blockedSet = new Set((blockedUsersRows || []).map((row: any) => row.blocked_user_id).filter(Boolean));

        // 2. Charger les relations acceptées dans les deux sens
        const [addedFriendsResult, friendsWhereIAmFriendResult] = await Promise.all([
          supabase
            .from('friends')
            .select('friend_id, last_interaction_at, is_muted')
            .eq('user_id', uid)
            .eq('status', 'accepted'),
          supabase
            .from('friends')
            .select('user_id, last_interaction_at')
            .eq('friend_id', uid)
            .eq('status', 'accepted')
        ]);
        
        if (addedFriendsResult.error) {
          console.error('❌ [useFriends] Error addedFriendsResult:', JSON.stringify(addedFriendsResult.error));
          throw addedFriendsResult.error;
        }
        if (friendsWhereIAmFriendResult.error) {
          console.error('❌ [useFriends] Error friendsWhereIAmFriendResult:', JSON.stringify(friendsWhereIAmFriendResult.error));
          throw friendsWhereIAmFriendResult.error;
        }

        if (!addedFriendsResult.data || !friendsWhereIAmFriendResult.data) {
          console.error('❌ [useFriends] Missing data for friends relations');
          throw new Error('Missing data for friends relations');
        }

        const addedFriendsIds = addedFriendsResult.data?.map(f => f.friend_id) || [];
        const friendsWhereIAmFriendIds = friendsWhereIAmFriendResult.data?.map(f => f.user_id) || [];
        
        // Combiner tous les IDs d'amis et exclure les bloqués
        const allFriendIds = [...new Set([...addedFriendsIds, ...friendsWhereIAmFriendIds])]
          .filter((id) => !blockedSet.has(id));

        if (allFriendIds.length === 0) {
          if (__DEV__) console.log('ℹ️ [useFriends] No friends found (legit empty list) for:', uid);
          return [];
        }

        // 3. Récupérer les profils et les métadonnées (Identity Reveals, Mute, etc.)
        const [
          profilesResult,
          revealsResult,
          mutedByResult
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
            .select('user_id, is_muted')
            .eq('friend_id', uid)
            .in('user_id', allFriendIds)
            .eq('is_muted', true)
        ]);

        if (profilesResult.error) throw profilesResult.error;
        if (revealsResult.error) throw revealsResult.error;
        if (mutedByResult.error) throw mutedByResult.error;

        if (!profilesResult.data) throw new Error('Missing profiles data');

        const finalFriends = profilesResult.data;
        const revealsData = revealsResult.data || [];
        const mutedByFriendsData = mutedByResult.data || [];

        // Créer des maps pour un accès rapide O(1)
        const lastInteractionMap: Record<string, string> = {};
        const mutedMap: Record<string, boolean> = {};

        // Remplir avec les données de la relation "Moi -> Ami" (Direction principale)
        (addedFriendsResult.data || []).forEach(rel => {
          if (rel.last_interaction_at) {
            lastInteractionMap[rel.friend_id] = rel.last_interaction_at;
          }
          if (rel.is_muted) {
            mutedMap[rel.friend_id] = true;
          }
        });

        // Compléter avec la relation "Ami -> Moi" (Direction inverse pour last_interaction_at)
        (friendsWhereIAmFriendResult.data || []).forEach(rel => {
          const existingTime = lastInteractionMap[rel.user_id];
          const inverseTime = rel.last_interaction_at;
          
          if (inverseTime) {
            if (!existingTime || new Date(inverseTime) > new Date(existingTime)) {
              lastInteractionMap[rel.user_id] = inverseTime;
            }
          }
        });

        const identityAliasMap = revealsData.reduce((acc: any, reveal: any) => {
          acc[reveal.friend_id] = { alias: reveal.alias, status: reveal.status };
          return acc;
        }, {});

        const mutedByMap = mutedByFriendsData.reduce((acc: any, f: any) => {
          acc[f.user_id] = true;
          return acc;
        }, {});

        // 4. Formater les amis
        const formattedFriends = finalFriends.map(friend => {
          const isMutedByMe = mutedMap[friend.id] || false;
          const hasMutedMe = mutedByMap[friend.id] || false;
          
          return {
            ...friend,
            identityAlias: identityAliasMap[friend.id]?.alias || null,
            identityStatus: identityAliasMap[friend.id]?.status || null,
            is_muted: isMutedByMe,
            isZenMode: friend.is_zen_mode || hasMutedMe,
            last_interaction_at: lastInteractionMap[friend.id] || null,
          } as Friend;
        });

        if (__DEV__) console.log(`✅ [useFriends] Successfully fetched ${formattedFriends.length} friends for ${uid}`);

        // 5. Trier par date d'interaction (le plus récent en premier)
        return formattedFriends.sort((a, b) => {
          const timeA = a.last_interaction_at ? new Date(a.last_interaction_at).getTime() : 0;
          const timeB = b.last_interaction_at ? new Date(b.last_interaction_at).getTime() : 0;
          if (timeA !== timeB) return timeB - timeA;
          return (a.pseudo || '').localeCompare(b.pseudo || '');
        });
      } catch (error) {
        console.error('❌ [useFriends] Critical error during fetch:', error);
        // On relance l'erreur pour que React Query utilise les données persistées (stale data)
        throw error;
      }
    },
    enabled: !!userId,
    placeholderData: (previousData) => previousData,
    refetchInterval: 300000, // 5 minutes (instead of 15s) since realtime handles active updates
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
      const data = await fetchPendingReceivedViaBackend(userId);
      if (data === null) {
        throw new Error('Network error');
      }
      return data || [];
    },
    enabled: !!userId,
    placeholderData: (previousData) => previousData,
    refetchInterval: 60000, // 1 minute (instead of 5s)
    refetchOnWindowFocus: true,
    retry: 1,
  });
};

export const usePendingSentMessages = (userId: string | null) => {
  return useQuery({
    queryKey: ['pendingSentMessages', userId],
    queryFn: async () => {
      if (!userId) return [];
      const data = await fetchPendingSentViaBackend(userId);
      if (data === null) {
        throw new Error('Network error');
      }
      return data || [];
    },
    enabled: !!userId,
    placeholderData: (previousData) => previousData,
    refetchInterval: 60000, // 1 minute (instead of 8s)
    refetchOnWindowFocus: true,
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

      if (error) {
        console.error('❌ [useBlockedUsers] Error:', error);
        throw error;
      }
      
      return (blockedUsersRows || []).map((row: any) => row.blocked_user_id).filter(Boolean) as string[];
    },
    enabled: !!userId,
    placeholderData: (previousData) => previousData,
    refetchInterval: 60000,
  });
};
