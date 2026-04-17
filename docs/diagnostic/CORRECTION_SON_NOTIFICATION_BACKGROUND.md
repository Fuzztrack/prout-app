# 🔊 Correction Son Notification en Background

## 🐛 Problème

Les notifications arrivent bien, mais le son personnalisé ne joue que quand l'app est ouverte, pas quand l'app est fermée (background/killed).

## 🔍 Cause

Quand l'app est fermée, le son doit être spécifié dans le **payload de la notification push** elle-même, pas seulement dans le handler frontend.

- **Quand l'app est ouverte (foreground)** : Le handler frontend joue le son via `notificationAudioPlayer`
- **Quand l'app est fermée (background/killed)** : Le système iOS/Android doit jouer le son depuis le payload de la notification push

## ✅ Corrections effectuées

### 1. Backend iOS (Expo Push Notifications)

**Fichier** : `backend/src/prout/prout.service.ts`

**Avant** :
```typescript
sound: null, // Désactiver le son système pour iOS
```

**Après** :
```typescript
sound: proutKey, // Nom du fichier son sans extension (ex: "prout1")
```

Le son sera maintenant joué automatiquement par iOS quand l'app est fermée.

### 2. Frontend Handler (éviter double son)

**Fichier** : `app/_layout.tsx`

Le handler `setNotificationHandler` est appelé **uniquement quand l'app est en foreground**. 

- **Foreground** : Le handler joue le son via `notificationAudioPlayer` et met `shouldPlaySound: false` pour éviter le double son système
- **Background** : Le système iOS jouera automatiquement le son depuis le payload (maintenant que `sound: proutKey` est dans le payload)

### 3. Backend Android (FCM)

**Fichier** : `backend/src/prout/prout.service.ts`

Le son est déjà correctement configuré :
- ✅ Dans le canal de notification Android (`channelId` avec le son configuré)
- ✅ Dans le payload FCM (`sound: proutKey`)

## 📋 Configuration requise

### Fichiers audio dans `app.json`

Les fichiers audio doivent être configurés dans `app.json` sous `expo-notifications.sounds` :

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "sounds": [
            "./assets/sounds/prout1.ogg",
            "./assets/sounds/prout2.ogg",
            // ... etc
          ]
        }
      ]
    ]
  }
}
```

✅ **Vérifié** : Les 20 fichiers `prout1.ogg` à `prout20.ogg` sont bien configurés.

## 🎯 Comportement attendu

### iOS
- **App ouverte** : Le son joue via `notificationAudioPlayer` (handler frontend)
- **App fermée** : Le son joue automatiquement depuis le payload (`sound: proutKey`)

### Android
- **App ouverte** : Le son joue via `notificationAudioPlayer` (handler frontend)
- **App fermée** : Le son joue automatiquement depuis le canal de notification Android

## ⚠️ Points à vérifier

1. **Build EAS** : Les fichiers audio doivent être inclus dans le build
   - Vérifier que les fichiers `assets/sounds/*.ogg` sont bien dans le bundle
   - Expo convertit automatiquement `.ogg` en `.caf` pour iOS lors du build

2. **Format audio iOS** : 
   - Les fichiers `.ogg` sont automatiquement convertis en `.caf` par Expo
   - Le nom dans le payload (`proutKey` = "prout1") doit correspondre au nom du fichier sans extension

3. **Test** :
   - Tester avec l'app **fermée** (kill l'app complètement)
   - Envoyer une notification depuis un autre appareil
   - Le son devrait jouer automatiquement

## 🚀 Prochaines étapes

1. **Redéployer le backend** avec les corrections
2. **Rebuild iOS et Android** avec EAS pour inclure les fichiers audio
3. **Tester** avec l'app fermée pour vérifier que le son joue

---

## 📝 Notes techniques

- Le handler `setNotificationHandler` est appelé **uniquement en foreground**
- Quand l'app est fermée, iOS/Android joue le son depuis le payload automatiquement
- Le nom du son dans le payload doit être le nom du fichier **sans extension** (ex: "prout1" pas "prout1.ogg")
- Les fichiers audio sont configurés dans `app.json` et inclus automatiquement dans le build par Expo



