# 🎨 Correction de l'icône iOS

## 🔍 Problème

L'icône affichée dans le build iOS est l'icône par défaut d'Apple au lieu de l'icône de l'app.

## ✅ Vérifications effectuées

### 1. Configuration dans `app.json` ✅
- ✅ `"icon": "./assets/images/icon.png"` (ligne 7)
- ✅ Chemin correct

### 2. Fichier source ✅
- ✅ `assets/images/icon.png` existe
- ✅ Format : PNG 1024x1024 pixels
- ✅ Format correct pour iOS

### 3. Problème identifié ⚠️

L'icône doit être **régénérée dans le code natif iOS** lors du prebuild. Si le prebuild a été fait avant d'avoir la bonne icône, ou si l'icône n'a pas été correctement copiée, on aura l'icône par défaut.

---

## 🔧 Solution : Régénérer les assets

### Étape 1 : Relancer le prebuild avec --clean

```bash
npx expo prebuild --platform ios --clean
```

Cette commande va :
- ✅ Supprimer le dossier `ios/` existant
- ✅ Régénérer tous les assets natifs
- ✅ Copier la bonne icône dans `ios/Prout/Images.xcassets/AppIcon.appiconset/`

### Étape 2 : Vérifier que l'icône a été copiée

Après le prebuild, vérifiez :

```bash
ls -la ios/Prout/Images.xcassets/AppIcon.appiconset/
```

Vous devriez voir `App-Icon-1024x1024@1x.png` avec la bonne icône.

### Étape 3 : Rebuild dans Xcode

1. Ouvrir `ios/Prout.xcworkspace` dans Xcode
2. Clean Build Folder (`Cmd + Shift + K`)
3. Build (`Cmd + B`)
4. Installer sur l'iPhone

---

## 📋 Spécifications de l'icône iOS

### ✅ Format requis
- **Format** : PNG
- **Dimensions** : 1024x1024 pixels (exactement)
- **Couleur** : RGB (pas de transparence pour l'icône principale)
- **Espace colorimétrique** : sRGB

### ⚠️ Règles strictes d'Apple
- ✅ Pas de transparence (alpha channel)
- ✅ Pas de coins arrondis (Apple les ajoute automatiquement)
- ✅ Pas de texte trop petit
- ✅ Design simple et reconnaissable

---

## 🚀 Commandes complètes

```bash
# 1. Régénérer les assets iOS
npx expo prebuild --platform ios --clean

# 2. Vérifier l'icône
ls -la ios/Prout/Images.xcassets/AppIcon.appiconset/

# 3. Ouvrir dans Xcode
open ios/Prout.xcworkspace

# 4. Dans Xcode : Clean Build Folder (Cmd + Shift + K)
# 5. Dans Xcode : Build (Cmd + B)
```

---

## ✅ Résultat attendu

Après le prebuild et le rebuild :
- ✅ L'icône de l'app sera la bonne
- ✅ Plus d'icône par défaut d'Apple
- ✅ L'icône apparaîtra correctement sur l'iPhone

---

## 💡 Si ça ne fonctionne toujours pas

1. **Vérifier le format de l'icône** :
   ```bash
   file assets/images/icon.png
   # Doit afficher : PNG image data, 1024 x 1024
   ```

2. **Vérifier que l'icône n'a pas de transparence** :
   - Ouvrir dans Preview
   - Vérifier qu'il n'y a pas de zones transparentes

3. **Forcer la régénération** :
   ```bash
   rm -rf ios/
   npx expo prebuild --platform ios
   ```




