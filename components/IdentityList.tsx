import { useEffect, useState, useCallback } from 'react';
import { Alert, ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { useIsFocused } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { sendProutViaBackend } from '../lib/sendProutBackend';
import { normalizePhone } from '../lib/normalizePhone';
import i18n from '../lib/i18n';
import { ensureContactPermissionWithDisclosure } from '../lib/contactConsent';

type IdentityFriend = {
  id: string;
  pseudo: string;
  phone: string | null;
  expo_push_token: string | null;
  push_platform: 'ios' | 'android' | null;
  alias: string | null;
  status: string | null;
};

type IdentityListProps = {
  onClose?: () => void;
};

export function IdentityList({ onClose }: IdentityListProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<IdentityFriend[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentPseudo, setCurrentPseudo] = useState<string>('Un ami');
  const isFocused = useIsFocused();

  const load = useCallback(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }
        setCurrentUserId(user.id);
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('pseudo, phone, contacts')
          .eq('id', user.id)
          .single();
        if (profile?.pseudo) setCurrentPseudo(profile.pseudo);
        const myPhoneRaw = profile?.phone || '';
        const myPhone = normalizePhone(myPhoneRaw || '');
        const myContacts = (profile?.contacts || []) as string[];

        // Matches téléphone (même logique que FriendList)
        let phoneFriendsIds: string[] = [];
        try {
            const status = await ensureContactPermissionWithDisclosure();
          if (status === 'granted') {
            const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
            if (data.length > 0) {
              const phonesRaw = data.flatMap(c => c.phoneNumbers || []).map(p => p.number || '').filter(Boolean);
              const phonesNormalized = phonesRaw.map(p => normalizePhone(p)).filter(Boolean) as string[];
              const phones = Array.from(new Set([...phonesRaw, ...phonesNormalized]));

              if (phones.length > 0) {
                // RPC sync_contacts (crée aussi les relations contact en base)
                const { data: matchedFriends, error: syncError } = await supabase.rpc('sync_contacts', { phones });
                if (syncError) {
                  console.error('❌ Erreur sync contacts (IdentityList):', syncError);
                } else if (matchedFriends) {
                  phoneFriendsIds = matchedFriends.map(u => u.id);
                }

                // fallback direct user_profiles
                if (phoneFriendsIds.length === 0) {
                  const { data: contactsFound } = await supabase
                    .from('user_profiles')
                    .select('id')
                    .in('phone', phones)
                    .neq('id', user.id);
                  if (contactsFound) {
                    phoneFriendsIds = contactsFound.map(u => u.id);
                  }
                }
              }
            }
          }
        } catch (err) {
          console.warn('⚠️ Permission contacts refusée ou erreur:', err);
        }

        // Fallback base: contacts stockés dans mon profil (trigger handle_phone_contacts)
        if (phoneFriendsIds.length === 0 && myContacts && myContacts.length > 0) {
          const contactsNormalized = myContacts.map(p => normalizePhone(p || '')).filter(Boolean) as string[];
          const contactsAll = Array.from(new Set([...myContacts, ...contactsNormalized].filter(Boolean)));
          if (contactsAll.length > 0) {
            const { data: contactsFound } = await supabase
              .from('user_profiles')
              .select('id')
              .in('phone', contactsAll)
              .neq('id', user.id);
            if (contactsFound) {
              phoneFriendsIds = contactsFound.map(u => u.id);
            }
          }
        }

        // Reverse match: qui m'a dans ses contacts
        if (myPhone || myPhoneRaw) {
          const needles = Array.from(new Set([myPhoneRaw, myPhone].filter(Boolean)));
          if (needles.length > 0) {
            const { data: reverseMatches } = await supabase
              .from('user_profiles')
              .select('id')
              .or(needles.map(n => `contacts.cs.{${n}}`).join(','))
              .neq('id', user.id);
            if (reverseMatches) {
              phoneFriendsIds = [...new Set([...phoneFriendsIds, ...reverseMatches.map(u => u.id)])];
            }
          }
        }

        // Récupérer les amis acceptés (dans les deux sens)
        // Récupérer toutes les relations friends (hors blocked) où je suis user ou friend
        const { data: rel1 } = await supabase
          .from('friends')
          .select('friend_id')
          .eq('user_id', user.id)
          .neq('status', 'blocked');
        const rel1Ids = rel1?.map(f => f.friend_id) || [];

        const { data: rel2 } = await supabase
          .from('friends')
          .select('user_id')
          .eq('friend_id', user.id)
          .neq('status', 'blocked');
        const rel2Ids = rel2?.map(f => f.user_id) || [];

        // Combiner : matches téléphone + toutes relations friends (contact ou autres)
        const allFriendIds = [...new Set([
          ...phoneFriendsIds,
          ...rel1Ids,
          ...rel2Ids,
        ].filter(Boolean))];

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
          .select('id, pseudo, phone, expo_push_token, push_platform')
          .in('id', allFriendIds);

        // Charger les contacts du téléphone pour trouver les noms révélés
        let contactsList: Contacts.Contact[] = [];
        try {
          const contactsStatus = await ensureContactPermissionWithDisclosure();
          if (contactsStatus === 'granted') {
            const { data: contactsData } = await Contacts.getContactsAsync({ 
              fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name] 
            });
            contactsList = contactsData || [];
          }
        } catch (e) {
          console.warn('⚠️ Erreur chargement contacts pour identité:', e);
        }

        const list: IdentityFriend[] = (users || []).map(u => {
          // Chercher le nom dans les contacts téléphone si pas d'alias révélé
          let contactAlias: string | null = null;
          if (!aliasMap[u.id]?.alias && u.phone) {
            const normalizedFriendPhone = normalizePhone(u.phone);
            const matchingContact = contactsList.find(contact => {
              if (!contact.phoneNumbers || contact.phoneNumbers.length === 0) return false;
              return contact.phoneNumbers.some(phoneNumber => {
                const normalizedContactPhone = normalizePhone(phoneNumber.number || '');
                return normalizedContactPhone === normalizedFriendPhone;
              });
            });
            if (matchingContact) {
              contactAlias = matchingContact.name || matchingContact.firstName || matchingContact.lastName || null;
            }
          }

          return {
            id: u.id,
            pseudo: u.pseudo,
            phone: u.phone,
            expo_push_token: u.expo_push_token,
            push_platform: (u.push_platform as 'ios' | 'android' | null) || null,
            alias: aliasMap[u.id]?.alias || contactAlias,
            status: aliasMap[u.id]?.status || null,
          };
        });
        
        setItems(list);
      } catch (e) {
        console.error('❌ Erreur chargement identité:', e);
      } finally {
        setLoading(false);
      }
  }, []);

  useEffect(() => {
    if (isFocused) {
      setLoading(true);
      load();
    }
  }, [isFocused, load]);

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

      Alert.alert(i18n.t('success'), i18n.t('identity_request_sent'));
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
      <View style={styles.container}>
        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Fermer">
            <Ionicons name="close" size={22} color="#604a3e" />
          </TouchableOpacity>
        )}
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Aucun ami encore. Ajoutez des amis pour demander leur identité.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {onClose && (
        <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Fermer">
          <Ionicons name="close" size={22} color="#604a3e" />
        </TouchableOpacity>
      )}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingVertical: 10 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 6,
    marginBottom: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
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

