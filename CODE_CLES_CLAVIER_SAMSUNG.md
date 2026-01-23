# Code Clés - Problème Clavier Samsung

## 📦 Extraits de Code Essentiels

### 1. Détection des Appareils (À placer EN DEHORS du composant)

```typescript
// ==========================================
// DÉTECTION DES APPAREILS (MODULE LEVEL)
// ==========================================
// ⚠️ CRITIQUE : Ces constantes DOIVENT être définies en dehors du composant
// pour garantir leur stabilité et éviter les re-renders inutiles

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

// Props de sécurité pour stabiliser le clavier
const oldAndroidInputProps = (isOldAndroid || isSamsungDevice || isHuaweiDevice) ? {
  autoCorrect: false,
  autoComplete: 'off',
  importantForAutofill: 'no',
  spellCheck: false,
  contextMenuHidden: true,
  textContentType: 'none',
  keyboardType: 'visible-password'
} : {};
```

---

### 2. Container Principal (Dans FriendsList)

```typescript
// Rendu différencié pour le conteneur principal
// iOS a besoin de KeyboardAvoidingView pour pousser le contenu
// Android utilise "softwareKeyboardLayoutMode": "resize" natif (app.json)
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

---

### 3. Rendu Header + SearchBar (Dans FriendsList)

```typescript
const useInlineSearch = Platform.OS === 'android' && isProblemAndroidDevice;

const content = (
  <Container {...containerProps}>
    <View style={styles.headerOverlayContainer}>
      {/* Header normal : Toujours présent pour conserver la hauteur */}
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
          {/* Android problématique : SearchBar intégré dans la liste */}
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
    />
  </Container>
);
```

---

### 4. Focus Manuel Différé (Dans FriendsList)

```typescript
// Focus manuel différé pour la recherche (Samsung/Huawei)
useEffect(() => {
  if (!isSearchVisible) return;
  if (closingCooldownUntilRef.current && Date.now() < closingCooldownUntilRef.current) return;
  const input = searchInputRef.current;
  if (!input) return;

  // Délai ULTRA-LONG pour Samsung : on attend que TOUT soit stabilisé
  const delay = Platform.OS === 'android' && isProblemAndroidDevice ? 800 : Platform.OS === 'android' ? 400 : 50;
  
  const timer = setTimeout(() => {
    if (!isClosingModalRef.current) {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  }, delay);

  return () => clearTimeout(timer);
}, [isSearchVisible, isProblemAndroidDevice]);
```

---

### 5. handlePressHeader (Dans FriendsList)

```typescript
const handlePressHeader = () => {
  if (isSearchVisible && isProblemAndroidDevice) {
    return; // Ne pas fermer le clavier si recherche active sur Samsung
  }
  Keyboard.dismiss();
  setExpandedFriendId(null);
  if (searchQuery.trim()) {
    onSearchQueryChange?.('');
    onSearchChange?.(false);
  }
};
```

---

### 6. Composant SearchBar Complet

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

  const prevProps = useRef<SearchBarProps>(props);
  const inputRef = useRef<TextInput>(null);
  const isClosingRef = useRef(false);
  const lastRefocusAtRef = useRef(0);
  const refocusAttemptsRef = useRef(0);

  useImperativeHandle(ref, () => inputRef.current as TextInput);
  
  // DEBUG: Tracer les changements de props
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

### 7. Toggle Search dans index.tsx

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

// Dans le JSX
<AppHeader
  // ... autres props ...
  onSearchToggle={toggleSearchVisibility}
/>
```

---

### 8. Styles (Dans FriendsList)

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
});
```

---

### 9. Configuration app.json

```json
{
  "expo": {
    "android": {
      "softwareKeyboardLayoutMode": "resize"
    }
  }
}
```

---

## ⚠️ Points Critiques

1. **Les constantes de détection DOIVENT être en dehors du composant** (module level)
2. **Pas de KeyboardAvoidingView global sur Android** (conflit avec resize natif)
3. **Le header reste toujours rendu** (pour éviter les reflows)
4. **Focus différé avec délai long sur Samsung** (800ms)
5. **Refocus automatique dans onBlur** (avec garde-fous)
6. **Listener keyboardDidHide** pour ré-ouvrir le clavier s'il se ferme

---

**Statut** : 🔴 Problème non résolu - Le clavier se ferme toujours automatiquement sur Samsung
