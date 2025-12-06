# 🔄 Réinitialisation Canaux Android

## ⚠️ Problème

Les canaux Android ne peuvent **pas être modifiés** une fois créés. Même après suppression avec `deleteNotificationChannelAsync()`, Android peut garder l'ancienne configuration en cache.

## ✅ Solution : Désinstaller complètement l'app

Pour recréer les canaux avec la bonne configuration, il faut désinstaller complètement l'app Android.

### Étape 1 : Désinstaller l'app

```bash
adb uninstall com.fuzztrack.proutapp
```

### Étape 2 : Réinstaller l'app

- Via Expo : Relancer `npx expo run:android`
- Ou via build : Installer le nouveau build

### Étape 3 : Vérifier les logs

Au démarrage, vous devriez voir :
```
🔧 [ANDROID] Début création des canaux de notification...
✅ [ANDROID] Canal créé: prout1 avec son: prout1
...
📋 [ANDROID] Canaux prout trouvés: 20
   - prout1: Prout prout1 (son: prout1)  ← Devrait afficher "prout1" pas "custom"
```

### Étape 4 : Tester

Envoyer une notification et vérifier que le son personnalisé joue quand l'app est fermée.

## 📝 Note importante

Les fichiers `.ogg` fonctionnent très bien sur Android (pas besoin de `.wav`). Le problème vient uniquement des canaux existants créés avec une ancienne configuration.

## 🔍 Vérification avant/après

**Avant** (canaux anciens) :
- Android affiche : `son: custom`
- Son par défaut joue

**Après** (canaux recréés) :
- Android affiche : `son: prout1` (ou nom du fichier)
- Son personnalisé joue



