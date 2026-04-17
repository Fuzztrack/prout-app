# 🔄 Instructions : Reset App Android pour Recréer les Canaux

## 🐛 Problème

Les canaux Android affichent `(son: custom)` au lieu du nom du fichier, ce qui signifie qu'Android ne trouve pas les fichiers audio, même si :
- ✅ Les canaux sont créés avec `sound: "prout1"`
- ✅ Les fichiers `.ogg` sont dans l'APK (`res/raw/prout1.ogg`)
- ✅ Les canaux sont supprimés et recréés

**Cause** : Les canaux Android ne peuvent **pas être modifiés** une fois créés. Même après suppression, Android garde parfois l'ancienne configuration en cache.

## ✅ Solution : Désinstaller complètement l'app

### Option 1 : Script automatique

J'ai créé un script pour vous :

```bash
./reset-android-app.sh
```

### Option 2 : Commande manuelle

```bash
adb uninstall com.fuzztrack.proutapp
```

### Option 3 : Via l'appareil Android

1. Aller dans **Paramètres** > **Applications**
2. Trouver **Prout**
3. Cliquer sur **Désinstaller**

## 📱 Après désinstallation

1. **Réinstaller l'app** :
   - Via Expo : Relancer `npx expo run:android`
   - Ou installer un nouveau build

2. **Vérifier les logs** au démarrage :
   ```
   🔧 [ANDROID] Début création des canaux de notification...
   ✅ [ANDROID] Canal créé: prout1 avec son: prout1
   ...
   📋 [ANDROID] Canaux prout trouvés: 20
      - prout1: Prout prout1 (son: prout1)  ← Devrait afficher "prout1" pas "custom"
   ```

3. **Tester** : Envoyer une notification et vérifier que le son personnalisé joue

## ⚠️ Important

- **Les fichiers `.ogg` fonctionnent très bien sur Android** (pas besoin de `.wav`)
- Le problème vient uniquement des canaux existants avec une ancienne configuration
- Après désinstallation, les canaux seront recréés avec la bonne configuration

## 🔍 Vérification

**Avant désinstallation** :
- Android affiche : `(son: custom)`
- Son par défaut joue

**Après désinstallation/réinstallation** :
- Android devrait afficher : `(son: prout1)` ou le nom du fichier
- Son personnalisé devrait jouer



