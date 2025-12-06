# Build Release Local avec npx

## Build APK de Release Android

### Commande principale :

```bash
npx expo run:android --variant release
```

Cette commande va :
1. Générer les fichiers natifs Android (si nécessaire)
2. Compiler l'app en mode release
3. Créer un APK signé dans `android/app/build/outputs/apk/release/`

## Étapes détaillées

### 1. Nettoyer le build précédent (optionnel mais recommandé)

```bash
cd android
./gradlew clean
cd ..
```

### 2. Build de release

```bash
npx expo run:android --variant release
```

### 3. Localiser l'APK généré

L'APK sera créé dans :
```
android/app/build/outputs/apk/release/app-release.apk
```

## Alternative : Build AAB (Android App Bundle)

Pour créer un AAB (nécessaire pour Google Play Store) :

```bash
cd android
./gradlew bundleRelease
cd ..
```

L'AAB sera créé dans :
```
android/app/build/outputs/bundle/release/app-release.aab
```

## Notes importantes

- ⚠️ **Signature** : Le build de release nécessite une clé de signature. Si c'est la première fois, Gradle va créer une clé de debug automatiquement (pas sécurisée pour production).
- Pour un vrai build de production, vous devez configurer une keystore de release dans `android/app/build.gradle`
- Le build peut prendre 5-15 minutes selon votre machine

## Vérifier la signature

```bash
cd android
./gradlew signingReport
cd ..
```

## Installer l'APK sur un device

```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```


