import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { useAudioPlayer } from 'expo-audio'; // Supprimé
import { Audio } from 'expo-av';
import * as Contacts from 'expo-contacts';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Animated as RNAnimated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { normalizePhone } from '../lib/normalizePhone';
import { sendProutViaBackend } from '../lib/sendProutBackend';
// Import supprimé : on utilise maintenant sync_contacts (fonction SQL Supabase)
import i18n from '../lib/i18n';
import { supabase } from '../lib/supabase';
const ANIM_IMAGES = [
  require('../assets/images/animprout1.png'),
  require('../assets/images/animprout2.png'),
  require('../assets/images/animprout3.png'),
  require('../assets/images/animprout4.png'),
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 150; // Seuil pour déclencher l'action

const PROUT_SOUNDS: { [key: string]: any } = {
  prout1: require('../assets/sounds/prout1.wav'),
  prout2: require('../assets/sounds/prout2.wav'),
  prout3: require('../assets/sounds/prout3.wav'),
  prout4: require('../assets/sounds/prout4.wav'),
  prout5: require('../assets/sounds/prout5.wav'),
  prout6: require('../assets/sounds/prout6.wav'),
  prout7: require('../assets/sounds/prout7.wav'),
  prout8: require('../assets/sounds/prout8.wav'),
  prout9: require('../assets/sounds/prout9.wav'),
  prout10: require('../assets/sounds/prout10.wav'),
  prout11: require('../assets/sounds/prout11.wav'),
  prout12: require('../assets/sounds/prout12.wav'),
  prout13: require('../assets/sounds/prout13.wav'),
  prout14: require('../assets/sounds/prout14.wav'),
  prout15: require('../assets/sounds/prout15.wav'),
  prout16: require('../assets/sounds/prout16.wav'),
  prout17: require('../assets/sounds/prout17.wav'),
  prout18: require('../assets/sounds/prout18.wav'),
  prout19: require('../assets/sounds/prout19.wav'),
  prout20: require('../assets/sounds/prout20.wav'),
};

// Mapping des noms de prouts (doit correspondre au backend)
const PROUT_NAMES: Record<string, string> = {
  prout1: "La Petite Bourrasque",
  prout2: "Le Crépitant",
  prout3: "Le Rebond du Tonnerre",
  prout4: "Le Faux Départ",
  prout5: "Le Frelon Trébuchant",
  prout6: "Le Kraken",
  prout7: "La Farandole",
  prout8: "Le Question Réponse",
  prout9: "Le Oulala… Problème",
  prout10: "Le Ballon Dégonflé",
  prout11: "La Mitraille Molle",
  prout12: "La Rafale Infernale",
  prout13: "Le Lâché Prise",
  prout14: "Le Basson",
  prout15: "La Fantaisie de Minuit",
  prout16: "Le Marmiton Furieux",
  prout17: "L'Éclair Fromager",
  prout18: "L'Impromptu",
  prout19: "La Grosse Bertha",
  prout20: "L'Éternel",
};

const SOUND_KEYS = Object.keys(PROUT_SOUNDS);

// Clés de cache pour AsyncStorage
const CACHE_KEY_FRIENDS = 'cached_friends_list';
const CACHE_KEY_PENDING_REQUESTS = 'cached_pending_requests';
const CACHE_KEY_INTERACTIONS = 'cached_interactions_timestamp'; // Nouvelle clé pour le tri
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 heures

// Fonction utilitaire pour charger le cache de manière sécurisée
const loadCacheSafely = async (key: string) => {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    
    // Vérifier que c'est un tableau
    if (!Array.isArray(parsed.data)) {
      // Cache invalide, ignoré
      return null;
    }
    
    // Vérifier l'âge du cache (optionnel)
    if (parsed.timestamp && Date.now() - parsed.timestamp > CACHE_MAX_AGE) {
      // Cache expiré, ignoré
      return null;
    }
    
    return parsed.data;
  } catch (e) {
    // Erreur lecture cache (non critique)
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
    // Erreur sauvegarde cache (non critique)
    // On ignore l'erreur, ce n'est pas critique
  }
};

