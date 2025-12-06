import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

// Import des images d'animation
const ANIM_IMAGES = [
  require('../assets/images/animprout1.png'),
  require('../assets/images/animprout2.png'),
  require('../assets/images/animprout3.png'),
  require('../assets/images/animprout4.png'),
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 150; // Seuil pour déclencher l'action

interface SwipeableFriendRowReanimatedProps {
  friend: any;
  backgroundColor: string;
  onSendProut: () => void;
  onLongPressName: () => void;
}

export default function SwipeableFriendRowReanimated({
  friend,
  backgroundColor,
  onSendProut,
  onLongPressName,
}: SwipeableFriendRowReanimatedProps) {
  const translationX = useSharedValue(0);
  const maxSwipe = SCREEN_WIDTH * 0.7; // Maximum 70% de l'écran
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showFinalImage, setShowFinalImage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Fonction pour mettre à jour l'index d'image (doit être appelée depuis le thread JS)
  const updateImageIndex = (x: number) => {
    const percentage = Math.min(x / maxSwipe, 1);
    let newIndex = 0;
    if (percentage <= 0.10) {
      newIndex = 0; // animprout1
    } else if (percentage <= 0.90) {
      newIndex = 1; // animprout2
    } else {
      newIndex = 2; // animprout3
    }
    
    if (newIndex !== currentImageIndex) {
      setCurrentImageIndex(newIndex);
    }
  };

  // Fonction pour déclencher l'action
  const triggerAction = () => {
    setIsLoading(true);
    setShowFinalImage(true);
    setCurrentImageIndex(0);
    onSendProut();
    
    // Reset après l'envoi
    setTimeout(() => {
      setIsLoading(false);
      setShowFinalImage(false);
      setCurrentImageIndex(0);
      translationX.value = withSpring(0, { damping: 15, stiffness: 150 });
    }, 1000);
  };

  // Animation du geste
  const gesture = Gesture.Pan()
    .onStart(() => {
      if (isLoading) return;
    })
    .onUpdate((e) => {
      if (isLoading) return;
      // Limiter le mouvement à droite uniquement
      const newX = Math.max(0, Math.min(e.translationX, maxSwipe));
      translationX.value = newX;
      
      // Mettre à jour l'image (appelé sur le thread JS)
      runOnJS(updateImageIndex)(newX);
    })
    .onEnd((e) => {
      if (isLoading) return;
      
      const finalX = e.translationX;
      
      if (finalX >= SWIPE_THRESHOLD) {
        // Seuil atteint : déclencher l'action
        runOnJS(triggerAction)();
      } else {
        // Retour élastique au début
        translationX.value = withSpring(0, { damping: 15, stiffness: 150 });
        runOnJS(setCurrentImageIndex)(0);
      }
    });

  // Style animé pour la ligne qui se déplace
  const animatedLineStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translationX.value }],
    };
  });

  // Style animé pour le zoom de l'image de fond
  const animatedImageScale = useAnimatedStyle(() => {
    const scale = interpolate(
      translationX.value,
      [0, maxSwipe],
      [0.5, 4.0],
      Extrapolation.CLAMP
    );
    
    return {
      transform: [{ scale }],
    };
  });

  // Calculer l'index de l'image pour l'affichage (basé sur la valeur animée)
  const getImageIndexFromValue = (x: number): number => {
    const percentage = Math.min(x / maxSwipe, 1);
    if (percentage <= 0.10) return 0;
    if (percentage <= 0.90) return 1;
    return 2;
  };

  return (
    <View style={[styles.swipeableRow, { backgroundColor }]} collapsable={false}>
      {/* Background : Image d'animation avec fond clair */}
      <View style={styles.swipeBackground} collapsable={false}>
        {/* Image finale (animprout4) après l'envoi du prout */}
        {showFinalImage ? (
          <View style={styles.finalImageContainer} collapsable={false}>
            <Animated.Image
              source={ANIM_IMAGES[3]}
              style={[
                styles.animImage,
                {
                  transform: [{ scale: 4.0 }],
                },
              ]}
              resizeMode="contain"
            />
          </View>
        ) : (
          /* Image normale pendant le swipe */
          currentImageIndex >= 0 && currentImageIndex < 3 && (
            <Animated.Image
              source={ANIM_IMAGES[currentImageIndex]}
              style={[styles.animImage, animatedImageScale]}
              resizeMode="contain"
            />
          )
        )}
      </View>

      {/* Foreground : Ligne de contact */}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            styles.swipeForeground,
            {
              backgroundColor,
            },
            animatedLineStyle,
          ]}
        >
          <View style={styles.userInfo}>
            <TouchableOpacity onLongPress={onLongPressName} activeOpacity={0.7}>
              <Text style={styles.pseudo} numberOfLines={1}>
                {friend.pseudo}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeableRow: {
    position: 'relative',
    borderRadius: 15,
    overflow: 'hidden',
    height: 60,
    zIndex: 1,
  },
  swipeBackground: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 20,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    overflow: 'hidden',
  },
  animImage: {
    width: 60,
    height: 60,
  },
  finalImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    zIndex: 1,
  },
  swipeForeground: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    height: '100%',
    width: '100%',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pseudo: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
  },
});

