# AUDIT DE L'APPLICATION — PROOT ! (ProutApp)
**Date : 04 Août 2026**  
**Version de l'application :** `1.1.41` (Android `versionCode 213`, iOS `buildNumber 113`)  
**Périmètre :** Code source Front-end (Expo SDK 54 / RN 0.81.5), Backend (NestJS 9), Supabase Edge Functions (`prout-proxy`), Sentry & Config Build Release.

---

##  EXECUTIVE SUMMARY

| Domaine | Statut Général | Commentaire Majeur |
|---|---|---|
| **Télémétrie & Release (Sentry)** | 🟢 **CONFORME** | Jeton `SENTRY_AUTH_TOKEN` configuré, upload des sourcemaps fonctionnel au build Release. |
| **Sécurité Edge Function (`prout-proxy`)** | 🟢 **CONFORME** | Vérification JWT Supabase Auth + imposition du `senderId` certifié en place. |
| **Limitation de Débit (Backend Rate Limit)** | 🟢 **CONFORME** | `trust proxy: 1` activé, quota augmenté à 120 req/min/client. |
| **Gestion des Statuts de Chat ('lu' & Timer)** | 🟢 **CONFORME** | Disparition immédiate du timer à la confirmation serveur + réconciliation locale des accusés de lecture. |
| **Qualité du Code TS / Temporal Dead Zone** | 🟡 **À CORRIGER** | 4 variables JS appelées avant leur déclaration dans `app/chat.tsx` (TDZ), erreurs dans `app/(tabs)/index.tsx`. |
| **Fichiers Fantômes & Dead Code** | 🟡 **À NETTOYER** | Fichier de route `app/index copie.tsx`, dossier `temp_restore/` (40+ erreurs TS), doublons `FriendsList.backup.tsx`. |

---

## 1. DÉTAIL DE L'AUDIT PAR DOMAINE

### 1.1 Télémétrie, Crash Reporting & Builds (Sentry)
* **Constat** : L'intégration de `@sentry/react-native` dans `app.json` et la présence du jeton `SENTRY_AUTH_TOKEN` dans `.env`, `android/sentry.properties` et `ios/sentry.properties` permettent un build Gradle sans erreur.
* **Source Maps** : Les sourcemaps sont automatiquement générées et uploadées lors de l'assemblage Release (`app:assembleRelease`). Les crashs en production remonteront avec des stack traces désanonymisées.
* **Note** : Le fichier `.env` contenant le secret est bien ignoré par `.gitignore` et ne risque pas d'être committé.

---

### 1.2 Sécurité & Authentification (Backend & Edge Functions)
* **Validation des identités (`P0-2`)** :
  * Dans `supabase/functions/prout-proxy/index.ts`, la fonction `supabaseAdmin.auth.getUser(token)` valide strictement le token JWT.
  * Les champs `senderId` et `userId` du body HTTP sont écrasés par l'ID certifié de l'utilisateur (`user.id`).
