import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  Modal,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
  interpolate,
} from 'react-native-reanimated';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const GRID_PADDING = 20;
const GRID_WIDTH = width - (GRID_PADDING * 2);
const CELL_MARGIN = 6;
const CELL_SIZE = (GRID_WIDTH / 3) - (CELL_MARGIN * 2);

const TOOT_SOUNDS = [
  require('../assets/sounds/toot1.wav'),
  require('../assets/sounds/toot3.wav'),
  require('../assets/sounds/toot4.wav'),
  require('../assets/sounds/toot6.wav'),
  require('../assets/sounds/toot8.wav'),
  require('../assets/sounds/toot9.wav'),
  require('../assets/sounds/toot10.wav'),
  require('../assets/sounds/toot11.wav'),
  require('../assets/sounds/toot12.wav'),
  require('../assets/sounds/toot13.wav'),
  require('../assets/sounds/toot14.wav'),
  require('../assets/sounds/toot16.wav'),
  require('../assets/sounds/toot17.wav'),
  require('../assets/sounds/toot18.wav'),
  require('../assets/sounds/toot19.wav'),
  require('../assets/sounds/toot20.wav'),
];

interface ProotSilenceChallengeProps {
  isVisible: boolean;
  onClose: () => void;
}

type GameStatus = 'idle' | 'playing' | 'levelUp' | 'finished';

