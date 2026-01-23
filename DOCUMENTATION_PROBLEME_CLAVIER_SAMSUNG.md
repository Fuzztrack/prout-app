# Documentation : Problème Clavier Samsung qui se ferme automatiquement

## 📋 Résumé du Problème

Sur les appareils Samsung (et Huawei), le clavier se ferme automatiquement immédiatement après l'ouverture de la barre de recherche, malgré tous les correctifs appliqués.

**Symptômes observés dans les logs :**
```
LOG  🟢 [SEARCH INPUT] onFocus triggered
LOG  🟡 [SEARCH INPUT] onBlur triggered
LOG  🟢 [SEARCH INPUT] onFocus triggered
LOG  🟡 [SEARCH INPUT] onBlur triggered
```

**Cycle infini** : Le clavier s'ouvre (`onFocus`), puis se ferme immédiatement (`onBlur`), puis se rouvre, etc.

---

## 🔧 Solutions Tentées

### 1. **Stabilisation des Props** ✅ (Partiellement efficace)
- **Problème** : `oldAndroidInputProps` était recréé à chaque render, cassant la mémoïsation de `SearchBar`
- **Solution** : Déplacement des constantes de détection d'appareils **en dehors** du composant (module level)
- **Résultat** : Réduction des re-renders inutiles, mais problème persistant

### 2. **Suppression du KeyboardAvoidingView global** ✅
- **Problème** : Conflit entre `KeyboardAvoidingView` dans `index.tsx` et le mode `resize` natif (`app.json`)
- **Solution** : Suppression complète du `KeyboardAvoidingView` global sur Android dans `index.tsx`
- **Résultat** : Amélioration, mais problème persistant

### 3. **Composant Permanent (Ghost SearchBar)** ✅
- **Problème** : Montage/démontage du composant pendant l'animation du clavier
- **Solution** : Le `SearchBar` reste toujours monté, caché par `height: 0` quand inactif
- **Résultat** : Pas d'amélioration significative

### 4. **Stratégie Overlay avec position absolute** ✅
- **Problème** : Changement de layout lors du remplacement Header ↔ SearchBar
- **Solution** : Header toujours présent (opacity 0), SearchBar superposé en `position: absolute`
- **Résultat** : Pas d'amélioration significative

### 5. **Recherche inline dans FlatList (ancienne méthode)** ✅
- **Problème** : Tentative de revenir à l'ancienne logique qui fonctionnait
- **Solution** : Sur Samsung/Huawei, SearchBar intégré dans `ListHeaderComponent` de la `FlatList`
- **Résultat** : Pas d'amélioration significative

### 6. **Refocus automatique sur onBlur** ✅
- **Problème** : Le clavier se ferme, on essaie de le rouvrir automatiquement
- **Solution** : Listener `keyboardDidHide` + refocus dans `onBlur` avec garde-fous
- **Résultat** : Crée une boucle de refocus, mais le clavier se ferme toujours

### 7. **Protection contre les touches interceptées** ✅
- **Problème** : `TouchableWithoutFeedback` du header intercepte les touches
- **Solution** : `pointerEvents="none"` sur le header quand recherche active
- **Résultat** : Pas d'amélioration significative

---

## 📁 Code Actuel (État Final)

### 1. Configuration Android (`app.json`)

```json
{
  "expo": {
    "android": {
      "softwareKeyboardLayoutMode": "resize"
    }
  }
}
```

**Important** : Le mode `resize` natif est activé. Cela signifie qu'Android redimensionne automatiquement la fenêtre quand le clavier s'ouvre. **Ne pas ajouter de `KeyboardAvoidingView` supplémentaire** qui entrerait en conflit.

---

### 2. Détection des Appareils (`components/FriendsList.tsx`)

**⚠️ CRITIQUE : Ces constantes doivent être définies EN DEHORS du composant (module level) pour garantir leur stabilité.**

