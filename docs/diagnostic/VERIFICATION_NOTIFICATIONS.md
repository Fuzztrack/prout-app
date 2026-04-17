# Vérification de la cohérence Frontend/Backend pour les notifications

## 📋 Résumé de l'architecture actuelle

### Frontend
1. **Récupération des tokens** (`lib/fcmToken.ts`):
   - **Android** : Token FCM natif via `getDevicePushTokenAsync()` → Format FCM
   - **iOS** : Token Expo via `getExpoPushTokenAsync()` → Format `ExponentPushToken[...]`

2. **Stockage** (`app/(tabs)/index.tsx`):
   - Token stocké dans `user_profiles.expo_push_token`
   - Plateforme stockée dans `user_profiles.push_platform` (`'ios'` ou `'android'`)

3. **Envoi** (`lib/sendProutBackend.ts`):
   - Envoie au backend : `token`, `sender`, `proutKey`, `platform`, `extraData`
   - `extraData` contient : `customMessage`, `senderId`, `receiverId`

### Backend
1. **Réception** (`prout.controller.ts`):
   - Reçoit : `token`, `sender`, `proutKey`, `platform`, `extraData`
   - Extrait `customMessage`, `senderId`, `receiverId` de `extraData`

2. **Traitement** (`prout.service.ts`):
   - Utilise Firebase Admin SDK pour envoyer les notifications
   - **Android** : Configure `androidConfig` avec `channelId` (`prout-{proutKey}-v3`)
   - **iOS** : Configure `apnsConfig` avec son `${proutKey}.wav`

## ✅ VALIDATION

### 1. **Tokens iOS - Format ExponentPushToken**
- ✅ **Confirmé** : Les tokens iOS au format `ExponentPushToken[...]` fonctionnent correctement
- ✅ **Backend** : Firebase Admin SDK gère ces tokens via la configuration APNS
- ✅ **Aucun changement nécessaire**

### 2. **Tokens Android - Format FCM**
- ✅ **Confirmé** : Les tokens Android au format FCM (`dpYNrpVlQ8KLjDtfRw8-Nf:APA91bF...`) fonctionnent correctement
- ✅ **Backend** : Firebase Admin SDK gère ces tokens via la configuration Android
- ✅ **Aucun changement nécessaire**

### 3. **Format du son iOS**
- ✅ **Confirmé** : Le format `${proutKey}.wav` fonctionne correctement pour iOS
- ✅ **Aucun changement nécessaire**

### 3. **Cohérence du channelId Android**
- ✅ **OK** : Le backend utilise `prout-{proutKey}-v3` qui correspond au code Android natif

### 4. **Message personnalisé**
- ✅ **OK** : Le frontend envoie `customMessage` dans `extraData`
- ✅ **OK** : Le backend l'extrait et l'inclut dans le body de la notification

## 📝 RÉSUMÉ DE LA COHÉRENCE

### ✅ Tout fonctionne correctement !

1. **Tokens** :
   - iOS : Format `ExponentPushToken[...]` → Géré par Firebase Admin SDK via APNS ✅
   - Android : Format FCM natif → Géré par Firebase Admin SDK directement ✅

2. **Sons** :
   - iOS : Format `${proutKey}.wav` dans APNS config ✅
   - Android : Format `${proutKey}` dans Android config (sans extension) ✅

3. **Messages personnalisés** :
   - Frontend envoie `customMessage` dans `extraData` ✅
   - Backend l'extrait et l'inclut dans le body de la notification ✅

4. **Plateforme** :
   - Frontend envoie `platform` ('ios' ou 'android') ✅
   - Backend utilise cette info pour configurer Android ou APNS ✅

5. **ChannelId Android** :
   - Format cohérent : `prout-{proutKey}-v3` ✅
   - Correspond au code Android natif (`ProutMessagingService.kt`) ✅

## ✅ POINTS VALIDÉS

- ✅ Format du `channelId` Android cohérent (`prout-{proutKey}-v3`)
- ✅ Passage de `platform` du frontend au backend
- ✅ Gestion du `customMessage` dans `extraData`
- ✅ Inclusion de `senderId` et `receiverId` dans les data
- ✅ Configuration Android avec son personnalisé

