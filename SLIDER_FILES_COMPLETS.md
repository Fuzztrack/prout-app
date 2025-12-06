# 📁 Fichiers nécessaires pour le Slider - Prêts à copier

## 🎯 Composant principal du Slider

### 1. `components/FriendsList.tsx`
Le composant complet avec le slider SwipeableFriendRow.

---

## 📦 Fichiers de dépendances nécessaires

### 2. `lib/normalizePhone.ts`
Fonction pour normaliser les numéros de téléphone.

### 3. `lib/sendProutBackend.ts`
Fonction pour envoyer les prouts via le backend.

### 4. `lib/supabase.ts`
Configuration Supabase (déjà présent, mais nécessaire).

---

## 🖼️ Assets images nécessaires

Placez ces fichiers dans `assets/images/` :

- ✅ `animprout1.png` - Image d'animation 1 (début du swipe)
- ✅ `animprout2.png` - Image d'animation 2 (milieu du swipe)
- ✅ `animprout3.png` - Image d'animation 3 (fin du swipe)
- ✅ `animprout4.png` - Image finale après l'envoi

---

## 🔊 Assets sons nécessaires

Placez ces fichiers dans `assets/sounds/` :

- ✅ `prout1.ogg` à `prout20.ogg` (20 fichiers sonores)

---

## 📋 Dépendances npm nécessaires

Assurez-vous d'avoir ces packages installés dans `package.json` :

```json
{
  "dependencies": {
    "@expo/vector-icons": "^15.0.3",
    "@react-native-async-storage/async-storage": "^2.2.0",
    "expo-audio": "~1.0.15",
    "expo-contacts": "~15.0.10",
    "@supabase/supabase-js": "^2.81.1",
    "react": "19.1.0",
    "react-native": "0.81.5"
  }
}
```

---

## 🐛 Problèmes connus et solutions

### Problème : Slider bloqué sur iOS, ne revient pas en place

**Cause probable :** 
- Animation non terminée
- PanResponder qui bloque
- État non réinitialisé

**Solution :** Voir les corrections dans les fichiers ci-dessous.

---

## 📝 Structure du slider

Le slider utilise :
- `PanResponder` pour détecter les gestes
- `Animated.Value` pour l'animation
- `Animated.spring` pour le retour élastique
- Images d'animation qui changent selon la distance du swipe
- Seuil de déclenchement : `SWIPE_THRESHOLD = 150`

---

## 🎨 Configuration du slider

```typescript
const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 150; // Seuil pour déclencher l'action
const maxSwipe = SCREEN_WIDTH * 0.7; // Maximum 70% de l'écran
```

---

## ⚙️ Prochaines étapes

1. Copier tous les fichiers listés ci-dessus
2. Vérifier que tous les assets sont présents
3. Vérifier les dépendances npm
4. Tester sur iOS et corriger le problème de blocage




