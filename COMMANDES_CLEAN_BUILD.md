# 🧹 Commandes Clean Build iOS

## 🚀 Commande rapide (tout en une)

```bash
./clean-build-ios.sh
```

Un script a été créé pour automatiser tout le nettoyage.

---

## 📋 Commandes manuelles (étape par étape)

### 1. Nettoyer le build iOS

```bash
rm -rf ios/build
rm -rf ios/DerivedData
```

### 2. Nettoyer les pods

```bash
cd ios
pod deintegrate 2>/dev/null || true
rm -rf Pods
rm -rf Podfile.lock
cd ..
```

### 3. Nettoyer le cache Xcode

```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/*
```

### 4. Nettoyer le cache Metro/Expo

```bash
rm -rf .expo
rm -rf node_modules/.cache
```

### 5. (Optionnel) Régénérer les assets

Si vous voulez aussi régénérer les assets (icône, splash, etc.) :

```bash
npx expo prebuild --platform ios --clean
```

---

## 🎯 Commande complète en une ligne

```bash
rm -rf ios/build ios/DerivedData ~/Library/Developer/Xcode/DerivedData/* .expo node_modules/.cache && cd ios && pod deintegrate 2>/dev/null || true && rm -rf Pods Podfile.lock && cd .. && echo "✅ Clean terminé !"
```

---

## 📝 Séquence complète avant EAS build

```bash
# 1. Clean build
./clean-build-ios.sh

# 2. Réinstaller les pods (si nécessaire)
cd ios && pod install && cd ..

# 3. Lancer le build EAS
eas build --platform ios --profile production --local
```

---

## ⚠️ Si vous voulez aussi régénérer les assets

```bash
# Clean complet + régénération assets
./clean-build-ios.sh
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..
eas build --platform ios --profile production --local
```

---

## 💡 Explication

- **`ios/build`** : Dossier de build Xcode
- **`ios/DerivedData`** : Données dérivées Xcode
- **`Pods`** : Dépendances CocoaPods
- **`DerivedData/*`** : Cache global Xcode
- **`.expo`** : Cache Expo
- **`node_modules/.cache`** : Cache Metro bundler

---

## ✅ Après le clean

Vous pouvez lancer directement :

```bash
eas build --platform ios --profile production --local
```

Le build EAS réinstallera automatiquement les pods si nécessaire.




