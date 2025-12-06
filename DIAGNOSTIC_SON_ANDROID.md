# 🔍 Diagnostic Son Android - Notifications Background

## 🐛 Problème actuel

Android joue le son par défaut ("ding") au lieu du son personnalisé quand l'app est fermée, même si :
- ✅ Le backend envoie `"android": { "channelId": "prout14" }`
- ✅ Les canaux sont créés au démarrage de l'app
- ✅ Les fichiers `.ogg` sont dans `app.json`

## 📋 Vérifications à faire

### 1. Vérifier les logs au démarrage de l'app

Les logs devraient maintenant afficher :
```
🔧 [ANDROID] Début création des canaux de notification...
✅ [ANDROID] Canal créé: prout1 avec son: prout1
✅ [ANDROID] Canal créé: prout2 avec son: prout2
...
🎯 [ANDROID] 20/20 canaux créés avec succès
📋 [ANDROID] Canaux prout trouvés: 20
   - prout1: Prout prout1 (son: prout1)
   - prout2: Prout prout2 (son: prout2)
   ...
```

**Où voir les logs** :
- Dans Metro bundler (terminal où `npx expo start` est lancé)
- Dans React Native Debugger (si activé)
- Via `adb logcat` sur Android : `adb logcat | grep ANDROID`

### 2. Vérifier que les fichiers audio sont dans le build

Les fichiers `.ogg` doivent être inclus dans le build Android dans `res/raw/`.

**Vérification** :
1. Extraire l'APK/AAB
2. Décompresser
3. Vérifier que `res/raw/prout1.ogg` à `res/raw/prout20.ogg` existent

**OU** via commande :
```bash
# Pour un APK
unzip -l app-release.apk | grep "res/raw/prout"
```

### 3. Vérifier le format du son dans les canaux

Actuellement, le code utilise :
- `sound: "prout14"` (sans extension)

**Formats possibles à tester** :
1. ✅ `"prout14"` (sans extension) - Format actuel
2. `"prout14.ogg"` (avec extension .ogg)
3. `"prout14.wav"` (avec extension .wav si Expo convertit)

### 4. Vérifier que les canaux sont bien utilisés

Le backend envoie `"android": { "channelId": "prout14" }`, mais il faut vérifier que :
- Le canal `prout14` existe bien
- Le canal a bien un son configuré
- Le son correspond au fichier dans `res/raw/`

## 🔧 Solutions possibles

### Solution 1 : Vérifier le format du son

Si les canaux sont créés mais le son ne joue pas, essayer avec extension :

```typescript
// Dans lib/notifications.ts, ligne 38
const soundResourceName = `${soundName}.ogg`; // Avec extension .ogg
```

### Solution 2 : Vérifier que les fichiers sont inclus

Si les fichiers ne sont pas dans le build :
1. Vérifier `app.json` : les fichiers `.ogg` doivent être dans `expo-notifications.sounds`
2. Rebuild complet : `eas build --platform android --profile production --local --clear-cache`

### Solution 3 : Utiliser un seul canal avec son dynamique

Si les 20 canaux ne fonctionnent pas, essayer un seul canal par défaut et jouer le son via le handler frontend (mais ça ne marchera pas en background).

### Solution 4 : Vérifier les permissions Android

Certains appareils Android (Xiaomi, Vivo, POCO) ont des problèmes avec les sons personnalisés. Tester sur un autre appareil.

## 📝 Prochaines étapes

1. **Vérifier les logs** : Lancer l'app et vérifier les logs `[ANDROID]`
2. **Vérifier les canaux** : Les logs doivent montrer 20 canaux créés
3. **Vérifier les fichiers** : Vérifier que les `.ogg` sont dans le build
4. **Tester différents formats** : Essayer avec/sans extension selon les résultats

## 🎯 Format attendu

**Backend** :
```json
{
  "android": {
    "channelId": "prout14"
  }
}
```

**Canal Android** :
- ID : `"prout14"`
- Son : `"prout14"` (sans extension) OU `"prout14.ogg"` (avec extension)

**Fichier dans build** :
- `res/raw/prout14.ogg` (fichier source)
- Android cherche par nom sans extension dans `res/raw/`



