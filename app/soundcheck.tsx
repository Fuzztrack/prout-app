import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  Image,
  Platform,
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
const POP_KEYS = SOUND_KEYS_BY_CATEGORY.pop || [];
const MOOD_KEYS = SOUND_KEYS_BY_CATEGORY.mood || [];
const TOOT_KEYS = SOUND_KEYS_BY_CATEGORY.toot || [];
const IS_ENGLISH_LOCALE = String(i18n.locale || '').toLowerCase().startsWith('en');
const USE_PROOT_TOOT_LOGO = Platform.OS === 'android' || !IS_ENGLISH_LOCALE;
const TOOT_LOGO_IMAGE = USE_PROOT_TOOT_LOGO
  ? require('../assets/images/proot.png')
  : require('../assets/images/toot.png');
// Android : proot un peu plus petit qu’avant ; iOS inchangé
const TOOT_HEADER_SIZE = Platform.OS === 'android'
  ? { width: 108, height: 47 }
  : USE_PROOT_TOOT_LOGO
    ? { width: 104, height: 44 }
    : { width: 80, height: 32 };
const MOOD_HEADER_SIZE = Platform.OS === 'android' ? { width: 94, height: 38 } : undefined;

/**
 * iOS — sous-titre colonne toot (soundcheck) :
 * - anglais : "to smile" · français : "pour tout et rien"
 * - es / pt / de / it : mêmes libellés « à la française » que sur Android (`soundcheck_subtitle_toot_android`)
 */
function getIOSTootSoundcheckSubtitleKey():
  | 'soundcheck_subtitle_toot'
  | 'soundcheck_subtitle_toot_android' {
  const loc = String(i18n.locale || '').toLowerCase();
  if (loc.startsWith('en') || loc.startsWith('fr')) {
    return 'soundcheck_subtitle_toot';
  }
  if (
    loc.startsWith('es') ||
    loc.startsWith('pt') ||
    loc.startsWith('de') ||
    loc.startsWith('it')
  ) {
    return 'soundcheck_subtitle_toot_android';
  }
  return 'soundcheck_subtitle_toot';
}

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
  const playablePopKeys = useMemo(() => POP_KEYS.filter((k) => !!SOUND_ASSETS[k]), []);
  const playableMoodKeys = useMemo(() => MOOD_KEYS.filter((k) => !!SOUND_ASSETS[k]), []);
  const playableTootKeys = useMemo(() => TOOT_KEYS.filter((k) => !!SOUND_ASSETS[k]), []);

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
          <Text style={styles.pageSubtitleNav}>{i18n.t('soundcheck_subtitle_explore_library')}</Text>
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
                {Platform.OS === 'android' && (
                  <>
                    <View style={styles.libraryHeaderCol}>
                      <Image source={TOOT_LOGO_IMAGE} style={[styles.libraryHeaderImage, TOOT_HEADER_SIZE]} resizeMode="contain" />
                      <Text style={styles.libraryHeaderSubtitle}>
                        {i18n.t(
                          Platform.OS === 'android'
                            ? 'soundcheck_subtitle_toot_android'
                            : 'soundcheck_subtitle_toot'
                        )}
                      </Text>
                    </View>
                    {playableTootKeys.map((soundKey) => (
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
                    <View style={[styles.libraryHeaderCol, { marginTop: 16 }]}>
                      <Image source={require('../assets/images/tweet.png')} style={styles.libraryHeaderImage} resizeMode="contain" />
                      <Text style={styles.libraryHeaderSubtitle}>{i18n.t('soundcheck_subtitle_tweet')}</Text>
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
                  </>
                )}
                {Platform.OS !== 'android' && (
                  <View style={styles.libraryHeaderCol}>
                    <Image source={require('../assets/images/mood.png')} style={[styles.libraryHeaderImage, MOOD_HEADER_SIZE]} resizeMode="contain" />
                    <Text style={styles.libraryHeaderSubtitle}>{i18n.t('soundcheck_subtitle_mood')}</Text>
                  </View>
                )}
                {Platform.OS !== 'android' &&
                  playableMoodKeys.map((soundKey) => (
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
                {Platform.OS === 'ios' && (
                  <>
                    <View style={[styles.libraryHeaderCol, { marginTop: 16 }]}>
                      <Image source={require('../assets/images/tweet.png')} style={styles.libraryHeaderImage} resizeMode="contain" />
                      <Text style={styles.libraryHeaderSubtitle}>{i18n.t('soundcheck_subtitle_tweet')}</Text>
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
                    <View style={[styles.libraryHeaderCol, { marginTop: 16 }]}>
                      <Image source={require('../assets/images/buzz.png')} style={styles.libraryHeaderImage} resizeMode="contain" />
                      <Text style={styles.libraryHeaderSubtitle}>{i18n.t('soundcheck_subtitle_buzz')}</Text>
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
                  </>
                )}
              </View>
              <View style={styles.libraryColumn}>
                <View style={styles.libraryHeaderCol}>
                  <Image source={require('../assets/images/pop.png')} style={[styles.libraryHeaderImage, { width: 78, height: 32 }]} resizeMode="contain" />
                  <Text style={styles.libraryHeaderSubtitle}>{i18n.t('soundcheck_subtitle_pop')}</Text>
                </View>
                {playablePopKeys.map((soundKey) => (
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
                {Platform.OS === 'android' && (
                  <>
                    <View style={[styles.libraryHeaderCol, { marginTop: 16 }]}>
                      <Image source={require('../assets/images/mood.png')} style={[styles.libraryHeaderImage, MOOD_HEADER_SIZE]} resizeMode="contain" />
                      <Text style={styles.libraryHeaderSubtitle}>{i18n.t('soundcheck_subtitle_mood')}</Text>
                    </View>
                    {playableMoodKeys.map((soundKey) => (
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
                    <View style={[styles.libraryHeaderCol, { marginTop: 16 }]}>
                      <Image source={require('../assets/images/buzz.png')} style={styles.libraryHeaderImage} resizeMode="contain" />
                      <Text style={styles.libraryHeaderSubtitle}>{i18n.t('soundcheck_subtitle_buzz')}</Text>
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
                  </>
                )}
                {Platform.OS !== 'android' && (
                  <>
                    <View style={[styles.libraryHeaderCol, { marginTop: 16 }]}>
                      <Image source={TOOT_LOGO_IMAGE} style={[styles.libraryHeaderImage, TOOT_HEADER_SIZE]} resizeMode="contain" />
                      <Text style={styles.libraryHeaderSubtitle}>
                        {i18n.t(getIOSTootSoundcheckSubtitleKey())}
                      </Text>
                    </View>
                    {playableTootKeys.map((soundKey) => (
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
                  </>
                )}
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
  pageSubtitleNav: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontStyle: 'italic',
    color: '#604a3e',
    marginTop: 0,
    marginBottom: 0,
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
  libraryHeaderSubtitle: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#604a3e',
    textAlign: 'center',
    marginTop: 1,
    marginBottom: 4,
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
});
