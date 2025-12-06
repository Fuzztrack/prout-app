import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CustomButton } from '../components/CustomButton';
import { safeReplace } from '../lib/navigation';
import { supabase } from '../lib/supabase';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    // Vérifier que l'utilisateur a bien accès à cette page (via le lien de reset)
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          Alert.alert(
            'Lien invalide',
            'Ce lien de réinitialisation est invalide ou a expiré. Veuillez demander un nouveau lien.',
            [{ text: 'OK', onPress: () => safeReplace(router, '/LoginScreen', { skipInitialCheck: false }) }]
          );
          return;
        }
        setVerifying(false);
      } catch (error) {
        console.error('Erreur vérification session:', error);
        Alert.alert(
          'Erreur',
          'Impossible de vérifier votre session. Veuillez réessayer.',
          [{ text: 'OK', onPress: () => safeReplace(router, '/LoginScreen', { skipInitialCheck: false }) }]
        );
      }
    };

    checkSession();
  }, []);

  const handleResetPassword = async () => {
    if (!password || password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        Alert.alert('Erreur', error.message || 'Impossible de réinitialiser le mot de passe');
        return;
      }

      Alert.alert(
        'Succès ✅',
        'Votre mot de passe a été réinitialisé avec succès !',
        [
          {
            text: 'OK',
            onPress: () => {
              safeReplace(router, '/LoginScreen', { skipInitialCheck: false });
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Erreur réinitialisation:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la réinitialisation');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#604a3e" />
        <Text style={styles.loadingText}>Vérification du lien...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Image
            source={require('../assets/images/prout-meme.png')}
            style={styles.headerImage}
            resizeMode="contain"
          />
          <Text style={styles.title}>Réinitialiser le mot de passe</Text>
          <Text style={styles.subtitle}>Choisissez un nouveau mot de passe sécurisé</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nouveau mot de passe</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              placeholder="6 caractères minimum"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={styles.passwordInput}
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={24}
                color="#604a3e"
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirmer le mot de passe</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              placeholder="Répétez le mot de passe"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              style={styles.passwordInput}
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye-off' : 'eye'}
                size={24}
                color="#604a3e"
              />
            </TouchableOpacity>
          </View>
        </View>

        <CustomButton
          title={loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
          onPress={handleResetPassword}
          disabled={loading}
          color="#604a3e"
          textColor="#ebb89b"
        />

        <TouchableOpacity
          onPress={() => safeReplace(router, '/LoginScreen', { skipInitialCheck: false })}
          style={styles.backLink}
        >
          <Text style={styles.backLinkText}>Retour à la connexion</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ebb89b' },
  scrollContent: { flexGrow: 1, padding: 20, justifyContent: 'center', paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ebb89b' },
  header: { alignItems: 'center', marginBottom: 30 },
  headerImage: { width: 150, height: 120, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#604a3e', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#604a3e', textAlign: 'center', opacity: 0.8, marginBottom: 30 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '600', color: '#604a3e', marginBottom: 8 },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 15,
    paddingLeft: 5,
  },
  loadingText: { marginTop: 10, color: '#604a3e', fontSize: 16 },
  backLink: { marginTop: 20, alignSelf: 'center', padding: 10 },
  backLinkText: { color: '#604a3e', fontSize: 14, textDecorationLine: 'underline' },
});


