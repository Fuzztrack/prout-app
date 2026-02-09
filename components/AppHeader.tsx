import { Ionicons } from '@expo/vector-icons';
import { Animated, Image, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import i18n from '../lib/i18n';

// Détection Google Pixel
const isPixelDevice =
  Platform.OS === 'android' &&
  /google|pixel/i.test(
    ((Platform as any).constants?.Brand as string) ||
      ((Platform as any).constants?.Manufacturer as string) ||
      ((Platform as any).constants?.Model as string) ||
      ''
  );

// ⏸️ PAUSÉ pour test : Afficher la recherche sur tous les appareils (test avec react-native-keyboard-controller)
// const isSearchSupported = Platform.OS === 'ios' || isPixelDevice;
const isSearchSupported = true; // Test : activer pour tous les appareils

// Couleur "actif" Zen/Silent dans le menu principal (contrastée avec le fond #ebb89b)
const ACTIVE_ICON_COLOR = '#604a3e';

interface AppHeaderProps {
  currentPseudo?: string;
  isZenMode?: boolean;
  isSilentMode?: boolean;
  isProfileMenuOpen?: boolean;
  isProfileOpen?: boolean;
  isSearchVisible?: boolean;
  onProfileMenuPress?: () => void;
  onSearchToggle?: () => void;
  onComplicityPress?: () => void;
  onSoundcheckPress?: () => void;
  onZenModeToggle?: () => void;
  onSilentModeToggle?: () => void;
  shakeX?: Animated.Value;
  shakeY?: Animated.Value;
}

export function AppHeader({
  currentPseudo,
  isZenMode = false,
  isSilentMode = false,
  isProfileMenuOpen = false,
  isProfileOpen = false,
  isSearchVisible = false,
  onProfileMenuPress,
  onSearchToggle,
  onComplicityPress,
  onSoundcheckPress,
  onZenModeToggle,
  onSilentModeToggle,
  shakeX,
  shakeY,
}: AppHeaderProps) {
  const AnimatedContainer = shakeX && shakeY ? Animated.View : View;
  const { height: screenHeight } = useWindowDimensions();
  const logoHeight = Math.min(140, Math.max(60, Math.round(screenHeight * 0.12)));
  const logoWidth = Math.round(logoHeight * (200 / 140));
  const animatedStyle = shakeX && shakeY ? {
    transform: [
      { translateX: shakeX },
      { translateY: shakeY },
    ],
  } : {};

  return (
    <View style={styles.headerSection}>
      {/* 1. LE LOGO */}
      <AnimatedContainer 
        style={[
          styles.logoContainer,
          animatedStyle,
        ]}
      >
        <Image 
          source={require('../assets/images/Prrt.png')} 
          style={[styles.logo, { height: logoHeight, width: logoWidth }]} 
          resizeMode="contain" 
        />
      </AnimatedContainer>

      {/* 2. LA BARRE DE NAVIGATION */}
      <View style={styles.navBar}>
        {/* Ligne 1 : Greeting uniquement */}
        <View style={styles.greetingRow}>
          {currentPseudo ? (
            <Text style={styles.greetingText}>{i18n.t('greeting')} {currentPseudo} !</Text>
          ) : null}
        </View>

        {/* Ligne 2 : Menu principal (Complicité, Soundcheck, Zen, Silencieux, Recherche, Profil) — masqué quand menu liste ouvert */}
        <View style={styles.menuRow}>
          <View style={styles.rightIconsContainer}>
            {!(isProfileMenuOpen || isProfileOpen) && (
              <>
                {/* Complicité - Coupe */}
                {onComplicityPress && (
                  <TouchableOpacity
                    onPress={onComplicityPress}
                    style={[styles.iconButton, { justifyContent: 'center', alignItems: 'center', minHeight: 28, marginTop: 2 }]}
                  >
                    <Ionicons
                      name="trophy"
                      size={22}
                      color="#ffffff"
                    />
                  </TouchableOpacity>
                )}

                {/* Soundcheck! - Onde sonore */}
                {onSoundcheckPress && (
                  <TouchableOpacity
                    onPress={onSoundcheckPress}
                    style={[styles.iconButton, { justifyContent: 'center', alignItems: 'center', minHeight: 28, marginTop: 2 }]}
                  >
                    <Ionicons
                      name="pulse"
                      size={22}
                      color="#ffffff"
                    />
                  </TouchableOpacity>
                )}

                {/* Mode Zen */}
                {onZenModeToggle && (
                  <TouchableOpacity
                    onPress={onZenModeToggle}
                    style={[styles.iconButton, { justifyContent: 'center', alignItems: 'center', minHeight: 28, marginTop: 2 }]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={isZenMode ? 'moon' : 'moon-outline'}
                      size={22}
                      color={isZenMode ? ACTIVE_ICON_COLOR : '#ffffff'}
                    />
                  </TouchableOpacity>
                )}

                {/* Envois silencieux */}
                {onSilentModeToggle && (
                  <TouchableOpacity
                    onPress={onSilentModeToggle}
                    style={[styles.iconButton, { justifyContent: 'center', alignItems: 'center', minHeight: 28, marginTop: 2 }]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={isSilentMode ? 'volume-mute' : 'volume-mute-outline'}
                      size={22}
                      color={isSilentMode ? ACTIVE_ICON_COLOR : '#ffffff'}
                    />
                  </TouchableOpacity>
                )}

                {/* Recherche */}
                {isSearchSupported && onSearchToggle && (
                  <TouchableOpacity 
                    onPress={onSearchToggle} 
                    style={[styles.iconButton, { justifyContent: 'center', alignItems: 'center', minHeight: 28, marginTop: 2 }]}
                  >
                    <Ionicons 
                      name={isSearchVisible ? "close" : "search"} 
                      size={22} 
                      color="#ffffff" 
                    />
                  </TouchableOpacity>
                )}
              </>
            )}
            
            {/* Menu Profil / Fermer (toujours visible pour pouvoir fermer le menu) */}
            {onProfileMenuPress && (
              <TouchableOpacity 
                onPress={onProfileMenuPress} 
                style={[
                  styles.iconButton, 
                  { justifyContent: 'center', alignItems: 'center', minHeight: 28 }, 
                  (isProfileMenuOpen || isProfileOpen) && { opacity: 0.7 }
                ]}
              >
                {(isProfileMenuOpen || isProfileOpen) ? (
                  <Ionicons name="close-circle-outline" size={28} color="#ffffff" />
                ) : (
                  <Image 
                    source={require('../assets/images/icon_compte.png')} 
                    style={styles.navIcon} 
                    resizeMode="contain"
                  />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  headerSection: {
    paddingTop: 0,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: -5,
    marginBottom: -8,
  },
  logo: {
    width: 120,
    height: 84,
  },
  navBar: {
    backgroundColor: 'transparent',
    marginBottom: 5,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    minHeight: 32,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    minHeight: 36,
  },
  greetingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginRight: 6,
  },
  rightIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  iconButton: {
    padding: 4,
  },
  navIcon: {
    width: 28,
    height: 28,
  },
});
