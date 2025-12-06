# Génération Automatique des Assets Android

## Configuration

Les splash screens et icônes sont maintenant générés automatiquement à partir de vos images sources lors du build.

### Images Sources

- **Icône de l'app** : `assets/images/icon.png`
  - Génère automatiquement les icônes dans `android/app/src/main/res/mipmap-*`
  - Configuré dans `app.json` → `"icon": "./assets/images/icon.png"`

- **Icône adaptative Android** : `assets/images/adaptive_icon.png`
  - Génère l'icône adaptative dans `android/app/src/main/res/mipmap-*`
  - Configuré dans `app.json` → `android.adaptiveIcon.foregroundImage`
  - Utilisée aussi pour le splash screen

- **Splash Screen** : `assets/images/adaptive_icon.png`
  - Génère automatiquement les splash screens dans `android/app/src/main/res/drawable-*`
  - Configuré dans `app.json` → plugin `expo-splash-screen`

## Génération Automatique

Les ressources sont générées automatiquement lors de :

1. **Build avec Expo CLI** :
   ```bash
   npx expo run:android
   ```

2. **Prebuild manuel** :
   ```bash
   npm run regenerate-assets
   # ou
   npx expo prebuild --platform android --clean
   ```

3. **Build release avec Gradle** :
   ```bash
   cd android && ./gradlew assembleRelease
   ```
   (Les ressources doivent être générées avant avec `prebuild`)

## Structure Générée

Après génération, vous trouverez :

```
android/app/src/main/res/
├── drawable-*/          # Splash screens (générés depuis adaptive_icon.png)
│   └── splashscreen_logo.png
└── mipmap-*/            # Icônes (générées depuis icon.png et adaptive_icon.png)
    ├── ic_launcher.webp
    ├── ic_launcher_foreground.webp
    └── ic_launcher_round.webp
```

## Notes Importantes

- ⚠️ **Modifier les images sources** : Si vous modifiez `icon.png` ou `adaptive_icon.png`, vous devez régénérer les ressources avec `npm run regenerate-assets`
- ✅ **Format recommandé** : PNG avec fond transparent pour `icon.png` et `adaptive_icon.png`
- 🎨 **Couleur de fond** : Le splash screen utilise la couleur `#ebb89b` définie dans `app.json`
- 🔄 **Nettoyage** : Utilisez `--clean` pour forcer la régénération complète



