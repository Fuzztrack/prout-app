import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { sendProutViaBackend } from '../lib/sendProutBackend';
import { supabase } from '../lib/supabase';

import i18n from '../lib/i18n';

export default function IdentityRevealScreen() {
  const router = useRouter();
  const { requesterId, requesterPseudo } = useLocalSearchParams<{ requesterId?: string; requesterPseudo?: string }>();
  const [alias, setAlias] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!requesterId) {
      Alert.alert(i18n.t('error'), i18n.t('reveal_missing_id'));
      return;
    }

    if (!alias.trim()) {
      Alert.alert(i18n.t('info'), i18n.t('reveal_missing_name'));
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert(i18n.t('error'), i18n.t('not_connected'));
        setLoading(false);
        return;
      }

      // 1. Mettre à jour l'entrée dans identity_reveals (UPDATE uniquement, la ligne doit exister)
      const { data: updateData, error: updateError } = await supabase
        .from('identity_reveals')
        .update({
          alias: alias.trim(),
          status: 'revealed',
        })
        .eq('requester_id', requesterId)
        .eq('friend_id', user.id)
        .select();

      if (updateError) {
        console.error('❌ Erreur update identity:', updateError);
        throw updateError;
      }
      
      console.log('✅ Identité mise à jour:', updateData);
      
      // Si aucune ligne n'est retournée, c'est que RLS a bloqué l'update/insert malgré le succès apparent
      if (!updateData || updateData.length === 0) {
         console.warn('⚠️ Attention: Aucune ligne retournée après update. Vérifier RLS.');
      }

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
          {
            senderId: user.id,
            receiverId: requesterId, // ⚠️ IMPORTANT : pour que le backend récupère la locale du destinataire
          },
        );
      }

      Alert.alert(i18n.t('reveal_success_title'), i18n.t('reveal_success_body'));
      router.back();
    } catch (error: any) {
      console.error('❌ Impossible d’enregistrer l’identité:', error);
      Alert.alert(i18n.t('error'), error.message || i18n.t('reveal_error'));
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
        <Text style={styles.title}>{i18n.t('who_are_you')}</Text>
        <Text style={styles.subtitle}>
          {i18n.t('who_are_you_subtitle', { requester: requesterPseudo || 'Un ami' })}
        </Text>

        <TextInput
          style={styles.input}
          placeholder={i18n.t('reveal_placeholder')}
          value={alias}
          onChangeText={setAlias}
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? i18n.t('loading') : i18n.t('send')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.secondary}>
          <Text style={styles.secondaryText}>{i18n.t('later')}</Text>
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
    color: '#333',
    backgroundColor: '#fff',
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

