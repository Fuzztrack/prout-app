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
import ProotSilenceChallenge from '@/components/ProotSilenceChallenge';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const BACKGROUND_COLOR = '#ebb89b';
const TRLL_KEYS = SOUND_KEYS_BY_CATEGORY.trll || [];
const BZZZ_KEYS = SOUND_KEYS_BY_CATEGORY.bzzz || [];
const POP_KEYS = SOUND_KEYS_BY_CATEGORY.pop || [];
const MOOD_KEYS = SOUND_KEYS_BY_CATEGORY.mood || [];
const TOOT_KEYS = SOUND_KEYS_BY_CATEGORY.toot || [];
const USE_PROOT_TOOT_LOGO = true;
const TOOT_LOGO_IMAGE = require('../assets/images/proot.png');
const TOOT_HEADER_SIZE = Platform.OS === 'android'
  ? { width: 108, height: 47 }
  : USE_PROOT_TOOT_LOGO
    ? { width: 104, height: 44 }
    : { width: 80, height: 32 };
const MOOD_HEADER_SIZE = Platform.OS === 'android' ? { width: 94, height: 38 } : undefined;

function AnimatedLibraryHeaderImage({
  source,
  style,
  isActive = false,
}: {
  source: any;
  style?: any;
  isActive?: boolean;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(scale);
    if (isActive) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 180 }),
          withTiming(1, { duration: 220 }),
          withTiming(1, { duration: 3000 }),
        ),
        -1,
        false,
      );
    } else {
      scale.value = withTiming(1, { duration: 120 });
    }
    return () => cancelAnimation(scale);
  }, [isActive, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.Image source={source} style={[style, animatedStyle]} resizeMode="contain" />
  );
}

function getIOSTootSoundcheckSubtitleKey(): 'soundcheck_subtitle_toot' | 'soundcheck_subtitle_toot_android' {
  const loc = String(i18n.locale || '').toLowerCase();
  if (loc.startsWith('en')) return 'soundcheck_subtitle_toot_android';
  if (loc.startsWith('fr')) return 'soundcheck_subtitle_toot';
  return 'soundcheck_subtitle_toot_android';
}

function getSoundDisplayName(soundKey: string) {
  const translated = i18n.t(`prout_names.${soundKey}`) as any;
  if (typeof translated === 'string' && translated !== `prout_names.${soundKey}`) return translated;
  return soundKey;
}

