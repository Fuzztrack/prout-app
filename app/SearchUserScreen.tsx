import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SearchUserScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // On charge notre ID au démarrage pour ne pas s'auto-ajouter
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setCurrentUserId(data.user.id);
    });
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResults([]);

    try {
      // 1. Recherche dans les profils (Insensible à la casse)
      const { data: profiles, error } = await supabase
        .from('user_profiles')
        .select('id, pseudo')
        .ilike('pseudo', `%${query.trim()}%`) // Recherche partielle
        .neq('id', currentUserId) // Exclure soi-même
        .limit(10);

      if (error) throw error;

      if (profiles && profiles.length > 0) {
        // 2. Vérifier les statuts d'amitié pour ces résultats
        // On veut savoir si on est déjà ami ou si une demande est en cours
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
      Alert.alert("Erreur", e.message);
    } finally {
      setLoading(false);
    }
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
           Alert.alert("Info", "Vous êtes déjà en lien avec cette personne.");
        } else {
           throw error;
        }
      } else {
        Alert.alert("Succès", "Demande d'ami envoyée !");
        // On met à jour la liste locale pour afficher "En attente"
        setResults(prev => prev.map(p => p.id === friendId ? { ...p, friendStatus: 'pending' } : p));
      }

    } catch (e: any) {
      Alert.alert("Erreur", "Impossible d'ajouter cet ami.");
      console.log(e);
    }
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/(tabs)')} activeOpacity={0.7}>
            <Image 
              source={require('../assets/images/prout-meme.png')} 
              style={styles.headerImage} 
              resizeMode="contain" 
            />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <TextInput
            style={styles.input}
            placeholder="Entrez un pseudo..."
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
            {loading ? 'Recherche...' : 'Rechercher'}
          </Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator style={{marginTop: 20}} color="#604a3e" />
        ) : (
          <FlatList
            data={results}
            keyExtractor={item => item.id}
            scrollEnabled={false}
            ListEmptyComponent={
              query.length > 0 ? <Text style={styles.empty}>Aucun prouteur trouvé.</Text> : null
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
                  <Text style={styles.statusText}>Déjà ami ✅</Text>
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
                      {item.friendStatus === 'pending' ? 'En attente' : 'Ajouter'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          />
        )}

        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#604a3e" />
          <Text style={styles.backText}>Retour</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#ebb89b' },
  container: { flexGrow: 1, backgroundColor: '#ebb89b', padding: 20, paddingTop: 20, paddingBottom: 100 },
  header: { alignItems: 'center', marginBottom: 20 },
  headerImage: { width: 180, height: 140, marginBottom: 10 },
  
  searchBox: { 
    marginBottom: 15,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.2)'
  },
  input: { 
    backgroundColor: 'transparent', 
    padding: 15, 
    fontSize: 16,
    color: '#333'
  },
  searchButtonMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#604a3e',
    padding: 15,
    borderRadius: 15,
    marginBottom: 20,
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
  
  userRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.8)', 
    padding: 15, 
    borderRadius: 15, 
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.2)'
  },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: 'rgba(96, 74, 62, 0.1)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 10 
  },
  avatarText: { fontWeight: 'bold', color: '#604a3e', fontSize: 18 },
  pseudo: { fontSize: 16, fontWeight: 'bold', color: '#604a3e' },
  
  addButton: { 
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', 
    paddingVertical: 8, 
    paddingHorizontal: 15, 
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.2)'
  },
  addButtonPending: {
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    borderColor: 'rgba(255, 68, 68, 0.5)'
  },
  addButtonText: { color: '#604a3e', fontWeight: 'bold', marginLeft: 5 },
  addButtonTextPending: { color: '#ff4444' },
  statusText: { color: '#604a3e', fontStyle: 'italic', opacity: 0.8 },
  empty: { textAlign: 'center', color: '#604a3e', marginTop: 20, opacity: 0.7 },
  
  backButton: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', 
    padding: 15, 
    borderRadius: 15,
    marginTop: 20,
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: 'rgba(96, 74, 62, 0.2)'
  },
  backText: { color: '#604a3e', fontWeight: 'bold', fontSize: 16, marginLeft: 10 }
});

