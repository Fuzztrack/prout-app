import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import i18n from '../lib/i18n';
import { supabase } from '../lib/supabase';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.82;

type BlockedUser = {
  id: string;
  pseudo: string;
  avatar_url: string | null;
};

type BlockedUsersListProps = {
  visible: boolean;
  onClose: () => void;
  onUnblocked?: () => void;
};

export function BlockedUsersList({ visible, onClose, onUnblocked }: BlockedUsersListProps) {
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [items, setItems] = useState<BlockedUser[]>([]);

  const loadBlockedUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) {
        setItems([]);
        return;
      }

      setCurrentUserId(user.id);

      const { data: blockedRows, error: blockedError } = await supabase
        .from('blocked_users')
        .select('blocked_user_id')
        .eq('blocker_id', user.id);

      if (blockedError) throw blockedError;

      const blockedIds = (blockedRows || [])
        .map((row: any) => row.blocked_user_id)
        .filter(Boolean);

      if (!blockedIds.length) {
        setItems([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, pseudo, avatar_url')
        .in('id', blockedIds);

      if (profilesError) throw profilesError;

      const nextItems = (profiles || [])
        .map((profile: any) => ({
          id: profile.id,
          pseudo: profile.pseudo || i18n.t('not_defined'),
          avatar_url: profile.avatar_url || null,
        }))
        .sort((a, b) => a.pseudo.localeCompare(b.pseudo, undefined, { sensitivity: 'base' }));

      setItems(nextItems);
    } catch (error) {
      console.error('❌ Erreur chargement amis bloqués:', error);
      Alert.alert(i18n.t('error'), i18n.t('blocked_friends_load_error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    void loadBlockedUsers();
  }, [visible, loadBlockedUsers]);

  const handleUnblock = useCallback(
    (user: BlockedUser) => {
      if (!currentUserId) return;

      Alert.alert(
        i18n.t('unblock_user_confirm_title'),
        i18n.t('unblock_user_confirm_body', { pseudo: user.pseudo }),
        [
          { text: i18n.t('cancel'), style: 'cancel' },
          {
            text: i18n.t('unblock_user'),
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from('blocked_users')
                  .delete()
                  .eq('blocker_id', currentUserId)
                  .eq('blocked_user_id', user.id);

                if (error) throw error;

                const { error: restoreFriendshipError } = await supabase
                  .from('friends')
                  .upsert(
                    {
                      user_id: currentUserId,
                      friend_id: user.id,
                      method: 'invitation',
                      status: 'accepted',
                    },
                    { onConflict: 'user_id,friend_id' }
                  );

                if (restoreFriendshipError) throw restoreFriendshipError;

                setItems((prev) => prev.filter((item) => item.id !== user.id));
                onUnblocked?.();
              } catch (unblockError) {
                console.error('❌ Erreur déblocage utilisateur:', unblockError);
                Alert.alert(i18n.t('error'), i18n.t('blocked_friends_unblock_error'));
              }
            },
          },
        ]
      );
    },
    [currentUserId, onUnblocked]
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{i18n.t('blocked_friends_title')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#604a3e" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator style={styles.loader} color="#604a3e" />
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={<Text style={styles.emptyText}>{i18n.t('blocked_friends_empty')}</Text>}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <View style={styles.userInfo}>
                    {item.avatar_url ? (
                      <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarPlaceholderText}>
                          {item.pseudo.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.pseudo}>{item.pseudo}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.unblockButton}
                    onPress={() => handleUnblock(item)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.unblockButtonText}>{i18n.t('unblock_user')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  modalContent: {
    width: '94%',
    height: MODAL_HEIGHT,
    maxHeight: MODAL_HEIGHT,
    backgroundColor: '#fff5eb',
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(96, 74, 62, 0.1)',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#604a3e',
  },
  closeButton: {
    padding: 4,
  },
  loader: {
    marginTop: 30,
  },
  listContent: {
    padding: 16,
    paddingBottom: 30,
    flexGrow: 1,
  },
  emptyText: {
    marginTop: 20,
    textAlign: 'center',
    color: '#604a3e',
    opacity: 0.7,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d2f1ef',
  },
  avatarPlaceholderText: {
    color: '#604a3e',
    fontWeight: '700',
  },
  pseudo: {
    color: '#604a3e',
    fontSize: 16,
    fontWeight: '600',
  },
  unblockButton: {
    backgroundColor: '#d2f1ef',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  unblockButtonText: {
    color: '#604a3e',
    fontWeight: '700',
  },
});