// Composant SwipeableFriendRow : Swipe to Action avec animation frame-by-frame (version Reanimated pour iOS fluide)
const SwipeableFriendRow = ({ 
  friend, 
  backgroundColor, 
  onSendProut, 
  onLongPressName,
  onDeleteFriend,
  introDelay = 0,
}: { 
  friend: any; 
  backgroundColor: string; 
  onSendProut: () => void; 
  onLongPressName: () => void;
  onDeleteFriend: () => void;
  introDelay?: number;
}) => {
  const translationX = useSharedValue(0);
  const maxSwipeRight = SCREEN_WIDTH * 0.7; // Maximum 70% de l'écran vers la droite
  const maxSwipeLeft = SCREEN_WIDTH * 0.7; // Maximum 70% de l'écran vers la gauche
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showFinalImage, setShowFinalImage] = useState(false);
  const introOffset = useSharedValue(0);
  const introDirectionRef = useRef(Math.random() > 0.5 ? 1 : -1);

  useEffect(() => {
    introOffset.value = introDirectionRef.current * 24;
    introOffset.value = withDelay(
      introDelay,
      withSpring(0, { damping: 12, stiffness: 140 })
    );
  }, [introDelay, introOffset]);
  
  // Calculer l'index de l'image en fonction de la distance du swipe (seulement pour swipe droite)
  const getImageIndex = (dx: number) => {
    const percentage = Math.min(dx / maxSwipeRight, 1);
    if (percentage <= 0.10) return 0; // animprout1 (0-10%)
    if (percentage <= 0.90) return 1; // animprout2 (10-90%)
    return 2; // animprout3 (90-100%)
  };

  // Fonction pour mettre à jour l'index d'image (appelée depuis le thread JS)
  const updateImageIndex = (x: number) => {
    const imageIndex = getImageIndex(x);
    if (imageIndex !== currentImageIndex) {
      setCurrentImageIndex(imageIndex);
    }
  };

  // Fonction pour déclencher l'action (swipe droite)
  const triggerAction = () => {
    setShowFinalImage(true);
    setCurrentImageIndex(0);
    onSendProut();
    
    // Après le retour du slider, attendre 0.5 seconde avant de cacher l'image
    setTimeout(() => {
      setShowFinalImage(false);
      setCurrentImageIndex(0);
    }, 500);
  };

  // Fonction pour déclencher la suppression (swipe gauche)
  const triggerDelete = () => {
    onDeleteFriend();
    // Retour à la position initiale après confirmation
    translationX.value = withSpring(0, {
      damping: 15,
      stiffness: 150,
    });
  };

  // Geste avec Reanimated (fluide sur iOS) - Supporte gauche et droite
  const gesture = Gesture.Pan()
    .activeOffsetX([-15, 15]) // Exiger un mouvement horizontal franc
    .failOffsetY([-10, 10])   // Laisser le scroll vertical passer
    .onStart(() => {
      // Reset si nécessaire
    })
    .onUpdate((e) => {
      // Permettre le swipe dans les deux sens
      const newX = Math.max(-maxSwipeLeft, Math.min(e.translationX, maxSwipeRight));
      translationX.value = newX;
      
      // Mettre à jour l'image seulement si swipe vers la droite
      if (newX > 0) {
        runOnJS(updateImageIndex)(newX);
      }
    })
    .onEnd((e) => {
      const finalX = e.translationX;
      
      // Swipe vers la droite (envoi de prout)
      if (finalX >= SWIPE_THRESHOLD) {
        runOnJS(triggerAction)();
        translationX.value = withSpring(0, {
          damping: 15,
          stiffness: 150,
        });
      } 
      // Swipe vers la gauche (suppression)
      else if (finalX <= -SWIPE_THRESHOLD) {
        runOnJS(triggerDelete)();
      } 
      // Seuil non atteint : retourner à la position initiale
      else {
        translationX.value = withSpring(0, {
          damping: 15,
          stiffness: 150,
        });
        if (finalX > 0) {
          runOnJS(setCurrentImageIndex)(0);
        }
      }
    });

  // Style animé pour la ligne qui se déplace
  const animatedLineStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translationX.value + introOffset.value }],
    };
  });

  // Style animé pour le zoom de l'image de fond (seulement pour swipe droite)
  const animatedImageScale = useAnimatedStyle(() => {
    // Ne zoomer que si on swipe vers la droite
    const positiveX = Math.max(0, translationX.value);
    const scale = interpolate(
      positiveX,
      [0, maxSwipeRight],
      [0.5, 4.0],
      Extrapolation.CLAMP
    );
    
    return {
      transform: [{ scale }],
      opacity: translationX.value > 0 ? 1 : 0, // Cacher l'image si swipe gauche
    };
  });

  // Style animé pour le fond rouge (seulement pour swipe gauche)
  const animatedRedBackground = useAnimatedStyle(() => {
    const negativeX = Math.min(0, translationX.value);
    const opacity = interpolate(
      Math.abs(negativeX),
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP
    );
    
    return {
      opacity,
    };
  });

  return (
    <View style={[styles.swipeableRow, { backgroundColor }]} collapsable={false}>
      {/* Background gauche : Fond rouge pour suppression */}
      <Animated.View 
        style={[
          styles.deleteBackground,
          animatedRedBackground
        ]}
        collapsable={false}
      >
        <Text style={styles.deleteText}>Supprimer</Text>
      </Animated.View>

      {/* Background droite : Image d'animation avec fond clair */}
      <View style={styles.swipeBackground} collapsable={false}>
        {/* Image finale (animprout4) après l'envoi du prout */}
        {showFinalImage ? (
          <View style={styles.finalImageContainer} collapsable={false}>
            <Animated.Image 
              source={ANIM_IMAGES[3]} 
              style={[
                styles.animImage,
                {
                  transform: [{ scale: 4.0 }], // Même taille que la fin du zoom
                },
              ]}
              resizeMode="contain"
            />
          </View>
        ) : (
          /* Image normale pendant le swipe */
          currentImageIndex >= 0 && currentImageIndex < 3 && (
            <Animated.Image 
              source={ANIM_IMAGES[currentImageIndex]} 
              style={[styles.animImage, animatedImageScale]}
              resizeMode="contain"
            />
          )
        )}
      </View>

      {/* Foreground : Ligne de contact */}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            styles.swipeForeground,
            {
              backgroundColor,
            },
            animatedLineStyle,
          ]}
        >
          <View style={styles.userInfo}>
            <TouchableOpacity onLongPress={onLongPressName} activeOpacity={0.7} style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={styles.pseudo} numberOfLines={1}>{friend.pseudo}</Text>
              {friend.isZenMode && <Text style={{marginLeft: 5, fontSize: 16}}>🌙</Text>}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

