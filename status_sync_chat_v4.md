# État d'Avancement : Correction de l'Aperçu des Messages

## 1. Problème Identifié
- **Android (App fermée) :** L'aperçu du dernier message n'apparaît pas instantanément après ouverture via une notification.
- **iOS (App ouverte) :** L'aperçu n'apparaît pas du tout à la réception, nécessitant un refresh manuel ou un délai d'attente.
- **Cause probable :** Désynchronisation entre les notifications (push/broadcast), le stockage persistant (Zustand), et l'état local de la liste d'amis (TanStack Query + local state).

## 2. Travail Réalisé (Phase 1 & 2)

### A. Persistance et Injection (Store)
- **`lib/chatStore.ts` :** Ajout d'un flag `hasHydrated` pour savoir quand les messages stockés sur le disque sont chargés.
- **`lib/services/NotificationService.ts` :**
    - Injection directe des données du message dans le store Zustand dès réception (foreground) OU clic (killed state).
    - Ajout d'une boucle d'attente pour s'assurer que le store est hydraté avant d'injecter (évite d'écraser les données par les valeurs par défaut du store).
    - Émission de l'événement `REFRESH_DATA` pour notifier l'UI.

### B. Synchronisation UI (FriendsList)
- **`components/FriendsList.tsx` :**
    - Initialisation de `pendingMessages` (aperçu) directement depuis le store Zustand au montage.
    - Ajout d'un effet de synchronisation réactif qui fusionne les messages du store avec l'état local.
    - Refonte du listener `REFRESH_DATA` pour extraire les données de manière plus robuste (supporte les formats `m_d`, `messageData`, et les champs à plat).
    - Ajout de mises à jour optimistes dans le listener Realtime `INSERT` de Supabase pour une réactivité immédiate.
    - Déclenchement de `refreshAllData()` dès le montage pour s'assurer que l'état serveur est récupéré sans attendre le focus.

### C. Gestion des "Lus"
- **`app/chat.tsx` :** Mise à jour optimiste du store local lors du passage en lecture pour que le point rouge disparaisse instantanément dans la liste.

---

## 3. État d'Avancement (Mis à jour le 15 Mai 2026)

### A. Investigation iOS (App Ouverte) - ✅ TERMINÉ
- **Diagnostic :** La cascade d'updates (FCM -> Store -> UI) était trop lente ou écrasée par TanStack.
- **Correction :** Utilisation de `queryClient.setQueryData` dans `FriendsList.tsx` pour injecter immédiatement le message dans le cache TanStack Query.
- **Robustesse :** Extraction des données améliorée dans `NotificationService.ts` (support format m_d et format plat).

### B. Fiabilisation du Tri (Android/iOS) - ✅ TERMINÉ
- **Correction :** Mise à jour optimiste de `last_interaction_at` dans le cache `friends` de TanStack Query dès réception d'un message.
- **Résultat :** L'ami remonte instantanément en haut de la liste, même si le fetch réseau prend du temps.

### C. Optimisation de la Cascade d'Updates - ✅ TERMINÉ
- **Changement :** Remplacement de la simple invalidation par une injection directe (`setQueryData`) + Invalidation retardée (3s).
- **Avantage :** Évite le "flash" de données obsolètes et assure une cohérence entre Notification, Realtime et Broadcast.

## 4. Résumé des Modifs
1. **`lib/services/NotificationService.ts`** : Parsing robuste m_d / flat + injection Zustand.
2. **`components/FriendsList.tsx`** :
   - `REFRESH_DATA` listener : injection `setQueryData` (messages + friends) + tri optimiste.
   - Realtime `INSERT` : injection `setQueryData` + tri optimiste.
   - Broadcast `message-received` : injection `setQueryData` + tri optimiste.
3. **`app/chat.tsx`** : Mise en cohérence des clés de requête (`currentUserId`).

### D. Tests Finaux - ✅ À VALIDER PAR L'UTILISATEUR
- [ ] Test Android depuis "killed state".
- [ ] Test iOS en premier plan (foreground).
- [ ] Vérification du point rouge (unread status) après retour arrière.

