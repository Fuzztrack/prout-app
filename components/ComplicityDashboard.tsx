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
  FadeInDown
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
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

export default function ComplicityDashboard() {
  const router = useRouter();
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textMain} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Image 
            source={require('../assets/images/resonance.png')} 
            style={styles.headerImage}
            resizeMode="contain"
          />
          <Text style={styles.headerSubtitle}>{i18n.t('complicity_subtitle')}</Text>
        </View>
        <View style={{ width: 40 }} /> 
      </View>

      {/* Icône d'aide */}
      <View style={styles.helpContainer}>
        <TouchableOpacity 
          style={styles.helpButton}
          onPress={() => setHelpModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="help-circle-outline" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={friends}
        renderItem={renderFriendItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Aucune donnée de complicité.</Text>
              <Text style={styles.emptySubText}>Envoyez des prouts pour démarrer !</Text>
            </View>
          ) : null
        }
      />

      {/* Modal Détail & Badges */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setModalVisible(false)}
            >
              <Ionicons name="close" size={24} color={COLORS.textMain} />
            </TouchableOpacity>

            {selectedFriend && (
              <ScrollView contentContainerStyle={styles.modalScroll}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalPseudo}>{selectedFriend.pseudo}</Text>
                  <Text style={styles.modalLevel}>{translateComplicityLevel(selectedFriend.complicity_level)}</Text>
                  <Text style={styles.modalScore}>{selectedFriend.complicity_score} pts</Text>
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{selectedFriend.interaction_count}</Text>
                    <Text style={styles.statLabel}>Total</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{selectedFriend.rapid_response_count}</Text>
                    <Text style={styles.statLabel}>Rapides</Text>
                  </View>
                </View>

                {/* Section Badges */}
                <Text style={styles.sectionTitle}>Trophées & Badges</Text>
                <View style={styles.badgesGrid}>
                  {BADGES_CONFIG.map((badge) => {
                    // Simulation : Badge débloqué si...
                    const isUnlocked = 
                      (badge.id === 'legend' && selectedFriend.complicity_score > 1000) ||
                      (badge.id === 'sniper' && selectedFriend.rapid_response_count > 5) ||
                      (badge.id === 'night_owl' && Math.random() > 0.7); // Simulation

                    return (
                      <View key={badge.id} style={[styles.badgeItem, !isUnlocked && styles.badgeLocked]}>
                        <View style={[styles.badgeIconBg, isUnlocked ? styles.badgeUnlockedBg : {}]}>
                          <Ionicons name={badge.icon as any} size={20} color={isUnlocked ? '#FFF' : COLORS.textSecondary} />
                        </View>
                        <Text style={[styles.badgeLabel, !isUnlocked && styles.textLocked]}>{badge.label}</Text>
                      </View>
                    );
                  })}
                </View>

              </ScrollView>
            )}
          </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 0, // Réduit de 5 à 0
    // borderBottomWidth: 1,
    // borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerImage: {
    width: 310,
    height: 75,
    marginBottom: 12,
  },
  headerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 0,
    textAlign: 'center',
  },
  helpContainer: {
    paddingHorizontal: 20,
    paddingTop: 0, // Réduit de 10 à 0
    paddingBottom: 5,
    alignItems: 'flex-end',
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
    // Ombre douce
    shadowColor: COLORS.textMain,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.modalOverlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '85%',
    backgroundColor: COLORS.cardBg, // Fond blanc
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 10,
  },
  modalScroll: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  modalPseudo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textMain,
    marginBottom: 5,
  },
  modalLevel: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginBottom: 15,
  },
  modalScore: {
    fontSize: 48,
    fontWeight: '900',
    color: COLORS.textMain,
  },
  statsGrid: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    marginBottom: 30,
    paddingVertical: 15,
    backgroundColor: COLORS.background, // Bleu clair
    borderRadius: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textMain,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  sectionTitle: {
    alignSelf: 'flex-start',
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textMain,
    marginBottom: 15,
    marginTop: 10,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 30,
  },
  badgeItem: {
    width: '48%',
    backgroundColor: COLORS.background, // Bleu clair
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeLocked: {
    opacity: 0.5,
  },
  badgeIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.border, // Bleu un peu plus foncé
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  badgeUnlockedBg: {
    backgroundColor: COLORS.textMain, // Marron pour débloqué
  },
  badgeLabel: {
    color: COLORS.textMain,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  textLocked: {
    color: COLORS.textSecondary,
  },
  // Help Modal Styles
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
