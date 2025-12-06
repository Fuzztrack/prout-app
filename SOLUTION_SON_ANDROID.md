# 🔧 Solution Son Android - Notifications Background

## 🐛 Problème actuel

Android joue le son par défaut ("ding") au lieu du son personnalisé quand l'app est fermée, même si :
- ✅ Les fichiers `.ogg` sont dans l'APK (`res/raw/prout1.ogg`)
- ✅ Les canaux sont créés avec `sound: "prout1"`
- ✅ Les logs montrent que les canaux sont créés

## 🔍 Diagnostic

Les logs montrent :
```
✅ [ANDROID] Canal créé: prout1 avec son: prout1
📋 [ANDROID] Canaux prout trouvés: 20
   - prout1: Prout prout1 (son: custom)  ← ⚠️ Devrait afficher "prout1" pas "custom"
```

Le fait qu'Android affiche "custom" au lieu du nom du fichier signifie qu'Android ne trouve pas le fichier audio correspondant.

## ✅ Solutions possibles

### Solution 1 : Désinstaller complètement l'app (RECOMMANDÉ)

**Problème** : Les canaux Android ne peuvent pas être modifiés une fois créés. Même après suppression avec `deleteNotificationChannelAsync()`, Android peut garder l'ancienne configuration en cache.

**Solution** :
1. Désinstaller complètement l'app Android : `adb uninstall com.fuzztrack.proutapp`
2. Réinstaller l'app
3. Les canaux seront créés avec la bonne configuration

**Commande** :
```bash
adb uninstall com.fuzztrack.proutapp
# Puis réinstaller via Expo ou rebuild
```

### Solution 2 : Vérifier le format du nom

Les fichiers dans l'APK sont : `res/raw/prout1.ogg`

Le canal utilise : `sound: "prout1"` (sans extension)

**Formats à tester** :
1. ✅ `"prout1"` (sans extension) - Format actuel
2. `"prout1.ogg"` (avec extension .ogg)
3. `"prout1.wav"` (avec extension .wav si Expo convertit)

### Solution 3 : Utiliser .wav au lieu de .ogg

Android peut préférer `.wav` pour les notifications. Vérifier si les fichiers `.wav` sont inclus dans le build.

**Si les .wav ne sont pas dans le build** :
- Les fichiers `.wav` sont dans `app.json` mais peut-être pas inclus dans le build debug
- Rebuild avec `eas build` pour inclure les `.wav`

### Solution 4 : Vérifier les permissions Android

Certains appareils Android (Xiaomi, Vivo, POCO) ont des problèmes avec les sons personnalisés. Tester sur un autre appareil.

## 🎯 Action immédiate recommandée

1. **Désinstaller complètement l'app** :
   ```bash
   adb uninstall com.fuzztrack.proutapp
   ```

2. **Réinstaller l'app** (via Expo ou rebuild)

3. **Vérifier les logs** : Les canaux devraient être créés avec le bon son

4. **Tester** : Envoyer une notification et vérifier que le son personnalisé joue

## 📝 Format attendu

**Fichiers dans APK** :
- `res/raw/prout1.ogg`
- `res/raw/prout2.ogg`
- etc.

**Configuration canal** :
```typescript
{
  sound: "prout1"  // Nom sans extension, correspond à prout1.ogg dans res/raw/
}
```

**Backend** :
```json
{
  "android": {
    "channelId": "prout1"
  }
}
```

## ⚠️ Notes importantes

1. **Canaux Android immutables** : Une fois créés, les canaux ne peuvent pas être modifiés. Il faut désinstaller l'app pour les recréer.

2. **Format debug vs release** : 
   - Debug : fichiers `prout1.ogg` (sans préfixe)
   - Release : fichiers `assets_sounds_prout1.ogg` (avec préfixe)
   - Le code actuel utilise le format debug

3. **Build production** : Pour la production, il faudra peut-être utiliser `assets_sounds_prout1` au lieu de `prout1`.



