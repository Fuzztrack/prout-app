import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import * as Contacts from 'expo-contacts';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizePhone } from '../lib/normalizePhone';
import { sendProutViaBackend } from '../lib/sendProutBackend';
// Import supprimé : on utilise maintenant sync_contacts (fonction SQL Supabase)
import { supabase } from '../lib/supabase';

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
  prout11: require('../assets/sounds/prout11.ogg'),
  prout12: require('../assets/sounds/prout12.ogg'),
  prout13: require('../assets/sounds/prout13.ogg'),
  prout14: require('../assets/sounds/prout14.ogg'),
  prout15: require('../assets/sounds/prout15.ogg'),
  prout16: require('../assets/sounds/prout16.ogg'),
  prout17: require('../assets/sounds/prout17.ogg'),
  prout18: require('../assets/sounds/prout18.ogg'),
  prout19: require('../assets/sounds/prout19.ogg'),
  prout20: require('../assets/sounds/prout20.ogg'),
};
const SOUND_KEYS = Object.keys(PROUT_SOUNDS);

// Clés de cache pour AsyncStorage
const CACHE_KEY_FRIENDS = 'cached_friends_list';
const CACHE_KEY_PENDING_REQUESTS = 'cached_pending_requests';
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 heures

// Fonction utilitaire pour charger le cache de manière sécurisée
const loadCacheSafely = async (key: string) => {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    
    // Vérifier que c'est un tableau
    if (!Array.isArray(parsed.data)) {
      console.warn('⚠️ Cache invalide (pas un tableau), ignoré');
      return null;
    }
    
    // Vérifier l'âge du cache (optionnel)
    if (parsed.timestamp && Date.now() - parsed.timestamp > CACHE_MAX_AGE) {
      console.log('🕐 Cache expiré, ignoré');
      return null;
    }
    
    return parsed.data;
  } catch (e) {
    console.warn('⚠️ Erreur lecture cache (ignoré):', e);
    return null; // En cas d'erreur, on ignore le cache et on continue normalement
  }
};

// Fonction utilitaire pour sauvegarder le cache de manière sécurisée
const saveCacheSafely = async (key: string, data: any[]) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('⚠️ Erreur sauvegarde cache (ignoré):', e);
    // On ignore l'erreur, ce n'est pas critique
  }
};

