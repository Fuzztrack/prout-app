# Logique Snapchat pour les Messages

## Comportement attendu

### 1. Message envoyé par A
- ✅ Reste visible dans le chat de A tant que B ne l'a pas lu
- ✅ Si A ferme son chat et que B ne l'a pas lu, le message reste et réapparaît quand A rouvre
- ✅ Si B lit le message, il devient "lu" (grisé) chez A
- ✅ Le message reste dans la base de données (marqué comme "READ:")
- ✅ Le message reste visible pour A et B tant qu'ils n'ont pas fermé leur chat tous les deux

### 2. Message reçu par B
- ✅ Quand B ouvre son chat, il lit automatiquement les messages de A
- ✅ Les messages deviennent "lus" (grisés) chez A
- ✅ Les messages restent en mémoire locale et en base de données tant que le chat est ouvert

### 3. Fermeture du chat (Mode Instantané / 0h)
- ✅ Si A ferme son chat avant que B ne lise le message : le message n'est pas purgé car il n'est pas "READ:". Il réapparaîtra à la réouverture.
- ✅ Si B lit le message, puis B ferme son chat : une fonction de purge backend supprime de la base de données **uniquement les messages marqués comme "READ:"**.
- ✅ Les messages disparaissent alors définitivement pour A et B (logique Snapchat).

## Modifications apportées

### Backend (`prout.service.ts`)

1. **`readConversation`** : 
   - Marque simplement les messages comme `READ:` dans la DB.
   - Envoie un broadcast avec les IDs des messages lus.
   - ⚠️ **Aucune suppression automatique** des messages ici.

2. **`purgeChat`** :
   - Exécuté quand l'utilisateur quitte l'écran de chat (si réglé sur 0h).
   - Supprime de la DB **uniquement** les messages marqués comme "READ:".
   - Garantit que les messages non lus ne disparaissent pas à la fermeture du chat.

3. **Logs ajoutés** :
   - `sendProut` : vérifie si les messages sont créés dans `pending_messages`
   - `readConversation` : trace le marquage
   - `markMessageRead` : logs détaillés
   - `purgeChat` : logs pour voir quels messages sont supprimés

### Client (`FriendsList.tsx` / `chat.tsx`)

1. **Fermeture du chat** :
   - ✅ Conservation de TOUS les messages à la fermeture (lus et non lus).
   - ✅ Déclenche `purgeChatViaBackend` qui purgera les "READ:".

2. **`loadData`** / **Événements Realtime** :
   - ✅ Filtre les messages qui ne sont plus sur le serveur (supprimés par `purgeChat`).
   - ✅ Garde les messages non lus puisqu'ils restent sur le serveur.
   - ✅ Le client reçoit un événement DELETE quand l'autre ferme le chat, ce qui vide la vue instantanément.

3. **Broadcast `message-read`** :
   - ✅ Ajoute les IDs au cache `readSentMessagesRef` même si les messages ne sont pas encore dans `lastSentMessages`
   - ✅ Marque les messages comme lus quand ils sont récupérés depuis la DB

## Problèmes identifiés

1. **Messages jamais récupérés depuis la DB** :
   - `fetchSentPendingMessages` retourne toujours 0 messages
   - Cause probable : RLS (Row Level Security) bloque l'accès aux messages envoyés
   - Solution : Créer la politique RLS "Users can read messages they sent"

2. **Messages supprimés trop vite** :
   - Les messages sont supprimés avant que le client ne puisse les récupérer
   - Solution : Délai de 5 secondes dans `readConversation` avant suppression

## Prochaines étapes

1. ✅ Exécuter `supabase_pending_messages_rls_policies.sql` pour créer les politiques RLS
2. ✅ Redéployer le backend sur Render avec les nouvelles modifications
3. ✅ Tester et vérifier les logs pour confirmer que les messages sont récupérés
4. ✅ Vérifier que les messages non lus restent visibles après fermeture du chat
5. ✅ Vérifier que les messages lus sont grisés chez A quand B les lit
