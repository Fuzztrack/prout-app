# ✅ Correction - Conflit Firebase iOS (use_modular_headers)

## 🔍 Problème

Lors de `npx expo prebuild --clean`, erreur lors de `pod install` :

```
The Swift pod `FirebaseCoreInternal` depends upon `GoogleUtilities`, which does not define modules.
```

Firebase nécessite des "modular headers" qui ne sont pas activés par défaut.

## ✅ Solution appliquée

### 1. Plugin installé ✅

`expo-build-properties` était déjà installé dans `package.json`.

### 2. Configuration ajoutée dans `app.json` ✅

Configuration ajoutée dans la section `plugins` :

```json
[
  "expo-build-properties",
  {
    "ios": {
      "useFrameworks": "static"
    }
  }
]
```

Cette configuration :
- Active les frameworks statiques pour iOS
- Active automatiquement les modular headers nécessaires pour Firebase
- Résout le conflit entre Swift et Objective-C

---

## 🚀 Prochaines étapes

### Relancer le prebuild

```bash
npx expo prebuild --clean
```

Cette fois, `pod install` devrait fonctionner sans erreur.

### Si ça fonctionne

Ensuite, vous pouvez :
1. Ouvrir le projet dans Xcode : `open ios/Prout.xcworkspace`
2. Build pour votre iPhone branché

---

## 📋 Résumé

- ✅ `expo-build-properties` installé
- ✅ Configuration iOS ajoutée dans `app.json`
- ⏳ À faire : Relancer `npx expo prebuild --clean`

---

## 💡 Explication

Le plugin `expo-build-properties` permet de configurer les propriétés natives iOS/Android directement depuis `app.json`, sans avoir à modifier manuellement le `Podfile` (qui est régénéré à chaque prebuild).

La configuration `"useFrameworks": "static"` active les frameworks statiques, ce qui permet à Firebase (qui utilise du code Objective-C) de fonctionner correctement avec Swift.

