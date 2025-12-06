import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { CustomButton } from '../components/CustomButton';
import { normalizePhone } from '../lib/normalizePhone';
import { supabase } from '../lib/supabase';

export default function CompleteProfileScreen() {
  const router = useRouter();
  const [pseudo, setPseudo] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        
        // Préremplir le pseudo depuis les métadonnées si disponible
        const pseudoFromMetadata = user.user_metadata?.pseudo;
        const phoneFromMetadata = user.user_metadata?.phone;
        
        if (pseudoFromMetadata && pseudoFromMetadata !== 'Nouveau Membre') {
          setPseudo(pseudoFromMetadata);
        }
        
        if (phoneFromMetadata) {
          setPhone(phoneFromMetadata);
        }
        
        // Le pseudo est pré-rempli dans le champ, l'utilisateur doit valider manuellement
        // Pas de mise à jour automatique ni de redirection automatique
      } else {
        router.replace('/AuthChoiceScreen');
      }
    };
    getUser();
  }, []);

  const handleSave = async () => {
    if (!pseudo.trim()) return Alert.alert("Erreur", "Choisis un pseudo !");
    setLoading(true);

    try {
      if (!userId) throw new Error("Utilisateur non trouvé");

      // Normaliser le téléphone si fourni (non obligatoire)
      const normalizedPhone = phone.trim() ? normalizePhone(phone.trim()) : null;

      // Utilisation de UPSERT : 
      // Si le profil a été supprimé, ça le recrée.
      // Si le profil existe, ça le met à jour.
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          pseudo: pseudo.trim(),
          phone: normalizedPhone,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      router.replace('/(tabs)');

    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setLoading(false);
    }
  };

  // 🚪 LA FONCTION DE SORTIE
  const handleLogout = async () => {
    try {
        await supabase.auth.signOut();
    } catch (e) {
        console.log("Erreur déconnexion:", e);
    }
    router.replace('/AuthChoiceScreen');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity onPress={() => router.push('/(tabs)')} activeOpacity={0.7}>
          <Image source={require('../assets/images/prout-meme.png')} style={styles.image} resizeMode="contain" />
        </TouchableOpacity>
        
        <Text style={styles.title}>Finalisation</Text>
        <Text style={styles.subtitle}>
            Votre compte Google est actif, mais votre profil ProutApp est manquant. Choisissez un pseudo pour le (re)créer.
        </Text>
        
        <TextInput 
            value={pseudo} 
            onChangeText={setPseudo} 
            style={styles.input} 
            placeholder="Votre Pseudo *" 
            autoCapitalize="none"
        />

        <TextInput 
            value={phone} 
            onChangeText={setPhone} 
            style={styles.input} 
            placeholder="Téléphone" 
            keyboardType="phone-pad"
            autoCapitalize="none"
        />

        <CustomButton 
            title={loading ? "Sauvegarde..." : "C'est parti !"} 
            onPress={handleSave} 
            disabled={loading} 
            color="#604a3e"
            textColor="#ebb89b"
        />

        {/* BOUTON DE SECOURS */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Annuler et se déconnecter</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ebb89b' },
  scrollContent: { flexGrow: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  image: { width: 180, height: 140, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#604a3e', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#604a3e', textAlign: 'center', marginBottom: 30, paddingHorizontal: 20 },
  input: { backgroundColor: 'white', borderRadius: 8, padding: 15, marginBottom: 20, width: '100%', fontSize: 18, textAlign: 'center' },
  logoutButton: { marginTop: 30, padding: 10 },
  logoutText: { color: '#604a3e', textDecorationLine: 'underline' }
});