const AnimatedSuccessScore = ({ percentage }: { percentage: number }) => {
  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = withDelay(300, withSpring(1, { damping: 8, stiffness: 120 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.Text style={[styles.finalScore, animatedStyle]}>
      {percentage}%
    </Animated.Text>
  );
};

const ProotSilenceChallenge: React.FC<ProotSilenceChallengeProps> = ({ isVisible, onClose }) => {
  const [score, setScore] = useState(0);
  const [missedCount, setMissedCount] = useState(0);
  const [level, setLevel] = useState(1);
  const [activeHoles, setActiveHoles] = useState<number[]>([]);
  const [poppingHoles, setPoppingHoles] = useState<number[]>([]);
  const [status, setStatus] = useState<GameStatus>('idle');
  const [levelTimeLeft, setLevelTimeLeft] = useState(10);
  
  const cloudTimeoutsRef = useRef<Record<number, NodeJS.Timeout>>({});
  const spawnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const levelTimerRef = useRef<NodeJS.Timeout | null>(null);
  const levelRef = useRef(1);
  
  const activeSoundsRef = useRef<Audio.Sound[]>([]);

  const levelOpacity = useSharedValue(0);

  const levelMessageStyle = useAnimatedStyle(() => ({
    opacity: levelOpacity.value,
    transform: [{ scale: interpolate(levelOpacity.value, [0, 1], [0.5, 1.2]) }],
  }));

  const playRandomToot = async () => {
    try {
      if (activeSoundsRef.current.length >= 3) {
        const oldestSound = activeSoundsRef.current.shift();
        if (oldestSound) {
          try {
            await oldestSound.stopAsync();
            await oldestSound.unloadAsync();
          } catch (e) {}
        }
      }

      const randomSound = TOOT_SOUNDS[Math.floor(Math.random() * TOOT_SOUNDS.length)];
      const { sound } = await Audio.Sound.createAsync(randomSound);
      activeSoundsRef.current.push(sound);
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          activeSoundsRef.current = activeSoundsRef.current.filter(s => s !== sound);
        }
      });

      await sound.playAsync();
    } catch (error) {
      console.log('Erreur son:', error);
    }
  };

  const playPopSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/pop.wav'));
      activeSoundsRef.current.push(sound);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          activeSoundsRef.current = activeSoundsRef.current.filter(s => s !== sound);
        }
      });
      await sound.playAsync();
    } catch (e) {}
  };

  const removeCloud = (holeIndex: number, wasMissed = false) => {
    if (cloudTimeoutsRef.current[holeIndex]) {
      clearTimeout(cloudTimeoutsRef.current[holeIndex]);
      delete cloudTimeoutsRef.current[holeIndex];
    }
    setActiveHoles(prev => prev.filter(h => h !== holeIndex));
    
    if (wasMissed) {
      setMissedCount(m => m + 1);
      triggerPopEffect(holeIndex);
    }
  };

  const triggerPopEffect = (holeIndex: number) => {
    setPoppingHoles(prev => [...prev, holeIndex]);
    setTimeout(() => {
      setPoppingHoles(prev => prev.filter(h => h !== holeIndex));
    }, 400);
  };

  const spawnSingleCloud = useCallback(() => {
    setActiveHoles(prev => {
      const maxClouds = levelRef.current === 1 ? 2 : levelRef.current === 2 ? 3 : 4;
      if (prev.length >= maxClouds) return prev;

      const emptyHoles = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(h => !prev.includes(h));
      if (emptyHoles.length === 0) return prev;

      const randomHole = emptyHoles[Math.floor(Math.random() * emptyHoles.length)];
      const lifeDuration = Math.max(1155 - (levelRef.current * 55), 800);

      cloudTimeoutsRef.current[randomHole] = setTimeout(() => {
        playRandomToot();
        removeCloud(randomHole, true);
      }, lifeDuration);

      return [...prev, randomHole];
    });
  }, []);

  const runSpawner = useCallback(() => {
    if (status !== 'playing' || !isVisible) return;
    
    // Rythme d'apparition légèrement plus doux au niveau 5
    // L1: ~400ms | L5: ~180ms
    const baseDelay = Math.max(450 - (levelRef.current * 60), 180);
    const nextSpawnDelay = baseDelay + (Math.random() * 200);

    spawnTimerRef.current = setTimeout(() => {
      spawnSingleCloud();
      runSpawner();
    }, nextSpawnDelay);
  }, [status, spawnSingleCloud, isVisible]);

  const handlePress = (index: number) => {
    if (activeHoles.includes(index) && status === 'playing') {
      setScore(s => s + 1);
      playPopSound();
      removeCloud(index, false);
    }
  };

  const startLevel = (nextLevel: number) => {
    levelRef.current = nextLevel;
    setLevel(nextLevel);
    setStatus('levelUp');
    setActiveHoles([]);
    clearAllTimers();

    levelOpacity.value = withSequence(
      withTiming(1, { duration: 400 }),
      withDelay(800, withTiming(0, { duration: 400 }))
    );

    setTimeout(() => {
      if (!isVisible) return;
      setStatus('playing');
      setLevelTimeLeft(10);
    }, 1800);
  };

  const clearAllTimers = () => {
    if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
    if (levelTimerRef.current) clearInterval(levelTimerRef.current);
    Object.values(cloudTimeoutsRef.current).forEach(clearTimeout);
    cloudTimeoutsRef.current = {};
  };

  const startGame = () => {
    setScore(0);
    setMissedCount(0);
    startLevel(1);
  };

  const stopGame = () => {
    clearAllTimers();
    setActiveHoles([]);
    setStatus('idle');
  };

  const endGame = () => {
    setStatus('finished');
    clearAllTimers();
    setActiveHoles([]);
  };

  useEffect(() => {
    if (status === 'playing') runSpawner();
    return () => { if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current); };
  }, [status, runSpawner]);

  useEffect(() => {
    if (status === 'playing' && levelTimeLeft > 0) {
      levelTimerRef.current = setInterval(() => {
        setLevelTimeLeft(t => t - 1);
      }, 1000);
    } else if (levelTimeLeft === 0 && status === 'playing') {
      clearInterval(levelTimerRef.current!);
      if (levelRef.current < 5) startLevel(levelRef.current + 1);
      else endGame();
    }
    return () => { if (levelTimerRef.current) clearInterval(levelTimerRef.current); };
  }, [levelTimeLeft, status]);

  useEffect(() => {
    if (!isVisible) {
      stopGame();
      activeSoundsRef.current.forEach(sound => sound.unloadAsync());
      activeSoundsRef.current = [];
    }
  }, [isVisible]);

  return (
    <Modal 
      visible={isVisible} 
      animationType="fade" 
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ebb89b" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.exitButton} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={44} color="#604a3e" />
              <Text style={styles.exitText}>QUITTER</Text>
            </TouchableOpacity>
            
            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>STOPPÉS</Text>
                <Text style={styles.statValue}>{score}</Text>
              </View>
              <View style={[styles.statBox, { marginLeft: 10, backgroundColor: 'rgba(211, 47, 47, 0.15)' }]}>
                <Text style={[styles.statLabel, { color: '#d32f2f' }]}>PROUTS</Text>
                <Text style={[styles.statValue, { color: '#d32f2f' }]}>{missedCount}</Text>
              </View>
            </View>
          </View>

          <View style={styles.titleContainer}>
            <Image source={require('../assets/images/challenge.png')} style={styles.titleImage} resizeMode="contain" />
          </View>

          <View style={styles.gridContainer}>
            <View style={styles.grid}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
                <TouchableOpacity
                  key={index}
                  activeOpacity={1}
                  onPress={() => handlePress(index)}
                  style={styles.cell}
                >
                  <View style={styles.hole} />
                  {activeHoles.includes(index) && <CloudImage key={`cloud-${index}`} />}
                  {poppingHoles.includes(index) && <PopEffect key={`pop-${index}`} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.footerInfo}>
             {status === 'playing' && (
               <TouchableOpacity style={styles.stopButton} onPress={stopGame}>
                 <Ionicons name="stop-circle" size={24} color="#ebb89b" />
                 <Text style={styles.stopButtonText}>STOP PARTIE</Text>
               </TouchableOpacity>
             )}
             <Text style={styles.levelIndicator}>NIVEAU {level} / 5</Text>
          </View>

          {status !== 'playing' && (
            <View style={styles.fullOverlay}>
              {status === 'idle' && (
                <TouchableOpacity style={styles.mainButton} onPress={startGame}>
                  <Text style={styles.mainButtonText}>COMMENCER</Text>
                </TouchableOpacity>
              )}
              {status === 'levelUp' && (
                <Animated.View style={[styles.levelMessage, levelMessageStyle]}>
                  <Text style={styles.levelText}>NIVEAU {level} !</Text>
                  <Text style={styles.levelSubText}>Restez concentré...</Text>
                </Animated.View>
              )}
              {status === 'finished' && (
                <View style={styles.gameOverBox}>
                  <Text style={styles.gameOverTitle}>TERMINÉ !</Text>
                  <AnimatedSuccessScore 
                    percentage={Math.round((score / (score + missedCount)) * 100) || 0} 
                  />
                  <Text style={styles.finalMissed}>Taux de réussite</Text>
                  <TouchableOpacity style={styles.retryButton} onPress={startGame}>
                    <Text style={styles.retryButtonText}>REJOUER</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const CloudImage = () => {
  const scale = useSharedValue(0);
  useEffect(() => { scale.value = withSpring(1, { damping: 10, stiffness: 100 }); }, []);
  const cloudStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: scale.value }));
  return (
    <Animated.View style={[styles.cloudContainer, cloudStyle]}>
      <Image source={require('../assets/images/proothail2.png')} style={styles.cloudImage} resizeMode="contain" />
    </Animated.View>
  );
};

const PopEffect = () => {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(1);
  useEffect(() => {
    scale.value = withTiming(1.5, { duration: 300 });
    opacity.value = withTiming(0, { duration: 300 });
  }, []);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  return (
    <Animated.View style={[styles.popContainer, popStyle]}>
      <Text style={styles.popEmoji}>💥</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ebb89b' },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 5,
    zIndex: 999,
    elevation: 10,
  },
  exitButton: { alignItems: 'center' },
  exitText: { fontSize: 10, fontWeight: 'bold', color: '#604a3e', marginTop: -4 },
  statsContainer: { flexDirection: 'row' },
  statBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(96, 74, 62, 0.2)',
    padding: 8,
    borderRadius: 15,
    minWidth: 75,
  },
  statLabel: { fontSize: 9, fontWeight: 'bold', color: '#604a3e', opacity: 0.8 },
  statValue: { fontSize: 22, fontWeight: '900', color: '#604a3e' },
  titleContainer: { alignItems: 'center', height: 100, marginBottom: 80 },
  titleImage: { width: '95%', height: '100%' },
  gridContainer: { flex: 1, justifyContent: 'flex-start', alignItems: 'center' },
  grid: { width: width - 40, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  cell: { width: '33.33%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', padding: 6 },
  hole: { width: '100%', height: '100%', backgroundColor: '#604a3e', borderRadius: 1000, borderWidth: 5, borderColor: 'rgba(0,0,0,0.15)' },
  cloudContainer: { position: 'absolute', width: '80%', height: '80%', justifyContent: 'center', alignItems: 'center' },
  cloudImage: { width: '100%', height: '100%' },
  popContainer: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  popEmoji: { fontSize: 40 },
  footerInfo: { paddingBottom: 20, alignItems: 'center' },
  levelIndicator: { fontSize: 20, fontWeight: '900', color: '#604a3e', opacity: 0.6, marginTop: 10 },
  stopButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#604a3e', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  stopButtonText: { color: '#ebb89b', fontWeight: 'bold', marginLeft: 5, fontSize: 12 },
  fullOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(235, 184, 155, 0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  mainButton: { backgroundColor: '#604a3e', paddingHorizontal: 50, paddingVertical: 20, borderRadius: 30, elevation: 12 },
  mainButtonText: { color: '#ebb89b', fontSize: 28, fontWeight: '900' },
  levelMessage: { alignItems: 'center', backgroundColor: '#604a3e', padding: 40, borderRadius: 30 },
  levelText: { fontSize: 56, fontWeight: '900', color: '#ebb89b' },
  levelSubText: { fontSize: 20, color: '#ebb89b', fontWeight: 'bold' },
  gameOverBox: { backgroundColor: '#604a3e', padding: 40, borderRadius: 35, width: '85%', alignItems: 'center' },
  gameOverTitle: { fontSize: 40, fontWeight: '900', color: '#ebb89b', marginBottom: 10 },
  finalScore: { fontSize: 32, color: '#FFF', fontWeight: 'bold' },
  finalMissed: { fontSize: 18, color: '#ebb89b', marginBottom: 30 },
  retryButton: { backgroundColor: '#ebb89b', paddingHorizontal: 50, paddingVertical: 18, borderRadius: 35 },
  retryButtonText: { color: '#604a3e', fontSize: 22, fontWeight: 'bold' },
});

export default ProotSilenceChallenge;
