import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  FlatList,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  FadeInDown,
  SlideInDown
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Device from 'expo-device';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import i18n from '../lib/i18n';

// Helper pour traduire les niveaux de complicité avec fallback robuste
const translateComplicityLevel = (levelKey: string | null | undefined): string => {
  if (!levelKey) return i18n.t('complicity_level_1');
  
  // Nettoyer la clé (enlever espaces, normaliser)
  const cleanKey = levelKey.trim();
  
  // Liste des clés valides
  const validKeys = ['complicity_level_1', 'complicity_level_2', 'complicity_level_3', 'complicity_level_elite'];
  
  // Si c'est déjà une clé valide, l'utiliser directement
  if (validKeys.includes(cleanKey)) {
    const translation = i18n.t(cleanKey);
    // Vérifier que la traduction existe
    if (translation && translation !== cleanKey && !translation.includes('missing')) {
      return translation;
    }
  }
  
  // Mapping des anciennes valeurs françaises vers les nouvelles clés
  const oldValueMapping: Record<string, string> = {
    'Connaissances sonores': 'complicity_level_1',
    'Bouquet Léger': 'complicity_level_1',
    'Souffle Initial': 'complicity_level_1',
    'Complices de fréquence': 'complicity_level_2',
    'Cuvée Complice': 'complicity_level_2',
    'Accord Partagé': 'complicity_level_2',
    'Âmes synchronisées': 'complicity_level_3',
    'Grand Cru des Échanges': 'complicity_level_3',
    'Sillage des Âmes': 'complicity_level_3',
    'Résonance Absolue': 'complicity_level_elite',
    'Réserve Privée': 'complicity_level_elite',
    'Quintessence de l\'Amitié': 'complicity_level_elite',
  };
  
  // Si c'est une ancienne valeur, la convertir
  if (oldValueMapping[cleanKey]) {
    const mappedKey = oldValueMapping[cleanKey];
    const translation = i18n.t(mappedKey);
    if (translation && translation !== mappedKey && !translation.includes('missing')) {
      return translation;
    }
  }
  
  // Fallback par défaut
  return i18n.t('complicity_level_1');
};

// Types pour les données
interface FriendComplicity {
  id: string;
  pseudo: string;
  avatar_url?: string;
  complicity_score: number;
  complicity_level: string;
  interaction_count: number;
  rapid_response_count: number;
  last_interaction_at: string;
}

