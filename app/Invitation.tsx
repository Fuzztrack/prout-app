// app/Invitation.tsx
import * as Contacts from 'expo-contacts';
import { ensureContactPermissionWithDisclosure } from '../lib/contactConsent';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CustomButton } from '../components/CustomButton';
import { normalizePhone } from '../lib/normalizePhone';
import { safePush, safeReplace } from '../lib/navigation';
// Import supprimé : on utilise maintenant sync_contacts (fonction SQL Supabase)
import { supabase } from '../lib/supabase';
import i18n from '../lib/i18n';

interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
}

interface PendingInvitation {
  id: string;
  from_user_id: string;
  to_user_id: string | null;
  to_email: string | null;
  to_pseudo: string | null;
  to_phone: string | null;
  status: string;
  created_at: string;
  from_user_pseudo?: string;
}

export default function InvitationScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showContactList, setShowContactList] = useState(false);
  const [inviteMode, setInviteMode] = useState<'email' | 'pseudo'>('pseudo');
  const [inviteValue, setInviteValue] = useState('');
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const subscriptionRef = useRef<any>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Charger les invitations en attente au démarrage
  useEffect(() => {
    loadPendingInvitations();
    setupRealtimeSubscription();
    
    // Polling de backup toutes les 5 secondes (au cas où Realtime ne fonctionne pas)
    pollingIntervalRef.current = setInterval(() => {
      loadPendingInvitations();
    }, 5000);

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

  // Recharger les invitations quand l'écran reprend le focus
  useFocusEffect(
    useCallback(() => {
      loadPendingInvitations();
    }, [])
  );

  // Charger les invitations en attente
  const loadPendingInvitations = async () => {
    try {
      setLoadingInvitations(true);
      
      // Récupérer l'utilisateur actuel
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return;
      }

      // Récupérer le profil de l'utilisateur actuel pour vérifier email/pseudo/téléphone
      const { data: currentProfile } = await supabase
        .from('user_profiles')
        .select('pseudo, phone')
        .eq('id', user.id)
        .single();

      // Récupérer l'email depuis auth.users
      const email = user.email;

      // Récupérer toutes les invitations en attente
      // On va filtrer côté client pour gérer les cas où to_user_id est null
      const { data: allInvitations, error: invitationsError } = await supabase
        .from('invitations')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (invitationsError) {
        console.error('Erreur lors du chargement des invitations:', invitationsError);
        return;
      }

      // Normaliser l'email pour la comparaison (minuscules, trim)
      const normalizedEmail = email?.toLowerCase().trim();

      // Filtrer les invitations qui correspondent à l'utilisateur actuel
      const relevantInvitations = (allInvitations || []).filter(inv => {
        // Invitation directe par to_user_id
        if (inv.to_user_id === user.id) {
          return true;
        }
        
        // Invitation par email (comparaison insensible à la casse)
        if (normalizedEmail && inv.to_email) {
          const normalizedInvEmail = inv.to_email.toLowerCase().trim();
          if (normalizedEmail === normalizedInvEmail) {
            return true;
          }
        }
        
        // Invitation par pseudo (comparaison exacte)
        if (currentProfile?.pseudo && inv.to_pseudo) {
          const normalizedPseudo = currentProfile.pseudo.trim();
          const normalizedInvPseudo = inv.to_pseudo.trim();
          if (normalizedPseudo === normalizedInvPseudo) {
            return true;
          }
        }
        
        // Invitation par téléphone (normalisation nécessaire)
        if (currentProfile?.phone && inv.to_phone) {
          const normalizedPhone = normalizePhone(currentProfile.phone);
          const normalizedInvPhone = normalizePhone(inv.to_phone);
          if (normalizedPhone === normalizedInvPhone) {
            return true;
          }
        }
        
        return false;
      });

      // Récupérer les pseudos des expéditeurs
      if (relevantInvitations.length > 0) {
        const fromUserIds = relevantInvitations.map(inv => inv.from_user_id);
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, pseudo')
          .in('id', fromUserIds);

        // Associer les pseudos aux invitations
        const invitationsWithPseudo = relevantInvitations.map(inv => {
          const profile = profiles?.find(p => p.id === inv.from_user_id);
          return {
            ...inv,
            from_user_pseudo: profile?.pseudo || 'Utilisateur inconnu',
          };
        });

        setPendingInvitations(invitationsWithPseudo);
      } else {
        setPendingInvitations([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des invitations:', error);
    } finally {
      setLoadingInvitations(false);
    }
  };

  // Configurer la subscription Realtime pour écouter les nouvelles invitations
  const setupRealtimeSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Créer un canal pour écouter les changements sur la table invitations
      const channel = supabase
        .channel('invitations-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'invitations',
            filter: `status=eq.pending`,
          },
          (payload) => {
            console.log('🔔 Nouvelle invitation détectée via Realtime:', payload);
            // Recharger les invitations immédiatement
            loadPendingInvitations();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'invitations',
          },
          (payload) => {
            console.log('🔔 Invitation mise à jour via Realtime:', payload);
            // Recharger les invitations si le statut change
            if (payload.new.status !== payload.old.status) {
              loadPendingInvitations();
            }
          }
        )
        .subscribe((status) => {
          console.log('📡 Statut subscription Realtime:', status);
        });

      subscriptionRef.current = channel;
    } catch (error) {
      console.error('❌ Erreur lors de la configuration de Realtime:', error);
      // En cas d'erreur, le polling de backup prendra le relais
    }
  };

  // Accepter une invitation
  const handleAcceptInvitation = async (invitation: PendingInvitation) => {
    try {
      setLoading(true);

      // Récupérer l'utilisateur actuel
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        Alert.alert(i18n.t('error'), i18n.t('cannot_retrieve_account'));
        return;
      }

      const invitingUserId = invitation.from_user_id; // A (celui qui a invité)
      const invitedUserId = user.id; // B (celui qui accepte)

      // Vérifier si la relation A→B existe
      const { data: friendRelation, error: findError } = await supabase
        .from('friends')
        .select('id, status')
        .eq('user_id', invitingUserId) // A
        .eq('friend_id', invitedUserId) // B
        .eq('method', 'invitation')
        .maybeSingle();

      if (findError) {
        console.error('Erreur lors de la recherche de la relation:', findError);
        Alert.alert(i18n.t('error'), i18n.t('cannot_find_invitation'));
        return;
      }

      // Si la relation n'existe pas, la créer d'abord (cas où invitation créée avant que B existe)
      if (!friendRelation) {
        const { data: newRelation, error: createError } = await supabase
          .from('friends')
          .insert([
            {
              user_id: invitingUserId,
              friend_id: invitedUserId,
              method: 'invitation',
              // Le trigger définira status='pending'
            },
          ])
          .select('id')
          .single();

        if (createError) {
          console.error('Erreur lors de la création de la relation:', createError);
          Alert.alert(i18n.t('error'), i18n.t('cannot_accept_invitation'));
          return;
        }
      } else {
        if (friendRelation.status === 'accepted') {
          Alert.alert(i18n.t('info'), i18n.t('invitation_already_accepted'));
          await loadPendingInvitations();
          return;
        }
      }

      // ✅ UNE SEULE REQUÊTE : Mettre à jour A→B de pending à accepted
      // Le trigger handle_invitation_accept créera automatiquement B→A
      const { error: updateError } = await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .eq('user_id', invitingUserId)
        .eq('friend_id', invitedUserId)
        .eq('method', 'invitation');

      if (updateError) {
        console.error('Erreur lors de la mise à jour de l\'amitié A→B:', updateError);
        Alert.alert(i18n.t('error'), i18n.t('cannot_accept_invitation'));
        return;
      }

      // Étape 4 : Mettre à jour le statut de l'invitation (pour historique)
      const updateData: { status: string; to_user_id: string } = {
        status: 'accepted',
        to_user_id: invitation.to_user_id || user.id,
      };

      await supabase
        .from('invitations')
        .update(updateData)
        .eq('id', invitation.id);

      Alert.alert(i18n.t('success'), i18n.t('invitation_accepted'));
      await loadPendingInvitations();
      
      // Attendre un peu pour que le trigger crée la réciproque
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Naviguer vers la page d'accueil pour que la liste d'amis se recharge
      safeReplace(router, '/(tabs)', { skipInitialCheck: false });
    } catch (error) {
      console.error('Erreur lors de l\'acceptation de l\'invitation:', error);
      Alert.alert(i18n.t('error'), i18n.t('error_occurred'));
    } finally {
      setLoading(false);
    }
  };

  // Rejeter une invitation
  const handleRejectInvitation = async (invitation: PendingInvitation) => {
    Alert.alert(
      i18n.t('confirm'),
      i18n.t('reject_invitation_confirm'),
      [
        {
          text: i18n.t('cancel'),
          style: 'cancel',
        },
        {
          text: i18n.t('reject'),
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);

              const { error } = await supabase
                .from('invitations')
                .update({ status: 'rejected' })
                .eq('id', invitation.id);

              if (error) {
                Alert.alert(i18n.t('error'), i18n.t('cannot_reject_invitation'));
                return;
              }

              Alert.alert(i18n.t('success'), i18n.t('invitation_rejected'));
              
              // Recharger les invitations
              await loadPendingInvitations();
              
              // Recharger les invitations
              await loadPendingInvitations();
            } catch (error) {
              console.error('Erreur lors du rejet de l\'invitation:', error);
              Alert.alert(i18n.t('error'), i18n.t('error_occurred'));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Filtrer les contacts en fonction de la recherche
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) {
      return contacts;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return contacts.filter((contact) =>
      contact.name.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  // Récupérer tous les contacts avec leurs numéros
  const loadContacts = async () => {
    try {
      setLoading(true);

      // Vérifier la permission avec divulgation
      const status = await ensureContactPermissionWithDisclosure();
      if (status !== 'granted') {
        Alert.alert(
          i18n.t('error'),
          i18n.t('contacts_access_required')
        );
        setLoading(false);
        return;
      }

      // Récupérer tous les contacts
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      // Créer une liste de contacts avec leurs numéros
      const contactsList: Contact[] = [];
      
      data.forEach((contact) => {
        const fullName = contact.name || 
                        `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 
                        'Sans nom';
        
        contact.phoneNumbers?.forEach((phoneNumber) => {
          const phone = phoneNumber.number || phoneNumber.digits || '';
          const normalized = normalizePhone(phone);
          
          // Ignorer les numéros trop courts
          if (normalized.length >= 8) {
            contactsList.push({
              id: `${contact.id}-${phoneNumber.id || normalized}`,
              name: fullName,
              phoneNumber: normalized,
            });
          }
        });
      });

      // Trier par nom
      contactsList.sort((a, b) => a.name.localeCompare(b.name));
      
      setContacts(contactsList);
      setShowContactList(true);
      console.log(`📱 ${contactsList.length} contacts chargés`);
    } catch (error) {
      console.error('Erreur lors du chargement des contacts:', error);
      Alert.alert(i18n.t('error'), i18n.t('cannot_load_contacts'));
    } finally {
      setLoading(false);
    }
  };

  const handleInviteFriend = () => {
    loadContacts();
  };

  const handleInviteByValue = async () => {
    if (!inviteValue.trim()) {
      Alert.alert(i18n.t('error'), i18n.t('enter_value'));
      return;
    }

    try {
      setLoading(true);

      // Récupérer l'utilisateur actuel
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        Alert.alert(i18n.t('error'), i18n.t('cannot_retrieve_account'));
        return;
      }

      let invitationData: {
        from_user_id: string;
        to_email?: string;
        to_pseudo?: string;
        to_user_id?: string;
      } = {
        from_user_id: user.id,
      };

      if (inviteMode === 'email') {
        // Normaliser l'email (minuscules, trim)
        const normalizedEmail = inviteValue.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
          Alert.alert(i18n.t('error'), i18n.t('invalid_email_simple'));
          return;
        }

        // Pour l'email, on crée simplement une invitation
        // L'utilisateur devra accepter l'invitation pour créer l'amitié
        // L'email est normalisé pour faciliter la comparaison ultérieure
        invitationData.to_email = normalizedEmail;
      } else if (inviteMode === 'pseudo') {
        // Vérifier si ce pseudo correspond à un utilisateur existant
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('pseudo', inviteValue.trim())
          .single();

        if (profile) {
          // Vérifier d'abord si une relation existe déjà dans les deux sens (A→B et B→A)
          // Vérifier aussi avec une requête séparée pour être sûr de tout voir
          const { data: existingRelations, error: checkError } = await supabase
            .from('friends')
            .select('id, status, method, user_id, friend_id')
            .or(`and(user_id.eq.${user.id},friend_id.eq.${profile.id}),and(user_id.eq.${profile.id},friend_id.eq.${user.id})`);
          
          // 🔍 DEBUG : Vérifier aussi directement dans l'autre sens pour voir s'il y a une invitation en pending
          const { data: reverseCheck, error: reverseError } = await supabase
            .from('friends')
            .select('id, status, method, user_id, friend_id')
            .eq('user_id', profile.id)
            .eq('friend_id', user.id);
          
          console.log('🔍 Vérification inverse (B→A):', reverseCheck);
          if (reverseCheck && reverseCheck.length > 0) {
            console.log('⚠️ ATTENTION : Il y a une relation B→A existante:', reverseCheck[0]);
          }

          if (checkError) {
            console.error('Erreur lors de la vérification de la relation:', checkError);
            Alert.alert(i18n.t('error'), i18n.t('cannot_verify_relation'));
            return;
          }

          // Trouver la relation A→B (où user.id est l'invitant)
          const relationAB = existingRelations?.find(
            (r: any) => r.user_id === user.id && r.friend_id === profile.id
          ) as any;

          // Trouver la relation B→A (où profile.id est l'invitant)
          const relationBA = existingRelations?.find(
            (r: any) => r.user_id === profile.id && r.friend_id === user.id
          ) as any;

          // Si une relation acceptée existe dans l'un ou l'autre sens, c'est déjà un ami
          if (relationAB?.status === 'accepted' || relationBA?.status === 'accepted') {
            Alert.alert(i18n.t('info'), i18n.t('already_friend_info'));
            return;
          }

          // Si une invitation est déjà en pending dans l'un ou l'autre sens
          if (
            (relationAB?.status === 'pending' && relationAB?.method === 'invitation') ||
            (relationBA?.status === 'pending' && relationBA?.method === 'invitation')
          ) {
            Alert.alert(i18n.t('info'), i18n.t('invitation_pending_info'));
            return;
          }

          // Si une relation existe mais n'est pas acceptée, la mettre à jour
          if (relationAB) {
            const { error: updateError } = await supabase
              .from('friends')
              .update({ method: 'invitation', status: 'pending' })
              .eq('id', relationAB.id);

            if (updateError) {
              console.error('Erreur lors de la mise à jour de la relation:', updateError);
              Alert.alert(i18n.t('error'), i18n.t('cannot_create_invitation'));
              return;
            }

            Alert.alert(i18n.t('success'), i18n.t('invitation_sent'));
            setInviteValue('');
            await loadPendingInvitations();
            return;
          }

          // Si une relation B→A existe (par exemple, créée par matching automatique),
          // on ne peut pas créer une invitation A→B car cela créerait un conflit
          if (relationBA) {
            // Si c'est une relation contact, on peut la mettre à jour en invitation
            if (relationBA.method === 'contact' && relationBA.status === 'accepted') {
              // Supprimer la relation B→A et créer A→B en invitation
              const { error: deleteError } = await supabase
                .from('friends')
                .delete()
                .eq('id', relationBA.id);

              if (deleteError) {
                console.error('Erreur lors de la suppression de la relation:', deleteError);
                Alert.alert(i18n.t('error'), i18n.t('cannot_create_invitation'));
                return;
              }
              // Continuer pour créer la nouvelle relation A→B
            } else {
              Alert.alert(i18n.t('info'), i18n.t('relation_exists'));
              return;
            }
          }

          // Aucune relation existante : créer l'amitié en pending dans friends
          // Le trigger handle_friend_creation définira automatiquement status='pending' pour method='invitation'
          console.log('🔍 Tentative de création d\'invitation:', {
            user_id: user.id,
            friend_id: profile.id,
            method: 'invitation',
            existingRelations: existingRelations?.length || 0,
            relationAB: relationAB ? { id: relationAB.id, status: relationAB.status, method: relationAB.method } : null,
            relationBA: relationBA ? { id: relationBA.id, status: relationBA.status, method: relationBA.method } : null,
          } as any);

          // ✅ Créer l'invitation avec UN OBJET PROPRE contenant uniquement les champs nécessaires
          // IMPORTANT : Ne pas utiliser de tableau, utiliser un objet simple
          // Ne pas inclure de champs supplémentaires qui pourraient perturber la requête
          const { error: friendError } = await supabase
            .from('friends')
            .insert({
              user_id: user.id,
              friend_id: profile.id,
              method: 'invitation', // Très important : valeur explicite
              status: 'pending'     // Explicite : même si le trigger le définit, on le spécifie
            });
          
          console.log('🔍 Données envoyées à Supabase:', {
            user_id: user.id,
            friend_id: profile.id,
            method: 'invitation',
            status: 'pending'
          });

          if (friendError) {
            console.error('❌ Erreur lors de la création de l\'amitié en pending:', friendError);
            console.error('Détails de l\'erreur:', {
              code: friendError.code,
              message: friendError.message,
              details: friendError.details,
              hint: friendError.hint,
            });
            
            // Si l'erreur indique qu'une invitation est déjà en pending, afficher un message approprié
            if (friendError.message?.includes('pending invitation') || friendError.message?.includes('Cannot create contact relationship')) {
              // Vérifier à nouveau les relations pour comprendre pourquoi le trigger bloque
              const { data: recheckRelations } = await supabase
                .from('friends')
                .select('id, status, method, user_id, friend_id')
                .or(`and(user_id.eq.${user.id},friend_id.eq.${profile.id}),and(user_id.eq.${profile.id},friend_id.eq.${user.id})`);
              
              console.log('🔍 Relations après erreur:', recheckRelations);
              
              Alert.alert(i18n.t('info'), i18n.t('invitation_pending_info'));
            } else if (friendError.message?.includes('friendship already exists')) {
              Alert.alert(i18n.t('info'), i18n.t('already_friend_info'));
            } else {
              Alert.alert(i18n.t('error'), i18n.t('cannot_create_invitation') + ': ' + (friendError.message || friendError.code));
            }
            return;
          }

          // ✅ Créer aussi une entrée dans la table invitations avec to_user_id pour que B puisse voir l'invitation
          const { error: invitationError } = await supabase
            .from('invitations')
            .insert([
              {
                from_user_id: user.id,
                to_user_id: profile.id,
                to_pseudo: inviteValue.trim(),
                status: 'pending',
              },
            ]);

          if (invitationError) {
            console.error('⚠️ Erreur lors de la création de l\'entrée dans invitations:', invitationError);
            // Ne pas bloquer si l'erreur est due à un doublon
            if (invitationError.code !== '23505') {
              console.warn('L\'invitation a été créée dans friends mais pas dans invitations');
            }
          }

          Alert.alert(i18n.t('success'), i18n.t('invitation_sent'));
          setInviteValue('');
          await loadPendingInvitations();
          return;
        }

        invitationData.to_pseudo = inviteValue.trim();
      }

      // Créer l'invitation
      const { error: inviteError } = await supabase
        .from('invitations')
        .insert([invitationData]);

      if (inviteError) {
        console.error('❌ Erreur lors de la création de l\'invitation:', inviteError);
        console.error('Détails de l\'erreur:', {
          code: inviteError.code,
          message: inviteError.message,
          details: inviteError.details,
          hint: inviteError.hint,
        });
        Alert.alert(i18n.t('error'), i18n.t('cannot_create_invitation') + ': ' + (inviteError.message || inviteError.code));
        return;
      }

      Alert.alert(i18n.t('success'), i18n.t('invitation_sent'));
      setInviteValue('');
      
      // Recharger les invitations
      await loadPendingInvitations();
    } catch (error) {
      console.error('Erreur lors de l\'invitation:', error);
      Alert.alert(i18n.t('error'), i18n.t('error_occurred'));
    } finally {
      setLoading(false);
    }
  };

  const handleContactSelect = async (contact: Contact) => {
    try {
      setLoading(true);

      // Récupérer l'utilisateur actuel
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        Alert.alert(i18n.t('error'), i18n.t('cannot_retrieve_account'));
        return;
      }

      // Vérifier si ce numéro correspond à un utilisateur existant
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('phone', contact.phoneNumber)
        .single();

      if (profile) {
        // Utilisateur existant : créer l'amitié mutuelle via sync_contacts (fonction SQL)
        const normalizedPhone = normalizePhone(contact.phoneNumber);
        if (!normalizedPhone) {
          Alert.alert(i18n.t('error'), i18n.t('invalid_phone'));
          return;
        }

        const { data: matchedFriends, error } = await supabase
          .rpc('sync_contacts', { 
            phones: [normalizedPhone] 
          });

        if (error) {
          console.error('❌ Erreur sync contacts:', error);
          Alert.alert(i18n.t('error'), i18n.t('cannot_create_friendship') + ': ' + (error.message || i18n.t('unknown_error')));
        } else if (matchedFriends && matchedFriends.length > 0) {
          Alert.alert(i18n.t('success'), i18n.t('friendship_created'));
        } else {
          Alert.alert(i18n.t('info'), i18n.t('friend_or_invitation_exists'));
        }
        return;
      }

      // Créer une invitation
      const { error: inviteError } = await supabase
        .from('invitations')
        .insert([
          {
            from_user_id: user.id,
            to_phone: contact.phoneNumber,
          },
        ]);

      if (inviteError) {
        console.error('❌ Erreur lors de la création de l\'invitation (contact):', inviteError);
        console.error('Détails de l\'erreur:', {
          code: inviteError.code,
          message: inviteError.message,
          details: inviteError.details,
          hint: inviteError.hint,
        });
        Alert.alert(i18n.t('error'), i18n.t('cannot_create_invitation') + ': ' + (inviteError.message || inviteError.code));
        return;
      }

      Alert.alert(i18n.t('success'), i18n.t('invitation_sent'));
      
      // Recharger les invitations si on revient à la vue principale
      if (!showContactList) {
        await loadPendingInvitations();
      }
    } catch (error) {
      console.error('Erreur lors de l\'invitation:', error);
      Alert.alert(i18n.t('error'), i18n.t('error_occurred'));
    } finally {
      setLoading(false);
    }
  };

  return (
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

      {!showContactList ? (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Section des invitations en attente */}
          <View style={styles.pendingSection}>
            <Text style={styles.sectionTitle}>{i18n.t('pending_invitations_title')}</Text>
            
            {loadingInvitations ? (
              <Text style={styles.loadingText}>{i18n.t('loading_invitations')}</Text>
            ) : pendingInvitations.length > 0 ? (
              pendingInvitations.map((invitation) => (
                <View key={invitation.id} style={styles.invitationItem}>
                  <View style={styles.invitationInfo}>
                    <Text style={styles.invitationFrom}>
                      {invitation.from_user_pseudo || i18n.t('unknown_user')} {i18n.t('invited_you')}
                    </Text>
                    {invitation.to_email && (
                      <Text style={styles.invitationDetail}>{i18n.t('email')}: {invitation.to_email}</Text>
                    )}
                    {invitation.to_pseudo && (
                      <Text style={styles.invitationDetail}>{i18n.t('pseudo')}: {invitation.to_pseudo}</Text>
                    )}
                    {invitation.to_phone && (
                      <Text style={styles.invitationDetail}>{i18n.t('phone')}: {invitation.to_phone}</Text>
                    )}
                  </View>
                  <View style={styles.invitationActions}>
                    <CustomButton
                      title={i18n.t('accept')}
                      onPress={() => handleAcceptInvitation(invitation)}
                      textColor="#fff"
                      color="#4CAF50"
                      small
                      disabled={loading}
                    />
                    <CustomButton
                      title={i18n.t('reject')}
                      onPress={() => handleRejectInvitation(invitation)}
                      textColor="#fff"
                      color="#f44336"
                      small
                      disabled={loading}
                    />
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noInvitationsText}>{i18n.t('no_pending_invitations')}</Text>
            )}
          </View>

          <View style={styles.separator} />

          <Text style={styles.sectionTitle}>Inviter par :</Text>
          
          <View style={styles.modeSelector}>
            <CustomButton
              title="Pseudo"
              onPress={() => setInviteMode('pseudo')}
              textColor={inviteMode === 'pseudo' ? '#fff' : '#604a3e'}
              color={inviteMode === 'pseudo' ? '#604a3e' : '#fff'}
              small
            />
            <CustomButton
              title="Email"
              onPress={() => setInviteMode('email')}
              textColor={inviteMode === 'email' ? '#fff' : '#604a3e'}
              color={inviteMode === 'email' ? '#604a3e' : '#fff'}
              small
            />
          </View>

          <TextInput
            placeholder={
              inviteMode === 'email'
                ? 'Entrez un email'
                : 'Entrez un pseudo'
            }
            value={inviteValue}
            onChangeText={setInviteValue}
            keyboardType={inviteMode === 'email' ? 'email-address' : 'default'}
            autoCapitalize="none"
            style={styles.input}
          />

          <CustomButton
            title={loading ? 'Envoi...' : 'Inviter'}
            onPress={handleInviteByValue}
            textColor="#604a3e"
            disabled={loading}
            loading={loading}
          />

          <CustomButton
            title={loading ? i18n.t('loading') : i18n.t('invite_from_contacts')}
            onPress={handleInviteFriend}
            textColor="#604a3e"
            disabled={loading}
            loading={loading}
          />
          
          <CustomButton
            title="Retour"
            onPress={() => safeReplace(router, '/(tabs)', { skipInitialCheck: false })}
            textColor="#604a3e"
          />
        </ScrollView>
      ) : (
        <View style={styles.contactListContainer}>
          <Text style={styles.contactListTitle}>{i18n.t('select_contact')}</Text>
          
          {filteredContacts.length === 0 && contacts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{i18n.t('no_contact_found')}</Text>
            </View>
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={
                <TextInput
                  style={styles.searchInput}
                  placeholder={i18n.t('search_contact_placeholder')}
                  placeholderTextColor="#999"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{i18n.t('no_contact_found')}</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.contactItem}
                  onPress={() => handleContactSelect(item)}
                >
                  <Text style={styles.contactName}>{item.name}</Text>
                  <Text style={styles.contactPhone}>{item.phoneNumber}</Text>
                </TouchableOpacity>
              )}
              style={styles.contactList}
            />
          )}
          
          <CustomButton
            title="Retour"
            onPress={() => {
              setShowContactList(false);
              setContacts([]);
              setSearchQuery('');
            }}
            textColor="#604a3e"
            small
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 0,
    backgroundColor: '#ebb89b',
  },
  header: {
    alignItems: 'center',
    marginBottom: 0,
    marginTop: 20,
  },
  headerImage: {
    width: 280,
    height: 210,
    marginBottom: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  pendingSection: {
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  invitationItem: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  invitationInfo: {
    marginBottom: 10,
  },
  invitationFrom: {
    fontSize: 16,
    fontWeight: '600',
    color: '#604a3e',
    marginBottom: 5,
  },
  invitationDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  invitationActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#604a3e',
    textAlign: 'center',
    marginBottom: 20,
  },
  noInvitationsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  separator: {
    height: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#604a3e',
    marginBottom: 15,
    textAlign: 'center',
  },
  modeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#d2f1ef',
    color: '#604a3e',
  },
  contactListContainer: {
    flex: 1,
    marginTop: 20,
  },
  contactListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#604a3e',
    marginBottom: 15,
    textAlign: 'center',
  },
  searchInput: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#d2f1ef',
    color: '#604a3e',
  },
  contactList: {
    flex: 1,
  },
  contactItem: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d2f1ef',
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#604a3e',
    marginBottom: 5,
  },
  contactPhone: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#604a3e',
  },
});
