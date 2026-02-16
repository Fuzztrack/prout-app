import { Ionicons } from '@expo/vector-icons';
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

const BACKGROUND_COLOR = '#ebb89b';
const TRLL_KEYS = SOUND_KEYS_BY_CATEGORY.trll || [];
const BZZZ_KEYS = SOUND_KEYS_BY_CATEGORY.bzzz || [];

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
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const currentSoundRef = useRef<Audio.Sound | null>(null);

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
  const tableMaxHeight = Math.max(280, Math.min(430, Math.round(screenWidth * 1.06)));

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
          <View style={styles.libraryHeaderRow}>
            <View style={styles.libraryHeaderCol}>
              <Image source={require('../assets/images/trrl.png')} style={styles.libraryHeaderImage} resizeMode="contain" />
              <Text style={styles.libraryHeaderDefinition}>{i18n.t('soundcheck_trll_description')}</Text>
            </View>
            <View style={styles.libraryHeaderCol}>
              <Image source={require('../assets/images/bzzz.png')} style={styles.libraryHeaderImage} resizeMode="contain" />
              <Text style={styles.libraryHeaderDefinition}>{i18n.t('soundcheck_bzzz_description')}</Text>
            </View>
          </View>
          <ScrollView
            style={[styles.libraryScroll, { maxHeight: tableMaxHeight }]}
            contentContainerStyle={styles.libraryScrollContent}
            showsVerticalScrollIndicator
          >
            <View style={styles.libraryColumns}>
              <View style={styles.libraryColumn}>
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
    paddingHorizontal: 24,
    paddingTop: 8,
    justifyContent: 'flex-start',
  },
  libraryHeaderRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  libraryHeaderCol: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  libraryColumns: {
    flexDirection: 'row',
    gap: 10,
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
});
