# Reproduire un crash en local avec Expo

## 1. Préparer l'environnement de développement

### Démarrer Expo avec logs détaillés

```bash
# Depuis le dossier du projet
npm start

# Ou avec plus de verbosité
EXPO_DEBUG=true npm start
```

### Options utiles :

- **`--dev-client`** : Utilise le dev client custom (si vous avez un build custom)
- **`--clear`** : Nettoie le cache Metro
- **`--no-dev`** : Mode production (pour tester comme en prod)

```bash
npm start -- --clear
```

## 2. Connecter votre appareil

### Android (USB)

```bash
# Dans un autre terminal, activez adb logcat pour capturer les logs
adb logcat -c  # Nettoie les logs précédents
adb logcat > crash_logs_android.txt

# Ou pour voir en temps réel + sauvegarder
adb logcat | tee crash_logs_android.txt
```

### iOS (USB ou WiFi)

```bash
# Pour le simulateur iOS
xcrun simctl spawn booted log stream --level=debug > crash_logs_ios.txt

# Pour un appareil physique, utilisez Xcode Console ou :
# Console.app > Votre appareil > Logs
```

## 3. Scénario de test pour reproduire le crash

### Étapes à suivre :

1. **Notez exactement ce qui s'est passé en production** :
   - Quelle action avez-vous faite juste avant le crash ?
   - Sur quel écran étiez-vous ?
   - Y avait-il une notification, un prout, une navigation ?

2. **Reproduisez les mêmes actions** :
   - Essayez de faire exactement la même chose
   - Notez les étapes exactes

3. **Quand le crash se produit** :
   - Les logs s'arrêteront dans le terminal Expo
   - Les logs natifs (adb logcat) continueront et montreront la stack trace

## 4. Analyser les logs

### Dans le terminal Expo (JavaScript/React Native)

Cherchez :
- `Error:` ou `Fatal:`
- `Unhandled promise rejection`
- `TypeError`, `ReferenceError`, etc.
- Stack traces complètes

### Dans adb logcat (Android natif)

Cherchez :
- `FATAL EXCEPTION`
- `AndroidRuntime: FATAL`
- `Process: com.fuzztrack.proutapp`
- Stack traces avec `at ...`

### Exemple de recherche dans les logs

```bash
# Android - Chercher les erreurs fatales
cat crash_logs_android.txt | grep -A 50 "FATAL"

# Chercher les erreurs React Native
cat crash_logs_android.txt | grep -i "reactnative\|expo" -A 20

# Chercher les dernières lignes avant le crash
tail -100 crash_logs_android.txt
```

## 5. Mode "production-like" en local

Pour tester comme en production (mais avec logs) :

```bash
# Démarrer en mode production
npm start -- --no-dev

# Mais gardez les logs activés
adb logcat  # Android
```

## 6. Activer le mode debug React Native

Dans votre app, secouez le téléphone ou appuyez sur Cmd+D (iOS) / Cmd+M (Android) et activez :
- **Debug JS Remotely** : Pour voir les erreurs JavaScript dans Chrome DevTools
- **Show Inspector** : Pour inspecter les éléments

## 7. Outils supplémentaires

### React DevTools

```bash
npm install -g react-devtools
react-devtools
```

Cela ouvre un outil pour inspecter l'état React et peut aider à voir où ça plante.

### Redux DevTools (si vous utilisez Redux)

Pour inspecter l'état de l'application.

## 8. Si le crash ne se reproduit pas en dev

Parfois les crashes en production ne se reproduisent pas en dev à cause de :
- Différences de build (proguard, minification)
- Cache différent
- Permissions différentes

Dans ce cas, essayez :

```bash
# Rebuild complet
npx expo prebuild --clean
npx expo run:android  # ou run:ios

# Puis testez avec ce build
```

## 9. Checklist de reproduction

- [ ] App démarrée en mode dev avec `npm start`
- [ ] Logs capturés avec `adb logcat` ou équivalent
- [ ] Actions exactes reproduites (écran, navigation, interaction)
- [ ] Logs analysés après le crash
- [ ] Stack trace complète copiée

## 10. Exemple de commande complète

```bash
# Terminal 1 : Expo
npm start -- --clear

# Terminal 2 : Logs Android
adb logcat -c && adb logcat | tee "crash_$(date +%Y%m%d_%H%M%S).txt"

# Terminal 3 : Logs spécifiques React Native
adb logcat | grep -E "ReactNativeJS|ExpoModulesCore|ProutApp"
```

## Si vous ne pouvez pas reproduire

1. **Activez les logs plus tôt** : Capturez les logs dès le démarrage de l'app
2. **Testez étape par étape** : Reproduisez chaque fonctionnalité séparément
3. **Vérifiez les conditions** : Le crash pourrait dépendre d'un état particulier (beaucoup d'amis, notifications, etc.)
4. **Utilisez un service de crash reporting** : Sentry capture automatiquement même en production



