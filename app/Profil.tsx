// app/Profil.tsx - Page de visualisation du profil
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { safePush, safeReplace } from '../lib/navigation';
import { supabase } from '../lib/supabase';

export default function ProfilScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [pseudo, setPseudo] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');


  // Charger l'utilisateur actuel via la session au démarrage
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        setLoading(true);

        // Récupérer l'utilisateur depuis la session
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          Alert.alert('Erreur', 'Impossible de récupérer votre compte');
          router.back();
          return;
        }

        setUserId(user.id);

        // Récupérer le profil
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) {
          Alert.alert('Erreur', 'Impossible de charger votre profil');
          router.back();
          return;
        }

        setPseudo(profile.pseudo || '');
        setPhone(profile.phone || '');
        setEmail(user.email || '');
        console.log('✅ Utilisateur chargé:', profile.pseudo);
      } catch (err) {
        console.error('Erreur lors du chargement:', err);
        if (err instanceof Error && (err.message.includes('network') || err.message.includes('fetch'))) {
          Alert.alert('Erreur', 'Problème de connexion, vérifiez votre réseau');
        } else {
          Alert.alert('Erreur', 'Impossible de charger votre profil');
        }
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadCurrentUser();
  }, [router]);

  // Fonction pour déconnecter l'utilisateur
  const handleSignOut = async () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
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
              
              const { error } = await supabase.auth.signOut();
              
              if (error) {
                Alert.alert('Erreur', 'Impossible de se déconnecter');
                return;
              }

              // Afficher le message
              Alert.alert(
                "Déconnexion réussie",
                "Vous ne recevrez plus de prout !",
                [{ text: "OK", onPress: () => safeReplace(router, '/LoginScreen', { skipInitialCheck: false }) }]
              );
            } catch (err) {
              console.error('Erreur lors de la déconnexion:', err);
              Alert.alert('Erreur', 'Une erreur est survenue lors de la déconnexion');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };


  if (!userId) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scrollContainer}>
        <View style={styles.container}>
          <Text style={styles.title}>Profil</Text>
          <View style={styles.centerContainer}>
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
          <View style={styles.separator} />
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#604a3e" />
            <Text style={styles.backText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scrollContainer}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => safePush(router, '/(tabs)', { skipInitialCheck: false })} activeOpacity={0.7}>
            <Image
              source={require('../assets/images/prout-meme.png')}
              style={styles.headerImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Profil</Text>

        <View style={styles.infoSection}>
          <View style={[styles.infoRow, styles.infoRowFirst]}>
            <Text style={styles.infoLabel}>Pseudo</Text>
            <Text style={styles.infoValue}>{pseudo || 'Non défini'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{email || 'Non défini'}</Text>
          </View>

          <View style={[styles.infoRow, styles.infoRowLast]}>
            <Text style={styles.infoLabel}>Téléphone</Text>
            <Text style={styles.infoValue}>{phone || 'Non défini'}</Text>
          </View>
        </View>

        <View style={styles.spacer} />

        <View style={styles.bottomSection}>
          <TouchableOpacity 
            style={styles.editButton} 
            onPress={() => safePush(router, '/EditProfil', { skipInitialCheck: false })} 
            disabled={loading}
          >
            <Ionicons name="create-outline" size={24} color="#604a3e" />
            <Text style={styles.editText}>Modifier votre profil</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.logoutLink} 
            onPress={handleSignOut} 
            disabled={loading}
          >
            <Text style={styles.logoutLinkText}>Se déconnecter</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#604a3e" />
            <Text style={styles.backText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 20, paddingTop: 40, paddingBottom: 100 },
  container: { flex: 1, backgroundColor: '#ebb89b' },
  header: { alignItems: 'center', marginBottom: 20 },
  headerImage: { width: 220, height: 160 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#604a3e' },
  infoSection: { 
    backgroundColor: 'rgba(255, 255, 255, 0.8)', 
    borderRadius: 15, 
    padding: 20, 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.2)',
  },
  infoRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(96, 74, 62, 0.1)',
  },
  infoRowFirst: {
    paddingTop: 0,
  },
  infoRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  infoLabel: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#604a3e',
    flex: 1,
  },
  infoValue: { 
    fontSize: 16, 
    color: '#604a3e',
    flex: 2,
    textAlign: 'right',
    opacity: 0.8,
  },
  separator: { height: 20 },
  spacer: { flex: 1 },
  returnButtonContainer: { marginTop: 10 },
  bottomSection: { marginBottom: 20 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 18, color: '#604a3e' },
  editButton: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', 
    padding: 15, 
    borderRadius: 15,
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: 'rgba(96, 74, 62, 0.2)'
  },
  editText: { color: '#604a3e', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
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
  backButton: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', 
    padding: 15, 
    borderRadius: 15,
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: 'rgba(96, 74, 62, 0.2)'
  },
  backText: { color: '#604a3e', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
});
