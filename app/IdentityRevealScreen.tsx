import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { sendProutViaBackend } from '../lib/sendProutBackend';
import { supabase } from '../lib/supabase';

export default function IdentityRevealScreen() {
  const router = useRouter();
  const { requesterId, requesterPseudo } = useLocalSearchParams<{ requesterId?: string; requesterPseudo?: string }>();
  const [alias, setAlias] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!requesterId) {
      Alert.alert('Erreur', 'Identifiant du demandeur manquant.');
      return;
    }

    if (!alias.trim()) {
      Alert.alert('Nom incomplet', 'Merci d’indiquer votre nom ou un alias.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Erreur', 'Vous devez être connecté.');
        setLoading(false);
        return;
      }

      await supabase
        .from('identity_reveals')
        .upsert({
          requester_id: requesterId,
          friend_id: user.id,
          alias: alias.trim(),
          status: 'revealed',
        }, {
          onConflict: 'requester_id,friend_id',
        });

      const { data: requesterProfile } = await supabase
        .from('user_profiles')
        .select('expo_push_token, push_platform')
        .eq('id', requesterId)
        .maybeSingle();

      if (requesterProfile?.expo_push_token) {
        const senderPseudo = user.user_metadata?.pseudo || requesterPseudo || 'Un prouteur';
        await sendProutViaBackend(
          requesterProfile.expo_push_token,
          senderPseudo,
          'identity-response',
          requesterProfile.push_platform as 'ios' | 'android' | undefined,
        );
      }

      Alert.alert('Merci !', 'Ton identité a été partagée avec ton ami.');
      router.back();
    } catch (error: any) {
      console.error('❌ Impossible d’enregistrer l’identité:', error);
      Alert.alert('Erreur', error.message || 'Impossible de partager ton identité.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Qui es-tu ? 👀</Text>
        <Text style={styles.subtitle}>
          {requesterPseudo ? `${requesterPseudo}` : 'Un ami'} souhaite connaître ton identité.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Ex: Michel Dupont"
          value={alias}
          onChangeText={setAlias}
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Envoi…' : 'Envoyer'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.secondary}>
          <Text style={styles.secondaryText}>Plus tard</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ebb89b',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#604a3e',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#604a3e',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d9c0b2',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#604a3e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondary: {
    marginTop: 16,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#604a3e',
    textDecorationLine: 'underline',
  },
});

