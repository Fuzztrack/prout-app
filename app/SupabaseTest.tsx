// app/SupabaseTest.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

export default function SupabaseTest() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [pseudo, setPseudo] = useState('');
  const [phone, setPhone] = useState('');

  // Lire tous les profils utilisateurs
  const fetchProfiles = async () => {
    const { data, error } = await supabase.from('user_profiles').select('*');
    if (error) {
      console.log('Erreur Supabase:', error);
      Alert.alert('Erreur', JSON.stringify(error));
    } else {
      setProfiles(data || []);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  // Note: Pour ajouter un profil, il faut d'abord créer un compte auth
  // Cette fonction est désactivée car elle nécessite une authentification complète
  const addProfile = async () => {
    Alert.alert(
      'Information',
      'Pour créer un profil, utilisez la page d\'inscription qui crée automatiquement le compte auth et le profil.'
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Test Supabase - Profils</Text>
      <Text style={styles.note}>
        Note: Les profils sont créés automatiquement lors de l'inscription.
      </Text>

      <Text style={styles.subtitle}>Liste des profils utilisateurs</Text>
      <FlatList
        data={profiles}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Text style={styles.profile}>
            {item.pseudo} - {item.phone || 'Pas de téléphone'}
          </Text>
        )}
      />
      <Button title="Rafraîchir" onPress={fetchProfiles} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#ebb89b' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#604a3e' },
  note: { fontSize: 14, color: '#604a3e', marginBottom: 20, fontStyle: 'italic' },
  input: { backgroundColor: '#fff', padding: 10, marginBottom: 10, borderRadius: 8 },
  subtitle: { marginTop: 20, fontSize: 20, fontWeight: 'bold', color: '#604a3e' },
  profile: { fontSize: 16, paddingVertical: 4, color: '#604a3e' },
});
