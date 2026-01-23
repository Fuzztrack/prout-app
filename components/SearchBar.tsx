import React, { forwardRef, memo, useRef, useEffect, useImperativeHandle } from 'react';
import { View, TextInput, Pressable, Keyboard, StyleSheet, Platform, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
      console.log('🔍 [SEARCH BAR] Re-rendered but NO props changed');
    }
    prevProps.current = props;
  });

  // DEBUG: Écouter les événements clavier
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subShow = Keyboard.addListener('keyboardDidShow', (event) => {
      console.log('🔵 [KEYBOARD] SHOW - height:', event.endCoordinates?.height);
    });

    const subHide = Keyboard.addListener('keyboardDidHide', () => {
      const timeSinceFocus = lastFocusAtRef.current ? Date.now() - lastFocusAtRef.current : null;
      console.log('🔴 [KEYBOARD] HIDE - timeSinceFocus:', timeSinceFocus, 'ms');
      if (timeSinceFocus !== null && timeSinceFocus < 1000) {
        console.log('⚠️ [KEYBOARD] HIDE suspect - clavier fermé trop tôt après focus !');
      }
    });

    return () => {
      subShow.remove();
      subHide.remove();
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
        onChangeText={onSearchQueryChange}
        returnKeyType="search"
        onFocus={() => {
          console.log('🟢 [SEARCH INPUT] onFocus triggered');
          lastFocusAtRef.current = Date.now();
        }}
        onBlur={() => {
          console.log('🟡 [SEARCH INPUT] onBlur triggered');
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
            console.log('🔴 [SEARCH BAR] Close button pressed - timeSinceFocus:', timeSinceFocus, 'ms', 'timeSincePressIn:', timeSincePressIn, 'ms');

            // Garde-fou : si onPress sans onPressIn (événement fantôme), ignorer
            if (timeSincePressIn === null) {
              console.log('🔴 [SEARCH BAR] Close blocked - missing onPressIn');
              return;
            }
            
            // Garde-fou : empêcher la fermeture automatique dans les 1000ms après le focus
            // Cela évite les fermetures fantômes causées par les re-layouts ou les événements système
            if (timeSinceFocus < 1000) {
              console.log('🔴 [SEARCH BAR] Close blocked - too soon after focus (', timeSinceFocus, 'ms)');
              return;
            }

            if (searchQuery.trim()) {
              onSearchQueryChange?.('');
            } else {
              console.log('🔴 [KEYBOARD] dismiss() - SearchBar: close button pressed (allowed)');
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
