import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type PendingRequest = {
  requestId: string;
  senderId: string;
  pseudo: string;
  method?: string;
};

export type IdentityRequest = {
  requesterId: string;
  requesterPseudo: string;
};

export const usePendingRequests = (userId: string | null) => {
  return useQuery({
    queryKey: ['pendingRequests', userId],
    queryFn: async () => {
      if (!userId) return [];

      // 1. Charger les demandes en attente
      const { data: rawRequests, error } = await supabase
        .from('friends')
        .select('id, user_id, method')
        .eq('friend_id', userId)
        .eq('status', 'pending');

      if (error) throw error;
      if (!rawRequests || rawRequests.length === 0) return [];

      // 2. Filtrer les demandes (si réciproque déjà acceptée)
      const filteredRequests = [];
      for (const req of rawRequests) {
        const { data: reciprocal } = await supabase
          .from('friends')
          .select('id, status')
          .eq('user_id', userId)
          .eq('friend_id', req.user_id)
          .maybeSingle();

        if (!reciprocal || reciprocal.status === 'pending') {
          filteredRequests.push(req);
        }
      }

      if (filteredRequests.length === 0) return [];

      // 3. Récupérer les pseudos des expéditeurs
      const senderIds = filteredRequests.map(r => r.user_id);
      const { data: senders } = await supabase
        .from('user_profiles')
        .select('id, pseudo')
        .in('id', senderIds);

      return filteredRequests.map(req => ({
        requestId: req.id,
        senderId: req.user_id,
        pseudo: senders?.find(s => s.id === req.user_id)?.pseudo || 'Inconnu',
        method: req.method
      }));
    },
    enabled: !!userId,
    placeholderData: (previousData) => previousData,
    refetchInterval: 30000, // Rafraîchir toutes les 30 secondes
  });
};

export const useIdentityRequests = (userId: string | null) => {
  return useQuery({
    queryKey: ['identityRequests', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data: identityRows, error: identityError } = await supabase
        .from('identity_reveals')
        .select('requester_id, status')
        .eq('friend_id', userId)
        .eq('status', 'pending');

      if (identityError) throw identityError;
      if (!identityRows || identityRows.length === 0) return [];

      const requesterIds = identityRows.map(r => r.requester_id);
      const { data: requesters } = await supabase
        .from('user_profiles')
        .select('id, pseudo')
        .in('id', requesterIds);

      return identityRows.map(row => ({
        requesterId: row.requester_id,
        requesterPseudo: requesters?.find(u => u.id === row.requester_id)?.pseudo || 'Inconnu',
      }));
    },
    enabled: !!userId,
    placeholderData: (previousData) => previousData,
    refetchInterval: 30000, // Rafraîchir toutes les 30 secondes
  });
};