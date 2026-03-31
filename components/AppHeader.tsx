import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

const SHOW_SOUNDCHECK_BUTTON = true;
const ENABLE_SOUNDCHECK_BUTTON_ANIMATION = false;

interface AppHeaderProps {
  currentPseudo?: string;
  profileAvatarUrl?: string | null;
  isProfileMenuOpen?: boolean;
  isProfileOpen?: boolean;
  isZenMode?: boolean;
  isSilentMode?: boolean;
  /** Recherche / filtre dans la liste d’amis */
  isSearchVisible?: boolean;
  onSearchToggle?: () => void;
  onAddFriendPress?: () => void;
  onProfileMenuPress?: () => void;
  onProfilePress?: () => void;
  onZenModePress?: () => void;
  onSilentModePress?: () => void;
  onSoundcheckPress?: () => void;
  shakeX?: Animated.Value;
  shakeY?: Animated.Value;
}

export function AppHeader({
  currentPseudo,
  profileAvatarUrl,
  isProfileMenuOpen = false,
  isProfileOpen = false,
  isZenMode = false,
  isSilentMode = false,
  isSearchVisible = false,
  onSearchToggle,
  onAddFriendPress,
  onProfileMenuPress,
  onProfilePress,
  onZenModePress,
  onSilentModePress,
  onSoundcheckPress,
  shakeX,
  shakeY,
}: AppHeaderProps) {
  const AnimatedContainer = shakeX && shakeY ? Animated.View : View;
  const { height: screenHeight } = useWindowDimensions();
  const soundcheckVibeY = useRef(new Animated.Value(0)).current;
  const soundcheckVibeRunningRef = useRef(false);
  const logoHeight = Math.min(160, Math.max(70, Math.round(screenHeight * 0.14)));
  const logoWidth = Math.round(logoHeight * (200 / 140));
  const animatedStyle = shakeX && shakeY ? {
    transform: [
      { translateX: shakeX },
      { translateY: shakeY },
    ],
  } : {};

  useEffect(() => {
    if (!ENABLE_SOUNDCHECK_BUTTON_ANIMATION) {
      soundcheckVibeRunningRef.current = false;
      soundcheckVibeY.stopAnimation();
      soundcheckVibeY.setValue(0);
      return;
    }
    const canAnimate = !!onSoundcheckPress && !(isProfileMenuOpen || isProfileOpen);
    if (!canAnimate) {
      soundcheckVibeRunningRef.current = false;
      soundcheckVibeY.stopAnimation();
      soundcheckVibeY.setValue(0);
      return;
    }

    const runVibration = () => {
      if (soundcheckVibeRunningRef.current) return;
      soundcheckVibeRunningRef.current = true;
      Animated.sequence([
        Animated.timing(soundcheckVibeY, { toValue: -2, duration: 55, useNativeDriver: true }),
        Animated.timing(soundcheckVibeY, { toValue: 2.5, duration: 65, useNativeDriver: true }),
        Animated.timing(soundcheckVibeY, { toValue: -1.5, duration: 50, useNativeDriver: true }),
        Animated.timing(soundcheckVibeY, { toValue: 2, duration: 60, useNativeDriver: true }),
        Animated.timing(soundcheckVibeY, { toValue: -1, duration: 45, useNativeDriver: true }),
        Animated.timing(soundcheckVibeY, { toValue: 1.5, duration: 55, useNativeDriver: true }),
        Animated.timing(soundcheckVibeY, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start(() => {
        soundcheckVibeRunningRef.current = false;
      });
    };

    const intervalId = setInterval(runVibration, 6000);

    return () => {
      clearInterval(intervalId);
      soundcheckVibeRunningRef.current = false;
      soundcheckVibeY.stopAnimation();
      soundcheckVibeY.setValue(0);
    };
  }, [isProfileMenuOpen, isProfileOpen, onSoundcheckPress, soundcheckVibeY]);

  const soundcheckVibeStyle = {
    transform: [
      {
        translateY: soundcheckVibeY,
      },
    ],
  };

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
            source={require('../assets/images/proot.png')}
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
        {/* Ligne 1 : gauche menu liste · droite Soundcheck + recherche */}
        <View style={[styles.menuRow, { justifyContent: 'space-between' }]}>
          {/* Icônes à gauche */}
          <View style={styles.leftIconsContainer}>
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
            {!(isProfileMenuOpen || isProfileOpen) && onAddFriendPress && (
              <TouchableOpacity
                onPress={onAddFriendPress}
                style={[
                  styles.iconButton,
                  { justifyContent: 'center', alignItems: 'center', minHeight: 28 },
                ]}
              >
                <Ionicons name="person-add-outline" size={24} color="#ffffff" />
              </TouchableOpacity>
            )}
            {isZenMode && (
              <TouchableOpacity
                onPress={onZenModePress}
                style={styles.modeStatusBadge}
                activeOpacity={0.85}
              >
                <Ionicons name="moon" size={18} color="#ebb89b" />
              </TouchableOpacity>
            )}
            {isSilentMode && (
              <TouchableOpacity
                onPress={onSilentModePress}
                style={styles.modeStatusBadge}
                activeOpacity={0.85}
              >
                <Ionicons name="volume-mute" size={18} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>

          {/* À droite : Soundcheck, puis recherche tout à droite */}
          <View style={styles.rightIconsContainer}>
            {SHOW_SOUNDCHECK_BUTTON && !(isProfileMenuOpen || isProfileOpen) && onSoundcheckPress && (
              <TouchableOpacity
                onPress={onSoundcheckPress}
                style={[styles.iconButton, { justifyContent: 'center', alignItems: 'center', minHeight: 30, marginTop: 1 }]}
              >
                <View style={styles.soundcheckCard}>
                  <Image
                    source={require('../assets/images/soundcheck3.png')}
                    style={[styles.soundcheckIcon, ENABLE_SOUNDCHECK_BUTTON_ANIMATION ? soundcheckVibeStyle : undefined]}
                    resizeMode="contain"
                  />
                </View>
              </TouchableOpacity>
            )}
            {!(isProfileMenuOpen || isProfileOpen) && onSearchToggle && (
              <TouchableOpacity
                onPress={onSearchToggle}
                style={[styles.iconButton, { justifyContent: 'center', alignItems: 'center', minHeight: 28, marginTop: 2 }]}
              >
                <Ionicons
                  name={isSearchVisible ? 'close' : 'search'}
                  size={22}
                  color="#ffffff"
                />
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
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    marginTop: -5,
    marginBottom: 2,
    zIndex: 0,
  },
  logo: {
    width: 120,
    height: 84,
  },
  navBar: {
    backgroundColor: 'transparent',
    marginBottom: 2,
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
    maxWidth: 80,
    marginTop: 2,
    zIndex: 1,
    marginLeft: 'auto',
  },
  profileAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(96,74,62,0.2)',
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 21,
  },
  profileAvatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 21,
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
  leftIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: -12,
  },
  modeStatusBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(96,74,62,0.28)',
  },
  rightIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  /** Même esprit que les cases "choose your sound" */
  soundcheckCard: {
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.2)',
    borderRadius: 8,
    paddingVertical: 1,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  soundcheckIcon: {
    width: 102,
    height: 22,
  },
  navIcon: {
    width: 28,
    height: 28,
  },
});
