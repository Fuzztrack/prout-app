import { useEffect, useState } from 'react';
import { Alert, ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { sendProutViaBackend } from '../lib/sendProutBackend';
import i18n from '../lib/i18n';

type IdentityFriend = {
  id: string;
  pseudo: string;
  expo_push_token: string | null;
  push_platform: 'ios' | 'android' | null;
  alias: string | null;
  status: string | null;
};

export function IdentityList() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<IdentityFriend[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentPseudo, setCurrentPseudo] = useState<string>('Un ami');

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }
        setCurrentUserId(user.id);
        const { data: profile } = await supabase.from('user_profiles').select('pseudo').eq('id', user.id).single();
        if (profile?.pseudo) {
          setCurrentPseudo(profile.pseudo);
        }

        // Récupérer les amis acceptés (dans les deux sens)
        const { data: addedFriends } = await supabase
          .from('friends')
          .select('friend_id')
          .eq('user_id', user.id)
          .eq('status', 'accepted');
        const addedFriendsIds = addedFriends?.map(f => f.friend_id) || [];

        const { data: friendsWhereIAmFriend } = await supabase
          .from('friends')
          .select('user_id')
          .eq('friend_id', user.id)
          .eq('status', 'accepted');
        const friendsWhereIAmFriendIds = friendsWhereIAmFriend?.map(f => f.user_id) || [];

        const allFriendIds = [...new Set([...addedFriendsIds, ...friendsWhereIAmFriendIds])];

        if (allFriendIds.length === 0) {
          setItems([]);
          return;
        }

        const { data: reveals } = await supabase
          .from('identity_reveals')
          .select('friend_id, alias, status')
          .eq('requester_id', user.id)
          .in('friend_id', allFriendIds);

        const aliasMap = (reveals || []).reduce((acc, r) => {
          acc[r.friend_id] = { alias: r.alias, status: r.status };
          return acc;
        }, {} as Record<string, { alias: string | null, status: string | null }>);

        const { data: users } = await supabase
          .from('user_profiles')
          .select('id, pseudo, expo_push_token, push_platform')
          .in('id', allFriendIds);

        const list: IdentityFriend[] = (users || []).map(u => ({
          id: u.id,
          pseudo: u.pseudo,
          expo_push_token: u.expo_push_token,
          push_platform: (u.push_platform as 'ios' | 'android' | null) || null,
          alias: aliasMap[u.id]?.alias || null,
          status: aliasMap[u.id]?.status || null,
        }));
        setItems(list);
      } catch (e) {
        console.error('❌ Erreur chargement identité:', e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const requestIdentity = async (friend: IdentityFriend) => {
    if (!currentUserId) return;
    try {
      const { data: existing } = await supabase
        .from('identity_reveals')
        .select('status')
        .eq('requester_id', currentUserId)
        .eq('friend_id', friend.id)
        .maybeSingle();

      if (existing?.status === 'pending') {
        Alert.alert(i18n.t('already_asked_identity_title'), i18n.t('already_asked_identity_body', { pseudo: friend.pseudo }));
        return;
      }

      await supabase
        .from('identity_reveals')
        .upsert({
          requester_id: currentUserId,
          friend_id: friend.id,
          status: 'pending',
        }, {
          onConflict: 'requester_id,friend_id',
          updated_at: new Date().toISOString(),
        });

      if (friend.expo_push_token) {
        await sendProutViaBackend(
          friend.expo_push_token,
          currentPseudo || 'Un ami',
          'identity-request',
          (friend.push_platform as 'ios' | 'android' | undefined) || 'android',
          {
            requesterId: currentUserId,
            requesterPseudo: currentPseudo || 'Un ami',
          },
        );
      }

      Alert.alert(i18n.t('success'), i18n.t('request_sent'));
      // Mettre à jour localement le statut
      setItems(prev => prev.map(i => i.id === friend.id ? { ...i, status: 'pending' } : i));
    } catch (error) {
      console.error('❌ Impossible de demander l’identité:', error);
      Alert.alert(i18n.t('error'), 'Impossible d’envoyer la demande.');
    }
  };

  const renderItem = ({ item }: { item: IdentityFriend }) => {
    const hasAlias = !!item.alias;
    const isPending = item.status === 'pending';
    return (
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pseudo}>{item.pseudo}</Text>
        </View>
        <View style={styles.right}>
          {hasAlias ? (
            <Text style={styles.alias}>{item.alias}</Text>
          ) : isPending ? (
            <Text style={styles.pending}>En attente…</Text>
          ) : (
            <TouchableOpacity style={styles.askButton} onPress={() => requestIdentity(item)}>
              <Ionicons name="help-circle-outline" size={20} color="#fff" />
              <Text style={styles.askText}>Qui ?</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 20 }} />;
  }

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Aucun ami encore. Ajoutez des amis pour demander leur identité.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={{ paddingVertical: 10 }}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pseudo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#604a3e',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alias: {
    fontSize: 15,
    color: '#2d5a4f',
    fontWeight: '600',
  },
  pending: {
    fontSize: 14,
    color: '#c47a1b',
    fontWeight: '600',
  },
  askButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#604a3e',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  askText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  empty: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#555',
  },
});

