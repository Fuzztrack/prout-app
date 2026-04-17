# 🚨 DIAGNOSTIC COMPLET : Problème Clavier Samsung/Huawei

**Date** : 21 janvier 2026  
**Statut** : 🔴 **NON RÉSOLU** - Clavier se ferme toujours sur Samsung/Huawei  
**Impact** : Sticky Chat + Barre de Recherche

---

## 📋 FICHIERS CONCERNÉS

### Fichiers modifiés
1. **`/Users/fuzz/ProutApp/components/FriendsList.tsx`** ⚠️ **PRINCIPAL**
   - Lignes clés : 571-577, 688-702, 2200, 2329-2340, 2696, 2880, 3062-3069
   - Détection devices : `isSamsungDevice`, `isHuaweiDevice`, `isProblemAndroidDevice`
   - Gestion focus : `searchInputRef`, `textInputRefs`, refocus logic
   - Scroll/Keyboard : `scrollEnabled`, `keyboardDismissMode`

2. **`/Users/fuzz/ProutApp/components/Onboarding.tsx`**
   - Ligne 189 : `skipButton.top` (20 → 40 → 60 → 80)
   - Ligne 248 : `footer.paddingBottom` (24 → 94)

### Fichiers NON modifiés (mais concernés)
- `app/(tabs)/index.tsx` - Gère le parent, pas de changement
- `app/_layout.tsx` - StatusBar config, pas de changement
- `app.json` - Config Android, pas de changement

---

## 🔍 SYMPTÔMES

### Sticky Chat
- **Samsung** : Clavier s'ouvre → se ferme immédiatement → remonte 0.5s → se referme
- **Huawei** : Même comportement (anciens modèles Android < 29)
- **Pixel/iOS** : ✅ Fonctionne parfaitement

### Barre de Recherche
- **Samsung/Huawei** : Même problème que sticky (clavier se ferme)
- **Pixel/iOS** : ✅ Fonctionne parfaitement

---

## 🛠️ SOLUTIONS TENTÉES (Historique complet)

### ❌ Tentative 1 : KeyboardAvoidingView Android
**Date** : Début 2025  
**Code** :
```tsx
<KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={90}>
  <View style={styles.stickyInputContainer}>
    <TextInput autoFocus />
  </View>
</KeyboardAvoidingView>
```
**Résultat** : Clavier se ferme sur Samsung, fonctionne sur iOS.

---

### ❌ Tentative 2 : Reanimated useAnimatedKeyboard (Thread UI)
**Date** : Décembre 2025  
**Hypothèse** : Re-renders React ferment le clavier.  
**Code** :
```typescript
const keyboard = useAnimatedKeyboard();
const animatedStyle = useAnimatedStyle(() => ({
  paddingBottom: keyboard.height.value > 0 ? 40 : 70,
  marginBottom: keyboard.height.value,
}));

<Animated.View style={[styles.stickyInputContainer, animatedStyle]}>
  <TextInput autoFocus />
</Animated.View>
```
**Résultat** : Clavier se ferme **toujours** sur Samsung.

---

### ❌ Tentative 3 : useMemo pour stabiliser le TextInput
**Date** : Janvier 2026  
**Hypothèse** : Recréation du TextInput lors d'un re-render.  
**Code** :
```typescript
const stickyInnerContent = useMemo(() => {
  if (!activeFriend) return null;
  return (
    <>
      <TextInput
        ref={(ref) => { textInputRefs.current[activeFriend.id] = ref; }}
        autoFocus
        {...oldAndroidInputProps}
      />
    </>
  );
}, [
  activeFriend,
  activeDraft,
  // PAS de keyboardVisible ici !
]);
```
**Résultat** : Clavier se ferme **toujours** sur Samsung.

---

