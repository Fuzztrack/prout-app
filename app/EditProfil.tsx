// app/EditProfil.tsx - Page de modification du profil
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { normalizePhone } from '../lib/normalizePhone';
import { safePush, safeReplace } from '../lib/navigation';
import { supabase } from '../lib/supabase';

export default function EditProfilScreen() {
  const router = useRouter();
  const [pseudo, setPseudo] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentPseudo, setCurrentPseudo] = useState<string>('');
  const [currentEmail, setCurrentEmail] = useState<string>('');
  const [currentPhone, setCurrentPhone] = useState<string>('');

  // Fonction pour gérer les erreurs Supabase
  const handleSupabaseError = (error: any, defaultMessage: string) => {
    console.error('Erreur Supabase:', error);
    if (error?.message?.includes('network') || 
        error?.message?.includes('fetch') || 
        error?.code === 'PGRST116' || 
        error?.code === 'PGRST301') {
      Alert.alert('Erreur', 'Problème de connexion, vérifiez votre réseau');
    } else {
      Alert.alert('Erreur', defaultMessage);
    }
  };

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
        setCurrentPseudo(profile.pseudo || '');
        // Normaliser l'email (trim + lowercase) pour l'affichage
        const normalizedEmail = user.email?.trim().toLowerCase() || '';
        setEmail(normalizedEmail);
        setCurrentEmail(normalizedEmail);
        setPhone(profile.phone || '');
        setCurrentPhone(profile.phone || '');
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

  // Fonction pour mettre à jour tous les champs modifiés
  const handleUpdateAll = async () => {
    if (!userId) {
      Alert.alert('Erreur', 'Impossible d\'identifier votre compte');
      return;
    }

    // Vérifier s'il y a des changements
    const trimmedPseudo = pseudo.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim() ? normalizePhone(phone.trim()) : null;
    const normalizedCurrentPhone = normalizePhone(currentPhone);

    const pseudoChanged = trimmedPseudo !== currentPseudo && trimmedPseudo !== '';
    const emailChanged = trimmedEmail !== currentEmail?.toLowerCase().trim() && trimmedEmail !== '';
    const phoneChanged = normalizedPhone !== normalizedCurrentPhone;

    if (!pseudoChanged && !emailChanged && !phoneChanged) {
      Alert.alert('Information', 'Aucun changement détecté');
      return;
    }

    // Valider les champs modifiés
    if (pseudoChanged) {
      if (!trimmedPseudo) {
        Alert.alert('Erreur', 'Le pseudo ne peut pas être vide');
        return;
      }
    }

    if (emailChanged) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        Alert.alert('Erreur', 'Veuillez entrer un email valide');
        return;
      }
      if (trimmedEmail.includes('@temp.proutapp.local')) {
        Alert.alert('Erreur', 'Veuillez entrer un email réel valide (pas un email temporaire)');
        return;
      }
    }

    if (phoneChanged && normalizedPhone && normalizedPhone.length < 8) {
      Alert.alert('Erreur', 'Le numéro de téléphone doit contenir au moins 8 chiffres');
      return;
    }

    // Vérifier l'unicité du pseudo si modifié
    if (pseudoChanged) {
      const { data: existingProfile, error: checkError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('pseudo', trimmedPseudo)
        .neq('id', userId)
        .maybeSingle();

      if (checkError) {
        Alert.alert('Erreur', 'Impossible de vérifier la disponibilité du pseudo');
        return;
      }

      if (existingProfile) {
        Alert.alert('Erreur', 'Ce pseudo est déjà utilisé par un autre utilisateur');
        return;
      }
    }

    setLoading(true);
    try {
      const updates: any = {};
      const messages: string[] = [];

      // Mettre à jour le pseudo si modifié
      if (pseudoChanged) {
        updates.pseudo = trimmedPseudo;
        messages.push('pseudo');
      }

      // Mettre à jour le téléphone si modifié
      if (phoneChanged) {
        updates.phone = normalizedPhone;
        messages.push('téléphone');
      }

      // Mettre à jour le profil si nécessaire
      if (Object.keys(updates).length > 0) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update(updates)
          .eq('id', userId);

        if (profileError) {
          if (profileError.code === '23505' || profileError.message?.includes('unique')) {
            Alert.alert('Erreur', 'Ce pseudo est déjà utilisé par un autre utilisateur');
            setLoading(false);
            return;
          }
          throw profileError;
        }

        // Mettre à jour les états locaux
        if (pseudoChanged) {
          setCurrentPseudo(trimmedPseudo);
          setPseudo(trimmedPseudo);
        }
        if (phoneChanged) {
          setCurrentPhone(normalizedPhone || '');
          setPhone(normalizedPhone || '');
        }
      }

      // Mettre à jour l'email si modifié (nécessite une mise à jour dans auth.users)
      if (emailChanged) {
        const { error: updateError } = await supabase.auth.updateUser({
          email: trimmedEmail,
        });

        if (updateError) {
          if (updateError.message?.includes('already registered')) {
            Alert.alert('Erreur', 'Cet email est déjà utilisé par un autre compte');
            setLoading(false);
            return;
          }
          throw updateError;
        }

        setCurrentEmail(trimmedEmail);
        setEmail(trimmedEmail);
        messages.push('email');
      }

      // Afficher le message de succès
      const isCurrentEmailTemporary = currentEmail?.includes('@temp.proutapp.local');
      const successMessage = messages.length > 0
        ? `${messages.join(', ')} mis${messages.length > 1 ? 's' : ''} à jour avec succès${emailChanged && isCurrentEmailTemporary ? ' ! Un email de confirmation a été envoyé.' : ' !'}`
        : 'Aucun changement';

      Alert.alert('Succès', successMessage, [
        {
          text: 'OK',
          onPress: () => safeReplace(router, '/Profil', { skipInitialCheck: false }),
        },
      ]);
    } catch (err) {
      console.error('Erreur lors de la mise à jour:', err);
      if (err instanceof Error) {
        if (err.message.includes('network') || err.message.includes('fetch')) {
          Alert.alert('Erreur', 'Problème de connexion, vérifiez votre réseau');
        } else {
          handleSupabaseError(err, 'Impossible de mettre à jour le profil');
        }
      } else {
        Alert.alert('Erreur', 'Une erreur est survenue');
      }
    } finally {
      setLoading(false);
    }
  };

  // Mettre à jour le pseudo avec confirmation (fonction conservée pour compatibilité mais non utilisée)
  const updatePseudo = async () => {
    if (!pseudo || !userId) {
      Alert.alert('Erreur', 'Veuillez entrer un nouveau pseudo');
      return;
    }

    const trimmedPseudo = pseudo.trim();

    // Vérifier que le pseudo n'est pas vide après trim
    if (!trimmedPseudo) {
      Alert.alert('Erreur', 'Le pseudo ne peut pas être vide');
      return;
    }

    if (trimmedPseudo === currentPseudo) {
      Alert.alert('Information', 'Le pseudo est identique à l\'actuel');
      return;
    }

    // ✅ VÉRIFIER L'UNICITÉ AVANT LA MISE À JOUR
    setLoading(true);
    try {
      // Vérifier si le pseudo existe déjà (sauf pour l'utilisateur actuel)
      const { data: existingProfile, error: checkError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('pseudo', trimmedPseudo)
        .neq('id', userId)
        .maybeSingle();

      if (checkError) {
        console.error('Erreur lors de la vérification du pseudo:', checkError);
        Alert.alert('Erreur', 'Impossible de vérifier la disponibilité du pseudo');
        setLoading(false);
        return;
      }

      if (existingProfile) {
        Alert.alert('Erreur', 'Ce pseudo est déjà utilisé par un autre utilisateur');
        setLoading(false);
        return;
      }

      // Le pseudo est disponible, demander confirmation
      Alert.alert(
        'Confirmer',
        `Voulez-vous changer votre pseudo de "${currentPseudo}" à "${trimmedPseudo}" ?`,
        [
          {
            text: 'Annuler',
            style: 'cancel',
            onPress: () => {
              setLoading(false);
            },
          },
          {
            text: 'Confirmer',
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from('user_profiles')
                  .update({ pseudo: trimmedPseudo })
                  .eq('id', userId);

                if (error) {
                  // Gérer spécifiquement l'erreur de contrainte unique
                  if (error.code === '23505' || error.message?.includes('unique') || error.message?.includes('duplicate')) {
                    Alert.alert('Erreur', 'Ce pseudo est déjà utilisé par un autre utilisateur');
                  } else {
                    handleSupabaseError(error, 'Impossible de mettre à jour le pseudo');
                  }
                } else {
                  setCurrentPseudo(trimmedPseudo);
                  setPseudo(trimmedPseudo);
                  try {
                    await supabase.auth.updateUser({
                      data: { pseudo: trimmedPseudo, pseudo_validated: true },
                    });
                  } catch (metaError) {
                    console.warn('⚠️ Impossible de mettre à jour les métadonnées pseudo:', metaError);
                  }
                  Alert.alert('Succès', 'Pseudo mis à jour avec succès !');
                  // Recharger les données après la mise à jour
                  safeReplace(router, '/Profil', { skipInitialCheck: false });
                }
              } catch (err) {
                console.error('Erreur inattendue:', err);
                if (err instanceof Error && (err.message.includes('network') || err.message.includes('fetch'))) {
                  Alert.alert('Erreur', 'Problème de connexion, vérifiez votre réseau');
                } else {
                  Alert.alert('Erreur', 'Une erreur est survenue');
                }
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      );
    } catch (err) {
      console.error('Erreur lors de la vérification du pseudo:', err);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la vérification');
      setLoading(false);
    }
  };

  // Mettre à jour l'email avec confirmation
  const updateEmail = async () => {
    if (!email || !userId) {
      Alert.alert('Erreur', 'Veuillez entrer un nouvel email');
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Valider le format de l'email (doit être un email valide, pas un email temporaire)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert('Erreur', 'Veuillez entrer un email valide');
      return;
    }

    // Vérifier que ce n'est pas un email temporaire
    if (trimmedEmail.includes('@temp.proutapp.local')) {
      Alert.alert('Erreur', 'Veuillez entrer un email réel valide (pas un email temporaire)');
      return;
    }

    // Normaliser l'email actuel pour la comparaison
    const normalizedCurrentEmail = currentEmail?.toLowerCase().trim() || '';

    if (trimmedEmail === normalizedCurrentEmail) {
      Alert.alert('Information', 'L\'email est identique à l\'actuel');
      return;
    }

    // Afficher un message différent si l'email actuel est temporaire
    const isCurrentEmailTemporary = normalizedCurrentEmail.includes('@temp.proutapp.local');
    const confirmationMessage = isCurrentEmailTemporary
      ? `Voulez-vous définir votre email à "${trimmedEmail}" ?\n\nActuellement, vous utilisez un email temporaire.`
      : `Voulez-vous changer votre email de "${currentEmail}" à "${trimmedEmail}" ?`;

    // Demander confirmation
    Alert.alert(
      'Confirmer',
      confirmationMessage,
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Confirmer',
          onPress: async () => {
            setLoading(true);
            try {
              // Mettre à jour l'email dans auth.users
              const { error: updateError } = await supabase.auth.updateUser({
                email: trimmedEmail,
              });

              if (updateError) {
                // Gérer spécifiquement l'erreur d'email invalide
                if (updateError.message?.includes('invalid') || updateError.message?.includes('Email address')) {
                  Alert.alert(
                    'Erreur',
                    'L\'email que vous avez entré n\'est pas valide. Veuillez utiliser un email réel (ex: nom@example.com)'
                  );
                } else if (updateError.message?.includes('already registered')) {
                  Alert.alert('Erreur', 'Cet email est déjà utilisé par un autre compte');
                } else {
                  handleSupabaseError(updateError, 'Impossible de mettre à jour l\'email');
                }
              } else {
                setCurrentEmail(trimmedEmail);
                Alert.alert(
                  'Succès',
                  isCurrentEmailTemporary
                    ? 'Email défini avec succès ! Un email de confirmation a été envoyé.'
                    : 'Email mis à jour avec succès ! Un email de confirmation a été envoyé.'
                );
                // Recharger les données après la mise à jour
                safeReplace(router, '/Profil', { skipInitialCheck: false });
              }
            } catch (err) {
              console.error('Erreur inattendue:', err);
              if (err instanceof Error) {
                if (err.message.includes('network') || err.message.includes('fetch')) {
                  Alert.alert('Erreur', 'Problème de connexion, vérifiez votre réseau');
                } else if (err.message.includes('invalid') || err.message.includes('Email')) {
                  Alert.alert(
                    'Erreur',
                    'L\'email que vous avez entré n\'est pas valide. Veuillez utiliser un email réel.'
                  );
                } else {
                  Alert.alert('Erreur', 'Une erreur est survenue');
                }
              } else {
                Alert.alert('Erreur', 'Une erreur est survenue');
              }
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Mettre à jour le numéro de téléphone avec confirmation
  const updatePhone = async () => {
    if (!phone || !userId) {
      Alert.alert('Erreur', 'Veuillez entrer un nouveau numéro de téléphone');
      return;
    }

    // Normaliser le numéro
    const normalizedPhone = normalizePhone(phone);
    const normalizedCurrentPhone = normalizePhone(currentPhone);

    if (normalizedPhone === normalizedCurrentPhone) {
      Alert.alert('Information', 'Le numéro de téléphone est identique à l\'actuel');
      return;
    }

    // Vérifier que le numéro est valide (au moins 8 chiffres)
    if (normalizedPhone.length < 8) {
      Alert.alert('Erreur', 'Le numéro de téléphone doit contenir au moins 8 chiffres');
      return;
    }

    // Demander confirmation
    Alert.alert(
      'Confirmer',
      `Voulez-vous changer votre numéro de téléphone de "${currentPhone}" à "${phone}" ?`,
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Confirmer',
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase
                .from('user_profiles')
                .update({ phone: normalizedPhone })
                .eq('id', userId);

              if (error) {
                handleSupabaseError(error, 'Impossible de mettre à jour le numéro de téléphone');
              } else {
                setCurrentPhone(normalizedPhone);
                setPhone(normalizedPhone);
                Alert.alert('Succès', 'Numéro de téléphone mis à jour avec succès !');
                // Recharger les données après la mise à jour
                safeReplace(router, '/Profil', { skipInitialCheck: false });
              }
            } catch (err) {
              console.error('Erreur inattendue:', err);
              if (err instanceof Error && (err.message.includes('network') || err.message.includes('fetch'))) {
                Alert.alert('Erreur', 'Problème de connexion, vérifiez votre réseau');
              } else {
                Alert.alert('Erreur', 'Une erreur est survenue');
              }
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Supprimer le compte
  const unsubscribe = async () => {
    if (!userId) {
      Alert.alert('Erreur', 'Impossible d\'identifier votre compte');
      return;
    }

    Alert.alert(
      'Confirmer',
      'Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // Appeler la fonction RPC pour supprimer complètement le compte
              // Cette fonction supprime à la fois auth.users et user_profiles
              const { error: deleteError } = await supabase.rpc('delete_user_account');

              if (deleteError) {
                console.error('Erreur lors de la suppression du compte:', deleteError);
                Alert.alert('Erreur', 'Impossible de supprimer le compte. Veuillez contacter le support.');
                return;
              }

              // Déconnecter l'utilisateur (même si le compte est déjà supprimé)
              await supabase.auth.signOut();

              Alert.alert('Compte supprimé', 'Votre compte a été supprimé avec succès.', [
                {
                  text: 'OK',
                  onPress: () => {
                    safeReplace(router, '/AuthChoiceScreen');
                  },
                },
              ]);
            } catch (err) {
              console.error('Erreur inattendue:', err);
              Alert.alert('Erreur', 'Une erreur est survenue lors de la suppression du compte');
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
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scrollContainer}>
          <View style={styles.container}>
            <Text style={styles.title}>Modifier votre profil</Text>
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
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
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

          <Text style={styles.title}>Modifier votre profil</Text>

          <View style={styles.section}>
            <TextInput 
              placeholder="Pseudo" 
              value={pseudo} 
              onChangeText={setPseudo} 
              style={styles.input}
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.section}>
            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.section}>
            <TextInput
              placeholder="Téléphone"
              value={phone}
              onChangeText={setPhone}
              style={styles.input}
              keyboardType="phone-pad"
              placeholderTextColor="#999"
            />
          </View>

          {/* Bouton unique de mise à jour */}
          <TouchableOpacity 
            style={styles.updateAllButton} 
            onPress={handleUpdateAll}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ebb89b" />
            ) : (
              <>
                <Ionicons name="checkmark-outline" size={24} color="#ebb89b" />
                <Text style={styles.updateAllText}>Mise à jour</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.spacer} />

          <View style={styles.bottomSection}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#604a3e" />
              <Text style={styles.backText}>Retour</Text>
            </TouchableOpacity>
            
            <View style={styles.deleteButtonContainer}>
              <TouchableOpacity 
                style={styles.deleteButton} 
                onPress={unsubscribe} 
                disabled={loading}
              >
                <Ionicons name="trash-outline" size={24} color="#ff4444" />
                <Text style={styles.deleteText}>Supprimer votre compte</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  container: { flex: 1, padding: 20, paddingTop: 20, paddingBottom: 100, backgroundColor: '#ebb89b' },
  header: { alignItems: 'center', marginBottom: 20 },
  headerImage: { width: 180, height: 140, marginBottom: 10 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#604a3e' },
  section: { marginBottom: 20 },
  input: { 
    backgroundColor: '#fff', 
    padding: 15, 
    marginBottom: 15, 
    borderRadius: 10, 
    color: '#333',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.2)'
  },
  updateAllButton: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: '#604a3e', 
    padding: 15, 
    borderRadius: 15,
    marginTop: 10,
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(96, 74, 62, 0.2)'
  },
  updateAllText: { color: '#ebb89b', fontWeight: 'bold', fontSize: 18, marginLeft: 10 },
  separator: { height: 20 },
  spacer: { flex: 1 },
  deleteButtonContainer: { marginTop: 10 },
  bottomSection: { marginBottom: 20 },
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
  deleteButton: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)', 
    padding: 15, 
    borderRadius: 15,
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 68, 68, 0.3)'
  },
  deleteText: { color: '#ff4444', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 18, color: '#604a3e' },
});

