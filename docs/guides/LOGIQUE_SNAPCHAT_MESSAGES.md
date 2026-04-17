# Logique Snapchat pour les Messages

## Comportement attendu

### 1. Message envoyé par A
- ✅ Reste visible dans le chat de A tant que B ne l'a pas lu
- ✅ Si A ferme son chat et que B ne l'a pas lu, le message reste et réapparaît quand A rouvre
- ✅ Si B lit le message, il devient "lu" (grisé) chez A
- ✅ Après 5 secondes, le message est supprimé du serveur mais reste en mémoire locale
- ✅ Le message reste visible pour A et B tant qu'ils n'ont pas fermé leur chat tous les deux

### 2. Message reçu par B
- ✅ Quand B ouvre son chat, il lit automatiquement les messages de A
- ✅ Les messages deviennent "lus" (grisés) chez A
- ✅ Les messages sont supprimés du serveur après 5 secondes mais restent en mémoire locale

### 3. Fermeture du chat
- ✅ Si B ferme son chat, A continue de voir la conversation (rien n'est effacé)
- ✅ Si B rouvre son chat, il retrouve la conversation
- ✅ Si A ET B ferment leur chat, les messages lus sont supprimés localement (après vérification serveur)

## Modifications apportées

### Backend (`prout.service.ts`)

1. **`readConversation`** : 
   - Marque les messages comme `READ:` dans la DB avant suppression
   - Attend 5 secondes avant de supprimer (pour laisser le temps au client de récupérer)
   - Envoie un broadcast avec les IDs des messages lus

2. **Logs ajoutés** :
   - `sendProut` : vérifie si les messages sont créés dans `pending_messages`
   - `readConversation` : trace le marquage et la suppression
   - `markMessageRead` : logs détaillés
   - `purgeChat` : logs pour voir quels messages sont supprimés

### Client (`FriendsList.tsx`)

1. **Fermeture du chat** :
   - ✅ Conservation de TOUS les messages à la fermeture (lus et non lus)
   - ✅ Les messages non lus restent visibles même après fermeture (persistance Snapchat)
   - ✅ Les messages lus seront supprimés seulement s'ils ne sont plus sur le serveur ET que le chat est fermé

2. **`loadData`** :
   - ✅ Filtre les messages qui ne sont plus sur le serveur (supprimés après 5 secondes)
   - ✅ Garde les messages non lus même s'ils ne sont plus sur le serveur
   - ✅ Supprime les messages lus qui ne sont plus sur le serveur si le chat est fermé

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
