import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 🔊 Preview player global (évite la cacophonie)
let currentPreviewSound: Audio.Sound | null = null;
let previewSeq = 0;

async function stopCurrentPreviewSound() {
  const s = currentPreviewSound;
  if (!s) return;
  currentPreviewSound = null;
  try {
    await s.stopAsync();
  } catch (_) {}
  try {
    await s.unloadAsync();
  } catch (_) {}
}

const MINT = '#A2E4D4';

export const SOUND_CATEGORY_KEY = 'sound_category';
export type SoundCategory = 'prrt' | 'trll' | 'bzzz';

// Convention d'angles (demandée) :
// 0° = 3h, sens horaire (y vers le bas).
const CATEGORIES: { id: SoundCategory; angle: number; label: string; source: any }[] = [
  { id: 'trll', angle: 210, label: 'TRLL!', source: require('../assets/images/trrl.png') }, // 10h
  { id: 'prrt', angle: 330, label: 'PRRT!', source: require('../assets/images/Prrt.png') }, // 2h
  { id: 'bzzz', angle: 90, label: 'BZZZ!', source: require('../assets/images/bzzz.png') },  // 6h
];

// Ajustements fins par logo (pour un rendu visuel équilibré)
const RADIAL_FACTOR: Record<SoundCategory, number> = {
  trll: 0.90, // trll légèrement plus proche du centre
  prrt: 0.99, // prrt un peu plus écarté (plus loin du centre)
  bzzz: 0.92, // même marge que prrt
};

// Offsets fins (px) pour équilibrer visuellement sans toucher aux angles de crans
const POSITION_OFFSET: Record<SoundCategory, { dx: number; dy: number }> = {
  trll: { dx: 0, dy: 0 },
  prrt: { dx: 0, dy: 18 }, // un peu plus bas
  bzzz: { dx: 0, dy: -28 }, // plus haut (vers le centre)
};

// L'indicateur est dessiné en haut (12h = 270° dans notre convention).
const angleToKnobRotation = (angleDeg: number) => (angleDeg - 270 + 360) % 360;
const SNAP_ANGLES = CATEGORIES.map((c) => c.angle); // [210, 330, 90]
const KNOB_ROTATIONS = SNAP_ANGLES.map(angleToKnobRotation); // [300, 60, 180]

const normalizeAngle = (deg: number) => {
  const v = deg % 360;
  return v < 0 ? v + 360 : v;
};

const circularDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

const snapToNearestAngle = (deg: number) => {
  const a = normalizeAngle(deg);
  let best = SNAP_ANGLES[0];
  let bestDist = circularDistance(a, best);
  for (let i = 1; i < SNAP_ANGLES.length; i++) {
    const cand = SNAP_ANGLES[i];
    const dist = circularDistance(a, cand);
    if (dist < bestDist) {
      best = cand;
      bestDist = dist;
    }
  }
  return best;
};

const PREVIEW_SOUNDS_BY_CATEGORY: Record<SoundCategory, any[]> = {
  prrt: [
    require('../assets/sounds/prrt1.wav'),
    require('../assets/sounds/prrt6.wav'),
    require('../assets/sounds/prrt8.wav'),
    require('../assets/sounds/prrt9.wav'),
    require('../assets/sounds/prrt17.wav'),
    require('../assets/sounds/prrt18.wav'),
  ],
  // NB: fichiers existants = trrl*.wav (orthographe assets)
  trll: [
    require('../assets/sounds/trrl1.wav'),
    require('../assets/sounds/trrl2.wav'),
    require('../assets/sounds/trrl3.wav'),
  ],
  bzzz: [
    require('../assets/sounds/bzzz1.wav'),
    require('../assets/sounds/bzzz2.wav'),
  ],
};

interface SoundcheckSelectorProps {
  initialCategory?: SoundCategory | null;
  onCategoryChange?: (category: SoundCategory) => void;
}

