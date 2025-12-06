import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [email, setEmail] = useState<string | null>(null);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.replace('/AuthChoiceScreen');
        return;
      }

      setEmail(user.email || '');

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) setProfile(data);

    } catch (e) {
      console.log("Erreur Profil:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleLogout = async () => {
    Alert.alert(
      "Déconnexion",
      "Voulez-vous vraiment vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Se déconnecter", 
          style: "destructive", 
          onPress: async () => {
            try {
              // Récupérer l'utilisateur avant déconnexion
              const { data: { user } } = await supabase.auth.getUser();
              
              // Supprimer le token FCM pour désactiver les notifications
              if (user) {
                await supabase
                  .from('user_profiles')
                  .update({ expo_push_token: null })
                  .eq('id', user.id);
                console.log('✅ Token FCM supprimé lors de la déconnexion');
              }
              
              // Déconnexion
              await supabase.auth.signOut();
              
              // Afficher le message
              Alert.alert(
                "Déconnexion réussie",
                "Vous ne recevrez plus de prout !",
                [{ text: "OK", onPress: () => router.replace('/AuthChoiceScreen') }]
              );
            } catch (error) {
              console.error('Erreur lors de la déconnexion:', error);
              await supabase.auth.signOut();
              router.replace('/AuthChoiceScreen');
            }
          } 
        }
      ]
    );
  };

  const handleContactSupport = () => {
    const email = 'mathieu@supercarburant.net';
    const subject = 'Support ProutApp';
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
    
    Linking.openURL(mailtoUrl).catch(() => {
      Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application email. Email: ' + email);
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#604a3e" />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/(tabs)')} activeOpacity={0.7}>
            <Image 
              source={require('../../assets/images/prout-meme.png')} 
              style={styles.headerImage} 
              resizeMode="contain" 
            />
          </TouchableOpacity>
        </View>

      <View style={styles.infoContainer}>
        <Text style={styles.pseudo}>
          <Text style={styles.label}>Pseudo: </Text>
          {profile?.pseudo || 'Utilisateur'}
        </Text>
        <Text style={styles.email}>
          <Text style={styles.label}>Email: </Text>
          {email}
        </Text>
        <Text style={styles.phone}>
          <Text style={styles.label}>Téléphone: </Text>
          {profile?.phone || 'Non renseigné'}
        </Text>
      </View>

      <TouchableOpacity style={styles.editButton} onPress={() => router.push('/EditProfil')}>
        <Ionicons name="create-outline" size={24} color="#604a3e" />
        <Text style={styles.editText}>Modifier son profil</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#604a3e" />
        <Text style={styles.backText}>Retour</Text>
      </TouchableOpacity>

      <View style={styles.spacer} />

      <TouchableOpacity style={styles.logoutLink} onPress={handleLogout}>
        <Text style={styles.logoutLinkText}>Se déconnecter</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleContactSupport} style={styles.supportLink}>
        <Text style={styles.supportLinkText}>Contacter le support</Text>
      </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#ebb89b' },
  container: { flexGrow: 1, backgroundColor: '#ebb89b', padding: 20, paddingTop: 20, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ebb89b' },
  backButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', padding: 15, borderRadius: 15,
    marginBottom: 15, borderWidth: 1, borderColor: 'rgba(96, 74, 62, 0.2)'
  },
  backText: { color: '#604a3e', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  header: { alignItems: 'center', marginBottom: 20 },
  headerImage: { width: 180, height: 140, marginBottom: 10 },
  infoContainer: { alignItems: 'center', marginBottom: 30 },
  pseudo: { fontSize: 14, color: '#604a3e', marginTop: 5, opacity: 0.8 },
  email: { fontSize: 14, color: '#604a3e', marginTop: 5, opacity: 0.8 },
  phone: { fontSize: 14, color: '#604a3e', marginTop: 5, opacity: 0.8 },
  label: { fontWeight: '600', opacity: 0.9 },

  editButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', padding: 15, borderRadius: 15,
    marginBottom: 15, borderWidth: 1, borderColor: 'rgba(96, 74, 62, 0.2)'
  },
  editText: { color: '#604a3e', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },

  spacer: { height: 20 },
  logoutLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    marginTop: 10,
  },
  logoutLinkText: { 
    color: '#604a3e', 
    fontSize: 14, 
    textDecorationLine: 'underline',
    opacity: 0.8,
  },
  supportLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    marginTop: 10,
  },
  supportLinkText: { 
    color: '#604a3e', 
    fontSize: 14, 
    textDecorationLine: 'underline',
    opacity: 0.8
  }
});