import { Ionicons } from '@expo/vector-icons';
import { Animated, Image, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

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
  profileAvatarUrl?: string | null;
  isZenMode?: boolean;
  isSilentMode?: boolean;
  isProfileMenuOpen?: boolean;
  isProfileOpen?: boolean;
  isSearchVisible?: boolean;
  onProfileMenuPress?: () => void;
  onProfilePress?: () => void;
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
  profileAvatarUrl,
  isZenMode = false,
  isSilentMode = false,
  isProfileMenuOpen = false,
  isProfileOpen = false,
  isSearchVisible = false,
  onProfileMenuPress,
  onProfilePress,
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
      <View style={styles.topRow}>
        {/* Logo à gauche */}
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

        {/* Vignette profil à droite (photo cliquable + pseudo dessous) */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onProfilePress || onProfileMenuPress}
          style={styles.profileVignette}
        >
          <View style={styles.profileAvatarWrap}>
            {profileAvatarUrl ? (
              <Image source={{ uri: profileAvatarUrl }} style={styles.profileAvatar} />
            ) : (
              <View style={styles.profileAvatarFallback}>
                <Ionicons name="person" size={18} color="#604a3e" />
              </View>
            )}
          </View>
          {!!currentPseudo && (
            <Text style={styles.profilePseudo} numberOfLines={1}>
              {currentPseudo}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 2. LA BARRE DE NAVIGATION */}
      <View style={styles.navBar}>
        {/* Ligne 1 : Menu principal (Complicité, Soundcheck, Zen, Silencieux, Recherche, Profil) — masqué quand menu liste ouvert */}
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'flex-start',
    marginTop: -5,
    marginBottom: 2,
    marginLeft: 10,
  },
  logo: {
    width: 120,
    height: 84,
  },
  navBar: {
    backgroundColor: 'transparent',
    marginBottom: 5,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
    minHeight: 30,
  },
  profileVignette: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 92,
    marginTop: 2,
  },
  profileAvatarWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#ffffff',
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(96,74,62,0.2)',
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
  profileAvatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f2ebe7',
  },
  profilePseudo: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
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
