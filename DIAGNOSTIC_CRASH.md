# Diagnostic des crashes de l'application

## Android

### 1. Logs en temps réel avec adb logcat

Connectez votre téléphone Android en USB avec le débogage activé, puis :

```bash
# Voir tous les logs
adb logcat

# Filtrer par niveau (Error, Fatal)
adb logcat *:E *:F

# Filtrer les logs de React Native / Expo
adb logcat | grep -E "ReactNative|Expo|ProutApp"

# Voir les crashes récents
adb logcat | grep -i "fatal\|crash\|exception"

# Sauvegarder les logs dans un fichier
adb logcat > crash_logs.txt
```

### 2. Logs spécifiques à l'app

```bash
# Logs de l'app uniquement
adb logcat | grep "com.fuzztrack.proutapp"

# Logs avec stack trace
adb logcat *:E AndroidRuntime:E *:S
```

### 3. Via Android Studio

1. Ouvrez Android Studio
2. Connectez votre appareil
3. Allez dans **View > Tool Windows > Logcat**
4. Filtrez par votre app : `package:com.fuzztrack.proutapp`
5. Les crashes apparaissent en rouge avec des stack traces complètes

## iOS

### 1. Via Xcode

1. Connectez votre iPhone/iPad en USB
2. Ouvrez Xcode
3. Allez dans **Window > Devices and Simulators**
4. Sélectionnez votre appareil
5. Cliquez sur **View Device Logs**
6. Recherchez les crash logs (symbolisés avec une icône de crash)

### 2. Via Console.app (macOS)

1. Ouvrez **Console.app** (Applications > Utilitaires)
2. Dans la barre latérale, sélectionnez votre appareil iOS
3. Recherchez les crash logs de votre app
4. Filtrez par "crash" ou "ProutApp"

### 3. Logs via terminal (simulateur)

```bash
# Logs du simulateur iOS
xcrun simctl spawn booted log stream --level=error

# Logs avec filtrage
xcrun simctl spawn booted log stream --predicate 'processImagePath contains "ProutApp"' --level=error
```

## Expo / React Native (développement)

### 1. Logs Metro Bundler

Quand vous lancez `npm start` ou `expo start`, les logs apparaissent dans le terminal. Les erreurs JavaScript sont visibles directement.

### 2. Logs dans le terminal Expo

```bash
# Démarrer avec logs détaillés
expo start --dev-client

# Les erreurs React Native apparaissent dans le terminal
```

### 3. React Native Debugger

Installez React Native Debugger pour voir les erreurs JavaScript avec des stack traces complètes.

## Points à vérifier en cas de crash

### Erreurs JavaScript communes
- Erreurs de navigation (router pas prêt)
- Erreurs de permissions (contacts, notifications)
- Erreurs de réseau (Supabase, backend)
- Erreurs de mémoire (listes trop grandes)

### Erreurs natives communes
- Permissions manquantes (AndroidManifest.xml, Info.plist)
- Ressources manquantes (images, sons)
- Problèmes de build (proguard, code signing)

### Comment capturer un crash

1. **Reproduire le crash** : Notez les étapes pour reproduire
2. **Capturer les logs** : Utilisez les commandes ci-dessus
3. **Chercher dans les logs** :
   - Recherchez "FATAL", "Exception", "Error"
   - Cherchez la stack trace complète
   - Vérifiez les logs juste avant le crash

## Exemple de recherche dans les logs

```bash
# Android - chercher les dernières erreurs avant crash
adb logcat -t 500 | grep -E "Error|Exception|Fatal" -A 10

# iOS - logs récents avec stack trace
xcrun simctl spawn booted log show --predicate 'processImagePath contains "ProutApp"' --last 5m --style syslog
```

## Astuce : Logs persistants

Pour Android, vous pouvez configurer un script qui sauvegarde automatiquement les logs :

```bash
# Créer un script save_logs.sh
#!/bin/bash
adb logcat -v time > "logs_$(date +%Y%m%d_%H%M%S).txt"
```

## Prochaine étape recommandée

Pour une meilleure visibilité en production, considérez d'ajouter un service de crash reporting comme :
- **Sentry** (recommandé pour React Native)
- **Firebase Crashlytics** (déjà intégré si vous utilisez Firebase)
- **Bugsnag**

Ces services capturent automatiquement les crashes avec des stack traces symbolisées même en production.



