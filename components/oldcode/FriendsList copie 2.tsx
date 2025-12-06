import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Animated, PanResponder, Alert, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import * as Contacts from 'expo-contacts';
import { useAudioPlayer } from 'expo-audio';
import { supabase } from '../lib/supabase';
import { normalizePhone } from '../lib/normalizePhone';
import { Ionicons } from '@expo/vector-icons';

// --- CONFIGURATION DES SONS ---
const PROUT_SOUNDS: { [key: string]: any } = {
  prout1: require('../assets/sounds/prout1.ogg'),
  prout2: require('../assets/sounds/prout2.ogg'),
  prout3: require('../assets/sounds/prout3.ogg'),
  prout4: require('../assets/sounds/prout4.ogg'),
  prout5: require('../assets/sounds/prout5.ogg'),
  prout6: require('../assets/sounds/prout6.ogg'),
  prout7: require('../assets/sounds/prout7.ogg'),
  prout8: require('../assets/sounds/prout8.ogg'),
  prout9: require('../assets/sounds/prout9.ogg'),
  prout10: require('../assets/sounds/prout10.ogg'),
};
const SOUND_KEYS = Object.keys(PROUT_SOUNDS);

// 🚨 DOIT CORRESPONDRE À CE QUI EST DANS lib/notifications.ts
const CHANNEL_SUFFIX = '-v7'; 

