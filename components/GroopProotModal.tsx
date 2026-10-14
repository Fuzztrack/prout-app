import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import i18n from '../lib/i18n';
import { createGroopProot, GroopProotGroup } from '../lib/groopProotService';
import { Friend } from '../hooks/useFriends';
import { isProotBot } from '../lib/prootBot';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = Math.min(SCREEN_HEIGHT * 0.85, 650);

interface GroopProotModalProps {
  visible: boolean;
  onClose: () => void;
  friends: Friend[];
  onGroupCreated?: (group: GroopProotGroup) => void;
}

export function GroopProotModal({
  visible,
  onClose,
  friends,
  onGroupCreated,
}: GroopProotModalProps) {
  const [groupName, setGroupName] = useState('');
  const [retentionMode, setRetentionMode] = useState<'24h' | 'permanent'>('24h');
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchFriend, setSearchFriend] = useState('');

  // Filtrer les vrais amis (exclure ProotBot et les profils sans pseudo)
  const selectableFriends = useMemo(() => {
    return (friends || []).filter(
      f => !f.isGroup && !isProotBot(f.id) && f.pseudo
    );
  }, [friends]);

  // Filtrer par recherche de pseudo
  const filteredFriends = useMemo(() => {
    if (!searchFriend.trim()) return selectableFriends;
    const q = searchFriend.toLowerCase().trim();
    return selectableFriends.filter(f => f.pseudo.toLowerCase().includes(q));
  }, [selectableFriends, searchFriend]);

  // Réinitialiser les champs à l'ouverture/fermeture
  useEffect(() => {
    if (!visible) {
      setGroupName('');
      setRetentionMode('24h');
      setSelectedFriendIds([]);
      setSearchFriend('');
      setIsSubmitting(false);
    }
  }, [visible]);

  if (!visible) return null;

  const toggleFriend = (friendId: string) => {
    if (selectedFriendIds.includes(friendId)) {
      setSelectedFriendIds(prev => prev.filter(id => id !== friendId));
      if (Platform.OS === 'ios') {
        Haptics.selectionAsync().catch(() => {});
      }
    } else {
      if (selectedFriendIds.length >= 10) {
        Alert.alert(
          'Limite atteinte',
          'Un groupe peut comporter au maximum 10 amis (+ vous-même).'
        );
        return;
      }
      setSelectedFriendIds(prev => [...prev, friendId]);
      if (Platform.OS === 'ios') {
        Haptics.selectionAsync().catch(() => {});
      }
    }
  };

  const isFormValid =
    groupName.trim().length >= 2 &&
    groupName.trim().length <= 50 &&
    selectedFriendIds.length >= 2 &&
    selectedFriendIds.length <= 10;

  const handleCreate = async () => {
    if (!isFormValid || isSubmitting) return;

    Keyboard.dismiss();
    setIsSubmitting(true);

    try {
      const newGroup = await createGroopProot({
        name: groupName,
        retentionMode,
        memberIds: selectedFriendIds,
      });

      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      onClose();
      if (onGroupCreated) {
        onGroupCreated(newGroup);
      }
    } catch (error: any) {
      Alert.alert(
        'Erreur de création',
        error?.message || 'Impossible de créer le groupe pour le moment.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.modalOverlay}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="people" size={24} color="#604a3e" style={{ marginRight: 8 }} />
              <Text style={styles.headerTitle}>Créer un GroopProot</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={26} color="#604a3e" />
            </TouchableOpacity>
          </View>

          {/* Formulaire & Options */}
          <View style={styles.formSection}>
            {/* Champ Nom du groupe */}
            <View style={styles.inputWrapper}>
              <Ionicons name="pencil-outline" size={18} color="#8a7466" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.nameInput}
                placeholder="Nom du groupe (ex: Les Invincibles)"
                placeholderTextColor="#9e8a7d"
                value={groupName}
                onChangeText={setGroupName}
                maxLength={50}
                autoFocus={true}
              />
            </View>

            {/* Sélecteur de Rétention */}
            <View style={styles.retentionContainer}>
              <Text style={styles.sectionLabel}>Rétention des messages :</Text>
              <View style={styles.retentionRow}>
                <TouchableOpacity
                  style={[
                    styles.retentionBtn,
                    retentionMode === '24h' && styles.retentionBtnActive,
                  ]}
                  onPress={() => setRetentionMode('24h')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="timer-outline"
                    size={15}
                    color={retentionMode === '24h' ? '#ffffff' : '#604a3e'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[
                    styles.retentionBtnText,
                    retentionMode === '24h' && styles.retentionBtnTextActive,
                  ]}>
                    24 Heures
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.retentionBtn,
                    retentionMode === 'permanent' && styles.retentionBtnActive,
                  ]}
                  onPress={() => setRetentionMode('permanent')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="flash"
                    size={15}
                    color={retentionMode === 'permanent' ? '#ffffff' : '#604a3e'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[
                    styles.retentionBtnText,
                    retentionMode === 'permanent' && styles.retentionBtnTextActive,
                  ]}>
                    0h (Éphémère)
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.retentionHint}>
                {retentionMode === '24h'
                  ? '⏳ Tous les messages s’effacent automatiquement après 24h.'
                  : '⚡ Les messages s’effacent à la fermeture du chat.'}
              </Text>
            </View>

            {/* Compteur d'amis & Recherche */}
            <View style={styles.friendsHeader}>
              <Text style={styles.sectionLabel}>
                Sélection des amis ({selectedFriendIds.length}/10) :
              </Text>
              {selectedFriendIds.length < 2 && (
                <Text style={styles.minWarning}>Min. 2 amis</Text>
              )}
            </View>

            {selectableFriends.length > 5 && (
              <View style={styles.searchWrapper}>
                <Ionicons name="search" size={16} color="#8a7466" style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher un ami..."
                  placeholderTextColor="#9e8a7d"
                  value={searchFriend}
                  onChangeText={setSearchFriend}
                />
                {!!searchFriend && (
                  <TouchableOpacity onPress={() => setSearchFriend('')}>
                    <Ionicons name="close-circle" size={16} color="#8a7466" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Liste des amis à cocher */}
          <FlatList
            data={filteredFriends}
            keyExtractor={item => item.id}
            style={styles.friendsList}
            contentContainerStyle={styles.friendsListContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {selectableFriends.length === 0
                    ? 'Ajoutez d’abord des amis pour créer un groupe !'
                    : 'Aucun ami trouvé avec ce pseudo.'}
                </Text>
              </View>
            )}
            renderItem={({ item }) => {
              const isSelected = selectedFriendIds.includes(item.id);
              const isDisabled = !isSelected && selectedFriendIds.length >= 10;

              return (
                <TouchableOpacity
                  style={[
                    styles.friendRow,
                    isSelected && styles.friendRowSelected,
                    isDisabled && styles.friendRowDisabled,
                  ]}
                  onPress={() => !isDisabled && toggleFriend(item.id)}
                  activeOpacity={isDisabled ? 1 : 0.7}
                >
                  <View style={styles.friendAvatarWrap}>
                    {item.avatar_url ? (
                      <Image source={{ uri: item.avatar_url }} style={styles.friendAvatar} />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarInitial}>
                          {(item.pseudo || 'A').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.friendInfo}>
                    <Text style={styles.friendPseudo} numberOfLines={1}>
                      {item.identityAlias || item.pseudo}
                    </Text>
                    {item.identityAlias && (
                      <Text style={styles.realPseudo} numberOfLines={1}>
                        @{item.pseudo}
                      </Text>
                    )}
                  </View>

                  <View
                    style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected,
                      isDisabled && styles.checkboxDisabled,
                    ]}
                  >
                    {isSelected && <Ionicons name="checkmark" size={16} color="#ffffff" />}
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          {/* Bouton de validation */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.createButton,
                (!isFormValid || isSubmitting) && styles.createButtonDisabled,
              ]}
              onPress={handleCreate}
              disabled={!isFormValid || isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="people" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.createButtonText}>
                    Créer le GroopProot
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  keyboardContainer: {
    width: '92%',
    maxHeight: MODAL_HEIGHT,
  },
  modalCard: {
    backgroundColor: '#fff5eb',
    borderRadius: 22,
    overflow: 'hidden',
    maxHeight: MODAL_HEIGHT,
    flexDirection: 'column',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(96, 74, 62, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#604a3e',
  },
  closeButton: {
    padding: 2,
  },
  formSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    marginBottom: 12,
  },
  nameInput: {
    flex: 1,
    fontSize: 15,
    color: '#4A3428',
    fontWeight: '500',
  },
  retentionContainer: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#604a3e',
    marginBottom: 6,
  },
  retentionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  retentionBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#EFE7DC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  retentionBtnActive: {
    backgroundColor: '#604a3e',
    borderColor: '#4A3428',
  },
  retentionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#604a3e',
  },
  retentionBtnTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  retentionHint: {
    fontSize: 11,
    color: '#8a7466',
    marginTop: 5,
    fontStyle: 'italic',
  },
  friendsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  minWarning: {
    fontSize: 11,
    color: '#b24c3d',
    fontWeight: '600',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#4A3428',
    padding: 0,
  },
  friendsList: {
    maxHeight: 220,
    paddingHorizontal: 16,
  },
  friendsListContent: {
    paddingVertical: 4,
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#8a7466',
    textAlign: 'center',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.1)',
  },
  friendRowSelected: {
    backgroundColor: '#faeedf',
    borderColor: '#604a3e',
  },
  friendRowDisabled: {
    opacity: 0.45,
  },
  friendAvatarWrap: {
    marginRight: 10,
  },
  friendAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFE7DC',
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ebb89b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#604a3e',
  },
  friendInfo: {
    flex: 1,
  },
  friendPseudo: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A3428',
  },
  realPseudo: {
    fontSize: 11,
    color: '#8a7466',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#8a7466',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  checkboxSelected: {
    backgroundColor: '#604a3e',
    borderColor: '#604a3e',
  },
  checkboxDisabled: {
    borderColor: '#ccc',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(96, 74, 62, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#604a3e',
    paddingVertical: 12,
    borderRadius: 14,
  },
  createButtonDisabled: {
    opacity: 0.45,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