```typescript
// ==========================================
// DÉTECTION DES APPAREILS (MODULE LEVEL)
// ==========================================
// Ces constantes DOIVENT être définies en dehors du composant pour garantir
// leur stabilité et éviter les re-renders inutiles de SearchBar (memoization)

const huaweiModel = Platform.OS === 'android' 
  ? ((Platform as any).constants?.Model as string) || ''
  : '';

const isHuaweiDevice =
  Platform.OS === 'android' &&
  /huawei/i.test(
    ((Platform as any).constants?.Brand as string) ||
      ((Platform as any).constants?.Manufacturer as string) ||
      ''
  );

const isSamsungDevice =
  Platform.OS === 'android' &&
  /samsung/i.test(
    ((Platform as any).constants?.Brand as string) ||
      ((Platform as any).constants?.Manufacturer as string) ||
      ''
  );

const isPixelDevice =
  Platform.OS === 'android' &&
  /google|pixel/i.test(
    ((Platform as any).constants?.Brand as string) ||
      ((Platform as any).constants?.Manufacturer as string) ||
      ((Platform as any).constants?.Model as string) ||
      ''
  );

const isOldAndroid = Platform.OS === 'android' && Platform.Version < 29;
const isProblemAndroidDevice =
  Platform.OS === 'android' && (isSamsungDevice || isHuaweiDevice || isOldAndroid);

// Props de sécurité pour stabiliser le clavier sur les appareils problématiques
const oldAndroidInputProps = (isOldAndroid || isSamsungDevice || isHuaweiDevice) ? {
  autoCorrect: false,           // Désactive la correction (cause majeure de sauts)
  autoComplete: 'off',          // Désactive les suggestions système
  importantForAutofill: 'no',   // Empêche Android de scanner le champ
  spellCheck: false,            // Désactive le soulignement rouge
  contextMenuHidden: true,      // Empêche le menu copier/coller qui vole le focus
  textContentType: 'none',      // iOS : pas de suggestions
  keyboardType: 'visible-password' // Force un clavier simple (moins de conflits)
} : {};
```

---

### 3. Logique du Container (`components/FriendsList.tsx`)

```typescript
// Rendu différencié pour le conteneur principal
// iOS a besoin de KeyboardAvoidingView pour pousser le contenu
// Android utilise "softwareKeyboardLayoutMode": "resize" natif (app.json), donc pas besoin de KAV ici (sinon conflit)
const Container = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
const containerProps = Platform.OS === 'ios' 
  ? { 
      style: styles.container,
      behavior: 'padding' as const,
      keyboardVerticalOffset: 0,
    }
  : { 
      style: styles.container 
    };
```

**Important** : Sur Android, on utilise une simple `View`, pas de `KeyboardAvoidingView`, car le mode `resize` natif gère déjà tout.

---

### 4. Rendu du Header et SearchBar (`components/FriendsList.tsx`)

