# 🔄 Migration vers Expo Server SDK complet

## ✅ Modifications effectuées

### 1. **app.json** - Ajout des fichiers `.wav`

Les fichiers `.wav` ont été ajoutés dans la liste `sounds` de `expo-notifications` (en plus des `.ogg` pour compatibilité Android).

**Fichiers ajoutés** :
- `./assets/sounds/prout1.wav` à `./assets/sounds/prout20.wav`

**Raison** : iOS nécessite des fichiers `.wav` pour les sons de notification en background.

### 2. **backend/src/prout/prout.service.ts** - Refactorisation complète

**Changements majeurs** :
- ✅ **Suppression de Firebase** : Plus besoin de Firebase Admin SDK pour les notifications
- ✅ **Expo Server SDK uniquement** : Utilise uniquement `expo-server-sdk` qui gère automatiquement :
  - APNs pour iOS
  - FCM V1 pour Android
- ✅ **Son iOS** : Envoie `sound: "prout1.wav"` dans le payload
- ✅ **Channel Android** : Utilise `channelId: "prout1"` (sans suffixe `-v14`)

**Nouvelle signature** :
```typescript
async sendProut(token: string, senderPseudo: string, proutKey: string)
```

**Format du message** :
```typescript
{
  to: token,
  title: 'PROUT ! 💨',
  body: `${senderPseudo} t'a envoyé : ${proutName}`,
  sound: `${proutKey}.wav`, // iOS
  android: {
    channelId: proutKey, // Android (ex: "prout1")
    icon: './assets/images/icon.png',
    color: '#ebb89b',
    vibrate: [0, 250, 250, 250],
  },
  data: { type: 'prout', proutKey, sender: senderPseudo, proutName }
}
```

### 3. **lib/notifications.ts** - Simplification des canaux Android

**Changements** :
- ✅ Suppression du suffixe `-v14` : Les canaux utilisent maintenant juste le nom du prout (ex: `"prout1"` au lieu de `"prout1-v14"`)
- ✅ Nettoyage des anciens canaux avec suffixe lors de la configuration

**Nouvelle fonction** :
```typescript
export function getChannelIdForSound(soundName: string) {
  return soundName; // Pas de suffixe
}
```

## 🎯 Avantages de cette migration

1. **Simplicité** : Un seul SDK (Expo) au lieu de deux (Expo + Firebase)
2. **Maintenance** : Moins de code, moins de dépendances
3. **iOS** : Support natif des fichiers `.wav` pour les notifications en background
4. **Android** : Canaux simplifiés sans versioning

## ⚠️ Points importants

### Backend
- ✅ Le service utilise maintenant uniquement `Expo.isExpoPushToken()` pour valider les tokens
- ✅ Plus besoin de Firebase Admin SDK pour les notifications (mais peut rester pour d'autres fonctionnalités)
- ✅ Le paramètre est `senderPseudo` dans le service, mais le controller passe `sender` (c'est compatible)

### Frontend
- ✅ Les fichiers `.wav` doivent être inclus dans le build (configurés dans `app.json`)
- ✅ Les canaux Android sont créés sans suffixe (ex: `"prout1"` au lieu de `"prout1-v14"`)

## 🚀 Prochaines étapes obligatoires

1. **Backend** : Déployer le nouveau `prout.service.ts` sur Render
2. **App Mobile** : 
   - Lancer un nouveau build EAS (`eas build --platform ios --profile production --local` et `eas build --platform android --profile production --local`)
   - **IMPORTANT** : Sans ce nouveau build, l'app iOS crashera ou restera muette car elle cherchera des fichiers `proutX.wav` qui ne sont pas encore dans le bundle

## 📝 Notes techniques

- Les fichiers `.wav` sont obligatoires pour iOS en background
- Les fichiers `.ogg` restent pour Android (compatibilité)
- Le `channelId` Android correspond maintenant exactement au `proutKey` (ex: `"prout1"`)
- Expo Server SDK gère automatiquement la conversion des tokens et l'envoi via APNs/FCM



