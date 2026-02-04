import { Ionicons } from '@expo/vector-icons';
import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import i18n from '../lib/i18n';

interface SearchBarProps {
  searchQuery: string;
  onSearchQueryChange?: (text: string) => void;
  onSearchChange?: (visible: boolean) => void;
  oldAndroidInputProps?: TextInputProps;
  showCloseButton?: boolean;
}

export const SearchBar = memo(forwardRef<TextInput, SearchBarProps>((props, ref) => {
  const { 
    searchQuery, 
    onSearchQueryChange, 
    onSearchChange,
    oldAndroidInputProps = {},
    showCloseButton = true
  } = props;

  const inputRef = useRef<TextInput>(null);
  const prevProps = useRef<SearchBarProps>(props);
  const lastFocusAtRef = useRef<number | null>(null);
  const closePressInAtRef = useRef<number | null>(null);
  const mountIdRef = useRef(Math.random().toString(36).substr(2, 9));
  const blurBlockedRef = useRef(false); // Blocage temporaire du blur après onChangeText
  const lastChangeTextAtRef = useRef<number | null>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      // Log removed
    } else {
      // Log removed
    }
    prevProps.current = props;
  });

  // Nettoyage du timeout de blur au démontage
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);


  return (
    <View style={styles.searchContainer}>
      <Ionicons name="search" size={20} color="#604a3e" style={styles.searchIcon} />
      <TextInput
        ref={inputRef}
        style={styles.searchInput}
        placeholder={i18n.t('search_contact_placeholder')}
        placeholderTextColor="#999"
        value={searchQuery}
        onChangeText={(text) => {
          lastChangeTextAtRef.current = Date.now();
          
          // Annuler le timeout précédent si existant
          if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
          }
          
          // Bloquer le blur pendant 1000ms après onChangeText (augmenté pour Samsung)
          blurBlockedRef.current = true;
          onSearchQueryChange?.(text);
          
          // Débloquer après 1000ms
          blurTimeoutRef.current = setTimeout(() => {
            blurBlockedRef.current = false;
          }, 1000);
          
          // Vérifier et re-focus immédiatement si nécessaire (plus agressif)
          requestAnimationFrame(() => {
            if (inputRef.current && !inputRef.current.isFocused() && blurBlockedRef.current) {
              inputRef.current.focus();
            }
          });
        }}
        returnKeyType="search"
        onFocus={() => {
          lastFocusAtRef.current = Date.now();
        }}
        onBlur={(e) => {
          const timeSinceFocus = lastFocusAtRef.current ? Date.now() - lastFocusAtRef.current : null;
          const timeSinceChangeText = lastChangeTextAtRef.current ? Date.now() - lastChangeTextAtRef.current : null;
          
          // Si le blur est bloqué (on vient de taper), ignorer et re-focus IMMÉDIATEMENT
          if (blurBlockedRef.current && timeSinceChangeText !== null && timeSinceChangeText < 1000) {
            // Re-focus immédiatement sans délai pour éviter que le clavier se ferme
            requestAnimationFrame(() => {
              if (inputRef.current) {
                inputRef.current.focus();
              }
            });
            return;
          }
          
          // Même si le blocage est expiré, si c'est très récent (< 1500ms), on re-focus quand même
          if (timeSinceChangeText !== null && timeSinceChangeText < 1500 && timeSinceFocus !== null && timeSinceFocus > 500) {
            requestAnimationFrame(() => {
              if (inputRef.current && searchQuery.length > 0) {
                inputRef.current.focus();
              }
            });
            return;
          }
        }}
        {...oldAndroidInputProps}
      />
      {showCloseButton && (
        <Pressable
          onPressIn={() => {
            closePressInAtRef.current = Date.now();
          }}
          onPress={() => {
            const timeSinceFocus = lastFocusAtRef.current ? Date.now() - lastFocusAtRef.current : Infinity;
            const timeSincePressIn = closePressInAtRef.current ? Date.now() - closePressInAtRef.current : null;

            // Garde-fou : si onPress sans onPressIn (événement fantôme), ignorer
            if (timeSincePressIn === null) {
              return;
            }
            
            // Garde-fou : empêcher la fermeture automatique dans les 1000ms après le focus
            // Cela évite les fermetures fantômes causées par les re-layouts ou les événements système
            if (timeSinceFocus < 1000) {
              return;
            }

            if (searchQuery.trim()) {
              onSearchQueryChange?.('');
            } else {
              onSearchChange?.(false);
              Keyboard.dismiss();
            }
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={22} color="#604a3e" />
        </Pressable>
      )}
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
    marginTop: 10, // Marge réduite (était 15)
    marginBottom: 10, // Marge réduite (était 15)
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
