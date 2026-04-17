# Guide de Configuration FCM - Étape par Étape

## ✅ État Actuel

- ✅ `@react-native-firebase/messaging` dans package.json
- ✅ Code FCM créé (`lib/fcmToken.ts`)
- ✅ Code intégré dans `app/(tabs)/index.tsx`
- ✅ Backend déployé sur Render : `https://prout-backend.onrender.com`
- ✅ URL backend configurée dans `lib/sendProutBackend.ts`

## 📋 Étapes de Configuration

### Étape 1 : Installer les Dépendances

```bash
cd /Users/fuzz/ProutAppavecNest
npm install
```

### Étape 2 : Vérifier google-services.json

Assurez-vous que `google-services.json` est présent dans :
- `android/app/google-services.json` ✅ (déjà fait)

### Étape 3 : Installer expo-dev-client (si pas déjà fait)

```bash
npx expo install expo-dev-client
```

### Étape 4 : Générer les Fichiers Natifs Android

```bash
npx expo prebuild --platform android --clean
```

Cette commande va :
- Générer les fichiers natifs Android
- Intégrer Firebase
- Configurer les canaux de notification

### Étape 5 : Rebuild l'App

```bash
npm run android
```

Ou si vous utilisez un device physique :
```bash
npx expo run:android
```

## 🧪 Test

### 1. Vérifier les Logs

Une fois l'app lancée, vérifiez dans les logs :
- `✅ Token FCM mis à jour` = Token obtenu avec succès
- `⚠️ @react-native-firebase/messaging non installé` = Problème d'installation

### 2. Vérifier dans Supabase

Allez dans Supabase → `user_profiles` et vérifiez que :
- Le champ `expo_push_token` contient un token FCM (commence par une longue chaîne aléatoire)
- Le token est bien stocké pour votre utilisateur

### 3. Tester l'Envoi de Prout

1. **Sur l'app A** : Envoyez un prout à un ami
2. **Sur l'app B** (destinataire) :
   - Fermez l'app complètement
   - Attendez la notification
   - Vérifiez que le bon son est joué

## 🐛 Dépannage

### Erreur : "Cannot find module '@react-native-firebase/messaging'"

**Solution** :
```bash
npm install @react-native-firebase/messaging
npx expo prebuild --platform android --clean
npm run android
```

### Erreur : "Firebase not initialized"

**Solution** :
- Vérifiez que `google-services.json` est dans `android/app/`
- Faites un `prebuild --clean` pour régénérer les fichiers

### Le token FCM est null

**Vérifications** :
1. Les permissions de notifications sont accordées
2. `google-services.json` est correctement configuré
3. L'app est rebuild avec `expo prebuild`

### Les sons ne fonctionnent pas

**Vérifications** :
1. Les fichiers `.ogg` sont dans `android/app/src/main/res/raw/`
2. `notification_channels.xml` existe dans `android/app/src/main/res/xml/`
3. Supprimez et réinstallez l'app pour réinitialiser les channels

## 📝 Checklist

- [ ] `npm install` exécuté
- [ ] `npx expo prebuild --platform android --clean` exécuté
- [ ] `npm run android` exécuté
- [ ] App lancée avec dev client
- [ ] Logs montrent `✅ Token FCM mis à jour`
- [ ] Token visible dans Supabase
- [ ] Test d'envoi de prout réussi
- [ ] Sons différents fonctionnent

## 🎯 Objectif Final

Envoyer un prout depuis l'app A → Notification reçue sur l'app B (fermée) → Son correspondant joué ✅


