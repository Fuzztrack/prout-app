# 🏗️ Build Local iOS avec Xcode - Guide Complet

## 📋 Prérequis

1. ✅ iPhone branché en USB
2. ✅ Xcode installé (dernière version recommandée)
3. ✅ CocoaPods installé
4. ✅ Compte Apple Developer configuré dans Xcode

---

## 🚀 Étapes de Build Local

### 1. Nettoyer l'environnement

```bash
cd /Users/fuzz/ProutApp

# Nettoyer les anciens builds
rm -rf ios/build
rm -rf node_modules
npm install

# Nettoyer le cache Expo
npx expo start --clear
```

**⚠️ Arrêtez le serveur Expo (Ctrl+C) avant de continuer**

---

### 2. Rebuild les fichiers natifs iOS

```bash
# Rebuild complet des fichiers natifs (nécessaire pour Reanimated)
npx expo prebuild --clean --platform ios
```

Cette commande va :
- Supprimer le dossier `ios/` existant
- Régénérer tous les fichiers natifs iOS
- Intégrer les plugins Expo (y compris Reanimated)

---

### 3. Installer les dépendances CocoaPods

```bash
cd ios
pod install
cd ..
```

⚠️ **Important** : Toujours lancer `pod install` après `prebuild` pour installer les dépendances natives.

---

### 4. Ouvrir le projet dans Xcode

```bash
open ios/Prout.xcworkspace
```

⚠️ **ATTENTION** : Ouvrir le `.xcworkspace` et **PAS** le `.xcodeproj` !

---

### 5. Configurer le projet dans Xcode

#### a) Sélectionner l'iPhone branché

1. En haut de Xcode, cliquez sur le menu déroulant à côté du bouton "Play"
2. Sélectionnez votre iPhone branché (il devrait apparaître dans la liste)

#### b) Configurer le Signing & Capabilities

1. Dans le navigateur de projet (panneau de gauche), cliquez sur **"Prout"** (le projet principal)
2. Sélectionnez la **target "Prout"**
3. Allez dans l'onglet **"Signing & Capabilities"**
4. Cochez **"Automatically manage signing"**
5. Sélectionnez votre **Team** (votre compte Apple Developer)

Si vous voyez des erreurs de certificats :
- Cliquez sur "Add Account..." et connectez-vous avec votre Apple ID
- Sélectionnez votre Team dans le menu déroulant

#### c) Vérifier le Bundle Identifier

Assurez-vous que le Bundle Identifier est `com.prout.app` (comme dans `app.json`)

---

### 6. Builder et déployer sur iPhone

#### Option A : Depuis Xcode (recommandé)

1. Cliquez sur le bouton **▶️ Play** (ou `Cmd + R`)
2. Xcode va :
   - Compiler le projet
   - Installer l'app sur votre iPhone
   - Lancer l'app

**Première fois ?** Sur votre iPhone, allez dans :
- **Réglages** → **Général** → **Gestion des VPN et de l'appareil**
- Cliquez sur votre compte développeur
- Approuvez le certificat de confiance

#### Option B : Depuis le terminal

```bash
xcodebuild -workspace ios/Prout.xcworkspace \
  -scheme Prout \
  -configuration Debug \
  -destination 'platform=iOS,id=DEVICE_ID' \
  build
```

Pour trouver le `DEVICE_ID` :
```bash
xcrun xctrace list devices
```

---

## 🔧 Configuration pour Reanimated

### Vérifier que Reanimated est bien configuré

Le plugin Reanimated devrait être automatiquement ajouté lors du `prebuild`. Vérifiez dans :

1. **Xcode** → Navigateur de projet → `ios/Podfile`
   - Vérifiez que `use_modular_headers!` est présent
   - Les pods Reanimated devraient être installés

2. **Build Settings** dans Xcode :
   - `Other Swift Flags` devrait inclure les flags Reanimated
   - `Swift Language Version` devrait être défini

---

## 🐛 Dépannage

### Erreur : "No code signing certificates found"

**Solution** :
1. Xcode → Preferences → Accounts
2. Ajoutez votre Apple ID
3. Sélectionnez votre Team dans Signing & Capabilities

### Erreur : "Module 'ExpoModulesCore' not found"

**Solution** :
```bash
cd ios
pod install --repo-update
cd ..
```

### Erreur : "Build failed" avec Reanimated

**Solution** :
1. Nettoyer le build :
   ```bash
   cd ios
   rm -rf build
   rm -rf Pods
   rm Podfile.lock
   pod install
   cd ..
   ```

2. Dans Xcode :
   - **Product** → **Clean Build Folder** (`Cmd + Shift + K`)
   - **Product** → **Build** (`Cmd + B`)

### Erreur : "use_modular_headers!" manquant

**Solution** : Vérifiez que le `Podfile` contient :
```ruby
platform :ios, '15.1'
use_modular_headers!
```

### L'app ne se lance pas sur l'iPhone

**Solution** :
1. Sur l'iPhone, allez dans **Réglages** → **Général** → **Gestion des VPN et de l'appareil**
2. Approuvez le certificat de votre compte développeur
3. Réessayez de lancer depuis Xcode

---

## 📱 Après le build

### Lancer Metro Bundler

Une fois l'app installée sur l'iPhone, vous devez lancer Metro pour le JavaScript :

```bash
npx expo start
```

Ou depuis Xcode, l'app va automatiquement se connecter à Metro si vous avez lancé `npx expo start` avant.

### Mode développement

Pour les hot reloads et debug :
- L'app sur iPhone se connecte automatiquement au Metro Bundler
- Les modifications JS sont rechargées automatiquement

---

## ✅ Checklist de build

- [ ] iPhone branché et reconnu par Xcode
- [ ] `npx expo prebuild --clean --platform ios` exécuté
- [ ] `pod install` exécuté dans `ios/`
- [ ] Xcode ouvert avec `Prout.xcworkspace`
- [ ] Team Apple Developer sélectionnée dans Signing
- [ ] iPhone sélectionné comme destination
- [ ] Build réussi (`Cmd + R`)
- [ ] App installée et lancée sur iPhone
- [ ] Metro Bundler lancé (`npx expo start`)

---

## 🔄 Rebuild après modifications natives

Si vous modifiez des plugins Expo ou des configurations natives :

```bash
# 1. Nettoyer
rm -rf ios/build
cd ios && rm -rf Pods Podfile.lock && cd ..

# 2. Rebuild
npx expo prebuild --clean --platform ios
cd ios && pod install && cd ..

# 3. Ouvrir Xcode
open ios/Prout.xcworkspace

# 4. Builder depuis Xcode (Cmd + R)
```

---

## 📝 Notes importantes

- ⚠️ **Premier build** : Peut prendre 5-10 minutes
- ⚠️ **Rebuild après prebuild** : Nécessaire si vous modifiez `app.json` ou ajoutez des plugins
- ⚠️ **Signing** : Besoin d'un compte Apple Developer (gratuit ou payant)
- ✅ **Hot reload** : Fonctionne après le premier build, pas besoin de rebuilder pour le JS

---

## 🎯 Commandes rapides

```bash
# Build complet (à faire une fois)
cd /Users/fuzz/ProutApp
npx expo prebuild --clean --platform ios
cd ios && pod install && cd ..
open ios/Prout.xcworkspace

# Ensuite, builder depuis Xcode (Cmd + R)

# Pour les modifications JS uniquement (pas besoin de rebuild)
npx expo start
```




