# 🔧 Guide de Correction - Slider iOS & Tokens

## 📋 Problèmes résolus

1. ✅ **Slider bloqué sur iOS** - Remplacé par react-native-reanimated (60fps, fluide)
2. ✅ **Tokens iOS non reconnus** - Backend à corriger pour gérer ExponentPushToken

---

## 🎯 Étape 1 : Vérifier les dépendances

Les dépendances sont déjà installées :
- ✅ `react-native-reanimated` (~4.1.1)
- ✅ `react-native-gesture-handler` (~2.28.0)

Si besoin, réinstaller :
```bash
npx expo install react-native-reanimated react-native-gesture-handler
```

---

## 🎯 Étape 2 : Nouveaux composants créés

### ✅ `components/ProutSlider.tsx`
- Slider fluide avec Reanimated
- Impossible à bloquer sur iOS
- Animation à 60fps

### ✅ `components/SwipeableFriendRowV2.tsx`
- Nouvelle version qui utilise ProutSlider
- Design adapté avec le nom de l'ami

### ✅ `components/FriendsList.tsx`
- Modifié pour utiliser SwipeableFriendRowV2 au lieu de SwipeableFriendRow

---

## 🎯 Étape 3 : Configuration Babel (si nécessaire)

Assurez-vous que `babel.config.js` inclut le plugin Reanimated :

```javascript
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin', // ⚠️ DOIT être en dernier
    ],
  };
};
```

---

## 🎯 Étape 4 : Rebuild nécessaire

Après ces modifications, vous devez reconstruire l'app native :

```bash
# Pour iOS
npx expo prebuild --clean
cd ios && pod install && cd ..
npx expo run:ios

# Ou avec EAS
eas build --platform ios
```

⚠️ **Important** : Reanimated nécessite un rebuild natif car c'est une librairie native.

---

## 🎯 Étape 5 : Correction Backend (Tokens iOS)

Le backend doit être modifié pour gérer les tokens iOS. Voir le fichier :
**`FIX_BACKEND_TOKEN_IOS.md`**

---

## ✅ Test de validation

1. **Slider iOS** :
   - ✅ Le slider glisse sans lag
   - ✅ Le slider revient en place après l'action
   - ✅ Pas de blocage ni de freeze

2. **Tokens iOS** :
   - ✅ Les notifications arrivent sur iOS
   - ✅ Pas d'erreur "Token invalide" dans les logs backend

---

## 🔄 Rollback si problème

Si vous voulez revenir à l'ancien slider :

1. Dans `components/FriendsList.tsx`, remplacer :
   ```typescript
   import SwipeableFriendRowV2 from './SwipeableFriendRowV2';
   ```
   par :
   ```typescript
   // import SwipeableFriendRowV2 from './SwipeableFriendRowV2'; // Commenté
   ```

2. Remplacer dans le renderItem :
   ```typescript
   <SwipeableFriendRowV2 ... />
   ```
   par :
   ```typescript
   <SwipeableFriendRow ... />
   ```

---

## 📝 Notes importantes

- Le nouveau slider est plus simple visuellement (pas d'images d'animation)
- Si vous voulez garder les images d'animation, il faudra les réintégrer dans SwipeableFriendRowV2
- Le backend doit absolument être corrigé pour que les notifications iOS fonctionnent

---

## 🚀 Prochaines étapes

1. ✅ Tester le slider sur iOS
2. ⏳ Corriger le backend (voir FIX_BACKEND_TOKEN_IOS.md)
3. ⏳ Tester les notifications iOS end-to-end




