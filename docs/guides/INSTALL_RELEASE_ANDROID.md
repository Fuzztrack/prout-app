# 📱 Installation d'un Build Release Android sur un Appareil

## ✅ Appareil Connecté

Votre appareil Android est connecté : `49281FDJH001B6`

## 📦 Fichier Disponible

Build release trouvé :
- `android/app/build/outputs/apk/release/app-release.apk`

---

## 🚀 Commandes d'Installation

### Option 1 : Installation Directe (APK Release)

```bash
# Installer l'APK release sur l'appareil connecté
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

**Option `-r`** : Remplace l'application si elle existe déjà (reinstall).

### Option 2 : Installation sur un Appareil Spécifique

Si plusieurs appareils sont connectés :

```bash
# Lister les appareils
adb devices

# Installer sur un appareil spécifique
adb -s 49281FDJH001B6 install -r android/app/build/outputs/apk/release/app-release.apk
```

### Option 3 : Désinstaller puis Installer

Pour une installation propre :

```bash
# Désinstaller l'ancienne version
adb uninstall com.fuzztrack.proutapp

# Installer la nouvelle version
adb install android/app/build/outputs/apk/release/app-release.apk
```

---

## 🔧 Commandes Utiles

### Vérifier les Appareils Connectés

```bash
adb devices
```

### Installer avec Options Avancées

```bash
# Forcer l'installation (si erreur de version)
adb install -r -d android/app/build/outputs/apk/release/app-release.apk

# Installer en mode test (bypass Google Play restrictions)
adb install -t -r android/app/build/outputs/apk/release/app-release.apk
```

**Options disponibles** :
- `-r` : Remplacer l'application existante
- `-d` : Permettre les downgrades (version inférieure)
- `-t` : Permettre l'installation de packages de test
- `-g` : Accorder toutes les permissions au runtime

### Vérifier l'Installation

```bash
# Vérifier que l'app est installée
adb shell pm list packages | grep proutapp

# Lancer l'application
adb shell monkey -p com.fuzztrack.proutapp -c android.intent.category.LAUNCHER 1
```

---

## 📦 Installation depuis un AAB (App Bundle)

Si vous avez un fichier `.aab` au lieu d'un `.apk` :

### 1. Générer un APK depuis l'AAB (optionnel)

```bash
# Utiliser bundletool (si installé)
bundletool build-apks \
  --bundle=android/app/build/outputs/bundle/release/app-release.aab \
  --output=app-release.apks \
  --mode=universal

# Extraire l'APK
unzip app-release.apks -d extracted/
adb install extracted/universal.apk
```

### 2. Installer directement via Google Play Console

Les fichiers `.aab` sont uploadés sur Google Play Console et distribués via le Play Store ou TestFlight interne.

---

## 🔄 Workflow Complet

### Build + Install en une Ligne

```bash
# Build release local
cd android && ./gradlew assembleRelease && cd ..

# Installer sur l'appareil
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

### Build EAS + Install

```bash
# 1. Build avec EAS
eas build --platform android --profile production

# 2. Télécharger l'APK depuis EAS dashboard
# 3. Installer
adb install -r ~/Downloads/app-release.apk
```

---

## ⚠️ Problèmes Courants

### Erreur : "INSTALL_FAILED_UPDATE_INCOMPATIBLE"

```bash
# Solution : Désinstaller d'abord
adb uninstall com.fuzztrack.proutapp
adb install android/app/build/outputs/apk/release/app-release.apk
```

### Erreur : "INSTALL_FAILED_VERSION_DOWNGRADE"

```bash
# Solution : Utiliser l'option -d (downgrade)
adb install -r -d android/app/build/outputs/apk/release/app-release.apk
```

### Erreur : Appareil Non Autorisé

```bash
# Vérifier l'autorisation USB debugging
# Sur l'appareil : Autoriser le débogage USB quand demandé
```

### Erreur : "Device Offline"

```bash
# Redémarrer le serveur ADB
adb kill-server
adb start-server
adb devices
```

---

## 📋 Commande Rapide (Recommandée)

Pour installer le build release actuel :

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

---

## 🎯 Commandes pour ce Projet

### Installer le Build Release Actuel

```bash
cd /Users/fuzz/ProutApp
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

### Vérifier et Lancer

```bash
# Vérifier l'installation
adb shell pm list packages | grep proutapp

# Lancer l'app
adb shell monkey -p com.fuzztrack.proutapp -c android.intent.category.LAUNCHER 1
```

---

**Note** : Assurez-vous que l'appareil Android a le **débogage USB activé** et que vous avez autorisé l'ordinateur à déboguer.

**Appareil actuel** : `49281FDJH001B6` ✅ Connecté

