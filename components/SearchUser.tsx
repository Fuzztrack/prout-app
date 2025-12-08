import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../lib/i18n';

export function SearchUser({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const latestQueryRef = useRef<string>('');
  const MIN_QUERY_LENGTH = 2;

  // On charge notre ID au démarrage pour ne pas s'auto-ajouter
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setCurrentUserId(data.user.id);
    });
  }, []);

  const performSearch = useCallback(async (text: string) => {
    const trimmed = text.trim();
    latestQueryRef.current = trimmed;

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // 1. Recherche dans les profils (Insensible à la casse)
      let profilesQuery = supabase
        .from('user_profiles')
        .select('id, pseudo')
        .ilike('pseudo', `${trimmed}%`) // Commence par
        .order('pseudo', { ascending: true })
        .limit(10);

      if (currentUserId) {
        profilesQuery = profilesQuery.neq('id', currentUserId); // Exclure soi-même
      }

      const { data: profiles, error } = await profilesQuery;

      if (error) throw error;

      // Vérifier que la requête est toujours d'actualité
      if (latestQueryRef.current !== trimmed) {
        return;
      }

      if (profiles && profiles.length > 0) {
        // 2. Vérifier les statuts d'amitié pour ces résultats
        const { data: friendships } = await supabase
          .from('friends')
          .select('friend_id, status')
          .eq('user_id', currentUserId)
          .in('friend_id', profiles.map(p => p.id));

        // On fusionne les infos
        const enrichedResults = profiles.map(profile => {
          const relation = friendships?.find(f => f.friend_id === profile.id);
          return {
            ...profile,
            friendStatus: relation?.status || null // 'accepted', 'pending', ou null
          };
        });

        setResults(enrichedResults);
      } else {
        setResults([]); // Aucun résultat
      }

    } catch (e: any) {
      Alert.alert(i18n.t('error'), e.message);
    } finally {
      if (latestQueryRef.current === trimmed) {
        setLoading(false);
      }
    }
  }, [currentUserId]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 250);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  const handleSearch = async () => {
    await performSearch(query);
  };

  const handleAddFriend = async (friendId: string) => {
    try {
      if (!currentUserId) return;

      // Création de la relation "Invitation"
      const { error } = await supabase
        .from('friends')
        .insert({
          user_id: currentUserId,
          friend_id: friendId,
          method: 'search', // On marque que ça vient de la recherche
          status: 'pending'
        });

      if (error) {
        if (error.code === '23505') { // Doublon
           Alert.alert(i18n.t('info'), i18n.t('already_linked'));
        } else {
           throw error;
        }
      } else {
        Alert.alert(i18n.t('success'), i18n.t('request_sent'));
        // On met à jour la liste locale pour afficher "En attente"
        setResults(prev => prev.map(p => p.id === friendId ? { ...p, friendStatus: 'pending' } : p));
      }

    } catch (e: any) {
      Alert.alert(i18n.t('error'), "Impossible d'ajouter cet ami."); // TODO: Traduire
      console.log(e);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{i18n.t('search_title')}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#604a3e" />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>{i18n.t('search_subtitle')}</Text>

      <View style={styles.searchBox}>
        <TextInput
          style={styles.input}
          placeholder={i18n.t('search_placeholder')}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={handleSearch}
          placeholderTextColor="#999"
        />
      </View>

      <TouchableOpacity 
        style={[
          styles.searchButtonMain,
          (loading || !query.trim()) && styles.searchButtonDisabled
        ]} 
        onPress={handleSearch}
        disabled={loading || !query.trim()}
      >
        <Ionicons 
          name="search" 
          size={20} 
          color="white" 
          style={{marginRight: 8}} 
        />
        <Text style={styles.searchButtonText}>
          {loading ? i18n.t('loading') : i18n.t('search_btn')}
        </Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator style={{marginTop: 20}} color="#604a3e" />
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          style={styles.resultsList}
          ListEmptyComponent={
            query.length > 0 ? <Text style={styles.empty}>{i18n.t('no_results')}</Text> : null
          }
          renderItem={({ item }) => (
            <View style={styles.userRow}>
              <View style={styles.userInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.pseudo.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.pseudo}>{item.pseudo}</Text>
              </View>

              {item.friendStatus === 'accepted' ? (
                <Text style={styles.statusText}>{i18n.t('already_friend')}</Text>
              ) : (
                <TouchableOpacity 
                  style={[
                    styles.addButton,
                    item.friendStatus === 'pending' && styles.addButtonPending
                  ]} 
                  onPress={() => item.friendStatus !== 'pending' && handleAddFriend(item.id)}
                  disabled={item.friendStatus === 'pending'}
                >
                  <Ionicons 
                    name={item.friendStatus === 'pending' ? "time-outline" : "person-add-outline"} 
                    size={20} 
                    color={item.friendStatus === 'pending' ? "#ff4444" : "#604a3e"} 
                  />
                  <Text style={[
                    styles.addButtonText,
                    item.friendStatus === 'pending' && styles.addButtonTextPending
                  ]}>
                    {item.friendStatus === 'pending' ? i18n.t('pending_btn') : i18n.t('add_btn')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.5)', // Plus transparent pour laisser voir le fond
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#604a3e',
  },
  closeButton: {
    padding: 5,
  },
  subtitle: {
    color: '#604a3e',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 15,
  },
  searchBox: { 
    marginBottom: 15,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.2)'
  },
  input: { 
    backgroundColor: 'transparent', 
    padding: 12, 
    fontSize: 16,
    color: '#333'
  },
  searchButtonMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#604a3e',
    padding: 12,
    borderRadius: 15,
    marginBottom: 10,
    opacity: 1
  },
  searchButtonDisabled: {
    opacity: 0.5
  },
  searchButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16
  },
  resultsList: {
    flex: 1,
  },
  userRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', 
    padding: 10, 
    borderRadius: 12, 
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.1)'
  },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: 'rgba(96, 74, 62, 0.1)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 10 
  },
  avatarText: { fontWeight: 'bold', color: '#604a3e', fontSize: 16 },
  pseudo: { fontSize: 15, fontWeight: 'bold', color: '#604a3e' },
  
  addButton: { 
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5', 
    paddingVertical: 6, 
    paddingHorizontal: 12, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.1)'
  },
  addButtonPending: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderColor: 'rgba(255, 68, 68, 0.3)'
  },
  addButtonText: { color: '#604a3e', fontWeight: 'bold', marginLeft: 5, fontSize: 12 },
  addButtonTextPending: { color: '#ff4444' },
  statusText: { color: '#604a3e', fontStyle: 'italic', opacity: 0.8, fontSize: 12 },
  empty: { textAlign: 'center', color: '#604a3e', marginTop: 20, opacity: 0.7 },
});