export default function SoundcheckScreen() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const currentSoundRef = useRef<Audio.Sound | null>(null);
  const [previewingSoundKey, setPreviewingSoundKey] = useState<string | null>(null);
  const [isChallengeVisible, setIsChallengeVisible] = useState(false);

  // Animation de "respiration" vive pour le personnage secret + vibration
  const pulseScale = useSharedValue(1);
  const shakeX = useSharedValue(0);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 180 }),
        withTiming(1, { duration: 220 }),
        withTiming(1, { duration: 2600 }),
      ),
      -1,
      false
    );

    shakeX.value = withRepeat(
      withSequence(
        // Phase active (environ 400ms pour correspondre au grossissement)
        withSequence(
          withTiming(-2.5, { duration: 40 }),
          withTiming(2.5, { duration: 40 }),
          withTiming(-2.5, { duration: 40 }),
          withTiming(2.5, { duration: 40 }),
          withTiming(-2.5, { duration: 40 }),
          withTiming(2.5, { duration: 40 }),
          withTiming(-2.5, { duration: 40 }),
          withTiming(2.5, { duration: 40 }),
          withTiming(-2.5, { duration: 40 }),
          withTiming(0, { duration: 40 }),
        ),
        // Phase de repos (2600ms)
        withTiming(0, { duration: 2600 }),
      ),
      -1,
      false
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: pulseScale.value },
      { translateX: shakeX.value }
    ],
  }));

  const soundTitleAsset = Image.resolveAssetSource(require('../assets/images/sound.png'));
  const soundcheckTailImage = Platform.OS === 'android'
    ? require('../assets/images/proothail2.png')
    : require('../assets/images/proothail2.png');
  const proothailAsset = Image.resolveAssetSource(soundcheckTailImage);
  const soundTitleAspectRatio = soundTitleAsset?.width ? soundTitleAsset.width / soundTitleAsset.height : 4;
  const proothailAspectRatio = proothailAsset?.width ? proothailAsset.width / proothailAsset.height : 1;
  
  const titleScale = 0.52;
  const titleImageWidth = Math.round(screenWidth * titleScale);
  const titleImageHeight = Math.round(titleImageWidth / soundTitleAspectRatio);
  const proothailHeight = Platform.OS === 'android'
    ? Math.min(78, Math.max(58, Math.round(titleImageHeight * 1.15)))
    : Math.min(72, Math.max(52, Math.round(titleImageHeight * 1.15)));
  const proothailWidth = Math.round(proothailHeight * proothailAspectRatio);
  const tableMaxHeight = Math.max(280, screenHeight - 200);

  // Ajustement spécifique pour petit écran iOS (< 380px de large)
  const proothailMarginRight = (Platform.OS === 'ios' && screenWidth < 380) ? -18 : -24;

  const stopCurrentSound = useCallback(async () => {
    const current = currentSoundRef.current;
    if (!current) { setPreviewingSoundKey(null); return; }
    currentSoundRef.current = null;
    setPreviewingSoundKey(null);
    try { await current.stopAsync(); await current.unloadAsync(); } catch (_) {}
  }, []);

  const playableTrllKeys = useMemo(() => TRLL_KEYS.filter((k) => !!SOUND_ASSETS[k]), []);
  const playableBzzzKeys = useMemo(() => BZZZ_KEYS.filter((k) => !!SOUND_ASSETS[k]), []);
  const playablePopKeys = useMemo(() => POP_KEYS.filter((k) => !!SOUND_ASSETS[k]), []);
  const playableMoodKeys = useMemo(() => MOOD_KEYS.filter((k) => !!SOUND_ASSETS[k]), []);
  const playableTootKeys = useMemo(() => TOOT_KEYS.filter((k) => !!SOUND_ASSETS[k]), []);
  
  const previewingCategory = useMemo(() => {
    if (!previewingSoundKey) return null;
    if (TOOT_KEYS.includes(previewingSoundKey)) return 'toot';
    if (MOOD_KEYS.includes(previewingSoundKey)) return 'mood';
    if (POP_KEYS.includes(previewingSoundKey)) return 'pop';
    if (TRLL_KEYS.includes(previewingSoundKey)) return 'trll';
    if (BZZZ_KEYS.includes(previewingSoundKey)) return 'bzzz';
    return null;
  }, [previewingSoundKey]);

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
      setPreviewingSoundKey(soundKey);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate(async (status: any) => {
        if (status?.isLoaded && status?.didJustFinish) {
          setPreviewingSoundKey((prev) => (prev === soundKey ? null : prev));
          try { await sound.unloadAsync(); } catch (_) {}
          if (currentSoundRef.current === sound) currentSoundRef.current = null;
        }
      });
    } catch (_) { setPreviewingSoundKey(null); }
  }, [stopCurrentSound]);

  const renderSoundRow = useCallback(
    (soundKey: string) => (
      <TouchableOpacity
        key={soundKey}
        style={[styles.libraryItem, previewingSoundKey === soundKey && styles.libraryItemActive]}
        onPress={() => playSelectedSound(soundKey)}
        activeOpacity={0.85}
      >
        <Text style={styles.libraryItemText}>{getSoundDisplayName(soundKey)}</Text>
      </TouchableOpacity>
    ),
    [previewingSoundKey, playSelectedSound]
  );

  useFocusEffect(useCallback(() => { return () => { stopCurrentSound().catch(() => {}); }; }, [stopCurrentSound]));

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.titleRow}>
          <View style={styles.titleCluster}>
            {/* PERSONNAGE SECRET CLIQUABLE ET QUI RESPIRE */}
            <TouchableOpacity 
              onPress={() => setIsChallengeVisible(true)}
              activeOpacity={0.9}
            >
              <Animated.Image
                source={soundcheckTailImage}
                style={[
                  styles.proothailImage, 
                  { 
                    width: proothailWidth, 
                    height: proothailHeight,
                    marginRight: proothailMarginRight 
                  }, 
                  pulseStyle
                ]}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <Image
              source={require('../assets/images/sound.png')}
              style={[styles.titleImage, { width: titleImageWidth, height: titleImageHeight }]}
              resizeMode="contain"
            />
          </View>
        </View>

        <View style={styles.navRow}>
            <TouchableOpacity
              onPress={() => { stopCurrentSound().catch(() => {}); router.back(); }}
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
                <View style={styles.libraryHeaderCol}>
                  <AnimatedLibraryHeaderImage 
                    source={TOOT_LOGO_IMAGE} 
                    style={[styles.libraryHeaderImage, TOOT_HEADER_SIZE]} 
                    isActive={previewingCategory === 'toot'} 
                  />
                  <Text style={styles.libraryHeaderSubtitle}>
                    {i18n.t('soundcheck_subtitle_toot_android')}
                  </Text>
                </View>
                {playableTootKeys.map((soundKey) => renderSoundRow(soundKey))}
                
                <View style={[styles.libraryHeaderCol, { marginTop: 16 }]}>
                  <AnimatedLibraryHeaderImage 
                    source={require('../assets/images/buzz.png')} 
                    style={styles.libraryHeaderImage} 
                    isActive={previewingCategory === 'bzzz'} 
                  />
                  <Text style={styles.libraryHeaderSubtitle}>{i18n.t('soundcheck_subtitle_buzz')}</Text>
                </View>
                {playableBzzzKeys.map((soundKey) => renderSoundRow(soundKey))}
              </View>

              <View style={styles.libraryColumn}>
                <View style={styles.libraryHeaderCol}>
                  <AnimatedLibraryHeaderImage 
                    source={require('../assets/images/pop.png')} 
                    style={[styles.libraryHeaderImage, { width: 78, height: 32 }]} 
                    isActive={previewingCategory === 'pop'} 
                  />
                  <Text style={styles.libraryHeaderSubtitle}>{i18n.t('soundcheck_subtitle_pop')}</Text>
                </View>
                {playablePopKeys.map((soundKey) => renderSoundRow(soundKey))}

                <View style={[styles.libraryHeaderCol, { marginTop: 16 }]}>
                  <AnimatedLibraryHeaderImage 
                    source={require('../assets/images/mood.png')} 
                    style={[styles.libraryHeaderImage, MOOD_HEADER_SIZE]} 
                    isActive={previewingCategory === 'mood'} 
                  />
                  <Text style={styles.libraryHeaderSubtitle}>{i18n.t('soundcheck_subtitle_mood')}</Text>
                </View>
                {playableMoodKeys.map((soundKey) => renderSoundRow(soundKey))}

                <View style={[styles.libraryHeaderCol, { marginTop: 16 }]}>
                  <AnimatedLibraryHeaderImage 
                    source={require('../assets/images/tweet.png')} 
                    style={styles.libraryHeaderImage} 
                    isActive={previewingCategory === 'trll'} 
                  />
                  <Text style={styles.libraryHeaderSubtitle}>{i18n.t('soundcheck_subtitle_tweet')}</Text>
                </View>
                {playableTrllKeys.map((soundKey) => renderSoundRow(soundKey))}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>

      <ProotSilenceChallenge isVisible={isChallengeVisible} onClose={() => setIsChallengeVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_COLOR },
  content: { flex: 1 },
  header: { alignItems: 'stretch', paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 0, paddingHorizontal: 12 },
  backButton: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 0 },
  headerSpacer: { width: 40 },
  titleRow: { width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  titleCluster: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  titleImage: { marginTop: 0, marginBottom: 0, zIndex: 2, elevation: 4 },
  proothailImage: { marginTop: -4, marginBottom: 0, marginLeft: -12, marginRight: -24, zIndex: 0 },
  pageSubtitleNav: { flex: 1, textAlign: 'center', fontSize: 12, fontStyle: 'italic', fontWeight: '700', color: '#604a3e', marginTop: 0, marginBottom: 0 },
  libraryArea: { flex: 1, paddingHorizontal: 12, paddingTop: 8, justifyContent: 'flex-start' },
  libraryHeaderCol: { justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  libraryHeaderImage: { width: 98, height: 40, marginBottom: 2 },
  libraryHeaderSubtitle: { fontSize: 11, fontStyle: 'italic', color: '#604a3e', textAlign: 'center', marginTop: 1, marginBottom: 4 },
  libraryScroll: { borderWidth: 1, borderColor: 'rgba(96, 74, 62, 0.12)', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)' },
  libraryScrollContent: { paddingHorizontal: 0, paddingVertical: 8 },
  libraryColumns: { flexDirection: 'row', gap: 12, width: '100%' },
  libraryColumn: { flex: 1 },
  libraryItem: { borderWidth: 2, borderColor: 'transparent', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.55)' },
  libraryItemActive: { backgroundColor: 'rgba(162, 228, 212, 0.72)', borderColor: 'rgba(96, 74, 62, 0.45)' },
  libraryItemText: { color: '#604a3e', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
