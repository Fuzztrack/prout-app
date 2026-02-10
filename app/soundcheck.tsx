import SoundcheckSelector, { stopCurrentPreviewSound } from '@/components/SoundcheckSelector';
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
const SOUND_ENABLED_KEY = 'soundcheck_sound_enabled';

export default function SoundcheckScreen() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [initialCategory, setInitialCategory] = useState<SoundCategory | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean | null>(null); // null = loading

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
  const soundwaveHeight = Math.min(90, Math.max(56, Math.round(screenWidth * 0.18)));
  const soundwaveWidth = Math.max(220, Math.round(screenWidth - 32)); // petite marge sur les bords

  // Flèche retour : toujours affichée
  const showBackButton = true;

  useEffect(() => {
    // Charger la catégorie sélectionnée
    AsyncStorage.getItem(SOUND_CATEGORY_KEY).then((saved) => {
      setInitialCategory((saved as SoundCategory) || 'trll');
    }).catch(() => setInitialCategory('trll'));

    // Charger l'état du son (par défaut: activé)
    AsyncStorage.getItem(SOUND_ENABLED_KEY).then((saved) => {
      setSoundEnabled(saved === null ? true : saved === 'true');
    }).catch(() => setSoundEnabled(true));
  }, []);

  // Arrêter le son preview quand on quitte la page (swipe back ou flèche)
  useFocusEffect(
    useCallback(() => {
      // Cleanup quand la page perd le focus (swipe back, navigation, etc.)
      return () => {
        stopCurrentPreviewSound().catch(() => {});
      };
    }, [])
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
          <Text style={styles.titleHint}>{i18n.t('soundcheck_hint')}</Text>
        </View>

        {/* Ligne navigation EN DESSOUS du titre */}
        <View style={styles.navRow}>
            <TouchableOpacity
              onPress={() => {
                stopCurrentPreviewSound().catch(() => {});
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
      <View style={styles.selectorArea}>
        {soundEnabled !== null && (
          <SoundcheckSelector initialCategory={initialCategory} soundEnabled={soundEnabled} />
        )}
      </View>
      {/* Bande sonore en bas (cliquable pour toggle son) */}
      <View style={[styles.bottomWave, { bottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          onPress={() => {
            const newValue = !soundEnabled;
            setSoundEnabled(newValue);
            AsyncStorage.setItem(SOUND_ENABLED_KEY, String(newValue)).catch(() => {});
            if (soundEnabled) {
              stopCurrentPreviewSound().catch(() => {});
            }
          }}
          activeOpacity={0.7}
          style={{ alignItems: 'center' }}
        >
          <Text style={[styles.soundToggleText, { color: soundEnabled ? '#ffffff' : '#999999' }]}>
            {soundEnabled ? 'Sound on' : 'Sound off'}
          </Text>
          <Image
            source={require('../assets/images/soundwave.png')}
            style={[styles.bottomWaveImage, { width: soundwaveWidth, height: soundwaveHeight }]}
            resizeMode="contain"
          />
        </TouchableOpacity>
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
    marginBottom: 16,
  },
  titleHint: {
    marginTop: 0,
    marginBottom: 0,
    fontSize: 16,
    color: '#604a3e',
    textAlign: 'center',
    paddingHorizontal: 12,
    lineHeight: 22,
    fontStyle: 'italic',
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
  soundToggleText: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 6,
    textAlign: 'center',
  },
  bottomWaveImage: {
  },
});
