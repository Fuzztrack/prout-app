import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import i18n from '@/lib/i18n';
import { Audio } from 'expo-av';
import { SOUND_ASSETS, SOUND_KEYS_BY_CATEGORY } from '@/lib/runtimeSounds';
import { SOUND_CATEGORY_KEY, type SoundCategory } from '@/components/SoundcheckSelector';

const BACKGROUND_COLOR = '#ebb89b';
const TRLL_KEYS = SOUND_KEYS_BY_CATEGORY.trll || [];
const BZZZ_KEYS = SOUND_KEYS_BY_CATEGORY.bzzz || [];
const DEFAULT_SOUND_OPTIONS: Array<{ category: SoundCategory; image: any }> = [
  { category: 'trll', image: require('../assets/images/tweet.png') },
  { category: 'bzzz', image: require('../assets/images/buzz.png') },
];

function getSoundDisplayName(soundKey: string) {
  const translated = i18n.t(`prout_names.${soundKey}`) as any;
  if (typeof translated === 'string' && translated !== `prout_names.${soundKey}`) {
    return translated;
  }
  const TRRL_FALLBACK: Record<string, string> = {
    trrl1: 'Le vertige du Shaman',
    trrl2: "L'Onde Incomprise",
    trrl3: 'Le Philosophe Noir',
    trrl4: 'Le Sifflet de Velours',
    trrl5: "L'Écho du Baobab",
  };
  return TRRL_FALLBACK[soundKey] || soundKey;
}