```typescript
const useInlineSearch = Platform.OS === 'android' && isProblemAndroidDevice;

const content = (
  <Container {...containerProps}>
    {/* 
      HEADER FIXE (Hors liste)
      Stratégie "Ghost SearchBar" : Le SearchBar est TOUJOURS rendu dans l'arbre,
      mais caché (hauteur 0) quand inactif. 
      Cela garantit que l'instance React et le noeud natif existent déjà quand on focus,
      évitant la perte de focus due au montage tardif pendant l'animation du clavier.
    */}
    <View style={styles.headerOverlayContainer}>
      {/* Header normal : Toujours présent pour conserver la hauteur et éviter les reflows */}
      {isSearchVisible ? (
        <View
          style={[styles.headerOverlayContent, isSearchVisible && !useInlineSearch && styles.headerHidden]}
          pointerEvents={useInlineSearch ? 'auto' : 'none'}
        >
          {headerComponent}
        </View>
      ) : (
        <TouchableWithoutFeedback onPress={handlePressHeader}>
          <View style={styles.headerOverlayContent}>
            {headerComponent}
          </View>
        </TouchableWithoutFeedback>
      )}

      {/* SearchBar superposé (iOS + Android OK) */}
      {!useInlineSearch && (
        <View
          style={[styles.searchOverlay, !isSearchVisible && styles.searchOverlayHidden]}
          pointerEvents={isSearchVisible ? 'auto' : 'none'}
        >
          <SearchBar
            ref={searchInputRef}
            searchQuery={searchQuery}
            onSearchQueryChange={onSearchQueryChange}
            onSearchChange={onSearchChange}
            oldAndroidInputProps={oldAndroidInputProps}
            isSearchVisible={isSearchVisible}
            shouldForceFocus={isProblemAndroidDevice}
          />
        </View>
      )}
    </View>

    <FlatList
      ref={flatListRef}
      data={getVisibleUsers()}
      // ... autres props ...
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
      ListHeaderComponent={
        <View>
          {/* Android problématique : SearchBar intégré dans la liste (ancienne logique stable) */}
          {useInlineSearch && isSearchVisible && (
            <SearchBar
              ref={searchInputRef}
              searchQuery={searchQuery}
              onSearchQueryChange={onSearchQueryChange}
              onSearchChange={onSearchChange}
              oldAndroidInputProps={oldAndroidInputProps}
              isSearchVisible={isSearchVisible}
              shouldForceFocus={isProblemAndroidDevice}
            />
          )}
          <TouchableWithoutFeedback onPress={handlePressHeader}>
            <View>
              {renderRequestsHeader()}
            </View>
          </TouchableWithoutFeedback>
        </View>
      }
      // ... reste de la FlatList ...
    />
  </Container>
);
```

---

### 5. Focus Manuel Différé (`components/FriendsList.tsx`)

```typescript
// Focus manuel différé pour la recherche (Samsung/Huawei)
useEffect(() => {
  if (!isSearchVisible) return;
  if (closingCooldownUntilRef.current && Date.now() < closingCooldownUntilRef.current) return;
  const input = searchInputRef.current;
  if (!input) return;

  // Délai ULTRA-LONG pour Samsung : on attend que TOUT soit stabilisé
  // Samsung OneUI est très lent à finir ses calculs de layout
  const delay = Platform.OS === 'android' && isProblemAndroidDevice ? 800 : Platform.OS === 'android' ? 400 : 50;
  
  const timer = setTimeout(() => {
    if (!isClosingModalRef.current) {
      // Double vérification : on s'assure que l'input existe toujours
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  }, delay);

  return () => clearTimeout(timer);
}, [isSearchVisible, isProblemAndroidDevice]);
```

---

### 6. Composant SearchBar (`components/SearchBar.tsx`)