// --- COMPOSANT SLIDER AVEC NUAGE VOLANT ---
const ProutSlider = ({ onComplete }: { onComplete: () => void }) => {
  const [active, setActive] = useState(false);
  const pan = useRef(new Animated.ValueXY()).current;
  
  // Animation du nuage
  const cloudY = useRef(new Animated.Value(0)).current;
  const cloudOpacity = useRef(new Animated.Value(0)).current;

  const WIDTH = 120;
  const MAX_SLIDE = WIDTH - 40 - 4; 

  const triggerCloudAnimation = () => {
    cloudY.setValue(0);
    cloudOpacity.setValue(1);

    Animated.parallel([
      Animated.timing(cloudY, {
        toValue: -100, // Monte de 100 pixels
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.timing(cloudOpacity, {
        toValue: 0, // Devient transparent
        duration: 1500,
        useNativeDriver: true,
      })
    ]).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => setActive(true),
      onPanResponderMove: (_, gestureState) => {
        let newX = Math.max(0, Math.min(gestureState.dx, MAX_SLIDE));
        pan.x.setValue(newX);
      },
      onPanResponderRelease: (_, gestureState) => {
        setActive(false);
        if (gestureState.dx >= MAX_SLIDE) {
          onComplete();
          triggerCloudAnimation(); // 💨 Lancement du nuage
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        } else {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.sliderContainer}>
      {/* Le Nuage Volant */}
      <Animated.Text 
        style={[
          styles.flyingCloud, 
          { 
            transform: [{ translateY: cloudY }], 
            opacity: cloudOpacity 
          }
        ]}
      >
        💨
      </Animated.Text>

      <View style={styles.sliderTrack}>
        <Text style={styles.sliderText}>Glisser 👉</Text>
        <Animated.View
          style={[styles.sliderThumb, { transform: [{ translateX: pan.x }] }, active && { backgroundColor: '#FF3B30' }]}
          {...panResponder.panHandlers}
        >
          <Text>💨</Text>
        </Animated.View>
      </View>
    </View>
  );
};

export function FriendsList() {
  const [appUsers, setAppUsers] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPseudo, setCurrentPseudo] = useState<string>("Un ami");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const player = useAudioPlayer(require('../assets/sounds/prout1.ogg'));

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Identité
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setCurrentUserId(user.id);
      const { data: profile } = await supabase.from('user_profiles').select('pseudo').eq('id', user.id).single();
      if (profile) setCurrentPseudo(profile.pseudo);

      // 2. CHARGEMENT DES DEMANDES RECUES
      const { data: rawRequests } = await supabase
        .from('friends')
        .select('id, user_id')
        .eq('friend_id', user.id)
        .eq('status', 'pending');

      if (rawRequests && rawRequests.length > 0) {
        const senderIds = rawRequests.map(r => r.user_id);
        const { data: senders } = await supabase
            .from('user_profiles')
            .select('id, pseudo')
            .in('id', senderIds);
            
        const cleanRequests = rawRequests.map(req => {
            const senderProfile = senders?.find(s => s.id === req.user_id);
            return {
                requestId: req.id,
                senderId: req.user_id,
                pseudo: senderProfile?.pseudo || 'Inconnu'
            };
        });
        setPendingRequests(cleanRequests);
      } else {
        setPendingRequests([]);
      }

      // 3. CHARGEMENT DES AMIS
      let phoneFriendsIds: string[] = [];
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
        if (data.length > 0) {
            const phones = data
                .flatMap(c => c.phoneNumbers || [])
                .map(p => normalizePhone(p.number))
                .filter(p => p !== null);
            
            const { data: contactsFound } = await supabase
                .from('user_profiles')
                .select('id')
                .in('phone', phones)
                .neq('id', user.id);
            
            if (contactsFound) phoneFriendsIds = contactsFound.map(u => u.id);
        }
      }

      const { data: addedFriends } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', user.id)
        .eq('status', 'accepted');
        
      const addedFriendsIds = addedFriends?.map(f => f.friend_id) || [];
      const allFriendIds = [...new Set([...phoneFriendsIds, ...addedFriendsIds])];

      if (allFriendIds.length > 0) {
          const { data: finalFriends } = await supabase
            .from('user_profiles')
            .select('id, pseudo, phone, expo_push_token')
            .in('id', allFriendIds);
            
          setAppUsers(finalFriends || []);
      }

    } catch (e) {
      console.log("Erreur:", e);
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIONS ---
  const handleAccept = async (req: any) => {
    if (!currentUserId) return;
    try {
        await supabase.from('friends').update({ status: 'accepted' }).eq('id', req.requestId);
        await supabase.from('friends').upsert({
            user_id: currentUserId,
            friend_id: req.senderId,
            status: 'accepted',
            method: 'search'
        });
        Alert.alert("Ami ajouté !", `Prêt à prouter sur ${req.pseudo}.`);
        loadData();
    } catch (e) {
        Alert.alert("Erreur", "Impossible d'accepter.");
    }
  };

  const handleReject = async (requestId: string) => {
    try {
        await supabase.from('friends').delete().eq('id', requestId);
        loadData();
    } catch (e) { console.log(e); }
  };

  // --- ENVOYER PROUT ---
  const handleSendProut = async (recipient: any) => {
     try {
      // 1. Choisir le son
      const randomKey = SOUND_KEYS[Math.floor(Math.random() * SOUND_KEYS.length)];
      const soundFile = PROUT_SOUNDS[randomKey];
      
      // 2. Jouer en local (Feedback immédiat)
      player.replace(soundFile);
      player.play();

      if (!recipient.expo_push_token) {
        Alert.alert("Oups", `${recipient.pseudo} n'a pas activé les notifications.`);
        return;
      }

      // 3. ENVOI SUR CANAL V7
      const channelId = `${randomKey}${CHANNEL_SUFFIX}`;

      const message = {
        to: recipient.expo_push_token,
        title: 'Prout ! 💨',
        body: `${currentPseudo} t'a envoyé ${randomKey} !`,
        data: { 
            soundName: randomKey,
            sender: currentPseudo 
        },
        android: {
            channelId: channelId, // Cible le canal spécifique V7
            volume: 1.0,
            vibrate: [0, 250, 250, 250]
            // PAS DE CHAMP "sound" ICI pour Android, c'est le canal qui gère
        },
        ios: {
            sound: `${randomKey}.wav` // iOS a besoin du fichier explicite
        }
      };

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      console.log(`🚀 Prout envoyé sur canal ${channelId}`);

    } catch (error) {
      console.log("Erreur envoi:", error);
    }
  };

  if (loading && appUsers.length === 0 && pendingRequests.length === 0) {
      return <ActivityIndicator color="#007AFF" style={{margin: 20}} />;
  }

  return (
    <View style={styles.container}>
      
      {/* DEMANDES */}
      {pendingRequests.length > 0 && (
        <View style={styles.requestsContainer}>
            <Text style={styles.sectionTitle}>🔔 Demandes d'amis ({pendingRequests.length})</Text>
            {pendingRequests.map((req) => (
                <View key={req.requestId} style={styles.requestRow}>
                    <Text style={styles.requestName}>{req.pseudo}</Text>
                    <View style={styles.requestActions}>
                        <TouchableOpacity onPress={() => handleReject(req.requestId)} style={styles.rejectBtn}>
                            <Ionicons name="close" size={20} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleAccept(req)} style={styles.acceptBtn}>
                            <Ionicons name="checkmark" size={20} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>
            ))}
        </View>
      )}

      {/* LISTE DES AMIS */}
      {appUsers.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Aucun ami confirmé 😢</Text>
          <Text style={styles.subText}>
            Invitez vos contacts ou utilisez la recherche pour ajouter des amis.
          </Text>
        </View>
      ) : (
        <FlatList
          data={appUsers}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item, index }) => (
            <View style={[styles.userRow, { backgroundColor: index % 2 === 0 ? '#d2f1ef' : '#baded7' }]}>
              <View style={styles.userInfo}>
                <Text style={styles.pseudo} numberOfLines={1}>{item.pseudo}</Text>
              </View>
              <ProutSlider onComplete={() => handleSendProut(item)} />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 10 },
  sectionTitle: { fontWeight: 'bold', color: '#604a3e', marginBottom: 10, fontSize: 16, marginLeft: 5 },
  requestsContainer: { marginBottom: 20 },
  requestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', padding: 12, borderRadius: 10, marginBottom: 8, shadowColor: "#000", shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  requestName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  requestActions: { flexDirection: 'row', gap: 15 },
  acceptBtn: { backgroundColor: '#4CAF50', padding: 8, borderRadius: 20 },
  rejectBtn: { backgroundColor: '#F44336', padding: 8, borderRadius: 20 },
  emptyCard: { backgroundColor: 'rgba(255,255,255,0.7)', padding: 20, borderRadius: 15, alignItems: 'center' },
  emptyText: { color: '#666', fontSize: 16, fontWeight: 'bold' },
  subText: { color: '#888', fontSize: 14, marginTop: 5, textAlign: 'center' },
  userRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 15, marginBottom: 8, shadowColor: "#000", shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.03, shadowRadius: 1, elevation: 1 },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  pseudo: { fontSize: 18, fontWeight: '600', color: '#333', marginLeft: 10 }, 
  sliderContainer: { position: 'relative' },
  sliderTrack: { width: 120, height: 44, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 22, justifyContent: 'center', padding: 2 },
  sliderThumb: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3 },
  sliderText: { position: 'absolute', width: '100%', textAlign: 'center', fontSize: 12, color: '#666', fontWeight: 'bold', zIndex: -1 },
  flyingCloud: { position: 'absolute', right: 0, top: -20, fontSize: 30, zIndex: 999, elevation: 10 }
});