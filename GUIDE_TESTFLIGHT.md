# Guide TestFlight - Déploiement iOS

## 📋 Prérequis

1. ✅ Compte Apple Developer (payant, $99/an)
2. ✅ EAS CLI installé (`npm install -g eas-cli`)
3. ✅ Fichier `eas.json` configuré ✅
4. ✅ Bundle ID configuré dans `app.json` : `com.prout.app`

## 🚀 Étapes de déploiement

### 1. Connexion à EAS

```bash
eas login
```

### 2. Lier le projet à EAS (si pas déjà fait)

```bash
eas build:configure
```

### 3. Vérifier la configuration Apple Developer

Assure-toi d'avoir :
- Ton Apple ID configuré dans Xcode
- Ton certificat de distribution dans EAS (créé automatiquement lors du premier build)

### 4. Build iOS pour TestFlight

#### Option A : Build Preview (pour tester rapidement)
```bash
eas build --platform ios --profile preview
```

#### Option B : Build Production (pour TestFlight/App Store)
```bash
eas build --platform ios --profile production
```

### 5. Soumettre à TestFlight

Une fois le build terminé (15-30 minutes), soumets-le à TestFlight :

```bash
eas submit --platform ios --latest
```

Cette commande utilise automatiquement le dernier build iOS disponible.

### 6. Suivre le build

Le build prend environ 15-30 minutes. Tu peux suivre la progression :

- Dans le terminal (URL fournie)
- Sur [expo.dev](https://expo.dev) → ton projet → Builds

### 7. Vérifier sur App Store Connect

1. Va sur [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Connecte-toi avec ton Apple ID Developer
3. Va dans **TestFlight**
4. Tu verras ton build en "Processing" puis "Ready to Test"

### 8. Ajouter des testeurs

Dans TestFlight :
- **Testeurs internes** : Membres de ton équipe Apple Developer
- **Testeurs externes** : Jusqu'à 10,000 testeurs (nécessite une review Apple)

## 📝 Notes importantes

### Version et Build Number

Les numéros de version sont gérés automatiquement par EAS grâce à `"autoIncrement": true`.

Tu peux aussi les définir manuellement dans `app.json` :
```json
{
  "expo": {
    "version": "1.0.0",
    "ios": {
      "buildNumber": "1"
    }
  }
}
```

### Certificats et Provisioning Profiles

EAS gère automatiquement :
- ✅ Certificats de distribution
- ✅ Provisioning profiles
- ✅ Pas besoin de les générer manuellement

### Première soumission

La première fois, Apple peut prendre jusqu'à 24-48h pour vérifier ton app avant qu'elle n'apparaisse dans TestFlight.

## 🔧 Commandes utiles

```bash
# Voir l'historique des builds
eas build:list

# Voir les détails d'un build
eas build:view [BUILD_ID]

# Annuler un build en cours
eas build:cancel [BUILD_ID]

# Télécharger un build
eas build:download [BUILD_ID]
```

## ⚠️ Dépannage

### Erreur de certificat
```bash
# Réinitialiser les certificats
eas credentials
```

### Erreur de Bundle ID
Vérifie que le Bundle ID dans `app.json` correspond à celui d'App Store Connect :
- `app.json` : `"bundleIdentifier": "com.prout.app"`
- App Store Connect : doit être identique

### Build échoue
- Vérifie les logs sur [expo.dev](https://expo.dev)
- Vérifie que tous les plugins sont compatibles
- Vérifie que les assets (icônes, splash) sont correctement configurés

## 📱 Après TestFlight

Une fois validé sur TestFlight, tu peux soumettre à l'App Store :

```bash
eas submit --platform ios --latest
```

Puis va sur App Store Connect pour remplir les métadonnées (description, screenshots, etc.) et soumettre pour review.