```typescript
import React, { forwardRef, memo, useRef, useEffect, useImperativeHandle } from 'react';
import { View, TextInput, TouchableOpacity, Keyboard, StyleSheet, Platform, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../lib/i18n';

interface SearchBarProps {
  searchQuery: string;
  onSearchQueryChange?: (text: string) => void;
  onSearchChange?: (visible: boolean) => void;
  oldAndroidInputProps?: TextInputProps;
  isSearchVisible?: boolean;
  shouldForceFocus?: boolean;
}

export const SearchBar = memo(forwardRef<TextInput, SearchBarProps>((props, ref) => {
  const { 
    searchQuery, 
    onSearchQueryChange, 
    onSearchChange,
    oldAndroidInputProps = {},
    isSearchVisible = false,
    shouldForceFocus = false
  } = props;

  // DEBUG: Tracer les changements de props
  const prevProps = useRef<SearchBarProps>(props);
  const inputRef = useRef<TextInput>(null);
  const isClosingRef = useRef(false);
  const lastRefocusAtRef = useRef(0);
  const refocusAttemptsRef = useRef(0);

  useImperativeHandle(ref, () => inputRef.current as TextInput);
  
  useEffect(() => {
    const changedProps = Object.entries(props).reduce((acc, [key, value]) => {
      if (prevProps.current[key as keyof SearchBarProps] !== value) {
        acc[key] = { from: prevProps.current[key as keyof SearchBarProps], to: value };
      }
      return acc;
    }, {} as Record<string, any>);

    if (Object.keys(changedProps).length > 0) {
      console.log('🔍 [SEARCH BAR] Re-rendered due to props change:', Object.keys(changedProps));
    } else {
      console.log('🔍 [SEARCH BAR] Re-rendered but NO props changed (checking ref stability?)');
    }
    prevProps.current = props;
  });
  
  // Listener pour ré-ouvrir le clavier s'il se ferme tout seul (Samsung)
  useEffect(() => {
    if (Platform.OS !== 'android' || !shouldForceFocus) return;
    if (!isSearchVisible) return;

    const subHide = Keyboard.addListener('keyboardDidHide', () => {
      if (isClosingRef.current || !isSearchVisible) return;
      const now = Date.now();
      if (now - lastRefocusAtRef.current < 400) return;
      if (refocusAttemptsRef.current >= 4) return;
      lastRefocusAtRef.current = now;
      refocusAttemptsRef.current += 1;
      setTimeout(() => {
        if (!isClosingRef.current && isSearchVisible) {
          inputRef.current?.focus();
        }
      }, 150);
    });

    return () => subHide.remove();
  }, [isSearchVisible, shouldForceFocus]);

  return (
    <View style={styles.searchContainer}>
      <Ionicons name="search" size={20} color="#604a3e" style={styles.searchIcon} />
      <TextInput
        ref={inputRef}
        style={styles.searchInput}
        placeholder={i18n.t('search_contact_placeholder')}
        placeholderTextColor="#999"
        value={searchQuery}
        onChangeText={onSearchQueryChange}
        returnKeyType="search"
        showSoftInputOnFocus
        disableFullscreenUI={Platform.OS === 'android'}
        onFocus={() => {
          console.log('🟢 [SEARCH INPUT] onFocus triggered');
          refocusAttemptsRef.current = 0;
        }}
        onBlur={() => {
          console.log('🟡 [SEARCH INPUT] onBlur triggered');
          if (!shouldForceFocus || !isSearchVisible || isClosingRef.current) {
            return;
          }
          const now = Date.now();
          if (now - lastRefocusAtRef.current < 400) {
            return;
          }
          if (refocusAttemptsRef.current >= 3) {
            return;
          }
          lastRefocusAtRef.current = now;
          refocusAttemptsRef.current += 1;
          setTimeout(() => {
            if (!isClosingRef.current && isSearchVisible) {
              inputRef.current?.focus();
            }
          }, 120);
        }}
        {...oldAndroidInputProps}
      />
      <TouchableOpacity
        onPress={() => {
          if (searchQuery.trim()) {
            onSearchQueryChange?.('');
          } else {
            console.log('🔴 [KEYBOARD] dismiss() - SearchBar: close button pressed');
            isClosingRef.current = true;
            onSearchChange?.(false);
            Keyboard.dismiss();
            setTimeout(() => {
              isClosingRef.current = false;
              refocusAttemptsRef.current = 0;
            }, 400);
          }
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close-circle" size={22} color="#604a3e" />
      </TouchableOpacity>
    </View>
  );
}));

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 10,
    height: 40,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#604a3e',
    height: '100%',
  },
});
```

---

### 7. Gestion de la Recherche dans `index.tsx` (`app/(tabs)/index.tsx`)

```typescript
const toggleSearchVisibility = useCallback(() => {
  if (isSearchVisible) {
    setIsSearchVisible(false);
    setSearchQuery('');
    Keyboard.dismiss();
  } else {
    setIsSearchVisible(true);
  }
}, [isSearchVisible]);

// ... dans le JSX ...
<AppHeader
  // ... autres props ...
  onSearchToggle={toggleSearchVisibility}
/>
```