const ProutSlider = ({ onComplete }: { onComplete: () => void }) => {
  const [active, setActive] = useState(false);
  const pan = useRef(new Animated.ValueXY()).current;
  const cloudY = useRef(new Animated.Value(0)).current;
  const cloudOpacity = useRef(new Animated.Value(0)).current;
  const WIDTH = 180;
  const MAX_SLIDE = WIDTH - 40 - 4;

  const triggerCloudAnimation = () => {
    cloudY.setValue(0);
    cloudOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(cloudY, { toValue: -100, duration: 1500, useNativeDriver: true }),
      Animated.timing(cloudOpacity, { toValue: 0, duration: 1500, useNativeDriver: true })
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
          triggerCloudAnimation();
        }
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      },
    })
  ).current;

  return (
    <View style={[styles.sliderContainer, { width: WIDTH }]}>
      <Animated.Text style={[styles.flyingCloud, { transform: [{ translateY: cloudY }], opacity: cloudOpacity }]}>💨</Animated.Text>
      <View style={[styles.sliderTrack, { width: WIDTH }]}>
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
  const [loading, setLoading] = useState(true); // Commencer à true pour éviter le flash
  const [currentPseudo, setCurrentPseudo] = useState<string>("Un ami");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const subscriptionRef = useRef<any>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cacheLoadedRef = useRef(false); // Pour éviter de charger le cache plusieurs fois
  const contactsSyncedRef = useRef(false); // Pour éviter de synchroniser les contacts plusieurs fois

  const player = useAudioPlayer(); // ⚡ Audio player sans son par défaut

  useEffect(() => {
    const initialize = async () => {
      // Réinitialiser le flag de synchronisation au démarrage
      contactsSyncedRef.current = false;
      
      // ÉTAPE 1 : Charger le cache IMMÉDIATEMENT (avant tout)
      let hasCache = false;
      if (!cacheLoadedRef.current) {
        cacheLoadedRef.current = true;
        try {
          const cachedFriends = await loadCacheSafely(CACHE_KEY_FRIENDS);
          const cachedRequests = await loadCacheSafely(CACHE_KEY_PENDING_REQUESTS);
          
          // Vérifier que le cache contient bien les tokens (sinon on ignore le cache)
          const cacheHasTokens = cachedFriends && cachedFriends.length > 0 && 
            cachedFriends.every(f => f.expo_push_token && f.expo_push_token.trim() !== '');
          
          if (cacheHasTokens) {
            setAppUsers(cachedFriends);
            setLoading(false); // Cache trouvé, pas de spinner
            hasCache = true;
            console.log('✅ Cache chargé avec tokens valides');
          } else if (cachedFriends && cachedFriends.length > 0) {
            console.warn('⚠️ Cache ignoré car tokens manquants, rechargement depuis la base...');
          }
          
          if (cachedRequests) {
            setPendingRequests(cachedRequests);
          }
        } catch (e) {
          // Ignorer les erreurs de cache
        }
      }
      
      // ÉTAPE 2 : Charger les données réseau (en arrière-plan)
      // Passer hasCache pour éviter de remettre loading à true si on a du cache
      // Si pas de cache, on force le loading (premier chargement)
      loadData(hasCache, !hasCache);
      
      // ÉTAPE 3 : Configurer Realtime et polling
      setupRealtimeSubscription();
      
      // Polling toutes les 30 secondes (au lieu de 5) et sans synchroniser les contacts
      pollingIntervalRef.current = setInterval(() => {
        loadData(false, false, false); // Pas de cache, pas de forceLoading, PAS de sync contacts
      }, 30000); // 30 secondes au lieu de 5
    };
    
    initialize();

    return () => {
      // Nettoyer la subscription Realtime
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      // Nettoyer le polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  const loadData = async (hasCacheFromInit: boolean = false, forceLoading: boolean = false, syncContacts: boolean = true) => {
    // Ne mettre loading à true que si :
    // 1. On n'a pas de cache à l'init ET pas de données affichées
    // 2. OU si forceLoading est true (premier chargement)
    if (forceLoading || (!hasCacheFromInit && appUsers.length === 0)) {
      setLoading(true);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      
      setCurrentUserId(user.id);
      const { data: profile } = await supabase.from('user_profiles').select('pseudo').eq('id', user.id).single();
      if (profile) setCurrentPseudo(profile.pseudo);

      // Charger les demandes en attente
      const { data: rawRequests } = await supabase
        .from('friends')
        .select('id, user_id, method')
        .eq('friend_id', user.id)
        .eq('status', 'pending');
      
      if (rawRequests?.length) {
        // Filtrer les demandes : si la réciproque est déjà acceptée, ne pas afficher la demande
        const filteredRequests = [];
        for (const req of rawRequests) {
          // Vérifier si la réciproque existe déjà avec status='accepted'
          const { data: reciprocal } = await supabase
            .from('friends')
            .select('id, status')
            .eq('user_id', user.id)
            .eq('friend_id', req.user_id)
            .maybeSingle();
          
          // Si la réciproque n'existe pas ou est encore pending, afficher la demande
          // Si elle est accepted, c'est que le trigger a déjà créé la réciproque, donc on ne montre pas la demande
          if (!reciprocal || reciprocal.status === 'pending') {
            filteredRequests.push(req);
          }
        }
        
        if (filteredRequests.length > 0) {
          const senderIds = filteredRequests.map(r => r.user_id);
          const { data: senders } = await supabase
            .from('user_profiles')
            .select('id, pseudo')
            .in('id', senderIds);
          const cleanRequests = filteredRequests.map(req => ({
            requestId: req.id,
            senderId: req.user_id,
            pseudo: senders?.find(s => s.id === req.user_id)?.pseudo || 'Inconnu',
            method: req.method
          }));
          setPendingRequests(cleanRequests);
          // Sauvegarder dans le cache (sans bloquer si ça échoue)
          await saveCacheSafely(CACHE_KEY_PENDING_REQUESTS, cleanRequests);
        } else {
          setPendingRequests([]);
          await saveCacheSafely(CACHE_KEY_PENDING_REQUESTS, []);
        }
      } else { 
        setPendingRequests([]);
        await saveCacheSafely(CACHE_KEY_PENDING_REQUESTS, []);
      }

      let phoneFriendsIds: string[] = [];
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
        if (data.length > 0) {
          // Normaliser les numéros de téléphone
          const phones = data
            .flatMap(c => c.phoneNumbers || [])
            .map(p => normalizePhone(p.number || ''))
            .filter(p => p !== null && p !== '');

          if (phones.length > 0) {
            // 🪄 Appel à sync_contacts UNIQUEMENT si syncContacts est true ET qu'on n'a pas déjà synchronisé
            // (pas lors du polling, seulement au chargement initial)
            if (syncContacts && !contactsSyncedRef.current) {
              const { data: matchedFriends, error } = await supabase
                .rpc('sync_contacts', { 
                  phones: phones 
                });

              if (error) {
                console.error('❌ Erreur sync contacts:', error);
              } else if (matchedFriends) {
                phoneFriendsIds = matchedFriends.map(u => u.id);
                contactsSyncedRef.current = true; // Marquer comme synchronisé
                console.log(`✅ ${matchedFriends.length} ami(s) trouvé(s) et enregistré(s) dans friends`);
              }
            } else {
              // Lors du polling, on récupère juste les IDs depuis la base (sans appeler sync_contacts)
              const { data: contactsFound } = await supabase
                .from('user_profiles')
                .select('id')
                .in('phone', phones)
                .neq('id', user.id);
              
              if (contactsFound) {
                phoneFriendsIds = contactsFound.map(u => u.id);
              }
            }
          }
        }
      }

      // Charger les amis acceptés (relations où user_id = user.id ET status = 'accepted')
      const { data: addedFriends } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', user.id)
        .eq('status', 'accepted');
      const addedFriendsIds = addedFriends?.map(f => f.friend_id) || [];
      
      // Aussi charger les relations où friend_id = user.id ET status = 'accepted' (pour les cas où B→A existe)
      // Cela garantit que si B→A est 'accepted', A verra B dans sa liste
      const { data: friendsWhereIAmFriend } = await supabase
        .from('friends')
        .select('user_id')
        .eq('friend_id', user.id)
        .eq('status', 'accepted');
      const friendsWhereIAmFriendIds = friendsWhereIAmFriend?.map(f => f.user_id) || [];
      
      // Combiner tous les IDs d'amis (contacts + relations acceptées dans les deux sens)
      const allFriendIds = [...new Set([...phoneFriendsIds, ...addedFriendsIds, ...friendsWhereIAmFriendIds])];

      if (allFriendIds.length > 0) {
          // Récupérer les amis avec leur token FCM (stocké dans expo_push_token)
          // IMPORTANT : Vérifier que le token est bien présent
          const { data: finalFriends } = await supabase
            .from('user_profiles')
            .select('id, pseudo, phone, expo_push_token')
            .in('id', allFriendIds);
          
          const friendsList = finalFriends || [];
          
          // Log pour debug : vérifier les tokens
          friendsList.forEach(friend => {
            if (!friend.expo_push_token || friend.expo_push_token.trim() === '') {
              console.warn(`⚠️ ${friend.pseudo} (${friend.id}) n'a pas de token FCM dans la base`);
            } else {
              console.log(`✅ ${friend.pseudo} (${friend.id}) a un token FCM: ${friend.expo_push_token.substring(0, 20)}...`);
            }
          });
          
          setAppUsers(friendsList);
          
          // Sauvegarder dans le cache (sans bloquer si ça échoue)
          await saveCacheSafely(CACHE_KEY_FRIENDS, friendsList);
      } else {
          setAppUsers([]);
          await saveCacheSafely(CACHE_KEY_FRIENDS, []);
      }
    } catch (e) { 
      console.log("Erreur:", e); 
    } finally { 
      setLoading(false); 
    }
  };

  // Configurer la subscription Realtime pour écouter les changements sur friends
  const setupRealtimeSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Créer un canal pour écouter les changements sur la table friends
      const channel = supabase
        .channel('friends-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'friends',
          },
          (payload) => {
            console.log('🔔 Relation friend mise à jour via Realtime:', payload);
            // Recharger les données si le statut change (sans remettre loading si données déjà affichées)
            if (payload.new.status !== payload.old.status) {
              loadData(false, false);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'friends',
          },
          (payload) => {
            console.log('🔔 Nouvelle relation friend créée via Realtime:', payload);
            // Recharger les données (sans remettre loading si données déjà affichées)
            loadData(false, false);
          }
        )
        .subscribe((status) => {
          console.log('📡 Statut subscription Realtime friends:', status);
        });

      subscriptionRef.current = channel;
    } catch (error) {
      console.error('❌ Erreur lors de la configuration de Realtime friends:', error);
    }
  };

  const handleAccept = async (req: any) => {
    if (!currentUserId) return;
    try {
      // Récupérer la relation pour vérifier son method
      const { data: relation } = await supabase
        .from('friends')
        .select('method')
        .eq('id', req.requestId)
        .single();

      // Si c'est une invitation, on met juste à jour le status
      // Le trigger handle_invitation_accept créera automatiquement la réciproque B→A avec status='accepted'
      if (relation?.method === 'invitation') {
        const { error: updateError } = await supabase
          .from('friends')
          .update({ status: 'accepted' })
          .eq('id', req.requestId);
        
        if (updateError) {
          console.error('Erreur lors de l\'acceptation de l\'invitation:', updateError);
          Alert.alert('Erreur', 'Impossible d\'accepter l\'invitation');
          return;
        }
        // Le trigger créera automatiquement la réciproque, pas besoin de créer manuellement
      } else {
        // Pour les demandes de recherche, on met à jour et on crée la réciproque
        const { error: updateError } = await supabase
          .from('friends')
          .update({ status: 'accepted' })
          .eq('id', req.requestId);
        
        if (updateError) {
          console.error('Erreur lors de l\'acceptation de la demande:', updateError);
          Alert.alert('Erreur', 'Impossible d\'accepter la demande');
          return;
        }
        
        // Vérifier si la réciproque existe déjà
        const { data: reciprocal } = await supabase
          .from('friends')
          .select('id, status')
          .eq('user_id', currentUserId)
          .eq('friend_id', req.senderId)
          .maybeSingle();
        
        // Si la réciproque n'existe pas ou est pending, la créer/mettre à jour
        if (!reciprocal) {
          await supabase
            .from('friends')
            .upsert({ 
              user_id: currentUserId, 
              friend_id: req.senderId, 
              status: 'accepted', 
              method: 'search' 
            });
        } else if (reciprocal.status === 'pending') {
          // Si elle existe mais est pending, la mettre à jour
          await supabase
            .from('friends')
            .update({ status: 'accepted' })
            .eq('id', reciprocal.id);
        }
      }
      
      loadData();
    } catch (e) { 
      console.error("Erreur handleAccept:", e);
      Alert.alert("Erreur", "Impossible d'accepter la demande"); 
    }
  };

  const handleReject = async (requestId: string) => {
    try { await supabase.from('friends').delete().eq('id', requestId); loadData(); } catch (e) {}
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    // Animation d'apparition
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(1300), // Afficher pendant 1.3s
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToastMessage(null);
    });
  };

  const handleLongPressName = async (friend: any) => {
    if (!friend.phone) {
      // Pas de téléphone, ne rien afficher
      return;
    }

    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        // Permission refusée, ne rien afficher
        return;
      }

      // Charger tous les contacts avec les noms
      const { data: contacts } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      if (!contacts || contacts.length === 0) {
        // Pas de contact trouvé, ne rien afficher
        return;
      }

      // Normaliser le numéro de téléphone de l'ami
      const normalizedFriendPhone = normalizePhone(friend.phone);

      // Chercher le contact correspondant
      const matchingContact = contacts.find(contact => {
        if (!contact.phoneNumbers || contact.phoneNumbers.length === 0) return false;
        return contact.phoneNumbers.some(phoneNumber => {
          const normalizedContactPhone = normalizePhone(phoneNumber.number || '');
          return normalizedContactPhone === normalizedFriendPhone;
        });
      });

      // Afficher seulement si le contact est trouvé dans les contacts
      if (matchingContact) {
        const fullName = matchingContact.name || matchingContact.firstName || matchingContact.lastName || friend.pseudo;
        showToast(fullName);
      }
      // Si le contact n'est pas trouvé, ne rien afficher
    } catch (error) {
      console.error("Erreur lors de la recherche du contact:", error);
      // Ne pas afficher d'erreur à l'utilisateur si le contact n'est pas trouvé
    }
  };

  const handleSendProut = async (recipient: any) => {
    try {
      // TOUJOURS recharger le pseudo depuis la base pour être sûr d'avoir la valeur à jour
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Erreur", "Vous n'êtes pas connecté.");
        return;
      }

      // Récupérer le pseudo de l'expéditeur depuis la base de données
      const { data: senderProfile, error: senderProfileError } = await supabase
        .from('user_profiles')
        .select('pseudo')
        .eq('id', user.id)
        .single();

      if (senderProfileError || !senderProfile?.pseudo) {
        console.error('❌ Erreur lors de la récupération du pseudo de l\'expéditeur:', senderProfileError);
        Alert.alert("Erreur", "Impossible de récupérer votre pseudo. Veuillez réessayer.");
        return;
      }

      const senderPseudo = senderProfile.pseudo.trim();
      if (!senderPseudo || senderPseudo === '') {
        Alert.alert("Erreur", "Votre pseudo n'est pas défini. Veuillez compléter votre profil.");
        return;
      }

      // Mettre à jour l'état local pour les prochaines fois
      if (currentPseudo !== senderPseudo) {
        setCurrentPseudo(senderPseudo);
      }

      // Le token FCM est stocké dans expo_push_token (réutilisation du champ existant)
      let fcmToken = recipient.expo_push_token;
      
      // Log de debug pour voir ce qui est passé
      console.log(`🔍 [DEBUG] Tentative d'envoi à ${recipient.pseudo} (${recipient.id}):`, {
        hasTokenInObject: !!fcmToken,
        tokenLength: fcmToken?.length || 0,
        tokenPreview: fcmToken ? fcmToken.substring(0, 20) + '...' : 'null/undefined',
        senderPseudo: senderPseudo
      });
      
      // Si le token n'est pas présent, essayer de le récupérer depuis la base
      if (!fcmToken || fcmToken.trim() === '') {
        console.warn(`⚠️ Token FCM manquant pour ${recipient.pseudo} (${recipient.id}), tentative de récupération depuis la base...`);
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('expo_push_token, pseudo')
          .eq('id', recipient.id)
          .single();
        
        if (profileError) {
          console.error(`❌ Erreur lors de la récupération du profil pour ${recipient.pseudo}:`, profileError);
        }
        
        if (profile?.expo_push_token && profile.expo_push_token.trim() !== '') {
          fcmToken = profile.expo_push_token;
          console.log(`✅ Token FCM récupéré depuis la base pour ${recipient.pseudo} (${recipient.id})`);
          
          // Mettre à jour l'objet dans la liste pour éviter de refaire la requête
          const updatedUsers = appUsers.map(u => 
            u.id === recipient.id ? { ...u, expo_push_token: fcmToken } : u
          );
          setAppUsers(updatedUsers);
        } else {
          console.error(`❌ Token FCM vraiment absent pour ${recipient.pseudo} (${recipient.id}) dans la base de données`);
          Alert.alert(
            "Oups", 
            `${recipient.pseudo} n'a pas activé les notifications. Le token n'est pas disponible dans la base de données.`
          );
          return;
        }
      }

      // Vérifier que c'est bien un token FCM (pas un token Expo Push)
      if (fcmToken.startsWith('ExponentPushToken[')) {
        console.warn('⚠️ Token Expo Push détecté au lieu d\'un token FCM. Le backend nécessite un token FCM natif.');
        Alert.alert("Erreur", "Le token de notification n'est pas valide. Veuillez redémarrer l'app.");
        return;
      }

      // ⚡ Choisir un prout aléatoire AVANT de l'utiliser
      const randomKey = SOUND_KEYS[Math.floor(Math.random() * SOUND_KEYS.length)];
      
      console.log('📤 Envoi prout à:', recipient.pseudo, 'De:', senderPseudo, 'Token:', fcmToken.substring(0, 20) + '...', 'Prout:', randomKey);

      // Jouer localement
      const soundFile = PROUT_SOUNDS[randomKey];
      player.replace(soundFile);
      player.play();

      // Envoyer le push via backend avec le token FCM et le bon pseudo
      await sendProutViaBackend(fcmToken, senderPseudo, randomKey);

    } catch (error) {
      console.error("Erreur prout:", error);
      Alert.alert("Erreur", "Impossible d'envoyer le prout.");
    }
  };

  if (loading && appUsers.length === 0 && pendingRequests.length === 0) return <ActivityIndicator color="#007AFF" style={{margin: 20}} />;

  return (
    <View style={styles.container}>
      {pendingRequests.length > 0 && (
        <View style={styles.requestsContainer}>
            <Text style={styles.sectionTitle}>🔔 Demandes d'amis</Text>
            {pendingRequests.map((req) => (
                <View key={req.requestId} style={styles.requestRow}>
                    <Text style={styles.requestName}>{req.pseudo}</Text>
                    <View style={styles.requestActions}>
                        <TouchableOpacity onPress={() => handleReject(req.requestId)} style={styles.rejectBtn}><Ionicons name="close" size={20} color="white" /></TouchableOpacity>
                        <TouchableOpacity onPress={() => handleAccept(req)} style={styles.acceptBtn}><Ionicons name="checkmark" size={20} color="white" /></TouchableOpacity>
                    </View>
                </View>
            ))}
        </View>
      )}

      {appUsers.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Aucun ami confirmé 😢</Text>
          <Text style={styles.subText}>Invitez vos contacts.</Text>
        </View>
      ) : (
        <FlatList
          data={appUsers}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item, index }) => (
            <View style={[styles.userRow, { backgroundColor: index % 2 === 0 ? '#d2f1ef' : '#baded7' }]}>
              <View style={styles.userInfo}>
                <TouchableOpacity onLongPress={() => handleLongPressName(item)} activeOpacity={0.7}>
                  <Text style={styles.pseudo} numberOfLines={1}>{item.pseudo}</Text>
                </TouchableOpacity>
              </View>
              <ProutSlider onComplete={() => handleSendProut(item)} />
            </View>
          )}
        />
      )}

      {/* Toast qui disparaît automatiquement */}
      {toastMessage && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 0 },
  sectionTitle: { fontWeight: 'bold', color: '#604a3e', marginBottom: 10, fontSize: 16, marginLeft: 5 },
  requestsContainer: { marginBottom: 20 },
  requestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', padding: 12, borderRadius: 10, marginBottom: 8 },
  requestName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  requestActions: { flexDirection: 'row', gap: 15 },
  acceptBtn: { backgroundColor: '#4CAF50', padding: 8, borderRadius: 20 },
  rejectBtn: { backgroundColor: '#F44336', padding: 8, borderRadius: 20 },
  emptyCard: { backgroundColor: 'rgba(255,255,255,0.7)', padding: 20, borderRadius: 15, alignItems: 'center' },
  emptyText: { color: '#666', fontSize: 16, fontWeight: 'bold' },
  subText: { color: '#888', fontSize: 14, marginTop: 5 },
  userRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 15, marginBottom: 8 },
  toast: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: '#604a3e',
    borderRadius: 12,
    padding: 16,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    alignItems: 'center',
  },
  toastText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  pseudo: { fontSize: 18, fontWeight: '600', color: '#333', marginLeft: 10 },
  sliderContainer: { position: 'relative' },
  sliderTrack: { width: 180, height: 44, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 22, justifyContent: 'center', padding: 2 },
  sliderThumb: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3 },
  sliderText: { position: 'absolute', width: '100%', textAlign: 'center', fontSize: 12, color: '#666', fontWeight: 'bold', zIndex: -1 },
  flyingCloud: { position: 'absolute', right: 0, top: -20, fontSize: 30, zIndex: 999, elevation: 10 }
});
