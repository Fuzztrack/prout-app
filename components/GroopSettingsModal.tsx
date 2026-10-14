import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  ActionSheetIOS,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import i18n from '../lib/i18n';
import {
  updateGroupName,
  updateGroupAvatar,
  removeGroupAvatar,
  updateGroupRetentionMode,
  deleteGroup,
  leaveGroup,
  fetchGroupMembers,
  GroupMemberInfo,
} from '../lib/groopProotService';
import { Friend } from '../hooks/useFriends';

interface GroopSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  group: Friend | null;
  currentUserId: string;
  onGroupUpdated?: (updated: { id: string; name?: string; avatar_url?: string | null; retention_mode?: '24h' | 'permanent' }) => void;
  onGroupDeleted?: (groupId: string) => void;
}

export function GroopSettingsModal({
  visible,
  onClose,
  group,
  currentUserId,
  onGroupUpdated,
  onGroupDeleted,
}: GroopSettingsModalProps) {
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentRetention, setCurrentRetention] = useState<'24h' | 'permanent'>('24h');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUpdatingRetention, setIsUpdatingRetention] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMembersExpanded, setIsMembersExpanded] = useState(false);
  const [members, setMembers] = useState<GroupMemberInfo[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  useEffect(() => {
    if (group && visible) {
      setName(group.pseudo || '');
      setAvatarUrl(group.avatar_url || null);
      setCurrentRetention((group.retentionMode as '24h' | 'permanent') || '24h');
      setIsEditingName(false);
      setIsMembersExpanded(false);
      void fetchGroupMembers(group.id).then(res => setMembers(res));
    }
  }, [group, visible]);

  if (!visible || !group) return null;

  const isCreator = group.createdBy === currentUserId;

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 50) {
      Alert.alert('Nom invalide', 'Le nom du groupe doit comporter entre 2 et 50 caractères.');
      return;
    }

    if (trimmed === group.pseudo) {
      setIsEditingName(false);
      return;
    }

    try {
      setIsSavingName(true);
      await updateGroupName(group.id, trimmed);
      setIsEditingName(false);
      onGroupUpdated?.({ id: group.id, name: trimmed, avatar_url: avatarUrl });
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (err: any) {
      console.error('❌ Erreur mise à jour nom groupe:', err);
      Alert.alert(i18n.t('error'), err?.message || 'Impossible de modifier le nom du groupe.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handlePickCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(i18n.t('error'), 'Permission d’accès à la caméra requise');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const uri = result.assets[0].uri;
      setIsUploadingPhoto(true);
      const newUrl = await updateGroupAvatar(group.id, uri);
      setAvatarUrl(newUrl);
      onGroupUpdated?.({ id: group.id, name, avatar_url: newUrl });

      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (error: any) {
      console.error('❌ Erreur caméra avatar groupe:', error);
      Alert.alert(i18n.t('error'), error?.message || 'Impossible de mettre à jour la photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePickGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const uri = result.assets[0].uri;
      setIsUploadingPhoto(true);
      const newUrl = await updateGroupAvatar(group.id, uri);
      setAvatarUrl(newUrl);
      onGroupUpdated?.({ id: group.id, name, avatar_url: newUrl });

      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (error: any) {
      console.error('❌ Erreur galerie avatar groupe:', error);
      Alert.alert(i18n.t('error'), error?.message || 'Impossible de mettre à jour la photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    try {
      setIsUploadingPhoto(true);
      await removeGroupAvatar(group.id);
      setAvatarUrl(null);
      onGroupUpdated?.({ id: group.id, name, avatar_url: null });
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (err: any) {
      console.error('❌ Erreur suppression photo groupe:', err);
      Alert.alert(i18n.t('error'), 'Impossible de supprimer la photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const openPhotoOptions = () => {
    if (Platform.OS === 'ios') {
      const options = ['Prendre une photo', 'Choisir dans la galerie'];
      if (avatarUrl) options.push('Supprimer la photo');
      options.push(i18n.t('cancel'));

      const destructiveIndex = avatarUrl ? 2 : undefined;
      const cancelIndex = options.length - 1;

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: cancelIndex,
          destructiveButtonIndex: destructiveIndex,
          title: 'Photo du GroopProot',
        },
        (buttonIndex) => {
          if (buttonIndex === 0) void handlePickCamera();
          else if (buttonIndex === 1) void handlePickGallery();
          else if (avatarUrl && buttonIndex === 2) void handleRemovePhoto();
        }
      );
    } else {
      const buttons: any[] = [
        { text: 'Prendre une photo', onPress: () => void handlePickCamera() },
        { text: 'Choisir dans la galerie', onPress: () => void handlePickGallery() },
      ];
      if (avatarUrl) {
        buttons.push({ text: 'Supprimer la photo', style: 'destructive', onPress: () => void handleRemovePhoto() });
      }
      buttons.push({ text: i18n.t('cancel'), style: 'cancel' });

      Alert.alert('Photo du GroopProot', 'Choisissez une option', buttons);
    }
  };

  const handleChangeRetention = async (mode: '24h' | 'permanent') => {
    if (mode === currentRetention || isUpdatingRetention) return;
    try {
      setIsUpdatingRetention(true);
      await updateGroupRetentionMode(group.id, mode);
      setCurrentRetention(mode);
      onGroupUpdated?.({ id: group.id, name, avatar_url: avatarUrl, retention_mode: mode });
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (e: any) {
      console.error('❌ Erreur changement rétention:', e);
      Alert.alert(i18n.t('error'), 'Impossible de modifier le mode de rétention.');
    } finally {
      setIsUpdatingRetention(false);
    }
  };

  const toggleMembersExpanded = () => {
    const next = !isMembersExpanded;
    setIsMembersExpanded(next);
    if (next && group?.id && members.length === 0) {
      setIsLoadingMembers(true);
      void fetchGroupMembers(group.id)
        .then(res => setMembers(res))
        .catch(err => console.error('Erreur chargement membres:', err))
        .finally(() => setIsLoadingMembers(false));
    }
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handleDestructiveAction = () => {
    if (isCreator) {
      Alert.alert(
        'Supprimer le GroopProot',
        `Voulez-vous supprimer définitivement "${name}" ? Cette action est irréversible et supprimera le groupe pour tous les membres.`,
        [
          { text: i18n.t('cancel'), style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: async () => {
              try {
                setIsDeleting(true);
                await deleteGroup(group.id, currentUserId);
                onClose();
                onGroupDeleted?.(group.id);
                if (Platform.OS === 'ios') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                }
              } catch (e: any) {
                console.error('❌ Erreur suppression groupe:', e);
                Alert.alert(i18n.t('error'), 'Impossible de supprimer le groupe.');
              } finally {
                setIsDeleting(false);
              }
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'Quitter le GroopProot',
        `Voulez-vous quitter le groupe "${name}" ?`,
        [
          { text: i18n.t('cancel'), style: 'cancel' },
          {
            text: 'Quitter',
            style: 'destructive',
            onPress: async () => {
              try {
                setIsDeleting(true);
                await leaveGroup(group.id, currentUserId);
                onClose();
                onGroupDeleted?.(group.id);
                if (Platform.OS === 'ios') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                }
              } catch (e: any) {
                console.error('❌ Erreur départ groupe:', e);
                Alert.alert(i18n.t('error'), 'Impossible de quitter le groupe.');
              } finally {
                setIsDeleting(false);
              }
            },
          },
        ]
      );
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardContainer}
          >
            <View style={styles.modalCard}>
              {/* En-tête */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Gestion du GroopProot</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={26} color="#604a3e" />
                </TouchableOpacity>
              </View>

              {/* Contenu */}
              <View style={styles.content}>
                {/* Avatar du groupe avec bouton caméra */}
                <View style={styles.avatarSection}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={openPhotoOptions}
                    disabled={isUploadingPhoto}
                    style={styles.avatarButton}
                  >
                    <View style={styles.avatarContainer}>
                      {isUploadingPhoto ? (
                        <ActivityIndicator color="#604a3e" size="large" />
                      ) : avatarUrl ? (
                        <Image
                          source={{ uri: avatarUrl }}
                          style={styles.avatarImage}
                          contentFit="cover"
                          transition={200}
                        />
                      ) : (
                        <Ionicons name="people" size={44} color="#604a3e" />
                      )}
                    </View>
                    <View style={styles.cameraBadge}>
                      <Ionicons name="camera" size={15} color="#ffffff" />
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.avatarHint}>Toucher pour changer la photo</Text>
                </View>

                {/* Nom du groupe */}
                <View style={styles.nameSection}>
                  <Text style={styles.fieldLabel}>Nom du groupe</Text>
                  {isEditingName ? (
                    <View style={styles.nameEditRow}>
                      <TextInput
                        style={styles.nameInput}
                        value={name}
                        onChangeText={setName}
                        placeholder="Nom du groupe"
                        placeholderTextColor="#A0887A"
                        maxLength={50}
                        autoFocus
                      />
                      <TouchableOpacity
                        style={[styles.saveNameButton, isSavingName && { opacity: 0.6 }]}
                        onPress={handleSaveName}
                        disabled={isSavingName}
                      >
                        {isSavingName ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Ionicons name="checkmark" size={20} color="#fff" />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cancelNameButton}
                        onPress={() => {
                          setName(group.pseudo || '');
                          setIsEditingName(false);
                        }}
                      >
                        <Ionicons name="close" size={20} color="#604a3e" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.nameDisplayRow}
                      onPress={() => setIsEditingName(true)}
                    >
                      <Text style={styles.groupNameText} numberOfLines={1}>
                        {name || 'Sans nom'}
                      </Text>
                      <View style={styles.pencilBadge}>
                        <Ionicons name="pencil" size={14} color="#604a3e" />
                      </View>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Mode de Rétention (24h / 0h) */}
                <View style={styles.retentionSection}>
                  <Text style={styles.fieldLabel}>Mode de rétention</Text>
                  <View style={styles.retentionRow}>
                    <TouchableOpacity
                      style={[
                        styles.retentionBtn,
                        currentRetention === '24h' && styles.retentionBtnActive,
                      ]}
                      onPress={() => handleChangeRetention('24h')}
                      disabled={isUpdatingRetention}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="timer-outline"
                        size={15}
                        color={currentRetention === '24h' ? '#ffffff' : '#604a3e'}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.retentionBtnText,
                          currentRetention === '24h' && styles.retentionBtnTextActive,
                        ]}
                      >
                        24 Heures
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.retentionBtn,
                        currentRetention === 'permanent' && styles.retentionBtnActive,
                      ]}
                      onPress={() => handleChangeRetention('permanent')}
                      disabled={isUpdatingRetention}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="flash"
                        size={15}
                        color={currentRetention === 'permanent' ? '#ffffff' : '#604a3e'}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.retentionBtnText,
                          currentRetention === 'permanent' && styles.retentionBtnTextActive,
                        ]}
                      >
                        0h (Éphémère)
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.retentionHintText}>
                    {currentRetention === '24h'
                      ? '⏳ Les messages s’effacent automatiquement après 24h.'
                      : '⚡ Les messages s’effacent à la fermeture du chat.'}
                  </Text>
                </View>

                {/* Métadonnées du groupe */}
                <View style={styles.infoCard}>
                  <TouchableOpacity
                    style={styles.membersExpandRow}
                    onPress={toggleMembersExpanded}
                    activeOpacity={0.7}
                  >
                    <View style={styles.infoRowLeft}>
                      <View style={styles.infoIconWrapper}>
                        <Ionicons name="people-outline" size={16} color="#604a3e" />
                      </View>
                      <Text style={styles.infoText}>
                        {(members.length > 0 ? members.length : (group.groupMembersCount || 2))} membres
                      </Text>
                    </View>
                    <Ionicons 
                      name={isMembersExpanded ? "chevron-down" : "chevron-forward"} 
                      size={18} 
                      color="#604a3e" 
                    />
                  </TouchableOpacity>

                  {isMembersExpanded && (
                    <View style={styles.membersListContainer}>
                      {isLoadingMembers ? (
                        <ActivityIndicator size="small" color="#604a3e" style={{ marginVertical: 8 }} />
                      ) : (
                        members.map((member) => (
                          <View key={member.userId} style={styles.memberItemRow}>
                            {member.avatarUrl ? (
                              <Image
                                source={{ uri: member.avatarUrl }}
                                style={styles.memberAvatar}
                                contentFit="cover"
                                transition={200}
                                cachePolicy="disk"
                              />
                            ) : (
                              <View style={styles.memberAvatarPlaceholder}>
                                <Text style={styles.memberAvatarPlaceholderText}>
                                  {member.pseudo.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                            )}
                            <View style={styles.memberInfoCol}>
                              <Text style={styles.memberPseudoText} numberOfLines={1}>
                                {member.pseudo} {member.userId === currentUserId ? '(Vous)' : ''}
                              </Text>
                            </View>
                            {member.role === 'creator' && (
                              <View style={styles.creatorBadge}>
                                <Text style={styles.creatorBadgeText}>Créateur</Text>
                              </View>
                            )}
                          </View>
                        ))
                      )}
                    </View>
                  )}

                  <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: '#e8dbce', marginTop: 4, paddingTop: 8 }]}>
                    <View style={styles.infoIconWrapper}>
                      <Ionicons name="shield-checkmark-outline" size={16} color="#604a3e" />
                    </View>
                    <Text style={styles.infoText}>
                      {isCreator ? 'Vous êtes le créateur' : 'Membre du groupe'}
                    </Text>
                  </View>
                </View>

                {/* Bouton Destructif (Supprimer / Quitter) */}
                <TouchableOpacity
                  style={[styles.destructiveButton, isDeleting && { opacity: 0.6 }]}
                  onPress={handleDestructiveAction}
                  disabled={isDeleting}
                  activeOpacity={0.85}
                >
                  {isDeleting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons
                        name={isCreator ? 'trash-outline' : 'log-out-outline'}
                        size={18}
                        color="#fff"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.destructiveButtonText}>
                        {isCreator ? 'Supprimer le GroopProot' : 'Quitter le GroopProot'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardContainer: {
    width: '88%',
    maxWidth: 380,
  },
  modalCard: {
    backgroundColor: '#fff5eb',
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 14,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(96, 74, 62, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#604a3e',
  },
  closeButton: {
    padding: 2,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 18,
  },
  avatarButton: {
    position: 'relative',
  },
  avatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#eeddcb',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#604a3e',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#604a3e',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff5eb',
  },
  avatarHint: {
    fontSize: 12,
    color: '#8b6f5d',
    marginTop: 6,
    fontWeight: '500',
  },
  nameSection: {
    width: '100%',
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8b6f5d',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nameDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.15)',
  },
  groupNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A3428',
    flex: 1,
  },
  pencilBadge: {
    backgroundColor: 'rgba(96, 74, 62, 0.1)',
    borderRadius: 10,
    padding: 6,
    marginLeft: 8,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: '#4A3428',
    fontWeight: '600',
    borderWidth: 1.5,
    borderColor: '#604a3e',
  },
  saveNameButton: {
    backgroundColor: '#604a3e',
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelNameButton: {
    backgroundColor: 'rgba(96, 74, 62, 0.12)',
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retentionSection: {
    width: '100%',
    marginBottom: 16,
  },
  retentionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  retentionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: 'rgba(96, 74, 62, 0.2)',
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
  retentionHintText: {
    fontSize: 11,
    color: '#8b6f5d',
    marginTop: 6,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  infoCard: {
    width: '100%',
    backgroundColor: '#f3e6d6',
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIconWrapper: {
    width: 24,
    alignItems: 'center',
    marginRight: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#553d30',
    fontWeight: '500',
  },
  membersExpandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  membersListContainer: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e8dbce',
    gap: 8,
  },
  memberItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  memberAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eee',
    marginRight: 10,
  },
  memberAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#604a3e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  memberAvatarPlaceholderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  memberInfoCol: {
    flex: 1,
  },
  memberPseudoText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3a2a22',
  },
  creatorBadge: {
    backgroundColor: 'rgba(96, 74, 62, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  creatorBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#604a3e',
  },
  destructiveButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d94343',
    borderRadius: 16,
    paddingVertical: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#d94343',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  destructiveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