**Important** : La croix dans le header ferme toujours la recherche + ferme le clavier explicitement.

---

### 8. Styles (`components/FriendsList.tsx`)

```typescript
const styles = StyleSheet.create({
  // ... autres styles ...
  headerOverlayContainer: {
    position: 'relative',
    zIndex: 10,
  },
  headerOverlayContent: {
    zIndex: 10,
  },
  headerHidden: {
    opacity: 0,
  },
  searchOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
  },
  searchOverlayHidden: {
    opacity: 0,
    pointerEvents: 'none',
  },
  // ... autres styles ...
});
```

---

## 🔍 Analyse du Problème

### Causes Probables Identifiées

1. **Re-renders pendant l'animation du clavier**
   - Même avec `React.memo`, quelque chose déclenche des re-renders
   - Les logs montrent `Re-rendered but NO props changed`, ce qui suggère un re-render du parent

2. **Conflit entre le mode `resize` natif et React Native**
   - Android redimensionne la fenêtre nativement
   - React Native essaie peut-être de gérer le layout en parallèle
   - Résultat : le TextInput perd le focus pendant le redimensionnement

3. **Comportement spécifique Samsung OneUI**
   - Samsung a sa propre couche UI (OneUI) qui peut intercepter les événements clavier
   - Le système peut considérer que le TextInput n'est plus "visible" pendant le resize

4. **Timing du focus**
   - Le focus est donné trop tôt (avant que le layout soit stabilisé)
   - Ou trop tard (le système a déjà décidé de fermer le clavier)

---

## 💡 Pistes de Solution Non Testées

### 1. **Utiliser `InteractionManager` pour différer le focus**

```typescript
useEffect(() => {
  if (!isSearchVisible) return;
  
  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  });
}, [isSearchVisible]);
```

### 2. **Forcer le focus via UIManager (API native)**

```typescript
import { UIManager } from 'react-native';

// Dans SearchBar, après le montage
useEffect(() => {
  if (Platform.OS === 'android' && isSearchVisible && shouldForceFocus) {
    const reactTag = inputRef.current?._nativeNode;
    if (reactTag) {
      UIManager.dispatchViewManagerCommand(reactTag, 'requestFocus', []);
    }
  }
}, [isSearchVisible]);
```

**⚠️ Attention** : `_nativeNode` est une API privée, peut casser entre versions.

### 3. **Désactiver complètement le mode resize natif et utiliser KeyboardAvoidingView**

```json
// app.json
{
  "android": {
    "softwareKeyboardLayoutMode": "pan" // Au lieu de "resize"
  }
}
```

Puis utiliser `KeyboardAvoidingView` avec `behavior="height"` sur Android.

**⚠️ Risque** : Peut casser le positionnement de la modale de chat.

### 4. **Utiliser un module natif custom**

Créer un module natif Android qui force le focus de manière plus agressive, en contournant les couches React Native.

---

## 📝 Notes Finales

Le problème semble être **profondément lié au comportement spécifique de Samsung OneUI** avec le mode `resize` natif d'Android. Toutes les solutions "React Native pures" ont été tentées sans succès.

**Recommandation** : Si aucune solution React Native pure ne fonctionne, envisager :
1. Désactiver temporairement la recherche sur Samsung (solution pragmatique)
2. Créer un module natif custom pour forcer le focus
3. Utiliser une bibliothèque tierce spécialisée dans la gestion du clavier Android (ex: `react-native-keyboard-controller`)

---

## 🧹 Nettoyage des Logs

Une fois le problème résolu, supprimer tous les `console.log` de diagnostic :
- `🔍 [SEARCH BAR]`
- `🟢 [SEARCH INPUT]`
- `🟡 [SEARCH INPUT]`
- `🔴 [KEYBOARD]`

---

**Dernière mise à jour** : 2025-01-XX
**Statut** : 🔴 Problème non résolu