export default function SoundcheckSelector({
  initialCategory = 'prrt',
  onCategoryChange,
}: SoundcheckSelectorProps) {
  const { width: screenWidth } = Dimensions.get('window');
  const layout = useMemo(() => {
    const H_PADDING = 16; // marge écran
    const available = Math.max(260, screenWidth - H_PADDING * 2);

    let knob = Math.min(160, available * 0.44);
    let logoBox = Math.min(112, available * 0.30); // grands logos mais adaptatifs
    let orbitPadding = Math.max(14, available * 0.04);

    let orbitRadius = knob / 2 + logoBox / 2 + orbitPadding;
    let container = orbitRadius * 2 + 32;

    if (container > available) {
      const scale = available / container;
      knob = knob * scale;
      logoBox = logoBox * scale;
      orbitPadding = orbitPadding * scale;
      orbitRadius = knob / 2 + logoBox / 2 + orbitPadding;
      container = orbitRadius * 2 + 32;
    }

    const logoHalf = logoBox / 2;
    const logoImg = Math.round(logoBox * 0.93);

    // Offsets fins (px) adaptés à l'échelle
    const offsetsScaled: Record<SoundCategory, { dx: number; dy: number }> = {
      trll: { dx: 0, dy: 0 },
      prrt: { dx: 0, dy: Math.round(18 * (logoBox / 112)) },
      bzzz: { dx: 0, dy: Math.round(-28 * (logoBox / 112)) },
    };

    return {
      knobSize: Math.round(knob),
      logoBox: Math.round(logoBox),
      logoHalf,
      logoImg,
      orbitRadius,
      containerSize: Math.round(container),
      offsetsScaled,
    };
  }, [screenWidth]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const rotationAnim = useRef(new Animated.Value(KNOB_ROTATIONS[0])).current;
  const knobOuterRef = useRef<View | null>(null);
  const knobCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const applySelectionByIndexRef = useRef<(index: number) => void>(() => {});

  const persistAndNotify = useCallback(
    async (index: number) => {
      const category = CATEGORIES[index].id;
      try {
        await AsyncStorage.setItem(SOUND_CATEGORY_KEY, category);
      } catch (_) {}
      onCategoryChange?.(category);
    },
    [onCategoryChange]
  );

  const playPreview = useCallback(async (category: SoundCategory) => {
    // Empêcher les superpositions : on coupe/unload le précédent immédiatement.
    await stopCurrentPreviewSound();

    const seq = ++previewSeq;
    const list = PREVIEW_SOUNDS_BY_CATEGORY[category] ?? PREVIEW_SOUNDS_BY_CATEGORY.prrt;
    const soundAsset = list[Math.floor(Math.random() * list.length)];
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(soundAsset);
      // Si une autre preview a démarré entre-temps, on abandonne celle-ci.
      if (seq !== previewSeq) {
        try { await sound.unloadAsync(); } catch (_) {}
        return;
      }
      currentPreviewSound = sound;
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate(async (status: any) => {
        if (status?.isLoaded && status?.didJustFinish) {
          try { await sound.unloadAsync(); } catch (_) {}
          if (currentPreviewSound === sound) currentPreviewSound = null;
        }
      });
    } catch (_) {}
  }, []);

  const updateKnobCenter = useCallback(() => {
    knobOuterRef.current?.measureInWindow?.((x, y, w, h) => {
      knobCenterRef.current = { x: x + w / 2, y: y + h / 2 };
    });
  }, []);

  const applySelectionByIndex = useCallback(
    (index: number) => {
      if (index === selectedIndex) return;
      const category = CATEGORIES[index].id;
      setSelectedIndex(index);
      Animated.timing(rotationAnim, {
        toValue: KNOB_ROTATIONS[index],
        duration: 180,
        useNativeDriver: true,
      }).start();
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      playPreview(category);
      persistAndNotify(index);
    },
    [selectedIndex, rotationAnim, playPreview, persistAndNotify]
  );

  useEffect(() => {
    applySelectionByIndexRef.current = applySelectionByIndex;
  }, [applySelectionByIndex]);

  const selectIndex = useCallback(
    (index: number) => {
      applySelectionByIndex(index);
    },
    [applySelectionByIndex]
  );

  useEffect(() => {
    const cat = initialCategory ?? 'prrt';
    const idx = CATEGORIES.findIndex((c) => c.id === cat);
    const i = idx >= 0 ? idx : 0;
    setSelectedIndex(i);
    rotationAnim.setValue(KNOB_ROTATIONS[i]);
  }, [initialCategory, rotationAnim]);

  const cycleNext = useCallback(() => {
    const next = (selectedIndex + 1) % 3;
    selectIndex(next);
  }, [selectedIndex, selectIndex]);

  const knobPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        updateKnobCenter();
        const { pageX, pageY } = evt.nativeEvent;
        const dx = pageX - knobCenterRef.current.x;
        const dy = pageY - knobCenterRef.current.y;
        const angleDeg = normalizeAngle((Math.atan2(dy, dx) * 180) / Math.PI);
        const snapped = snapToNearestAngle(angleDeg);
        const index = SNAP_ANGLES.findIndex((a) => a === snapped);
        if (index >= 0) applySelectionByIndexRef.current(index);
      },
      onPanResponderMove: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        const dx = pageX - knobCenterRef.current.x;
        const dy = pageY - knobCenterRef.current.y;
        const angleDeg = normalizeAngle((Math.atan2(dy, dx) * 180) / Math.PI);
        const snapped = snapToNearestAngle(angleDeg);
        const index = SNAP_ANGLES.findIndex((a) => a === snapped);
        if (index >= 0) applySelectionByIndexRef.current(index);
      },
      onPanResponderRelease: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        const dx = pageX - knobCenterRef.current.x;
        const dy = pageY - knobCenterRef.current.y;
        const angleDeg = normalizeAngle((Math.atan2(dy, dx) * 180) / Math.PI);
        const snapped = snapToNearestAngle(angleDeg);
        const index = SNAP_ANGLES.findIndex((a) => a === snapped);
        if (index >= 0) applySelectionByIndexRef.current(index);
      },
      onPanResponderTerminate: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        const dx = pageX - knobCenterRef.current.x;
        const dy = pageY - knobCenterRef.current.y;
        const angleDeg = normalizeAngle((Math.atan2(dy, dx) * 180) / Math.PI);
        const snapped = snapToNearestAngle(angleDeg);
        const index = SNAP_ANGLES.findIndex((a) => a === snapped);
        if (index >= 0) applySelectionByIndexRef.current(index);
      },
    })
  ).current;

  const animatedKnobStyle = {
    transform: [
      {
        rotate: rotationAnim.interpolate({
          inputRange: [0, 60, 180, 300, 360],
          outputRange: ['0deg', '60deg', '180deg', '300deg', '360deg'],
        }),
      },
    ],
  };

  const center = layout.containerSize / 2;
  return (
    <View style={styles.wrapper}>
      <View style={[styles.selectorContainer, { width: layout.containerSize, height: layout.containerSize }]}>
        {CATEGORIES.map((cat, index) => {
          const rad = (cat.angle * Math.PI) / 180;
          const r = layout.orbitRadius * (RADIAL_FACTOR[cat.id] ?? 1);
          const x = Math.cos(rad) * r;
          const y = Math.sin(rad) * r;
          const off = layout.offsetsScaled[cat.id] ?? { dx: 0, dy: 0 };
          const left = center + x + off.dx - layout.logoHalf;
          const top = center + y + off.dy - layout.logoHalf;
          const isActive = index === selectedIndex;
          return (
            <TouchableOpacity
              key={cat.id}
              activeOpacity={0.8}
              onPress={() => selectIndex(index)}
              style={[styles.logoWrapper, { left, top, width: layout.logoBox, height: layout.logoBox }]}
            >
              <Image
                source={cat.source}
                style={[
                  styles.logoImage,
                  { opacity: isActive ? 1 : 0.4, width: layout.logoImg, height: layout.logoImg },
                ]}
                resizeMode="contain"
              />
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity activeOpacity={1} onPress={cycleNext} style={styles.knobTouch}>
          <View
            ref={(r) => {
              knobOuterRef.current = r;
            }}
            onLayout={updateKnobCenter}
            style={[
              styles.knobOuter,
              {
                width: layout.knobSize,
                height: layout.knobSize,
                borderRadius: layout.knobSize / 2,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.knobInner,
                {
                  width: Math.max(24, layout.knobSize - 16),
                  height: Math.max(24, layout.knobSize - 16),
                },
                animatedKnobStyle,
              ]}
              {...knobPanResponder.panHandlers}
            >
              <View style={styles.knobIndicator} />
            </Animated.View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  selectorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  logoWrapper: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
  },
  knobTouch: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  knobOuter: {
    backgroundColor: MINT,
    borderWidth: 4,
    borderColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  knobInner: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 4,
  },
  knobIndicator: {
    width: 4,
    height: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 2,
  },
});
