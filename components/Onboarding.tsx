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

type OnboardingProps = {
  onFinish: () => Promise<void> | void;
};

type Slide = {
  key: string;
  title: string;
  description: string;
  emoji?: string;
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
    emoji: '🔔',
  },
  {
    key: 'sound',
    title: 'Montez le volume',
    description:
      'Pensez à vérifier que vous avez le son activé (et pas en silencieux) pour profiter de la mélodie.',
    emoji: '🔊',
  },
  {
    key: 'friends',
    title: 'Plus on est de fous...',
    description:
      "Trouvez vos amis facilement en autorisant l'accès à vos contacts. On ne spamme pas, promis !",
    emoji: '👥',
  },
  {
    key: 'gesture',
    title: 'À vous de jouer',
    description:
      "Dès que vous avez un ami, swipez simplement sur son nom vers la droite pour lui envoyer un prout. Surprise garantie !",
    emoji: '👉',
  },
  {
    key: 'mute',
    title: 'Sourdine',
    description:
      "En swipant à gauche le nom d'un contact, vous pouvez le mettre en sourdine.",
    emoji: '🔇',
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
      ) : (
        <Text style={styles.emoji}>{item.emoji}</Text>
      )}
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
  emoji: {
    fontSize: 64,
    marginBottom: 20,
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