### ❌ Tentative 4 : Ref Proxy (handlePressHeaderRef)
**Date** : Janvier 2026  
**Hypothèse** : Closure de `handlePressHeader` dans `useMemo` provoque des re-renders.  
**Code** :
```typescript
const handlePressHeaderRef = useRef(handlePressHeader);
useEffect(() => {
  handlePressHeaderRef.current = handlePressHeader;
});

// Dans stickyInnerContent :
<TouchableOpacity onPress={() => handlePressHeaderRef.current()}>
  <Ionicons name="close-circle" />
</TouchableOpacity>
```
**Résultat** : Clavier se ferme **toujours** sur Samsung.

---

### ❌ Tentative 5 : Ghost Input (Toujours monté mais caché)
**Date** : Janvier 2026  
**Hypothèse** : Montage/démontage du TextInput tue le clavier.  
**Code** :
```tsx
<Animated.View style={{
  opacity: activeFriend ? 1 : 0,
  zIndex: activeFriend ? 100 : -1,
  pointerEvents: activeFriend ? 'auto' : 'none',
}}>
  {/* TextInput toujours rendu */}
  <TextInput autoFocus={displayFriend.id === expandedFriendId} />
</Animated.View>
```
**Résultat** : **Crash "Oups une erreur est survenue"** (useMemo appelé dans IIFE).  
**Fix partiel** : Retour au montage/démontage normal, mais clavier se ferme toujours.

---

### ❌ Tentative 6 : `oldAndroidInputProps` (Clavier basique)
**Date** : Décembre 2025  
**Hypothèse** : Autocorrect/suggestions ferment le clavier.  
**Code** :
```typescript
const isOldAndroid = Platform.OS === 'android' && Platform.Version < 29;
const oldAndroidInputProps = isOldAndroid ? {
  autoCorrect: false,
  autoComplete: 'off',
  importantForAutofill: 'no',
  spellCheck: false,
  contextMenuHidden: true,
  textContentType: 'none',
  keyboardType: 'visible-password', // Clavier basique sans prédiction
} : {};
```
**Résultat** : Aide sur vieux Android (< 29), **ne résout PAS** Samsung moderne.

---

### ❌ Tentative 7 : `keyboardShouldPersistTaps="always"`
**Date** : Janvier 2026  
**Code** :
```tsx
<FlatList
  keyboardShouldPersistTaps={Platform.OS === 'android' ? "always" : "handled"}
  keyboardDismissMode={Platform.OS === 'ios' ? "interactive" : "on-drag"}
/>
```
**Résultat** : Empêche le clavier de se fermer au tap **dans la FlatList**, mais pas au montage du Sticky.

---

### ❌ Tentative 8 : Focus Manuel Différé (InteractionManager)
**Date** : 21 janvier 2026  
**Code** :
```typescript
useEffect(() => {
  if (!expandedFriendId) return;
  const input = textInputRefs.current[expandedFriendId];
  if (!input) return;

  const triggerFocus = () => input.focus();

  if (Platform.OS === 'android') {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(triggerFocus, 300);
    });
  } else {
    setTimeout(triggerFocus, 50);
  }
}, [expandedFriendId]);
```
**Résultat** : **Boucle infinie** (clavier sort/rentre indéfiniment).

---

### ❌ Tentative 9 : Anti-boucle + Refocus sur keyboardDidHide
**Date** : 21 janvier 2026  
**Code** :
```typescript
const lastFocusAttemptRef = useRef<{ friendId: string | null; at: number }>({ friendId: null, at: 0 });
const keyboardVisibleRef = useRef(false);
const refocusOnHideAttemptedRef = useRef(false);

// Dans keyboardDidHide :
if (
  Platform.OS === 'android' &&
  expandedFriendId &&
  lastStickyOpenAtRef.current &&
  Date.now() - lastStickyOpenAtRef.current < 1200 &&
  !refocusOnHideAttemptedRef.current
) {
  refocusOnHideAttemptedRef.current = true;
  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => input.focus(), 250);
  });
}
```
**Résultat** : Plus de boucle, mais **clavier se ferme toujours**.

