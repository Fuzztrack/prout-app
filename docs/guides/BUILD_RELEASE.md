# Guide de Build Release

## Prérequis

1. Installer EAS CLI (si pas déjà fait) :
```bash
npm install -g eas-cli
```

2. Se connecter à Expo :
```bash
eas login
```

3. Lier le projet (si pas déjà fait) :
```bash
eas build:configure
```

## Build Android Release

### Option 1 : APK (pour tester directement)

```bash
eas build --platform android --profile preview
```

### Option 2 : AAB (pour Google Play Store)

```bash
eas build --platform android --profile production
```

## Build iOS Release

```bash
eas build --platform ios --profile production
```

## Build pour les deux plateformes

```bash
eas build --platform all --profile production
```

## Vérifier le statut du build

```bash
eas build:list
```

## Télécharger le build

Une fois le build terminé, vous recevrez un lien pour télécharger le fichier.

## Notes importantes

- Le build peut prendre 10-30 minutes
- Vous devez être connecté à Expo
- Pour Android, le build production crée un AAB (Android App Bundle) pour Google Play
- Pour Android, le build preview crée un APK pour tester directement


