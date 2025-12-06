import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CustomButton } from '../components/CustomButton';
import { safeReplace } from '../lib/navigation';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Validation : le bouton est activé seulement si email et password sont remplis
  const isFormValid = email.trim().length > 0 && password.trim().length > 0;

  const handleLogin = async () => {
    setLoading(true);
    console.log('🔐 Tentative de connexion...');
    
    // Timeout de sécurité : si la navigation ne se fait pas en 5 secondes, réactiver le bouton
    const timeoutId = setTimeout(() => {
      console.warn('⏱️ Timeout de connexion - réactivation du bouton');
      setLoading(false);
    }, 5000);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        clearTimeout(timeoutId);
        setLoading(false);
        console.error('❌ Erreur de connexion:', error.message);
        return Alert.alert('Erreur', error.message);
      }

      if (!data.session || !data.session.user) {
        clearTimeout(timeoutId);
        setLoading(false);
        console.error('❌ Session invalide après connexion');
        return Alert.alert('Erreur', 'Session invalide après connexion');
      }

      console.log('✅ Connexion réussie, vérification du profil...');
      const sessionUser = data.session.user;
      const pseudoValidated = sessionUser.user_metadata?.pseudo_validated === true;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('pseudo')
        .eq('id', sessionUser.id)
        .maybeSingle();

      clearTimeout(timeoutId);
      console.log('📋 Profil trouvé:', profile?.pseudo || 'aucun');

      // Ne pas remettre loading à false ici car on navigue
      // La navigation va démonter le composant
      const hasValidProfile = !!(profile && profile.pseudo && profile.pseudo !== 'Nouveau Membre');
      if (hasValidProfile || pseudoValidated) {
        console.log('➡️ Navigation vers /(tabs)');
        safeReplace(router, '/(tabs)');
      } else {
        console.log('➡️ Navigation vers /CompleteProfileScreen');
        safeReplace(router, '/CompleteProfileScreen');
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      console.error('❌ Erreur lors de la connexion:', e);
      setLoading(false);
      Alert.alert('Erreur', e.message || 'Une erreur est survenue lors de la connexion');
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert(
        'Email requis',
        'Veuillez d\'abord entrer votre email dans le champ ci-dessus.',
        [{ text: 'OK' }]
      );
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert('Erreur', 'Veuillez entrer un email valide');
      return;
    }

    if (trimmedEmail.includes('@temp.proutapp.local')) {
      Alert.alert(
        'Erreur',
        'Impossible de réinitialiser le mot de passe avec un email temporaire.\n\nVeuillez contacter le support.'
      );
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: 'proutapp://reset-password',
      });

      if (error) {
        if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
          Alert.alert(
            'Email non trouvé',
            'Aucun compte n\'est associé à cet email. Vérifiez votre adresse email.'
          );
        } else if (error.message?.includes('rate limit') || error.message?.includes('too many')) {
          Alert.alert(
            'Trop de tentatives',
            'Vous avez fait trop de demandes. Veuillez patienter quelques minutes avant de réessayer.'
          );
        } else {
          Alert.alert('Erreur', error.message || 'Impossible d\'envoyer l\'email de réinitialisation');
        }
        return;
      }

      Alert.alert(
        'Email envoyé 📧',
        'Un email de réinitialisation a été envoyé à votre adresse.\n\nVérifiez votre boîte de réception (et vos spams) et suivez les instructions pour réinitialiser votre mot de passe.',
        [{ text: 'OK' }]
      );
    } catch (err) {
      console.error('Erreur lors de la réinitialisation:', err);
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'envoi de l\'email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
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
          <Text style={styles.title}>Connexion</Text>
        </View>

        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor="#999"
        />
        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="Mot de passe"
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
              name={showPassword ? "eye-off" : "eye"} 
              size={24} 
              color="#604a3e" 
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          onPress={handleResetPassword}
          disabled={loading}
          style={styles.forgotPasswordLink}
        >
          <Text style={styles.forgotPasswordText}>Mot de passe oublié ?</Text>
        </TouchableOpacity>

        <CustomButton 
          title={loading ? 'Connexion...' : 'Se connecter'} 
          onPress={handleLogin} 
          disabled={loading || !isFormValid}
          color="#604a3e"
          textColor="#ebb89b"
        />

        <CustomButton
          title="Pas de compte ? S'inscrire"
          onPress={() => safeReplace(router, '/RegisterEmailScreen', { skipInitialCheck: false })}
          color="transparent"
          textColor="#604a3e"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ebb89b' },
  scrollContent: { flexGrow: 1, padding: 20, justifyContent: 'center', paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 30 },
  headerImage: { width: 150, height: 120, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#604a3e', textAlign: 'center' },
  input: { 
    backgroundColor: 'white', 
    padding: 15, 
    borderRadius: 8, 
    marginBottom: 15,
    fontSize: 16,
    color: '#333'
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 15,
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
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginBottom: 10,
    padding: 5,
  },
  forgotPasswordText: {
    color: '#604a3e',
    fontSize: 14,
    textDecorationLine: 'underline',
    opacity: 0.8,
  },
});

