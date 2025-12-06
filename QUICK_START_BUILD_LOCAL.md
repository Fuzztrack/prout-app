# 🚀 Quick Start - Build Local iOS avec Xcode

## ✅ Prerequisites OK

- ✅ Podfile corrigé avec `use_modular_headers!`
- ✅ `pod install` réussi (108 dépendances installées)
- ✅ Projet prêt pour Xcode

---

## 📱 Étapes Rapides

### 1. Ouvrir Xcode

```bash
open ios/Prout.xcworkspace
```

⚠️ **IMPORTANT** : Ouvrir le `.xcworkspace` et **PAS** le `.xcodeproj` !

### 2. Brancher votre iPhone

1. Connectez votre iPhone en USB
2. Déverrouillez l'iPhone
3. Acceptez "Faire confiance à cet ordinateur" si demandé

### 3. Configurer dans Xcode

#### a) Sélectionner votre iPhone

- En haut de Xcode, dans la barre d'outils
- Menu déroulant à côté du bouton ▶️ Play
- Sélectionnez votre iPhone (il apparaîtra dans la liste)

#### b) Configurer Signing

1. Dans le navigateur de gauche, cliquez sur **"Prout"** (le projet bleu)
2. Sélectionnez la **target "Prout"** sous TARGETS
3. Onglet **"Signing & Capabilities"**
4. Cochez **"Automatically manage signing"**
5. Sélectionnez votre **Team** (votre Apple ID)

Si vous n'avez pas de Team :
- Cliquez sur "Add Account..."
- Connectez-vous avec votre Apple ID
- Sélectionnez votre Team

### 4. Builder et installer

1. Cliquez sur le bouton **▶️ Play** (ou `Cmd + R`)
2. Xcode va :
   - Compiler (première fois : ~5-10 minutes)
   - Installer sur l'iPhone
   - Lancer l'app

### 5. Autoriser sur iPhone (première fois)

Si c'est la première fois, sur votre iPhone :
- **Réglages** → **Général** → **Gestion des VPN et de l'appareil**
- Cliquez sur votre compte développeur
- Appuyez sur **"Faire confiance"**

### 6. Lancer Metro Bundler (pour le JavaScript)

Dans un terminal séparé :

```bash
cd /Users/fuzz/ProutApp
npx expo start
```

L'app sur l'iPhone se connectera automatiquement à Metro pour le hot reload.

---

## ✅ Checklist

- [ ] iPhone branché et reconnu par Xcode
- [ ] Xcode ouvert avec `Prout.xcworkspace`
- [ ] iPhone sélectionné comme destination de build
- [ ] Team Apple Developer sélectionnée dans Signing
- [ ] Build lancé (▶️ Play)
- [ ] App installée sur iPhone
- [ ] Metro Bundler lancé (`npx expo start`)

---

## 🐛 Dépannage Rapide

### "No code signing certificates"
→ Ajoutez votre Apple ID dans Xcode → Preferences → Accounts

### Build échoue avec erreur de certificat
→ Vérifiez que "Automatically manage signing" est coché

### L'app ne se lance pas
→ Sur iPhone : Réglages → Général → Gestion VPN → Faire confiance à votre compte

### Erreurs de compilation
→ Product → Clean Build Folder (`Cmd + Shift + K`)
→ Puis rebuild

---

## 📝 Commandes Utiles

```bash
# Ouvrir Xcode
open ios/Prout.xcworkspace

# Lancer Metro Bundler
npx expo start

# Clean build
cd ios
rm -rf build
cd ..
# Puis rebuild dans Xcode (Cmd + R)
```

---

## 🎉 C'est prêt !

Une fois builder, vous pourrez :
- ✅ Tester le nouveau slider fluide (Reanimated)
- ✅ Vérifier que les tokens iOS fonctionnent (après correction backend)

---

**Guide complet** : Voir `BUILD_LOCAL_XCODE.md` pour plus de détails.

