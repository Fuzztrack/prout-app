import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, StyleSheet, Platform, TouchableOpacity, Text, Keyboard, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SwipeableFriendRow } from '../components/FriendsList';
import { SearchEvents } from '../utils/searchEvent';
import { Ionicons } from '@expo/vector-icons';

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState<any[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<any[]>([]);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (params.friends) {
      try {
        const parsedFriends = JSON.parse(params.friends as string);
        setFriends(parsedFriends);
        setFilteredFriends(parsedFriends);
      } catch (e) {
        console.error('Error parsing friends', e);
      }
    }
  }, [params.friends]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFriends(friends);
      return;
    }
    const query = searchQuery.toLowerCase();
    const filtered = friends.filter(friend => 
      (friend.pseudo && friend.pseudo.toLowerCase().includes(query)) ||
      (friend.username && friend.username.toLowerCase().includes(query))
    );
    setFilteredFriends(filtered);
  }, [searchQuery, friends]);

  // Focus simple
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 500); // Délai un peu plus long pour être sûr
    return () => clearTimeout(timer);
  }, []);

  const handleSelectFriend = (friend: any) => {
    Keyboard.dismiss();
    SearchEvents.selectFriend(friend.id);
    router.back();
  };

  const handleClose = () => {
    Keyboard.dismiss();
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#604a3e" />
        </TouchableOpacity>
        
        <View style={styles.simpleInputContainer}>
          <Ionicons name="search" size={20} color="#604a3e" style={{ marginRight: 10 }} />
          <TextInput
            ref={inputRef}
            style={styles.simpleInput}
            placeholder="Rechercher..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            // Props minimalistes pour éviter tout conflit Android
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#ccc" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredFriends}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        // On désactive le dismiss on-drag pour voir si c'est lui le coupable
        // keyboardDismissMode="on-drag" 
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item, index }) => (
          <TouchableOpacity 
            onPress={() => handleSelectFriend(item)}
            style={styles.friendRow}
          >
            <View style={styles.avatarContainer}>
              <View style={[styles.avatarPlaceholder, { backgroundColor: index % 2 === 0 ? '#d2f1ef' : '#baded7' }]}>
                <Text style={styles.avatarText}>
                  {(item.pseudo || item.username || '?').substring(0, 1).toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={styles.infoContainer}>
              <Text style={styles.pseudo}>{item.pseudo || 'Sans pseudo'}</Text>
              <Text style={styles.username}>@{item.username}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    paddingRight: 15,
    backgroundColor: '#f2f2f2',
  },
  backButton: {
    paddingLeft: 15,
    paddingRight: 10,
    height: 40,
    justifyContent: 'center',
  },
  simpleInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 10,
    height: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  simpleInput: {
    flex: 1,
    fontSize: 16,
    color: '#604a3e',
    height: '100%',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginBottom: 8,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarContainer: { marginRight: 15 },
  avatarPlaceholder: {
    width: 50, height: 50, borderRadius: 25,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: '#604a3e' },
  infoContainer: { flex: 1 },
  pseudo: { fontSize: 16, fontWeight: 'bold', color: '#604a3e' },
  username: { fontSize: 14, color: '#888' },
});