* **Rate Limiting (`P1-2`)** :
  * [`backend/src/main.ts`](file:///Users/fuzz/Proutapp/backend/src/main.ts#L10) contient `expressApp.set('trust proxy', 1)`.
  * [`backend/src/app.module.ts`](file:///Users/fuzz/Proutapp/backend/src/app.module.ts#L18) autorise `120 req/min/client`.

---

### 1.3 Chat & Expérience Utilisateur
* **Statut 'lu' & Timer** :
  * La synchronisation optimiste dans [`components/chat/ChatComposer.tsx`](file:///Users/fuzz/Proutapp/components/chat/ChatComposer.tsx) notifie le composant parent [`app/chat.tsx`](file:///Users/fuzz/Proutapp/app/chat.tsx) dès la confirmation d'envoi par le backend.
  * Le message passe instantanément du statut `optimistic: true` à validé serveur (`optimistic: false`), faisant disparaître l'icône de l'horloge.
  * La gestion du statut `read` lors des broadcasts Supabase est sécurisée dans `lib/chatStore.ts`.

---

### 1.4 Qualité du Code TypeScript & Erreurs de Runtime (TDZ)
Une analyse avec `npx tsc --noEmit` révèle quelques fragilités dans le code de production :

#### ⚠️ A. Variables appelées avant déclaration (Temporal Dead Zone - TDZ dans `app/chat.tsx`)
1. **Ligne 243** : `sentMessages` est référencé dans la callback `useEffect` / `handleMessageEdited` avant sa déclaration `useState` (ligne 272).
2. **Ligne 626** : `loadConversationReactions` est utilisé dans un `useFocusEffect` avant d'être défini plus bas dans le fichier.
3. **Ligne 767** : `isReactionForCurrentConversation`, `removeReactionForMessage` et `replaceReactionForMessage` sont appelés dans le callback du canal Realtime avant leur déclaration sous forme de constantes `useCallback`.
* **Impact** : Peut provoquer un crash silencieux ou une `ReferenceError` sous certaines conditions de premier rendu ou de reconnexion réseau.

#### ⚠️ B. Problème de type `Share.share` dans `app/(tabs)/index.tsx`
* Ligne 704 : L'appel `Share.share({ message: customMessage })` transmet un type `string | undefined`, ce qui n'est pas toléré par la signature officielle de la API React Native `ShareContent` (attend `string` obligatoire).

---

### 1.5 Nettoyage de Code mort (Debt & Code Hygiene)
1. **Route fantôme Expo Router** : `app/index copie.tsx` est présent dans le dossier de routage. Expo Router crée automatiquement une route nommée `/index copie`. Ce fichier doit être supprimé pour éviter des routes mortes exposées.
2. **Fichiers de secours obsolètes** :
   * `temp_restore/` (dossier racine) contient 50+ fichiers obsolètes générant plus de 40 erreurs de typage.
   * `components/FriendsList.backup.tsx` et `components/FriendsList_baaack.tsx` pèsent plus de 5 000 lignes mortes.
3. **Imports inutilisés / obsolètes** dans `AuthChoiceScreen.tsx` et `edit-profile.tsx`.

---

## 2. PLAN D'ACTIONS RECOMMANDÉ

### Actions Prioritaires (Recommandé avant la prochaine release) :
1. **Corriger l'ordre des déclarations (TDZ) dans [`app/chat.tsx`](file:///Users/fuzz/Proutapp/app/chat.tsx)** :
   * Déplacer les fonctions `loadConversationReactions`, `isReactionForCurrentConversation` et l'état `sentMessages` au-dessus de leurs utilisations dans les `useEffect` / `useFocusEffect`.
2. **Supprimer le fichier de route fantôme** :
   * Supprimer [`app/index copie.tsx`](file:///Users/fuzz/Proutapp/app/index%20copie.tsx).
3. **Purger les fichiers morts du dépôt** :
   * Supprimer le dossier `temp_restore/`, ainsi que `FriendsList.backup.tsx` et `FriendsList_baaack.tsx`.

---

## 3. TABLEAU DE SYNTHÈSE DES AMÉLIORATIONS HISTORIQUES

| Problème Audit 31/07 | État au 04/08/2026 | Solution appliquée |
|---|---|---|
| `P0-2` Identité prout-proxy non vérifiée | 🟢 **Résolu** | JWT Supabase Auth vérifié & `user.id` forcé dans Deno. |
| `P1-2` Rate limit bloque tout le monde | 🟢 **Résolu** | `trust proxy: 1` activé, limite à 120 req/min/IP. |
| `P1-5` Pas de Sentry ni sourcemaps | 🟢 **Résolu** | Plugin Sentry configuré + `SENTRY_AUTH_TOKEN` opérationnel. |
| `Bug Chat` Timer et statut 'lu' bloqués | 🟢 **Résolu** | Callback `onMessageConfirmed` + sync Zustand `chatStore`. |
