# État d'Avancement - Synchronisation du Chat

## Ce qui a été fait

1.  **Backend : Inclusion des données de message dans les notifications**
    *   Le service `ProutService` a été modifié pour extraire les données du message (`id`, `from_user_id`, `to_user_id`, `message_content` déchiffré, `created_at`) après l'insertion en base de données.
    *   Ces données sont maintenant incluses dans le champ `data` des notifications push envoyées via **Expo** (iOS) et **FCM** (Android).
    *   Un correctif a été apporté pour un problème de portée (scope) de variable qui bloquait le déploiement sur Render.

2.  **Frontend : Injection directe dans le store**
    *   Le `NotificationService` a été mis à jour pour écouter le champ `messageData` dans les notifications reçues.
    *   Si présent, le message est immédiatement ajouté au `useChatStore`, permettant une mise à jour instantanée de l'UI sans attendre un rafraîchissement réseau.
    *   Le mécanisme reste compatible avec les anciens utilisateurs : si `messageData` est absent, l'application retombe sur le mécanisme de rafraîchissement global classique.

3.  **Logs de Debug**
    *   Ajout de logs détaillés côté Backend pour vérifier la présence et le contenu de `messageData` avant l'envoi.
    *   Ajout de logs détaillés côté Frontend pour inspecter l'intégralité du payload reçu dans les notifications.

## Ce qui reste à faire

1.  **Vérification du Déploiement**
    *   Redéployer le backend avec les nouveaux logs.
    *   Vérifier dans les logs de Render que `messageData` est bien généré et envoyé.

2.  **Investigation du Payload**
    *   Si `messageData` est toujours absent côté frontend malgré le déploiement backend, vérifier si le format JSON imbriqué est correctement supporté par les services de push (certains limitent la profondeur ou exigent que tout soit sous forme de chaînes de caractères).
    *   Ajuster le format de `messageData` (ex: `JSON.stringify`) si nécessaire côté backend.

3.  **Validation Finale**
    *   Confirmer que le délai de synchronisation a disparu pour les utilisateurs ayant la nouvelle version.
    *   S'assurer qu'aucun bug n'a été introduit pour les utilisateurs sur d'anciennes versions.
