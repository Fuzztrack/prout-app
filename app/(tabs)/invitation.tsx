import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { safePush } from '../../lib/navigation';
import { supabase } from '../../lib/supabase';

export default function InvitationScreen() {
  const router = useRouter();
  const [pseudo, setPseudo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getPseudo = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('user_profiles')
            .select('pseudo')
            .eq('id', user.id)
            .single();
          if (data) setPseudo(data.pseudo);
        }
      } catch (e) {
        // Erreur silencieuse -> Mettre une valeur par défaut
        setPseudo("Utilisateur");
      } finally {
        setLoading(false);
      }
    };
    getPseudo();
  }, []);

  const onShare = async () => {
    try {
      const message = pseudo 
        ? `Rejoins-moi sur l'appli "Prout !", mon pseudo est ${pseudo}\n\nTéléchargez l'appli : http://www.theproutapp.com`
        : `Rejoins-moi sur l'appli "Prout !"\n\nTéléchargez l'appli : http://www.theproutapp.com`;

      await Share.share({
        message: message,
        title: 'Invitation ProutApp',
      });
    } catch (error) {
      console.log(error);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#604a3e" /></View>;
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView 
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => safePush(router, '/(tabs)', { skipInitialCheck: false })} activeOpacity={0.7}>
            <Image 
              source={require('../../assets/images/prout-meme.png')} 
              style={styles.headerImage} 
              resizeMode="contain" 
            />
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.description}>
            Plus on est de fous, plus on rit ! Partage ton pseudo pour retrouver tes amis facilement. Tu peux aussi les chercher avec leurs pseudos.
          </Text>
        </View>

        <TouchableOpacity style={styles.shareButton} onPress={onShare}>
          <Ionicons name="share-outline" size={24} color="#604a3e" />
          <Text style={styles.shareText}>Partager le lien</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.searchButton} 
          onPress={() => safePush(router, '/SearchUserScreen', { skipInitialCheck: false })}
        >
          <Ionicons name="search" size={24} color="#604a3e" />
          <Text style={styles.searchText}>Chercher par pseudo</Text>
        </TouchableOpacity>

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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ebb89b' },
  header: { alignItems: 'center', marginBottom: 20 },
  headerImage: { width: 180, height: 140, marginBottom: 10 },
  infoContainer: { alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, color: '#604a3e', textAlign: 'center' },
  description: { fontSize: 16, color: '#604a3e', textAlign: 'center', marginBottom: 20, lineHeight: 22, opacity: 0.8, paddingHorizontal: 10 },
  shareButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', padding: 15, borderRadius: 15,
    marginBottom: 15, borderWidth: 1, borderColor: 'rgba(96, 74, 62, 0.2)'
  },
  shareText: { color: '#604a3e', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  searchButton: {
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
  searchText: { color: '#604a3e', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  backButton: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', 
    padding: 15, 
    borderRadius: 15,
    marginTop: 15,
    marginBottom: 15,
    borderWidth: 1, 
    borderColor: 'rgba(96, 74, 62, 0.2)'
  },
  backText: { color: '#604a3e', fontWeight: 'bold', fontSize: 16, marginLeft: 10 }
});