---

### ❌ Tentative 10 : Refocus sur onBlur
**Date** : 21 janvier 2026  
**Code** :
```typescript
<TextInput
  onBlur={() => {
    if (Platform.OS !== 'android') return;
    if (!activeFriend || displayFriend.id !== activeFriend.id) return;
    if (
      lastStickyOpenAtRef.current &&
      Date.now() - lastStickyOpenAtRef.current < 1200 &&
      !refocusOnBlurAttemptedRef.current
    ) {
      refocusOnBlurAttemptedRef.current = true;
      InteractionManager.runAfterInteractions(() => {
        setTimeout(() => {
          textInputRefs.current[displayFriend.id]?.focus();
        }, 250);
      });
    }
  }}
/>
```
**Résultat** : **Clavier se ferme toujours**.

---

### ❌ Tentative 11 : Désactiver scroll automatique (Samsung)
**Date** : 21 janvier 2026  
**Code** :
```typescript
const scrollToActiveFriend = (friendId: string, delay = 0) => {
  // Samsung : éviter le scroll programmatique qui casse le focus clavier
  if (isSamsungDevice) return;
  // ... reste du code
};
```
**Résultat** : **Clavier se ferme toujours**.

---

### ❌ Tentative 12 : keyboardDismissMode="none" + scrollEnabled=false (Samsung)
**Date** : 21 janvier 2026  
**Code** :
```tsx
<FlatList
  keyboardDismissMode={
    Platform.OS === 'ios'
      ? "interactive"
      : isSamsungDevice
        ? "none"
        : "on-drag"
  }
  scrollEnabled={!(isSamsungDevice && activeFriend)}
/>
```
**Résultat** : **Clavier se ferme toujours**.

---

### ❌ Tentative 13 : Désactiver transform translateY (Samsung)
**Date** : 21 janvier 2026  
**Code** :
```typescript
const androidAnimatedStyle = useAnimatedStyle(() => {
  if (Platform.OS !== 'android' || !androidKeyboard) return {};
  const isKeyboardOpen = androidKeyboard.height.value > 0;
  // Samsung : éviter les transforms qui déclenchent une perte de focus
  if (isSamsungDevice) {
    return {
      paddingBottom: isKeyboardOpen ? 40 : 70,
    };
  }
  return {
    paddingBottom: isKeyboardOpen ? 40 : 70,
    transform: [{ translateY: isKeyboardOpen ? -androidKeyboard.height.value : 0 }],
  };
});
```
**Résultat** : **Clavier se ferme toujours**.

---

### ❌ Tentative 14 : Ghost Input (Version corrigée)
**Date** : 21 janvier 2026  
**Code** :
```typescript
const lastActiveFriendRef = useRef<any>(null);
if (activeFriend) {
  lastActiveFriendRef.current = activeFriend;
}
const displayFriend = activeFriend || lastActiveFriendRef.current;

// Sticky toujours monté, juste invisible
{(() => {
  const isVisible = !!activeFriend;
  return (
    <Animated.View
      pointerEvents={isVisible ? 'auto' : 'none'}
      style={[
        styles.stickyInputContainer,
        androidAnimatedStyle,
        {
          position: 'absolute',
          left: 0, right: 0, bottom: 0,
          zIndex: isVisible ? 100 : -1,
          opacity: isVisible ? 1 : 0,
          height: isVisible ? undefined : 0,
          overflow: 'hidden',
        }
      ]}
    >
      {stickyInnerContent}
    </Animated.View>
  );
})()}
```
**Résultat** : **Clavier se ferme toujours**.

---

