import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../lib/i18n';

type OnboardingProps = {
  onFinish: () => Promise<void> | void;
};

type Slide = {
  key: string;
  title: string;
  description: string;
  icon?: string;
  color?: string;
};

const slides: Slide[] = [
  {
    key: 'welcome',
    title: 'Bienvenue sur Prout !',
    description: "L'appli de notification de prout.",
  },
  {
    key: 'notifications',
    title: 'Le cœur du Prout',
    description:
      "Tout l'intérêt réside dans la surprise ! Acceptez les notifications pour recevoir les prouts de vos amis.",
    icon: 'notifications-outline',
    color: '#9C27B0',
  },
  {
    key: 'sound',
    title: 'Montez le volume',
    description:
      'Pensez à vérifier que vous avez le son activé (et pas en silencieux) pour profiter de la mélodie.',
    icon: 'volume-high-outline',
    color: '#F4A261',
  },
  {
    key: 'gesture',
    title: 'À vous de jouer',
    description:
      "Dès que vous avez un ami, swipez simplement sur son nom vers la droite pour lui envoyer un prout. Surprise garantie !",
    icon: 'paper-plane-outline',
    color: '#4CAF50',
  },
  {
    key: 'mute',
    title: i18n.t('tuto_4_title'),
    description: i18n.t('tuto_4_desc'),
    icon: 'volume-mute-outline',
    color: '#FF9800',
  },
];

const { width } = Dimensions.get('window');

export default function Onboarding({ onFinish }: OnboardingProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const flatListRef = useRef<FlatList<Slide>>(null);

  const handleViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems?.length > 0 && typeof viewableItems[0].index === 'number') {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const completeOnboarding = useCallback(async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    } catch (e) {
      console.warn('❌ Impossible de stocker hasSeenOnboarding:', e);
    }
    try {
      await onFinish?.();
    } finally {
      setIsFinishing(false);
    }
  }, [isFinishing, onFinish]);

  const isLastSlide = currentIndex === slides.length - 1;

  const renderItem = ({ item }: { item: Slide }) => (
    <View style={[styles.slide, { width }]}>
      {item.key === 'welcome' ? (
        <Image source={require('../assets/images/adaptive_icon.png')} style={styles.image} />
      ) : item.icon && item.color ? (
        <View style={[styles.iconContainer, { backgroundColor: item.color }]}>
          <Ionicons name={item.icon as any} size={64} color="white" />
        </View>
      ) : null}
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </View>
  );

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity style={styles.skipButton} onPress={completeOnboarding}>
          <Text style={styles.skipText}>Passer</Text>
        </TouchableOpacity>

        <Animated.FlatList
          ref={flatListRef}
          data={slides}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={viewConfig}
          bounces={false}
        />

        <View style={styles.footer}>
          <View style={styles.dots}>
            {slides.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  currentIndex === index && styles.activeDot,
                ]}
              />
            ))}
          </View>

          {isLastSlide && (
            <TouchableOpacity
              style={styles.startButton}
              onPress={completeOnboarding}
              disabled={isFinishing}
            >
              <Text style={styles.startButtonText}>C'est parti !</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ebb89b',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  safeArea: {
    flex: 1,
    width: '100%',
  },
  skipButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 2,
    padding: 10,
  },
  skipText: {
    color: '#604a3e',
    fontWeight: '600',
    fontSize: 16,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: 150,
    height: 150,
    marginBottom: 20,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#604a3e',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#4a3329',
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    paddingBottom: 24,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    marginVertical: 16,
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(96, 74, 62, 0.3)',
  },
  activeDot: {
    backgroundColor: '#604a3e',
    width: 20,
  },
  startButton: {
    backgroundColor: '#604a3e',
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 25,
  },
  startButtonText: {
    color: '#ebb89b',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

