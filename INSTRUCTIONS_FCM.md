# Instructions - Configuration FCM Natif

## ✅ Modifications effectuées

1. **Package ajouté** : `@react-native-firebase/messaging` dans `package.json`
2. **Nouvelle fonction** : `lib/fcmToken.ts` pour obtenir le token FCM
3. **Fichiers modifiés** :
   - `app/(tabs)/index.tsx` - Utilise maintenant `getFCMToken()` au lieu de `getExpoPushTokenAsync()`
   - `components/FriendsList.tsx` - Utilise le token FCM pour l'envoi

## 📦 Installation

### 1. Installer les dépendances

```bash
npm install
```

### 2. Configuration Firebase pour React Native Firebase

**⚠️ IMPORTANT** : `@react-native-firebase/messaging` nécessite un projet Expo avec **dev client** ou **bare workflow**. 

Si vous utilisez Expo Managed, vous devez :
- Soit utiliser `expo-dev-client` (recommandé)
- Soit faire un `prebuild` pour générer les fichiers natifs

### 3. Configuration Android

Le fichier `google-services.json` doit être présent dans `android/app/` (déjà fait).

### 4. Configuration iOS (si nécessaire)

Le fichier `GoogleService-Info.plist` doit être présent dans `ios/` (déjà fait).

## 🔧 Configuration supplémentaire requise

### Pour Expo avec dev client :

1. Installez le dev client :
```bash
npx expo install expo-dev-client
```

2. Rebuild l'app native :
```bash
npx expo prebuild
npm run android  # ou npm run ios
```

### Pour Expo Managed (sans dev client) :

Cette option nécessite de passer en bare workflow ou d'utiliser un dev client.

## 📝 Notes importantes

- Le token FCM est stocké dans le champ `expo_push_token` de Supabase (réutilisation du champ existant)
- Si vous préférez un champ séparé `fcm_token`, il faudra :
  1. Ajouter la colonne dans Supabase
  2. Modifier les requêtes pour utiliser `fcm_token` au lieu de `expo_push_token`

## 🧪 Test

1. Démarrez l'app avec le dev client
2. Vérifiez dans les logs que le token FCM est obtenu : `✅ Token FCM mis à jour`
3. Vérifiez dans Supabase que le token est bien stocké dans `expo_push_token`
4. Testez l'envoi d'un prout - le backend devrait recevoir un token FCM valide

## ⚠️ Dépannage

Si vous obtenez une erreur `Cannot find module '@react-native-firebase/messaging'` :
- Assurez-vous d'avoir fait `npm install`
- Vérifiez que vous utilisez un dev client ou bare workflow
- Rebuild l'app native après l'installation

Si le token FCM est `null` :
- Vérifiez que les permissions de notifications sont accordées
- Vérifiez que `google-services.json` est correctement configuré
- Vérifiez les logs Android : `adb logcat | grep -i firebase`