### ❌ Tentative 15 : Focus manuel pour Recherche (même logique)
**Date** : 21 janvier 2026  
**Code** :
```typescript
const searchInputRef = useRef<TextInput | null>(null);
const isProblemAndroidDevice = Platform.OS === 'android' && (isSamsungDevice || isHuaweiDevice || isOldAndroid);

// Focus manuel différé
useEffect(() => {
  if (!isSearchVisible) return;
  const input = searchInputRef.current;
  if (!input) return;

  if (Platform.OS === 'android' && isProblemAndroidDevice) {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => input.focus(), 250);
    });
  } else {
    setTimeout(() => input.focus(), 50);
  }
}, [isSearchVisible, isProblemAndroidDevice]);

// Scroll bloqué pendant recherche
scrollEnabled={
  !(isSamsungDevice && activeFriend) &&
  !(isProblemAndroidDevice && isSearchVisible)
}
```
**Résultat** : **Clavier se ferme toujours** (même problème que sticky).

---

## 📊 ÉTAT ACTUEL DU CODE

### Détection Devices
```typescript
// Ligne 678-702
const isHuaweiDevice = Platform.OS === 'android' && /huawei/i.test(...);
const isSamsungDevice = Platform.OS === 'android' && /samsung/i.test(...);
const isOldAndroid = Platform.OS === 'android' && Platform.Version < 29;
const isProblemAndroidDevice = Platform.OS === 'android' && (isSamsungDevice || isHuaweiDevice || isOldAndroid);
```

### Refs et États
```typescript
// Ligne 676-577
const textInputRefs = useRef<Record<string, TextInput | null>>({});
const searchInputRef = useRef<TextInput | null>(null);
const keyboardVisibleRef = useRef(false);
const lastFocusAttemptRef = useRef<{ friendId: string | null; at: number }>({ friendId: null, at: 0 });
const lastStickyOpenAtRef = useRef<number | null>(null);
const refocusOnHideAttemptedRef = useRef(false);
const refocusOnBlurAttemptedRef = useRef(false);
const lastSearchOpenAtRef = useRef<number | null>(null);
const refocusSearchOnBlurAttemptedRef = useRef(false);
```

### Focus Sticky (Ligne 2759-2785)
```typescript
useEffect(() => {
  if (!expandedFriendId) return;
  if (keyboardVisibleRef.current) return;
  const input = textInputRefs.current[expandedFriendId];
  if (!input) return;

  const now = Date.now();
  if (
    lastFocusAttemptRef.current.friendId === expandedFriendId &&
    now - lastFocusAttemptRef.current.at < 1500
  ) {
    return;
  }
  lastFocusAttemptRef.current = { friendId: expandedFriendId, at: now };

  const triggerFocus = () => input.focus();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  if (Platform.OS === 'android') {
    const task = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(triggerFocus, 300);
    });
    return () => {
      task.cancel?.();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }

  timeoutId = setTimeout(triggerFocus, 50);
  return () => {
    if (timeoutId) clearTimeout(timeoutId);
  };
}, [expandedFriendId]);
```

### Focus Recherche (Ligne 2329-2340)
```typescript
useEffect(() => {
  if (!isSearchVisible) return;
  const input = searchInputRef.current;
  if (!input) return;

  const triggerFocus = () => input.focus();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  if (Platform.OS === 'android' && isProblemAndroidDevice) {
    InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(triggerFocus, 250);
    });
  } else {
    timeoutId = setTimeout(triggerFocus, 50);
  }

  return () => {
    if (timeoutId) clearTimeout(timeoutId);
  };
}, [isSearchVisible, isProblemAndroidDevice]);
```

### FlatList Config (Ligne 3062-3069)
```typescript
<FlatList
  keyboardShouldPersistTaps={Platform.OS === 'android' ? "always" : "handled"}
  keyboardDismissMode={
    Platform.OS === 'ios'
      ? "interactive"
      : isSamsungDevice
        ? "none"
        : "on-drag"
  }
  scrollEnabled={
    !(isSamsungDevice && activeFriend) &&
    !(isProblemAndroidDevice && isSearchVisible)
  }
/>
```

