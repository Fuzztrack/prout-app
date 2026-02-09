import SoundcheckSelector from '@/components/SoundcheckSelector';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import i18n from '@/lib/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOUND_CATEGORY_KEY, type SoundCategory } from '@/components/SoundcheckSelector';

const BACKGROUND_COLOR = '#ebb89b';

export default function SoundcheckScreen() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [initialCategory, setInitialCategory] = useState<SoundCategory | null>(null);

  // On garde un header lisible (sinon il chevauche le centre et le sélecteur).
  const titleImageHeight = Math.min(150, Math.max(95, Math.round(screenHeight * 0.14)));
  const titleImageWidth = Math.round(titleImageHeight * (310 / 75)); // proche de resonance.png
  const soundwaveHeight = Math.min(90, Math.max(56, Math.round(screenWidth * 0.18)));
  const soundwaveWidth = Math.max(220, Math.round(screenWidth - 32)); // petite marge sur les bords

  // Flèche retour : affichée sur simulateur (Constants.isDevice peut être bugué et renvoyer true sur simu, donc on affiche si !isDevice ou en dev)
  const showBackButton = !Constants.isDevice || __DEV__;

  useEffect(() => {
    AsyncStorage.getItem(SOUND_CATEGORY_KEY).then((saved) => {
      setInitialCategory((saved as SoundCategory) || 'prrt');
    }).catch(() => setInitialCategory('prrt'));
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          {showBackButton ? (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="arrow-back" size={24} color="#604a3e" />
            </TouchableOpacity>
          ) : (
            <View style={[styles.backButton, { width: 40 }]} />
          )}
          <View style={styles.titleContainer} pointerEvents="none">
            <Image
              source={require('../assets/images/sound.png')}
              style={[styles.titleImage, { width: titleImageWidth, height: titleImageHeight }]}
              resizeMode="contain"
            />
            <Text style={styles.titleHint}>{i18n.t('soundcheck_hint')}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </View>
      <View style={styles.selectorArea}>
        <SoundcheckSelector initialCategory={initialCategory} />
      </View>
      {/* Bande sonore en bas (sans déformation, avec marge) */}
      <View style={[styles.bottomWave, { bottom: insets.bottom + 16 }]} pointerEvents="none">
        <Image
          source={require('../assets/images/soundwave.png')}
          style={[styles.bottomWaveImage, { width: soundwaveWidth, height: soundwaveHeight }]}
          resizeMode="contain"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  backButton: {
    padding: 8,
  },
  headerSpacer: {
    width: 40,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  titleImage: {
    maxWidth: '100%',
  },
  titleHint: {
    marginTop: 4,
    marginBottom: 2,
    fontSize: 13,
    color: '#604a3e',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  selectorArea: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 6,
    marginTop: 0,
    paddingBottom: 10,
  },
  bottomWave: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.95,
  },
  bottomWaveImage: {
  },
});