export default function SoundcheckScreen() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const currentSoundRef = useRef<Audio.Sound | null>(null);
  const [defaultCategory, setDefaultCategory] = useState<SoundCategory>('trll');

  // Taille du titre: on se base sur le vrai ratio de sound.png pour éviter
  // les "marges" visuelles créées par un ratio arbitraire + resizeMode="contain".
  const soundTitleAsset = Image.resolveAssetSource(require('../assets/images/sound.png'));
  const soundTitleAspectRatio =
    soundTitleAsset?.width && soundTitleAsset?.height
      ? soundTitleAsset.width / soundTitleAsset.height
      : 4; // fallback safe
  // On "sur-dimensionne" un peu le titre (image très large donc peu haute),
  // ça augmente sa hauteur sans réintroduire de marges.
  const titleScale = 0.8;
  const titleImageWidth = Math.round(screenWidth * titleScale);
  const titleImageHeight = Math.round(titleImageWidth / soundTitleAspectRatio);
  // Laisser le tableau descendre presque jusqu'en bas, en gardant ~200px de marge (titre + bas)
  const tableMaxHeight = Math.max(280, screenHeight - 200);

  const stopCurrentSound = useCallback(async () => {
    const current = currentSoundRef.current;
    if (!current) return;
    currentSoundRef.current = null;
    try {
      await current.stopAsync();
    } catch (_) {}
    try {
      await current.unloadAsync();
    } catch (_) {}
  }, []);

  const playableTrllKeys = useMemo(() => TRLL_KEYS.filter((k) => !!SOUND_ASSETS[k]), []);
  const playableBzzzKeys = useMemo(() => BZZZ_KEYS.filter((k) => !!SOUND_ASSETS[k]), []);
  const selectedDefaultCategoryIndex = useMemo(() => {
    const foundIndex = DEFAULT_SOUND_OPTIONS.findIndex((option) => option.category === defaultCategory);
    return foundIndex >= 0 ? foundIndex : 0;
  }, [defaultCategory]);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(SOUND_CATEGORY_KEY)
      .then((saved) => {
        if (!mounted || !saved) return;
        if (saved === 'trll' || saved === 'bzzz') {
          setDefaultCategory(saved);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const handleSelectDefaultCategory = useCallback(async (category: SoundCategory) => {
    setDefaultCategory(category);
    try {
      await AsyncStorage.setItem(SOUND_CATEGORY_KEY, category);
    } catch (_) {}
  }, []);

  const playSelectedSound = useCallback(async (soundKey: string) => {
    const asset = SOUND_ASSETS[soundKey];
    if (!asset) return;
    await stopCurrentSound();
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(asset);
      currentSoundRef.current = sound;
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate(async (status: any) => {
        if (status?.isLoaded && status?.didJustFinish) {
          try {
            await sound.unloadAsync();
          } catch (_) {}
          if (currentSoundRef.current === sound) {
            currentSoundRef.current = null;
          }
        }
      });
    } catch (_) {}
  }, [stopCurrentSound]);

  // Arrêter le son preview quand on quitte la page (swipe back ou flèche)
  useFocusEffect(
    useCallback(() => {
      // Cleanup quand la page perd le focus (swipe back, navigation, etc.)
      return () => {
        stopCurrentSound().catch(() => {});
      };
    }, [stopCurrentSound])
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        {/* Titre en HAUT (au-dessus de la flèche retour) */}
        <View style={styles.titleContainer} pointerEvents="none">
          <Image
            source={require('../assets/images/sound.png')}
            style={[styles.titleImage, { width: titleImageWidth, height: titleImageHeight }]}
            resizeMode="contain"
          />
        </View>

        {/* Ligne navigation EN DESSOUS du titre */}
        <View style={styles.navRow}>
            <TouchableOpacity
              onPress={() => {
                stopCurrentSound().catch(() => {});
                router.back();
              }}
              style={styles.backButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="arrow-back" size={24} color="#604a3e" />
            </TouchableOpacity>
          <View style={styles.headerSpacer} />
        </View>
      </View>
      <View style={styles.content}>
        <View style={styles.libraryArea}>
          <ScrollView
            style={[styles.libraryScroll, { maxHeight: tableMaxHeight }]}
            contentContainerStyle={styles.libraryScrollContent}
            showsVerticalScrollIndicator
          >
            <View style={styles.libraryColumns}>
              <View style={styles.libraryColumn}>
                <View style={styles.libraryHeaderCol}>
                  <Image source={require('../assets/images/tweet.png')} style={styles.libraryHeaderImage} resizeMode="contain" />
                </View>
                {playableTrllKeys.map((soundKey) => (
                  <TouchableOpacity
                    key={soundKey}
                    style={styles.libraryItem}
                    onPress={() => playSelectedSound(soundKey)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.libraryItemText}>
                      {getSoundDisplayName(soundKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.libraryColumn}>
                <View style={styles.libraryHeaderCol}>
                  <Image source={require('../assets/images/buzz.png')} style={styles.libraryHeaderImage} resizeMode="contain" />
                </View>
                {playableBzzzKeys.map((soundKey) => (
                  <TouchableOpacity
                    key={soundKey}
                    style={styles.libraryItem}
                    onPress={() => playSelectedSound(soundKey)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.libraryItemText}>
                      {getSoundDisplayName(soundKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
        <View style={[styles.defaultCategorySection, { paddingBottom: Math.max(10, insets.bottom) }]}>
          <Text style={styles.defaultCategoryTitle}>Choose your default sound notification category</Text>
          <View style={styles.defaultCategoryTrack}>
            <View
              pointerEvents="none"
              style={[
                styles.defaultCategoryIndicator,
                { left: `${selectedDefaultCategoryIndex * (100 / 2)}%` },
              ]}
            />
            {DEFAULT_SOUND_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.category}
                style={styles.defaultCategoryStep}
                onPress={() => handleSelectDefaultCategory(option.category)}
                activeOpacity={0.85}
              >
                <Image source={option.image} style={styles.defaultCategoryIcon} resizeMode="contain" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  content: {
    flex: 1,
  },
  header: {
    // Important: ne pas centrer verticalement le contenu du header,
    // sinon quand l'image grandit elle "descend" (effet de centrage).
    alignItems: 'stretch',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 0,
    paddingHorizontal: 12,
  },
  backButton: {
    // Garder une zone de touch confortable sans "pousser" vers le bas
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 0,
  },
  headerSpacer: {
    width: 40,
  },
  titleContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
  },
  titleImage: {
    marginTop: 0,
    marginBottom: 10,
  },
  libraryArea: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    justifyContent: 'flex-start',
  },
  libraryHeaderCol: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  libraryHeaderImage: {
    width: 98,
    height: 40,
    marginBottom: 2,
  },
  libraryHeaderDefinition: {
    color: '#604a3e',
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
    minHeight: 34,
  },
  libraryScroll: {
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.12)',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  libraryScrollContent: {
    paddingHorizontal: 0,
    paddingVertical: 8,
  },
  libraryColumns: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  libraryColumn: {
    flex: 1,
  },
  libraryItem: {
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.2)',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  libraryItemText: {
    color: '#604a3e',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  defaultCategorySection: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  defaultCategoryTitle: {
    color: '#604a3e',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  defaultCategoryTrack: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.18)',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.32)',
    overflow: 'hidden',
    minHeight: 62,
  },
  defaultCategoryIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '50%',
    backgroundColor: 'rgba(162, 228, 212, 0.72)',
  },
  defaultCategoryStep: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  defaultCategoryIcon: {
    width: 84,
    height: 32,
  },
});
