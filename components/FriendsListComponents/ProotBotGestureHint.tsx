import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Svg, { Path, Line, Rect, Circle, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import i18n from '../../lib/i18n';
import {
  isProotBotGestureHintSeen,
  isProotBotGestureHintSeenSync,
  setProotBotGestureHintSeen,
} from '../../lib/prootBot';

/**
 * Composant vectoriel SVG : Gant blanc vintage cartoon / style Mickey
 * - Agrandit à 62px
 * - Lignes épurées, simples et ultra-lisibles (contour gras de 3.6px)
 * - 3 nervures noires distinctives sur le dos de la main
 * - Revers de manche bouffant au poignet
 */
const VintageGloveSvg = React.memo(({ size = 62 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <G transform="rotate(-10 32 32)">
      {/* Ombre portée douce vintage */}
      <Path
        d="M 24 7 C 20 7, 17 10, 17 15 L 17 27 C 12 29, 9 33, 9 37 C 9 41, 13 44, 18 43 L 18 49 L 46 49 L 46 42 C 49 41, 51 37, 51 33 C 51 29, 48 26, 48 22 C 48 17, 44 15, 40 15 C 37 15, 34 17, 32 20 L 31 15 C 31 10, 28 7, 24 7 Z"
        fill="rgba(0, 0, 0, 0.15)"
        transform="translate(2, 2.5)"
      />

      {/* Corps épuré du gant & doigts */}
      <Path
        d="M 24 6
           C 20 6, 17 9, 17 14
           L 17 26
           C 12 28, 9 32, 9 36
           C 9 40, 13 43, 18 42
           L 18 48
           L 46 48
           L 46 41
           C 49 40, 51 36, 51 32
           C 51 28, 48 25, 48 21
           C 48 16, 44 14, 40 14
           C 37 14, 34 16, 32 19
           L 31 14
           C 31 9, 28 6, 24 6 Z"
        fill="#FFFFFF"
        stroke="#222222"
        strokeWidth={3.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 3 nervures noires iconiques sur le dos du gant */}
      <Line x1="27" y1="33" x2="26" y2="42" stroke="#222222" strokeWidth={3.2} strokeLinecap="round" />
      <Line x1="32" y1="32" x2="32" y2="42" stroke="#222222" strokeWidth={3.2} strokeLinecap="round" />
      <Line x1="37" y1="33" x2="38" y2="42" stroke="#222222" strokeWidth={3.2} strokeLinecap="round" />

      {/* Revers bouffant du poignet */}
      <Rect
        x="15"
        y="46"
        width="34"
        height="12"
        rx="6"
        fill="#FFFFFF"
        stroke="#222222"
        strokeWidth={3.6}
      />
    </G>
  </Svg>
));

/**
 * Effet Pop cartoon au tap
 */
const PopEffectSvg = React.memo(() => (
  <Svg width={48} height={48} viewBox="0 0 48 48">
    <Line x1="24" y1="3" x2="24" y2="10" stroke="#FF8A3D" strokeWidth={3} strokeLinecap="round" />
    <Line x1="24" y1="38" x2="24" y2="45" stroke="#FF8A3D" strokeWidth={3} strokeLinecap="round" />
    <Line x1="3" y1="24" x2="10" y2="24" stroke="#FF8A3D" strokeWidth={3} strokeLinecap="round" />
    <Line x1="38" y1="24" x2="45" y2="24" stroke="#FF8A3D" strokeWidth={3} strokeLinecap="round" />
    <Line x1="9" y1="9" x2="14" y2="14" stroke="#604a3e" strokeWidth={2.6} strokeLinecap="round" />
    <Line x1="34" y1="34" x2="39" y2="39" stroke="#604a3e" strokeWidth={2.6} strokeLinecap="round" />
    <Line x1="39" y1="9" x2="34" y2="14" stroke="#604a3e" strokeWidth={2.6} strokeLinecap="round" />
    <Line x1="9" y1="39" x2="14" y2="34" stroke="#604a3e" strokeWidth={2.6} strokeLinecap="round" />
    <Circle cx="24" cy="24" r="3" fill="#FF8A3D" />
  </Svg>
));

/**
 * Effet Onde / Ripple pour l'appui long
 */
const LongPressRippleSvg = React.memo(() => (
  <Svg width={56} height={56} viewBox="0 0 56 56">
    <Circle cx="28" cy="28" r="22" stroke="#604a3e" strokeWidth={2.5} strokeDasharray="4 5" fill="none" opacity={0.7} />
    <Circle cx="28" cy="28" r="14" fill="#FF8A3D" opacity={0.45} />
    <Circle cx="28" cy="28" r="6" fill="#3a2a22" opacity={0.6} />
  </Svg>
));

type StepType = 'swipe' | 'tap' | 'press' | 'idle';

type ProotBotGestureHintProps = {
  isRowActive?: boolean;
};

export const ProotBotGestureHint: React.FC<ProotBotGestureHintProps> = React.memo(({ isRowActive = false }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepType>('idle');
  const cycleCountRef = useRef(0);
  const isCancelledRef = useRef(false);

  // Vérification : uniquement à la première ouverture après installation ou mise à jour
  useEffect(() => {
    if (isProotBotGestureHintSeenSync()) {
      setIsVisible(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const seen = await isProotBotGestureHintSeen();
        if (cancelled) return;
        if (seen) {
          setIsVisible(false);
        } else {
          setIsVisible(true);
          // Marqué comme vu dès le premier déclenchement pour ne plus jamais réapparaître
          await setProotBotGestureHintSeen();
        }
      } catch {
        setIsVisible(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Valeurs partagées Reanimated
  const masterOpacity = useSharedValue(1);
  const handX = useSharedValue(66);
  const handY = useSharedValue(0);
  const handScale = useSharedValue(1);
  const handOpacity = useSharedValue(0);

  // Position horizontale de la pointe de la flèche (la flèche s'arrête derrière la main)
  const arrowTipX = useSharedValue(40);
  const arrowOpacity = useSharedValue(0);

  const popScale = useSharedValue(0);
  const popOpacity = useSharedValue(0);
  const rippleScale = useSharedValue(0.4);
  const rippleOpacity = useSharedValue(0);

  // Opacité et échelle du badge de texte ('Swipe', 'Tap', 'Or press')
  const badgeOpacity = useSharedValue(0);
  const badgeScale = useSharedValue(0.9);

  // Styles animés Reanimated
  const animatedHandStyle = useAnimatedStyle(() => ({
    opacity: handOpacity.value * masterOpacity.value,
    transform: [
      { translateX: handX.value },
      { translateY: handY.value },
      { scale: handScale.value },
    ],
  }));

  // Ligne horizontale droite pleine et colorée (se trace jusqu'à la pointe de la flèche)
  const animatedArrowLineStyle = useAnimatedStyle(() => {
    const currentWidth = Math.max(0, arrowTipX.value - 40 + 4);
    return {
      width: currentWidth,
      opacity: arrowOpacity.value * masterOpacity.value,
    };
  });

  // Pointe de flèche horizontale : entièrement découverte, le gant est positionné devant elle
  const animatedArrowHeadStyle = useAnimatedStyle(() => ({
    opacity: arrowOpacity.value * masterOpacity.value,
    transform: [
      { translateX: arrowTipX.value },
    ],
  }));

  const animatedPopStyle = useAnimatedStyle(() => ({
    opacity: popOpacity.value * masterOpacity.value,
    transform: [
      { scale: popScale.value },
    ],
  }));

  const animatedRippleStyle = useAnimatedStyle(() => ({
    opacity: rippleOpacity.value * masterOpacity.value,
    transform: [
      { scale: rippleScale.value },
    ],
  }));

  const animatedBadgeStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value * masterOpacity.value,
    transform: [
      { scale: badgeScale.value },
    ],
  }));

  // Disparition immédiate si l'utilisateur interagit avec la rangée
  useEffect(() => {
    if (isRowActive && isVisible) {
      isCancelledRef.current = true;
      void setProotBotGestureHintSeen();
      masterOpacity.value = withTiming(0, { duration: 180 }, () => {
        runOnJS(setIsVisible)(false);
      });
    }
  }, [isRowActive, isVisible]);

  // Machine d'états : Étape par étape ('swipe' -> 'tap' -> 'press')
  useEffect(() => {
    if (!isVisible) return;
    isCancelledRef.current = false;

    // Démarre l'étape Swipe
    const playSwipeStep = () => {
      if (isCancelledRef.current) return;
      setCurrentStep('swipe');

      // Reset positions : la pointe de flèche à 40, la main décalée DEVANT à 72 px
      arrowTipX.value = 40;
      handX.value = 72;
      handY.value = 0;
      handScale.value = 1;
      popOpacity.value = 0;
      rippleOpacity.value = 0;

      // Affichage badge texte
      badgeScale.value = 0.85;
      badgeOpacity.value = withTiming(1, { duration: 200 });
      badgeScale.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.back(1.5)) });

      // Apparition du gant et de la flèche
      handOpacity.value = withTiming(0.95, { duration: 220 });
      arrowOpacity.value = withDelay(100, withTiming(0.95, { duration: 180 }));

      // Glissement horizontal ample synchronisé :
      // La pointe de la flèche va de 40 à 190 px
      // La main va de 72 à 222 px (32 px devant la pointe, laissant le bout de flèche 100% visible)
      arrowTipX.value = withDelay(
        200,
        withTiming(190, { duration: 850, easing: Easing.inOut(Easing.cubic) })
      );

      handX.value = withDelay(
        200,
        withTiming(222, { duration: 850, easing: Easing.inOut(Easing.cubic) }, (finished) => {
          if (finished) {
            // Disparition en fin de course
            handOpacity.value = withTiming(0, { duration: 200 });
            arrowOpacity.value = withTiming(0, { duration: 200 });
            badgeOpacity.value = withTiming(0, { duration: 200 }, (badgeFinished) => {
              if (badgeFinished) {
                runOnJS(scheduleNextStep)('tap', 250);
              }
            });
          }
        })
      );
    };

    // Démarre l'étape Tap
    const playTapStep = () => {
      if (isCancelledRef.current) return;
      setCurrentStep('tap');

      // Position au centre du bouton
      handX.value = 130;
      handY.value = 0;
      handScale.value = 1;

      // Affichage badge texte
      badgeScale.value = 0.85;
      badgeOpacity.value = withTiming(1, { duration: 200 });
      badgeScale.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.back(1.5)) });

      // Apparition du gant
      handOpacity.value = withTiming(0.95, { duration: 200 });

      // Mouvement vertical rapide (Tap)
      handY.value = withDelay(
        250,
        withSequence(
          withTiming(9, { duration: 130, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 150, easing: Easing.out(Easing.quad) })
        )
      );
      handScale.value = withDelay(
        250,
        withSequence(
          withTiming(0.86, { duration: 130 }),
          withTiming(1, { duration: 150 })
        )
      );

      // Déclenchement de l'effet Pop cartoon à l'impact
      setTimeout(() => {
        if (isCancelledRef.current) return;
        popScale.value = 0.3;
        popOpacity.value = 1;
        popScale.value = withTiming(1.3, { duration: 260, easing: Easing.out(Easing.back(1.5)) });
        popOpacity.value = withTiming(0, { duration: 260 });
      }, 380);

      // Disparition du gant et du badge après le tap
      setTimeout(() => {
        if (isCancelledRef.current) return;
        handOpacity.value = withTiming(0, { duration: 220 });
        badgeOpacity.value = withTiming(0, { duration: 220 }, (finished) => {
          if (finished) {
            runOnJS(scheduleNextStep)('press', 250);
          }
        });
      }, 950);
    };

    // Démarre l'étape Appui Long (Or press)
    const playPressStep = () => {
      if (isCancelledRef.current) return;
      setCurrentStep('press');

      // Position au centre du bouton
      handX.value = 130;
      handY.value = 0;
      handScale.value = 1;

      // Affichage badge texte
      badgeScale.value = 0.85;
      badgeOpacity.value = withTiming(1, { duration: 200 });
      badgeScale.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.back(1.5)) });

      // Apparition du gant
      handOpacity.value = withTiming(0.95, { duration: 200 });

      // Descente et maintien enfoncé (1,2 seconde)
      handY.value = withDelay(250, withTiming(9, { duration: 150, easing: Easing.in(Easing.quad) }));
      handScale.value = withDelay(250, withTiming(0.83, { duration: 150 }));

      // Onde d'appui long qui pulse pendant le maintien
      setTimeout(() => {
        if (isCancelledRef.current) return;
        rippleScale.value = 0.4;
        rippleOpacity.value = 0.85;
        rippleScale.value = withTiming(1.25, { duration: 850, easing: Easing.out(Easing.ease) });
        rippleOpacity.value = withSequence(
          withTiming(0.85, { duration: 650 }),
          withTiming(0, { duration: 300 })
        );
      }, 350);

      // Relâchement après 1200ms de maintien
      setTimeout(() => {
        if (isCancelledRef.current) return;
        handY.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.quad) });
        handScale.value = withTiming(1, { duration: 180 });

        // Disparition de fin d'étape
        setTimeout(() => {
          if (isCancelledRef.current) return;
          handOpacity.value = withTiming(0, { duration: 250 });
          badgeOpacity.value = withTiming(0, { duration: 250 }, (finished) => {
            if (finished) {
              runOnJS(handleCycleCompleted)();
            }
          });
        }, 200);
      }, 1500);
    };

    const scheduleNextStep = (next: StepType, delayMs: number) => {
      if (isCancelledRef.current) return;
      setTimeout(() => {
        if (isCancelledRef.current) return;
        if (next === 'tap') playTapStep();
        else if (next === 'press') playPressStep();
        else if (next === 'swipe') playSwipeStep();
      }, delayMs);
    };

    const handleCycleCompleted = () => {
      cycleCountRef.current += 1;
      if (cycleCountRef.current < 3 && !isCancelledRef.current) {
        // Pause de 1,2 s entre chaque cycle complet
        scheduleNextStep('swipe', 1200);
      } else {
        // Fin des 3 répétitions : disparition définitive
        void setProotBotGestureHintSeen();
        masterOpacity.value = withTiming(0, { duration: 300 }, () => {
          runOnJS(setIsVisible)(false);
        });
      }
    };

    // Délai initial de 1000ms au chargement de l'écran avant de démarrer
    const initialTimer = setTimeout(() => {
      playSwipeStep();
    }, 1000);

    return () => {
      isCancelledRef.current = true;
      clearTimeout(initialTimer);
      cancelAnimation(handX);
      cancelAnimation(handY);
      cancelAnimation(handScale);
      cancelAnimation(handOpacity);
      cancelAnimation(arrowTipX);
      cancelAnimation(arrowOpacity);
      cancelAnimation(popScale);
      cancelAnimation(popOpacity);
      cancelAnimation(rippleScale);
      cancelAnimation(rippleOpacity);
      cancelAnimation(badgeOpacity);
      cancelAnimation(badgeScale);
      cancelAnimation(masterOpacity);
    };
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  const getStepText = () => {
    switch (currentStep) {
      case 'swipe':
        return i18n.t('hint_bubble_swipe');
      case 'tap':
        return i18n.t('hint_bubble_tap');
      case 'press':
        return i18n.t('hint_bubble_press');
      default:
        return '';
    }
  };

  const stepText = getStepText();
  // Décalage dynamique vers la gauche selon la longueur du texte :
  // Plus le texte est long, plus la marge droite augmente pour décaler la bulle vers la gauche et garantir que tout le texte s'affiche
  const badgeRightOffset = Math.max(14, Math.min(80, 14 + Math.max(0, stepText.length - 16) * 3.2));

  return (
    <View pointerEvents="none" style={styles.overlayContainer}>
      {/* 1. Badge texte de l'étape : décalé vers la gauche selon la longueur du texte */}
      {currentStep !== 'idle' && (
        <Animated.View style={[styles.badgeContainer, { right: badgeRightOffset }, animatedBadgeStyle]}>
          <View style={styles.badgePill}>
            <Text
              style={styles.badgeText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {stepText}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* 2. Ligne de flèche strictement horizontale pleine et colorée (#FF8A3D comme l'appui long) */}
      <Animated.View style={[styles.arrowLineContainer, animatedArrowLineStyle]}>
        <Svg width={250} height={24} viewBox="0 0 250 24">
          <Line
            x1="0"
            y1="12"
            x2="250"
            y2="12"
            stroke="#FF8A3D"
            strokeWidth={4.5}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>

      {/* 3. Pointe de flèche horizontale pleine et colorée : entièrement visible, située derrière le gant */}
      <Animated.View style={[styles.arrowHeadContainer, animatedArrowHeadStyle]}>
        <Svg width={22} height={24} viewBox="0 0 22 24">
          <Path
            d="M 2 4 L 18 12 L 2 20 Z"
            fill="#FF8A3D"
            stroke="#FF8A3D"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>

      {/* 4. Effet Pop au Tap */}
      <Animated.View style={[styles.popContainer, animatedPopStyle]}>
        <PopEffectSvg />
      </Animated.View>

      {/* 5. Onde pulsée d'Appui Long */}
      <Animated.View style={[styles.rippleContainer, animatedRippleStyle]}>
        <LongPressRippleSvg />
      </Animated.View>

      {/* 6. Gant cartoon épuré et agrandi (62px) placé devant la flèche */}
      <Animated.View style={[styles.handContainer, animatedHandStyle]}>
        <VintageGloveSvg size={62} />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    zIndex: 20,
  },
  badgeContainer: {
    position: 'absolute',
    top: -24,
    zIndex: 25,
  },
  badgePill: {
    backgroundColor: '#3a2a22',
    paddingHorizontal: 12,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
    alignSelf: 'flex-end',
    flexShrink: 0,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
    flexShrink: 0,
    includeFontPadding: false,
  },
  handContainer: {
    position: 'absolute',
    top: -1,
    left: 0,
    width: 62,
    height: 62,
  },
  arrowLineContainer: {
    position: 'absolute',
    top: 18,
    left: 40,
    height: 24,
    overflow: 'hidden',
  },
  arrowHeadContainer: {
    position: 'absolute',
    top: 18,
    left: 0,
    width: 20,
    height: 24,
  },
  popContainer: {
    position: 'absolute',
    top: -5,
    left: 128,
    width: 48,
    height: 48,
  },
  rippleContainer: {
    position: 'absolute',
    top: -9,
    left: 124,
    width: 56,
    height: 56,
  },
});