export function FriendsList({ onProutSent, isZenMode }: { onProutSent?: () => void; isZenMode?: boolean } = {}) {
  const [appUsers, setAppUsers] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [identityRequests, setIdentityRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); // Commencer à true pour éviter le flash
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPseudo, setCurrentPseudo] = useState<string>("Un ami");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new RNAnimated.Value(0)).current;
  const subscriptionRef = useRef<any>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cacheLoadedRef = useRef(false); // Pour éviter de charger le cache plusieurs fois
  const contactsSyncedRef = useRef(false); // Pour éviter de synchroniser les contacts plusieurs fois
  const phoneFriendIdsRef = useRef<string[]>([]);
  
  // Ref pour stocker les timestamps d'interaction (chargé depuis AsyncStorage)
  const interactionsMapRef = useRef<Record<string, number>>({});

  // Fonction pour charger les interactions
  const loadInteractions = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY_INTERACTIONS);
      if (cached) {
        interactionsMapRef.current = JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Erreur chargement interactions:', e);
    }
  };

  // Fonction pour mettre à jour une interaction
  const updateInteraction = async (friendId: string) => {
    const now = Date.now();
    interactionsMapRef.current = {
      ...interactionsMapRef.current,
      [friendId]: now
    };
    
    // Mettre à jour l'ordre de la liste immédiatement
    setAppUsers(prevUsers => {
      const newUsers = [...prevUsers];
      return sortFriends(newUsers);
    });

    // Sauvegarder en background
    try {
      await AsyncStorage.setItem(CACHE_KEY_INTERACTIONS, JSON.stringify(interactionsMapRef.current));
    } catch (e) {
      console.warn('Erreur sauvegarde interaction:', e);
    }
  };

  // Fonction de tri
  const sortFriends = (friends: any[]) => {
    return friends.sort((a, b) => {
      const timeA = interactionsMapRef.current[a.id] || 0;
      const timeB = interactionsMapRef.current[b.id] || 0;
      // Tri décroissant (plus récent en premier)
      if (timeA !== timeB) return timeB - timeA;
      // Fallback: ordre alphabétique
      return (a.pseudo || '').localeCompare(b.pseudo || '');
    });
  };
  
  // Cooldown par utilisateur pour éviter le spam (Map<userId, timestamp>)
  const cooldownMapRef = useRef<Map<string, number>>(new Map());
  const COOLDOWN_DURATION = 2000; // 2 secondes de pause entre chaque envoi

  // const player = useAudioPlayer(); // Supprimé

  useFocusEffect(
    useCallback(() => {
      // Recharger les données à chaque fois que l'écran gagne le focus
      loadData(false, false, false);
    }, [])
  );

  useEffect(() => {
    const mode: Audio.AudioMode = {
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    };

    Audio.setAudioModeAsync(mode).catch((error) => {
      console.warn('⚠️ Impossible de configurer le mode audio:', error);
    });
  }, []);

  useEffect(() => {
    const initialize = async () => {
      // Réinitialiser le flag de synchronisation au démarrage
      contactsSyncedRef.current = false;
      
      // ÉTAPE 1 : Charger le cache IMMÉDIATEMENT (avant tout)
      let hasCache = false;
      if (!cacheLoadedRef.current) {
        cacheLoadedRef.current = true;
        try {
          // Charger les timestamps d'abord
          await loadInteractions();

          const cachedFriends = await loadCacheSafely(CACHE_KEY_FRIENDS);
          const cachedRequests = await loadCacheSafely(CACHE_KEY_PENDING_REQUESTS);
          
          // Vérifier que le cache contient bien les tokens (sinon on ignore le cache)
          const cacheHasTokens = cachedFriends && cachedFriends.length > 0 && 
            cachedFriends.every(f => f.expo_push_token && f.expo_push_token.trim() !== '');
          
          if (cacheHasTokens) {
            // Appliquer le tri sur le cache
            const sortedCache = sortFriends(cachedFriends);
            setAppUsers(sortedCache);
            setLoading(false); // Cache trouvé, pas de spinner
            hasCache = true;
          } else if (cachedFriends && cachedFriends.length > 0) {
            // Cache ignoré, rechargement depuis la base
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

  const router = useRouter();

  const loadData = async (hasCacheFromInit: boolean = false, forceLoading: boolean = false, syncContacts: boolean = true) => {
    // Ne mettre loading à true que si :
    // 1. On n'a pas de cache à l'init ET pas de données affichées
    // 2. OU si forceLoading est true (premier chargement)
    if (forceLoading || (!hasCacheFromInit && appUsers.length === 0)) {
      setLoading(true);
      
      // Timeout de sécurité pour le chargement
      setTimeout(() => {
        setLoading((currentLoading) => {
          if (currentLoading) {
            Alert.alert("Connexion lente", "Impossible de charger la liste d'amis. Vérifiez votre réseau.");
            return false;
          }
          return currentLoading;
        });
      }, 8000); // 8 secondes pour être large
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      
      setCurrentUserId(user.id);
      const { data: profile } = await supabase.from('user_profiles').select('pseudo').eq('id', user.id).single();
      if (profile) {
        setCurrentPseudo(profile.pseudo);
      }

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

      // Tentative de récupération des pseudos séparément pour contourner le problème de relation
      const { data: identityRows, error: identityError } = await supabase
        .from('identity_reveals')
        .select(`
          requester_id,
          status
        `)
        .eq('friend_id', user.id)
        .eq('status', 'pending');

      if (identityError) {
        console.error('❌ Erreur chargement demandes identité:', identityError);
      }

      let identityList: any[] = [];
      if (identityRows && identityRows.length > 0) {
        const requesterIds = identityRows.map(r => r.requester_id);
        const { data: requesters } = await supabase
          .from('user_profiles')
          .select('id, pseudo')
          .in('id', requesterIds);
        
        identityList = identityRows.map(row => ({
          requesterId: row.requester_id,
          requesterPseudo: requesters?.find(u => u.id === row.requester_id)?.pseudo || 'Inconnu',
        }));
      }
      setIdentityRequests(identityList);

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
      phoneFriendIdsRef.current = phoneFriendsIds;
      const allFriendIds = [...new Set([...phoneFriendsIds, ...addedFriendsIds, ...friendsWhereIAmFriendIds])];

      if (allFriendIds.length > 0) {
          // Récupérer les amis avec leur token FCM (stocké dans expo_push_token)
          // IMPORTANT : Vérifier que le token est bien présent
          const { data: finalFriends } = await supabase
            .from('user_profiles')
            .select('id, pseudo, phone, expo_push_token, push_platform, is_zen_mode')
            .in('id', allFriendIds);
          
          let identityAliasMap: Record<string, { alias: string | null, status: string | null }> = {};
          if (allFriendIds.length > 0) {
            // Utiliser une requête simple sans jointure pour être sûr
            const { data: reveals, error: revealError } = await supabase
              .from('identity_reveals')
              .select('friend_id, alias, status')
              .eq('requester_id', user.id)
              .in('friend_id', allFriendIds);

            if (revealError) {
              console.error('❌ Erreur chargement identités:', revealError);
            }

            if (reveals) {
              identityAliasMap = reveals.reduce((acc, reveal) => {
                acc[reveal.friend_id] = {
                  alias: reveal.alias,
                  status: reveal.status,
                };
                return acc;
              }, {} as Record<string, { alias: string | null, status: string | null }>);
            }
          }

          const friendsList = (finalFriends || []).map(friend => ({
            ...friend,
            isPhoneContact: phoneFriendsIds.includes(friend.id),
            identityAlias: identityAliasMap[friend.id]?.alias || null,
            identityStatus: identityAliasMap[friend.id]?.status || null,
            isZenMode: friend.is_zen_mode || false,
          }));
          
          // Vérifier les tokens (sans logs)
          friendsList.forEach(friend => {
            if (!friend.expo_push_token || friend.expo_push_token.trim() === '') {
              // Token manquant, mais on ne log plus
            }
          });
          
          // Trier la liste avant de la setter
          const sortedList = sortFriends(friendsList);
          setAppUsers(sortedList);
          
          // Sauvegarder dans le cache (sans bloquer si ça échoue)
          await saveCacheSafely(CACHE_KEY_FRIENDS, sortedList);
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
            event: '*',
            schema: 'public',
            table: 'friends',
          },
          (payload) => {
            // Recharger les données si le statut change (sans remettre loading si données déjà affichées)
            loadData(false, false);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'identity_reveals',
          },
          (payload) => {
            // Recharger les données si une demande d'identité change
            console.log('🔄 Changement identity_reveals détecté, rechargement...');
            loadData(false, false);
          }
        )
        .subscribe(() => {
          // Subscription active, pas besoin de log
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

  const handleDeleteFriend = async (friend: any) => {
    if (!currentUserId) return;
    
    const isContactFriend =
      friend?.isPhoneContact ||
      phoneFriendIdsRef.current.includes(friend?.id);

    if (isContactFriend) {
      Alert.alert(
        i18n.t('delete_impossible_title'),
        i18n.t('delete_impossible_contact'),
      );
      return;
    }
    
    // Afficher la confirmation avec Alert
    Alert.alert(
      i18n.t('confirm_delete_title'),
      i18n.t('confirm_delete_body', { pseudo: friend.pseudo }),
      [
        {
          text: i18n.t('cancel'),
          style: 'cancel',
          onPress: () => {
            // Rien à faire, le slider reviendra automatiquement
          },
        },
        {
          text: i18n.t('confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              // Supprimer les deux relations dans friends (A→B et B→A)
              // Relation A→B (où currentUserId est user_id)
              await supabase
                .from('friends')
                .delete()
                .eq('user_id', currentUserId)
                .eq('friend_id', friend.id);
              
              // Relation B→A (où friend.id est user_id)
              await supabase
                .from('friends')
                .delete()
                .eq('user_id', friend.id)
                .eq('friend_id', currentUserId);
              
              // Recharger la liste
              loadData();
              
              // Afficher un toast de confirmation
              showToast(i18n.t('friend_deleted_toast', { pseudo: friend.pseudo }));
            } catch (error) {
              console.error('Erreur lors de la suppression:', error);
              Alert.alert(i18n.t('error'), 'Impossible de supprimer cet ami');
            }
          },
        },
      ]
    );
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    // Animation d'apparition
    RNAnimated.sequence([
      RNAnimated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      RNAnimated.delay(1300), // Afficher pendant 1.3s
      RNAnimated.timing(toastOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToastMessage(null);
    });
  };

  const handleLongPressName = async (friend: any) => {
    if (friend.identityAlias) {
      showToast(`✨ ${friend.identityAlias}`);
      return;
    }

    if (friend.identityStatus === 'pending') {
      Alert.alert(
        i18n.t('already_asked_identity_title'),
        i18n.t('already_asked_identity_body', { pseudo: friend.pseudo }),
        [
          { text: i18n.t('cancel'), style: 'cancel' },
          { text: i18n.t('relaunch_btn'), onPress: () => requestIdentityReveal(friend, { force: true }) },
        ],
      );
      return;
    }

    let contactRevealed = false;

    if (friend.phone) {
      try {
        const { status } = await Contacts.requestPermissionsAsync();
        if (status === 'granted') {
          const { data: contacts } = await Contacts.getContactsAsync({
            fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
          });

          if (contacts && contacts.length > 0) {
            const normalizedFriendPhone = normalizePhone(friend.phone);

            const matchingContact = contacts.find(contact => {
              if (!contact.phoneNumbers || contact.phoneNumbers.length === 0) return false;
              return contact.phoneNumbers.some(phoneNumber => {
                const normalizedContactPhone = normalizePhone(phoneNumber.number || '');
                return normalizedContactPhone === normalizedFriendPhone;
              });
            });

            if (matchingContact) {
              const fullName = matchingContact.name || matchingContact.firstName || matchingContact.lastName || friend.pseudo;
              showToast(fullName);
              contactRevealed = true;
            }
          }
        }
      } catch (error) {
        console.error("Erreur lors de la recherche du contact:", error);
      }
    }

    if (contactRevealed) {
      return;
    }

    Alert.alert(
      i18n.t('ask_identity_title'),
      i18n.t('ask_identity_body', { pseudo: friend.pseudo }),
      [
        { text: i18n.t('cancel'), style: 'cancel' },
        {
          text: i18n.t('ask_btn'),
          onPress: () => requestIdentityReveal(friend),
        },
      ],
    );
  };

  const requestIdentityReveal = async (friend: any, options: { force?: boolean } = {}) => {
    if (!currentUserId) return;

    try {
      await supabase
        .from('identity_reveals')
        .upsert({
          requester_id: currentUserId,
          friend_id: friend.id,
          status: 'pending',
        }, {
          onConflict: 'requester_id,friend_id',
          updated_at: new Date().toISOString(),
        });

      if (friend.expo_push_token) {
        await sendProutViaBackend(
          friend.expo_push_token,
          currentPseudo || 'Un ami',
          'identity-request',
          friend.push_platform as 'ios' | 'android' | undefined,
          {
            requesterId: currentUserId,
            requesterPseudo: currentPseudo || 'Un ami',
          },
        );
      }

      if (options.force) {
        showToast(i18n.t('request_sent')); // Réutilisation du message générique ou création d'un spécifique si besoin
      } else {
        Alert.alert(i18n.t('success'), i18n.t('request_sent'));
      }
      loadData(false, false, false);
    } catch (error) {
      console.error('❌ Impossible de demander l’identité:', error);
      Alert.alert(i18n.t('error'), 'Impossible d’envoyer la demande.');
    }
  };

  const handleSendProut = async (recipient: any) => {
    // 1. Vérification Mode Zen (Moi) - utilise la prop isZenMode
    if (isZenMode) {
      Alert.alert(i18n.t('zen_mode_active_me_title'), i18n.t('zen_mode_active_me_body'));
      return;
    }

    // 2. Vérification Mode Zen (Destinataire)
    if (recipient.isZenMode) {
      Alert.alert(i18n.t('zen_mode_active_friend_title'), i18n.t('zen_mode_active_friend_body', { pseudo: recipient.pseudo }));
      return;
    }

    // Vérifier le cooldown pour cet utilisateur
    const now = Date.now();
    const lastSent = cooldownMapRef.current.get(recipient.id);
    
    if (lastSent && (now - lastSent) < COOLDOWN_DURATION) {
      // En cooldown, ignorer la requête
      const remainingTime = Math.ceil((COOLDOWN_DURATION - (now - lastSent)) / 1000);
      // Cooldown actif, réessayez plus tard
      return;
    }
    
    // Mettre à jour le timestamp pour cet utilisateur
    cooldownMapRef.current.set(recipient.id, now);
    
    try {
      // TOUJOURS recharger le pseudo depuis la base pour être sûr d'avoir la valeur à jour
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert(i18n.t('error'), i18n.t('not_connected'));
        // Retirer le cooldown en cas d'erreur
        cooldownMapRef.current.delete(recipient.id);
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
        Alert.alert(i18n.t('error'), "Impossible de récupérer votre pseudo. Veuillez réessayer."); // Pas traduit pour l'instant (erreur technique)
        cooldownMapRef.current.delete(recipient.id);
        return;
      }

      const senderPseudo = senderProfile.pseudo.trim();
      if (!senderPseudo || senderPseudo === '') {
        Alert.alert("Erreur", "Votre pseudo n'est pas défini. Veuillez compléter votre profil.");
        cooldownMapRef.current.delete(recipient.id);
        return;
      }

      // Mettre à jour l'état local pour les prochaines fois
      if (currentPseudo !== senderPseudo) {
        setCurrentPseudo(senderPseudo);
      }

      // Le token FCM est stocké dans expo_push_token (réutilisation du champ existant)
      let fcmToken = recipient.expo_push_token;
      let targetPlatform = recipient.push_platform;
      
      // Si le token n'est pas présent, essayer de le récupérer depuis la base
      if (!fcmToken || fcmToken.trim() === '') {
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('expo_push_token, pseudo, push_platform')
          .eq('id', recipient.id)
          .single();
        
        if (profileError) {
          console.error(`❌ Erreur lors de la récupération du profil pour ${recipient.pseudo}:`, profileError);
        }
        
        if (profile?.expo_push_token && profile.expo_push_token.trim() !== '') {
          fcmToken = profile.expo_push_token;
          targetPlatform = profile.push_platform || targetPlatform;
          
          // Mettre à jour l'objet dans la liste pour éviter de refaire la requête
          const updatedUsers = appUsers.map(u => 
            u.id === recipient.id ? { ...u, expo_push_token: fcmToken, push_platform: profile.push_platform || u.push_platform } : u
          );
          setAppUsers(updatedUsers);
        } else {
          Alert.alert(
            "Oups", 
            `${recipient.pseudo} n'a pas activé les notifications. Le token n'est pas disponible dans la base de données.`
          );
          // Retirer le cooldown en cas d'erreur
          cooldownMapRef.current.delete(recipient.id);
          return;
        }
      }

      // Le backend se charge de détecter le type de token (iOS Expo ou Android FCM)
      // et d'utiliser la bonne API. On envoie le token tel quel.

      // ⚡ Choisir un prout aléatoire AVANT de l'utiliser
      const randomKey = SOUND_KEYS[Math.floor(Math.random() * SOUND_KEYS.length)];

      // Jouer localement avec expo-av
      const soundFile = PROUT_SOUNDS[randomKey];
      try {
        const { sound } = await Audio.Sound.createAsync(soundFile);
        await sound.playAsync();
        // Libérer la ressource après lecture
        sound.setOnPlaybackStatusUpdate(async (status) => {
          if (status.isLoaded && status.didJustFinish) {
            await sound.unloadAsync();
          }
        });
      } catch (error) {
        console.warn("Impossible de jouer le son:", error);
      }
      // player.replace(soundFile); // Ancien code
      // player.play(); // Ancien code

      // Envoyer le push via backend avec le token FCM et le bon pseudo
      await sendProutViaBackend(fcmToken, senderPseudo, randomKey, targetPlatform || 'ios');
      
      // Mettre à jour le timestamp d'interaction pour le tri
      await updateInteraction(recipient.id);

      // Afficher le nom du prout dans un toast
      const proutName = PROUT_NAMES[randomKey] || randomKey;
      showToast(`${proutName} !`);
      
      // Déclencher l'animation de secousse du header
      if (onProutSent) {
        onProutSent();
      }

    } catch (error: any) {
      console.error("Erreur lors de l'envoi du prout:", error?.message || error);
      
      // Si c'est une erreur 429 (Too Many Requests), informer l'utilisateur
      if (error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
        Alert.alert(i18n.t('cooldown_alert'), i18n.t('cooldown_message'));
      } else {
        // Message plus détaillé selon le type d'erreur
        let errorMessage = "Impossible d'envoyer le prout.";
        if (error?.message?.includes('Backend error')) {
          errorMessage = "Erreur serveur. Le backend ne peut pas traiter ce type de token.\n\nVérifiez que le backend est configuré pour iOS (Expo Push).";
        }
        Alert.alert(i18n.t('error'), errorMessage);
      }
      
      // En cas d'erreur, on retire le cooldown pour permettre une nouvelle tentative
      cooldownMapRef.current.delete(recipient.id);
    }
  };

  const renderRequestsHeader = () => {
    if (pendingRequests.length === 0 && identityRequests.length === 0) return null;
    return (
      <View style={styles.requestsContainer}>
        {pendingRequests.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{i18n.t('friends_requests')}</Text>
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
          </>
        )}

        {identityRequests.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: pendingRequests.length ? 20 : 0 }]}>{i18n.t('identity_requests')}</Text>
            {identityRequests.map((req) => (
              <View key={req.requesterId} style={styles.identityRow}>
                <Text style={styles.requestName}>{req.requesterPseudo}</Text>
                <TouchableOpacity
                  style={styles.identityButton}
                  onPress={() => router.push({
                    pathname: '/IdentityRevealScreen',
                    params: {
                      requesterId: req.requesterId,
                      requesterPseudo: req.requesterPseudo,
                    },
                  })}
                >
                  <Ionicons name="person-circle" size={18} color="white" />
                  <Text style={styles.identityButtonText}>{i18n.t('respond_btn')}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </View>
    );
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadData(false, false, true);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading && appUsers.length === 0 && pendingRequests.length === 0) return <ActivityIndicator color="#007AFF" style={{margin: 20}} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={appUsers}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          appUsers.length === 0 && pendingRequests.length === 0 ? styles.emptyContentPadding : null,
        ]}
        ListHeaderComponent={renderRequestsHeader()}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{i18n.t('no_friends')}</Text>
            <Text style={styles.subText}>{i18n.t('invite_contacts')}</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={{ position: 'relative', marginBottom: 8 }}>
            <SwipeableFriendRow
              friend={item}
              backgroundColor={index % 2 === 0 ? '#d2f1ef' : '#baded7'}
              onSendProut={() => handleSendProut(item)}
              onLongPressName={() => handleLongPressName(item)}
              onDeleteFriend={() => handleDeleteFriend(item)}
                introDelay={index * 40}
            />
          </View>
        )}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        showsVerticalScrollIndicator={false}
      />

      {/* Toast qui disparaît automatiquement */}
      {toastMessage && (
        <RNAnimated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </RNAnimated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, marginTop: 0 },
  list: { flex: 1 },
  listContent: { paddingBottom: 80 },
  emptyContentPadding: { flexGrow: 1, justifyContent: 'center' },
  sectionTitle: { fontWeight: 'bold', color: '#604a3e', marginBottom: 10, fontSize: 16, marginLeft: 5 },
  requestsContainer: { marginBottom: 20 },
  requestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', padding: 12, borderRadius: 10, marginBottom: 8 },
  requestName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  requestActions: { flexDirection: 'row', gap: 15 },
  acceptBtn: { backgroundColor: '#4CAF50', padding: 8, borderRadius: 20 },
  rejectBtn: { backgroundColor: '#F44336', padding: 8, borderRadius: 20 },
  identityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', padding: 12, borderRadius: 10, marginBottom: 8 },
  identityButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#604a3e', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  identityButtonText: { color: 'white', fontWeight: 'bold' },
  emptyCard: { backgroundColor: 'rgba(255,255,255,0.7)', padding: 20, borderRadius: 15, alignItems: 'center' },
  emptyText: { color: '#666', fontSize: 16, fontWeight: 'bold' },
  subText: { color: '#888', fontSize: 14, marginTop: 5 },
  swipeableRow: {
    position: 'relative',
    borderRadius: 15,
    overflow: 'hidden', // Garder hidden pour le design
    height: 60, // Hauteur fixe pour aligner l'image
    zIndex: 1, // S'assurer que le conteneur reste dans son espace
  },
  swipeBackground: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    justifyContent: 'center', // Centrer verticalement
    alignItems: 'flex-start', // Positionner à gauche
    paddingLeft: 20, // Espacement depuis la gauche
    height: 60, // Même hauteur que la ligne
    backgroundColor: 'rgba(255, 255, 255, 0.4)', // Fond clair pour différencier les couches
    overflow: 'hidden', // CRITIQUE : Masquer impérativement ce qui dépasse lors du zoom agressif
  },
  animImage: {
    width: 60,
    height: 60,
    // Le transform origin est center par défaut en React Native
    // L'image va zoomer depuis son centre
  },
  finalImageContainer: {
    // Conteneur pour l'image finale pour éviter qu'elle affecte le layout parent
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    zIndex: 1,
  },
  swipeForeground: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    height: '100%',
    width: '100%',
  },
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
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  pseudo: { fontSize: 18, fontWeight: '600', color: '#333', marginLeft: 10 },
  deleteBackground: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    backgroundColor: '#F44336', // Rouge
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
    borderRadius: 15,
  },
  deleteText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
