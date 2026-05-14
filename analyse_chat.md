# Analyse des Problèmes de Synchronisation du Chat

Ce document résume l'enquête sur les problèmes de perte de messages et de délais de synchronisation dans le chat de l'application.

## 1. Problèmes Signalés

L'utilisateur a signalé deux problèmes majeurs :

1.  **Perte de Messages** :
    *   Des messages reçus (signalés par une notification) n'apparaissent pas toujours dans la vue de chat.
    *   Des messages envoyés peuvent disparaître après avoir été envoyés.
2.  **Délai de Synchronisation** :
    *   Après réception d'une notification, il y a un délai notable avant que le message n'apparaisse dans l'interface du chat lorsque l'application est ouverte. L'utilisateur voit le message se "charger", ce qui crée une mauvaise expérience.

## 2. Investigation Menée

Mon analyse s'est concentrée sur le flux de données d'un message, de sa création à sa réception.

### a. Stockage Côté Client (`lib/chatStore.ts`)

-   **Technologie** : Le chat utilise `Zustand` pour la gestion de l'état, avec `AsyncStorage` pour la persistance.
-   **Logique Clé** : Les actions `addReceivedMessages` et `addSentMessages` sont responsables de l'ajout de messages dans le store.
-   **Constat** : Le store est conçu pour éviter les doublons en se basant sur l'identifiant unique (`id`) de chaque message. La logique semble correcte, mais elle dépend entièrement de la présence de cet `id`.

### b. Interface du Chat (`app/chat.tsx`)

-   **Chargement des Messages** : La fonction `refreshMessages` est au cœur du système. Elle interroge le backend pour obtenir les messages reçus et envoyés en attente (`fetchPendingReceivedViaBackend`, `fetchPendingSentViaBackend`).
-   **Mise à jour** : Une fois les messages récupérés, `refreshMessages` appelle `addReceivedMessages` et `addSentMessages` pour mettre à jour l'état local.
-   **Dépendance** : Le bon fonctionnement de l'affichage dépend de l'exécution réussie et rapide de `refreshMessages`.

### c. Gestion des Notifications Push (`lib/services/NotificationService.ts`)

-   **Réception** : Le service écoute les notifications entrantes via `addNotificationReceivedListener`.
-   **Mécanisme de Rafraîchissement** :
    -   Lorsqu'une notification est reçue, le service **n'ajoute pas directement le message au `chatStore`**.
    -   À la place, il émet un événement global : `DeviceEventEmitter.emit('REFRESH_DATA', data)`.
    -   D'autres parties de l'application (comme l'écran de chat) doivent écouter cet événement pour ensuite déclencher la fonction `refreshMessages`.
-   **Cause du Délai** : Ce mécanisme indirect est la cause principale du délai de synchronisation. Au lieu d'avoir le message instantanément (puisqu'il est dans la notification), l'application doit faire un aller-retour complet avec le serveur pour récupérer une liste de messages.

### d. Logique Côté Backend (`backend/src/prout/prout.service.ts`)

-   **Processus d'Envoi** :
    1.  Le service reçoit une requête pour envoyer un "prout" (un message).
    2.  Il insère le message dans la table `pending_messages` de Supabase. Cette opération génère un `id` unique (UUID) pour le message.
    3.  Ensuite, il construit et envoie une notification push via Expo ou FCM.
-   **Analyse de la Charge Utile (Payload)** :
    -   J'ai examiné la structure de l'objet `data` envoyé dans la notification push.
    -   **Constat Critique** : La charge utile de la notification contient des informations sur l'expéditeur, le type de son, etc., mais **elle n'inclut PAS l' `id` du message qui vient d'être créé dans la base de données**.

## 3. Analyse des Causes Profondes

### Cause du **Délai de Synchronisation**

-   Le délai est causé par le fait que la notification ne transporte pas le contenu du message. Elle agit uniquement comme un "signal" pour dire à l'application de tout rafraîchir en contactant le serveur. Ce rafraîchissement prend du temps, d'où le délai perçu par l'utilisateur.

### Cause de la **Perte de Messages**

-   C'est le problème le plus grave, et il découle directement du constat sur le backend :
    1.  Une notification est reçue.
    2.  L'application tente de rafraîchir les messages en appelant `refreshMessages`.
    3.  Si cet appel réseau échoue pour une raison quelconque (mauvaise connexion, erreur serveur temporaire), le message n'est **jamais** ajouté au store local.
    4.  L'utilisateur a vu la notification, mais le message est perdu pour l'application jusqu'au prochain rafraîchissement réussi.
    5.  La disparition des messages envoyés est probablement liée à une logique de synchronisation agressive qui considère les messages non retournés par le serveur comme "lus" ou "supprimés", même s'ils viennent juste d'être envoyés.

## 4. Solution Proposée

La solution consiste à rendre le flux de messages plus direct et robuste.

1.  **Modifier le Backend** :
    -   Dans `backend/src/prout/prout.service.ts`, après avoir inséré le message dans `pending_messages`, il faut **inclure l'objet message complet (ou au minimum `id`, `created_at`, `from_user_id`, `message_content`) dans la charge utile `data` de la notification push**.
2.  **Modifier le Frontend** :
    -   Dans `lib/services/NotificationService.ts`, mettre à jour le `addNotificationReceivedListener`.
    -   Quand une notification de type "prout" est reçue, il faut extraire les données du message de la charge utile.
    -   Appeler directement `useChatStore.getState().addReceivedMessages(friendId, [newMessage])` avec le message reçu.
    -   Cette action ajoutera le message au store **instantanément**, sans aucun appel réseau. Le message apparaîtra immédiatement dans l'interface utilisateur si elle est ouverte.
    -   On peut conserver l'événement `REFRESH_DATA` comme mécanisme de secours ou pour d'autres types de mises à jour.

Cette approche corrigera à la fois le problème de délai (le traitement devient instantané) et le problème de fiabilité (le message est stocké localement dès sa réception, éliminant le risque de le perdre à cause d'un échec réseau).

## 5. État de l'Implémentation

Les modifications suivantes ont été effectuées :

1.  **Backend (`backend/src/prout/prout.service.ts`)** :
    *   Mise à jour de `sendProut` pour récupérer le message inséré en base, le déchiffrer et l'inclure dans un objet `messageData`.
    *   Mise à jour de `sendViaExpo` et `sendViaFCM` pour inclure `messageData` dans la charge utile `data` de la notification.
    *   Inclusion de `messageData` dans l'événement de broadcast `message-received`.
2.  **Frontend (`lib/services/NotificationService.ts`)** :
    *   Le listener de notifications extrait maintenant `messageData` de la notification.
    *   Le message est injecté directement dans le `useChatStore` via `addReceivedMessages`.
    *   Ajout de logs de debug en mode `__DEV__` pour confirmer l'injection.

Ces changements assurent que les messages apparaissent instantanément dès la réception de la notification, même si l'appel réseau de rafraîchissement est lent ou échoue.
