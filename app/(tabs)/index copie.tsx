import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, RefreshControl, Image, Alert, TouchableOpacity, Platform } from 'react-native';
import { supabase } from '@/lib/supabase'; 
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FriendsList } from '@/components/FriendsList';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { safeReplace } from '@/lib/navigation';

export default function HomeScreen() {
  const router = useRouter();
  
  const [refreshing, setRefreshing] = useState(false);
  const [pseudo, setPseudo] = useState<string | null>(null);
  const isLoadedRef = useRef(false);

  // --- FONCTION DE TEST (POUR LE SON) ---
  const testLocalChannel = async () => {
    console.log("🔔 Test du canal local...");
    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: "Test Son V7",
                body: "Si tu entends Prout 1, le canal marche !",
                data: { soundName: 'prout1' }
            },
            trigger: { 
                seconds: 1, 
                channelId: 'prout1-v7' // On cible le canal V7
            },
        });
        Alert.alert("Test lancé", "Verrouillez votre écran maintenant pour entendre le son !");
    } catch (e: any) {
        Alert.alert("Erreur Test", e.message);
    }
  };

  // --- MISE À JOUR TOKEN ---
  const updatePushToken = async (userId: string) => {
    if (!Device.isDevice || Platform.OS === 'web') return;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') return;

      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

      if (tokenData.data) {
        supabase
          .from('user_profiles')
          .update({ expo_push_token: tokenData.data })
          .eq('id', userId)
          .then(({ error }) => {
             if (!error) console.log("🔔 Token mis à jour");
          });
      }
    } catch (e) {
      console.log("Erreur Token silencieuse:", e);
    }
  };

  // --- CHARGEMENT ---
  const loadData = async () => {
    if (isLoadedRef.current && !refreshing) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        safeReplace(router, '/AuthChoiceScreen', { skipInitialCheck: false });
        return;
      }

      updatePushToken(user.id);

      const { data } = await supabase
        .from('user_profiles')
        .select('pseudo')
        .eq('id', user.id)
        .maybeSingle();

      if (data) setPseudo(data.pseudo);
      else setPseudo("Utilisateur"); 

      isLoadedRef.current = true;
    } catch (e) {
      console.log("Erreur Home:", e);
    }
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    isLoadedRef.current = false;
    loadData().then(() => setRefreshing(false));
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#604a3e" />}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Image 
            source={require('../../assets/images/prout-meme.png')} 
            style={styles.headerImage} 
            resizeMode="contain" 
          />
        </View>

        <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>
            Bonjour, <Text style={styles.pseudo}>{pseudo || '...'}</Text>
            </Text>
            <TouchableOpacity onPress={() => safeReplace(router, '/AuthChoiceScreen')}>
                <Ionicons name="log-out-outline" size={28} color="#604a3e" style={{opacity: 0.6}} />
            </TouchableOpacity>
        </View>

        {/* 👇 BOUTON DE TEST TEMPORAIRE 👇 */}
        <TouchableOpacity onPress={testLocalChannel} style={styles.debugButton}>
            <Text style={styles.debugText}>TESTER CANAL V7 (SON)</Text>
        </TouchableOpacity>

        {/* LISTE D'AMIS */}
        <Text style={styles.sectionTitle}>Vos contacts sur Prout</Text>
        
        <FriendsList />

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#ebb89b' 
  },
  scrollContent: { 
    padding: 20, 
    paddingTop: 20, 
    paddingBottom: 100 
  },
  header: { 
    alignItems: 'center', 
    marginBottom: 10 
  },
  headerImage: { 
    width: 180, 
    height: 140, 
    marginBottom: 5 
  },
  welcomeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10
  },
  welcomeText: {
    fontSize: 18,
    color: '#604a3e',
  },
  pseudo: {
    fontWeight: 'bold',
    fontSize: 22
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#604a3e',
    marginBottom: 10,
    marginLeft: 5,
    marginTop: 10
  },
  debugButton: {
      backgroundColor: '#d32f2f',
      padding: 15,
      borderRadius: 10,
      alignItems: 'center',
      marginBottom: 20,
  },
  debugText: {
      color: 'white',
      fontWeight: 'bold'
  }
});