// Configuration des Badges
const BADGES_CONFIG = [
  { id: 'night_owl', icon: 'moon', label: 'Oiseau de nuit', description: 'Envoi entre 1h et 5h du matin' },
  { id: 'sniper', icon: 'flash', label: 'Sniper', description: 'Réponse en moins de 10s' },
  { id: 'legend', icon: 'trophy', label: 'Légende', description: 'Score > 1000' },
  { id: 'ping_pong', icon: 'sync', label: 'Ping Pong', description: '5 échanges alternés en 2 min' },
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Couleurs de l'application
const COLORS = {
  background: '#ebb89b', // Fond principal beige/saumon
  cardBg: '#ffffff',
  textMain: '#604a3e',
  textSecondary: '#8a7d75',
  accent: '#ebb89b', // Beige/Orange
  gold: '#D4AF37', // Gardé pour les médailles/scores élevés
  border: '#baded7',
  modalOverlay: 'rgba(96, 74, 62, 0.6)', // Marron transparent
};
// Modale score : couleurs alignées avec l'app (fond #ebb89b, boutons #604a3e, accents #baded7)
const MODAL_COLORS = {
  bg: '#fdf5f0',           // Crème chaud (proche fond app)
  headerStart: '#f8ebe4',   // Beige très clair
  headerEnd: '#ebb89b',     // Fond principal app
  scoreStart: '#ebb89b',    // Bouton contact FriendList (messageSendButton)
  scoreEnd: '#d4a088',      // Beige un peu plus foncé pour le dégradé
  progressBg: '#eed9cf',     // Beige clair
  progressFill: '#baded7',   // Menthe (bordures / accents app)
  scoreText: '#baded7',      // Couleur champs contact FriendList (lignes alternées)
  white: '#ffffff',
  dark: '#604a3e',          // textMain app
  statIcon: '#604a3e',
  badgeUnlocked: ['#baded7', '#d2f1ef'], // Mint app
  badgeLockedBg: '#e8d5d0',  // Beige gris
};

export default function ComplicityDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [friends, setFriends] = useState<FriendComplicity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState<FriendComplicity | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);

  // Charger les données depuis Supabase
  useEffect(() => {
    loadComplicityData();
  }, []);

  const loadComplicityData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('friends')
        .select(`
          friend_id,
          complicity_score,
          complicity_level,
          interaction_count,
          rapid_response_count,
          last_interaction_at,
          friend:friend_id (
            pseudo,
            avatar_url
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'accepted')
        .order('complicity_score', { ascending: false });

      if (error) throw error;

      const formattedFriends = data.map((item: any) => ({
        id: item.friend_id,
        pseudo: item.friend?.pseudo || 'Ami inconnu',
        avatar_url: item.friend?.avatar_url,
        complicity_score: item.complicity_score || 0,
        complicity_level: item.complicity_level || 'complicity_level_1',
        interaction_count: item.interaction_count || 0,
        rapid_response_count: item.rapid_response_count || 0,
        last_interaction_at: item.last_interaction_at
      }));

      setFriends(formattedFriends);
    } catch (error) {
      console.error('Erreur chargement complicité:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFriendPress = (friend: FriendComplicity) => {
    setSelectedFriend(friend);
    setModalVisible(true);
  };

  const renderFriendItem = ({ item, index }: { item: FriendComplicity; index: number }) => {
    const getNextLevelScore = (score: number) => {
      if (score < 50) return 50;
      if (score < 200) return 200;
      if (score < 500) return 500;
      return 1000;
    };
    
    const nextScore = getNextLevelScore(item.complicity_score);
    const progress = Math.min(item.complicity_score / nextScore, 1);

    return (
      <Animated.View 
        entering={FadeInDown.delay(index * 100).springify()} 
        style={styles.cardContainer}
      >
        <TouchableOpacity 
          style={styles.card} 
          onPress={() => handleFriendPress(item)}
          activeOpacity={0.8}
        >
          {/* Rang */}
          <View style={styles.rankContainer}>
            {index === 0 && <Text style={styles.rankIcon}>🥇</Text>}
            {index === 1 && <Text style={styles.rankIcon}>🥈</Text>}
            {index === 2 && <Text style={styles.rankIcon}>🥉</Text>}
            {index > 2 && <Text style={styles.rankText}>#{index + 1}</Text>}
          </View>

          {/* Avatar */}
          <View style={styles.avatarContainer}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarLetter}>{item.pseudo.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>

          {/* Info Centrale */}
          <View style={styles.infoContainer}>
            <Text style={styles.pseudo} numberOfLines={1}>{item.pseudo}</Text>
            <Text style={styles.levelTitle}>{translateComplicityLevel(item.complicity_level)}</Text>
          </View>

          {/* Score & Progression */}
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreValue}>{item.complicity_score} <Text style={styles.scoreUnit}>pts</Text></Text>
            <View style={styles.progressBarBg}>
              <LinearGradient
                colors={[COLORS.accent, COLORS.textMain]} // Dégradé marron/beige
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressBarFill, { width: `${progress * 100}%` }]}
              />
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Flèche retour : toujours affichée
  const showBackButton = true;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 16) }]}>
        <View style={styles.headerTitleContainer}>
          <Image 
            source={require('../assets/images/resonance.png')} 
            style={styles.headerImage}
            resizeMode="contain"
          />
          <Text style={styles.headerSubtitle}>{i18n.t('complicity_subtitle')}</Text>
        </View>

        <View style={styles.headerNavRow}>
          {showBackButton ? (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textMain} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.backButton, { width: 40 }]} />
          )}
          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => setHelpModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="help-circle-outline" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={friends}
        renderItem={renderFriendItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{i18n.t('complicity_empty_title')}</Text>
              <Text style={styles.emptySubText}>{i18n.t('complicity_empty_subtitle')}</Text>
            </View>
          ) : null
        }
      />

      {/* Modal Détail & Badges — style paper.io */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View 
            entering={SlideInDown.duration(320).springify().damping(18)} 
            style={styles.modalContent}
          >
            <TouchableOpacity 
              style={styles.modalCloseButton} 
              onPress={() => setModalVisible(false)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={22} color={MODAL_COLORS.dark} />
            </TouchableOpacity>

            {selectedFriend && (() => {
              const nextScore = (() => {
                const s = selectedFriend.complicity_score;
                if (s < 50) return 50;
                if (s < 200) return 200;
                if (s < 500) return 500;
                return 1000;
              })();
              const progress = Math.min(selectedFriend.complicity_score / nextScore, 1);
              return (
                <ScrollView 
                  contentContainerStyle={styles.modalScroll} 
                  showsVerticalScrollIndicator={false}
                >
                  {/* Bandeau header type paper.io */}
                  <LinearGradient
                    colors={[MODAL_COLORS.headerStart, MODAL_COLORS.headerEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalHeaderGradient}
                  >
                    <View style={styles.modalAvatarRing}>
                      {selectedFriend.avatar_url ? (
                        <Image source={{ uri: selectedFriend.avatar_url }} style={styles.modalAvatar} />
                      ) : (
                        <View style={[styles.modalAvatar, styles.modalAvatarPlaceholder]}>
                          <Text style={styles.modalAvatarLetter}>{selectedFriend.pseudo.charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.modalPseudo}>{selectedFriend.pseudo}</Text>
                    <View style={styles.modalLevelPill}>
                      <Text style={styles.modalLevelPillText}>{translateComplicityLevel(selectedFriend.complicity_level)}</Text>
                    </View>
                  </LinearGradient>

                  {/* Score géant type jeu */}
                  <View style={styles.modalScoreBlock}>
                    <LinearGradient
                      colors={[MODAL_COLORS.scoreStart, MODAL_COLORS.scoreEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.modalScoreGradient}
                    >
                      <Text style={styles.modalScoreValue}>{selectedFriend.complicity_score}</Text>
                      <Text style={styles.modalScoreUnit}>pts</Text>
                    </LinearGradient>
                    <View style={styles.modalProgressBarBg}>
                      <LinearGradient
                        colors={[MODAL_COLORS.progressFill, MODAL_COLORS.scoreEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.modalProgressBarFill, { width: `${progress * 100}%` }]}
                      />
                    </View>
                    <Text style={styles.modalProgressLabel}>Prochain palier : {nextScore} pts</Text>
                  </View>

                  {/* Stats en pills */}
                  <View style={styles.modalStatsRow}>
                    <View style={styles.modalStatPill}>
                      <Ionicons name="chatbubbles" size={24} color={MODAL_COLORS.statIcon} />
                      <Text style={styles.modalStatValue}>{selectedFriend.interaction_count}</Text>
                      <Text style={styles.modalStatLabel}>Total</Text>
                    </View>
                    <View style={styles.modalStatPill}>
                      <Ionicons name="flash" size={24} color={MODAL_COLORS.statIcon} />
                      <Text style={styles.modalStatValue}>{selectedFriend.rapid_response_count}</Text>
                      <Text style={styles.modalStatLabel}>Rapides</Text>
                    </View>
                  </View>

                  {/* Badges type paper.io — bulles */}
                  <Text style={styles.modalSectionTitle}>Trophées & Badges</Text>
                  <View style={styles.modalBadgesRow}>
                    {BADGES_CONFIG.map((badge) => {
                      const isUnlocked = 
                        (badge.id === 'legend' && selectedFriend.complicity_score > 1000) ||
                        (badge.id === 'sniper' && selectedFriend.rapid_response_count > 5) ||
                        (badge.id === 'night_owl' && Math.random() > 0.7);
                      return (
                        <View key={badge.id} style={[styles.modalBadgeBubble, !isUnlocked && styles.modalBadgeLocked]}>
                          {isUnlocked ? (
                            <LinearGradient
                              colors={MODAL_COLORS.badgeUnlocked}
                              style={styles.modalBadgeBubbleInner}
                            >
                              <Ionicons name={badge.icon as any} size={22} color={MODAL_COLORS.white} />
                            </LinearGradient>
                          ) : (
                            <View style={styles.modalBadgeBubbleInnerLocked}>
                              <Ionicons name="lock-closed" size={18} color={COLORS.textSecondary} />
                            </View>
                          )}
                          <Text style={[styles.modalBadgeLabel, !isUnlocked && styles.modalBadgeLabelLocked]} numberOfLines={1}>{badge.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              );
            })()}
          </Animated.View>
        </View>
      </Modal>

      {/* Modal Aide - Comment ça marche */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={helpModalVisible}
        onRequestClose={() => setHelpModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.helpModalContent}>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setHelpModalVisible(false)}
            >
              <Ionicons name="close" size={24} color={COLORS.textMain} />
            </TouchableOpacity>

            <ScrollView contentContainerStyle={styles.helpModalScroll}>
              
              <Text style={styles.helpTitle}>{i18n.t('complicity_help_title')}</Text>
              
              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>{i18n.t('complicity_help_score_title')}</Text>
                <Text style={styles.helpText}>
                  {i18n.t('complicity_help_score_text')}
                </Text>
              </View>

              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>{i18n.t('complicity_help_rapid_title')}</Text>
                <Text style={styles.helpText}>
                  {i18n.t('complicity_help_rapid_text')}
                </Text>
              </View>

              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>{i18n.t('complicity_help_levels_title')}</Text>
                <Text style={styles.helpText}>
                  {i18n.t('complicity_help_levels_text')}
                </Text>
              </View>

              <View style={styles.helpSection}>
                <Text style={styles.helpSectionTitle}>{i18n.t('complicity_help_tip_title')}</Text>
                <Text style={styles.helpText}>
                  {i18n.t('complicity_help_tip_text')}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
  },
  headerImage: {
    width: 310,
    height: 75,
    marginBottom: 20,
  },
  headerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  helpButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    shadowColor: COLORS.textMain,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  listContent: {
    padding: 16,
    paddingTop: 2,
  },
  cardContainer: {
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 12,
    // Ombre projetée vers la gauche (lumière venant de la droite)
    ...Platform.select({
      ios: {
        shadowColor: '#5c4a3d',
        shadowOffset: { width: -5, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  rankContainer: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankIcon: {
    fontSize: 20,
  },
  rankText: {
    color: COLORS.textSecondary,
    fontWeight: 'bold',
  },
  avatarContainer: {
    marginHorizontal: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.textMain,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: COLORS.textMain,
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  pseudo: {
    color: COLORS.textMain,
    fontSize: 16,
    fontWeight: 'bold',
  },
  levelTitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  scoreContainer: {
    alignItems: 'flex-end',
    width: 80,
  },
  scoreValue: {
    color: COLORS.textMain,
    fontSize: 18,
    fontWeight: 'bold',
  },
  scoreUnit: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  progressBarBg: {
    width: '100%',
    height: 4,
    backgroundColor: COLORS.border,
    marginTop: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: COLORS.textMain,
    fontSize: 16,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  emptySubText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  // Modal Styles — style paper.io
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.modalOverlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '88%',
    backgroundColor: MODAL_COLORS.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  modalCloseButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: MODAL_COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  modalScroll: {
    alignItems: 'center',
    paddingBottom: 48,
    paddingTop: 8,
  },
  modalHeaderGradient: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 24,
    paddingTop: 28,
    borderRadius: 24,
    marginBottom: 16,
  },
  modalAvatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: MODAL_COLORS.white,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: MODAL_COLORS.dark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  modalAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  modalAvatarPlaceholder: {
    backgroundColor: MODAL_COLORS.progressFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAvatarLetter: {
    fontSize: 28,
    fontWeight: '800',
    color: MODAL_COLORS.dark,
  },
  modalPseudo: {
    fontSize: 24,
    fontWeight: '800',
    color: MODAL_COLORS.dark,
    marginBottom: 8,
  },
  modalLevelPill: {
    backgroundColor: MODAL_COLORS.dark,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modalLevelPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: MODAL_COLORS.white,
  },
  modalScoreBlock: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalScoreGradient: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 20,
    marginBottom: 10,
    ...Platform.select({
      ios: { shadowColor: MODAL_COLORS.dark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  modalScoreValue: {
    fontSize: 42,
    fontWeight: '900',
    color: MODAL_COLORS.scoreText,
  },
  modalScoreUnit: {
    fontSize: 16,
    fontWeight: '700',
    color: MODAL_COLORS.scoreText,
    marginLeft: 4,
  },
  modalProgressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: MODAL_COLORS.progressBg,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  modalProgressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  modalProgressLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  modalStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
    gap: 12,
  },
  modalStatPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MODAL_COLORS.white,
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderRadius: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  modalStatValue: {
    fontSize: 22,
    fontWeight: '800',
    color: MODAL_COLORS.dark,
    marginTop: 6,
  },
  modalStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  modalSectionTitle: {
    alignSelf: 'flex-start',
    fontSize: 18,
    fontWeight: '800',
    color: MODAL_COLORS.dark,
    marginBottom: 14,
  },
  modalBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  modalBadgeBubble: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalBadgeLocked: {
    opacity: 0.7,
  },
  modalBadgeBubbleInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  modalBadgeBubbleInnerLocked: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: MODAL_COLORS.badgeLockedBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  modalBadgeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: MODAL_COLORS.dark,
  },
  modalBadgeLabelLocked: {
    color: COLORS.textSecondary,
  },
  // Help Modal Styles
  closeButton: {
    alignSelf: 'flex-end',
    padding: 10,
  },
  helpModalContent: {
    height: '90%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    marginTop: 'auto',
  },
  helpModalScroll: {
    paddingBottom: 40,
  },
  helpTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textMain,
    textAlign: 'center',
    marginBottom: 30,
  },
  helpSection: {
    marginBottom: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.5)', // Blanc semi-transparent pour un effet subtil
    padding: 16,
    borderRadius: 12,
  },
  helpSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textMain,
    marginBottom: 10,
  },
  helpText: {
    fontSize: 15,
    color: COLORS.textMain,
    lineHeight: 22,
  },
});
