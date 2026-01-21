import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../lib/i18n';

interface AppHeaderProps {
  currentPseudo?: string;
  isZenMode?: boolean;
  isSilentMode?: boolean;
  isProfileMenuOpen?: boolean;
  isProfileOpen?: boolean;
  isSearchVisible?: boolean;
  onProfileMenuPress?: () => void;
  onSearchToggle?: () => void;
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
  onZenModeToggle,
  onSilentModeToggle,
  shakeX,
  shakeY,
}: AppHeaderProps) {
  const AnimatedContainer = shakeX && shakeY ? Animated.View : View;
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
          source={require('../assets/images/prout-meme.png')} 
          style={styles.logo} 
          resizeMode="contain" 
        />
      </AnimatedContainer>

      {/* 2. LA BARRE DE NAVIGATION */}
      <View style={styles.navBar}>
        <View style={styles.navBarContent}>
          <View style={styles.greetingContainer}>
            <View style={styles.greetingRow}>
              {currentPseudo ? (
                <Text style={styles.greetingText}>{i18n.t('greeting')} {currentPseudo} !</Text>
              ) : null}
              {isZenMode && onZenModeToggle && (
                <TouchableOpacity onPress={onZenModeToggle} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <Ionicons
                    name="moon"
                    size={18}
                    color="#ffffff"
                    style={styles.zenIcon}
                  />
                </TouchableOpacity>
              )}
              {isSilentMode && onSilentModeToggle && (
                <TouchableOpacity onPress={onSilentModeToggle} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <Ionicons
                    name="volume-mute"
                    size={22}
                    color="#ffffff"
                    style={styles.zenIcon}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          {/* Icônes à droite : Recherche + Profil */}
          <View style={styles.rightIconsContainer}>
            {/* Recherche (visible seulement dans FriendsList) */}
            {onSearchToggle && (
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
            
            {/* Menu Profil */}
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
    paddingBottom: 5,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: -10,
  },
  logo: {
    width: 200,
    height: 140,
  },
  navBar: {
    backgroundColor: 'transparent',
    marginBottom: 10,
  },
  navBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  greetingContainer: {
    flex: 1,
    marginRight: 8,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  greetingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginRight: 6,
  },
  zenIcon: {
    marginRight: 4,
  },
  rightIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  navIcon: {
    width: 28,
    height: 28,
  },
});
