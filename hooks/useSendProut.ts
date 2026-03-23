import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendProutViaBackend } from '../lib/sendProutBackend';
import { supabase } from '../lib/supabase';

export const useSendProut = (userId: string | null) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      recipientToken, 
      senderPseudo, 
      proutKey, 
      platform, 
      extraData,
      receiverId // Ajout de l'ID du destinataire pour le broadcast
    }: { 
      recipientToken: string; 
      senderPseudo: string; 
      proutKey: string; 
      platform?: 'ios' | 'android'; 
      extraData?: any;
      receiverId?: string;
    }) => {
      // 1. Envoi via le backend (Notifications + DB)
      const res = await sendProutViaBackend(recipientToken, senderPseudo, proutKey, platform, extraData);

      // 2. 🚀 SIGNAL DIRECT (Broadcast) pour l'instantanéité UI
      if (receiverId) {
        const channel = supabase.channel(`room-${receiverId}`);
        await channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.send({
              type: 'broadcast',
              event: 'new-prout',
              payload: { proutKey, senderPseudo, timestamp: new Date().toISOString() },
            });
            // On peut se déconnecter tout de suite après l'envoi
            supabase.removeChannel(channel);
          }
        });
      }

      return res;
    },
    
    // 🚀 L'étape "MAGIQUE" : Optimistic Update
    onMutate: async (newProut) => {
      // 1. Annuler les rafraîchissements en cours pour ne pas écraser notre modif optimiste
      await queryClient.cancelQueries({ queryKey: ['pendingSentMessages', userId] });

      // 2. Récupérer l'état actuel des messages envoyés
      const previousMessages = queryClient.getQueryData(['pendingSentMessages', userId]);

      // 3. Ajouter "optimistiquement" le nouveau message à la liste locale
      const optimisticMessage = {
        id: `temp-${Date.now()}`, // ID temporaire
        message_content: newProut.proutKey,
        created_at: new Date().toISOString(),
        sender_pseudo: newProut.senderPseudo,
        is_optimistic: true, // Pour pouvoir l'identifier si besoin (ex: petit spinner)
      };

      queryClient.setQueryData(['pendingSentMessages', userId], (old: any[] = []) => [
        optimisticMessage,
        ...old,
      ]);

      // 4. Retourner le contexte pour pouvoir annuler en cas d'erreur
      return { previousMessages };
    },

    // En cas d'erreur : on remet l'ancienne liste
    onError: (err, newProut, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(['pendingSentMessages', userId], context.previousMessages);
      }
      console.error('❌ Erreur lors de l\'envoi optimiste:', err);
    },

    // Une fois terminé (succès ou erreur) : on rafraîchit pour avoir les vraies données du serveur
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingSentMessages', userId] });
    },
  });
};