### Android Animated Style (Ligne 2880-2895)
```typescript
const androidAnimatedStyle = useAnimatedStyle(() => {
  if (Platform.OS !== 'android' || !androidKeyboard) return {};
  const isKeyboardOpen = androidKeyboard.height.value > 0;
  // Samsung : éviter les transforms qui déclenchent une perte de focus
  if (isSamsungDevice) {
    return {
      paddingBottom: isKeyboardOpen ? 40 : 70,
    };
  }
  return {
    paddingBottom: isKeyboardOpen ? 40 : 70,
    transform: [{ translateY: isKeyboardOpen ? -androidKeyboard.height.value : 0 }],
  };
});
```

### Scroll Disabled (Ligne 2200)
```typescript
const scrollToActiveFriend = (friendId: string, delay = 0) => {
  // Samsung : éviter le scroll programmatique qui casse le focus clavier
  if (isSamsungDevice) return;
  // ... reste du code
};
```

---

## 🎯 HYPOTHÈSES NON TESTÉES

### A. windowSoftInputMode Android (AndroidManifest.xml)
**Théorie** : Samsung ignore `adjustResize` par défaut.  
**Test** :
```xml
<activity
  android:name=".MainActivity"
  android:windowSoftInputMode="adjustResize|stateAlwaysVisible"
>
```

### B. Focus uniquement après keyboardDidShow
**Théorie** : Ne jamais focus avant que le clavier soit physiquement visible.  
**Test** :
```typescript
useEffect(() => {
  const subShow = Keyboard.addListener('keyboardDidShow', () => {
    if (expandedFriendId && !keyboardVisibleRef.current) {
      setTimeout(() => {
        textInputRefs.current[expandedFriendId]?.focus();
      }, 100);
    }
  });
  return () => subShow.remove();
}, [expandedFriendId]);
```

### C. setNativeProps pour forcer le focus
**Théorie** : Bypass React et forcer directement le focus natif.  
**Test** :
```typescript
import { UIManager } from 'react-native';

const input = textInputRefs.current[expandedFriendId];
if (input) {
  UIManager.focus(input);
}
```

### D. Retirer le sticky de la FlatList (Portal/absolute root)
**Théorie** : Le sticky dans le même arbre que la FlatList cause des conflits de layout.  
**Test** : Utiliser `react-native-portalize` ou `react-native-modal` pour rendre le sticky en dehors.

### E. Désactiver complètement les animations Reanimated sur Samsung
**Théorie** : Toute animation déclenche une perte de focus.  
**Test** :
```typescript
const androidAnimatedStyle = useAnimatedStyle(() => {
  if (isSamsungDevice) return {}; // Pas d'animation du tout
  // ... reste
});
```

### F. InputAccessoryView (iOS-like) pour Android
**Théorie** : Utiliser un composant natif dédié au clavier.  
**Test** : Créer un module natif Android custom.

---

## 📝 NOTES IMPORTANTES

1. **iOS/Pixel** : ✅ **Aucun problème**, tout fonctionne parfaitement
2. **Huawei ancien** (< Android 29) : Même problème que Samsung
3. **Samsung moderne** : Problème persistant malgré 15 tentatives
4. **Ghost Input** : Implémenté mais ne résout pas le problème
5. **Scroll bloqué** : Implémenté mais ne résout pas le problème
6. **Focus différé** : Implémenté mais ne résout pas le problème

---

## 🔴 CONCLUSION

**Le problème est profondément lié à OneUI (Samsung)** qui gère le focus de manière très stricte.  
**Toutes les solutions JS/React ont échoué.**  
**Il faut probablement une solution native Android** (modification du `AndroidManifest.xml` ou module natif custom).

---

**Dernière mise à jour** : 21 janvier 2026  
**Prochaine étape recommandée** : Tester Hypothèse A (windowSoftInputMode) ou Hypothèse C (setNativeProps)
