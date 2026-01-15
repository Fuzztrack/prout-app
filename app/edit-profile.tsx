// app/EditProfil.tsx - Page de modification du profil
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { safePush, safeReplace } from '../lib/navigation';
import { normalizePhone } from '../lib/normalizePhone';
import { supabase } from '../lib/supabase';
import i18n from '../lib/i18n';

export default function EditProfilScreen() {
  const router = useRouter();
  // Configuration explicite de la modale transparente
  const stackOptions = {
    presentation: 'transparentModal' as const,
    animation: 'fade' as const,
    headerShown: false,
    contentStyle: { backgroundColor: 'transparent' }, // Important pour éviter le fond blanc par défaut
  };
  
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
      Alert.alert(i18n.t('error'), i18n.t('connection_error_body'));
    } else {
      Alert.alert(i18n.t('error'), defaultMessage);
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
          Alert.alert(i18n.t('error'), i18n.t('cannot_retrieve_account'));
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
          Alert.alert(i18n.t('error'), i18n.t('cannot_load_profile'));
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
          Alert.alert(i18n.t('error'), i18n.t('connection_error_body'));
        } else {
          Alert.alert(i18n.t('error'), i18n.t('cannot_load_profile'));
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
      Alert.alert(i18n.t('error'), i18n.t('cannot_identify_account'));
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
      Alert.alert(i18n.t('info'), i18n.t('no_change'));
      return;
    }

    // Valider les champs modifiés
    if (pseudoChanged) {
      if (!trimmedPseudo) {
        Alert.alert(i18n.t('error'), i18n.t('cannot_be_empty'));
        return;
      }
    }

    if (emailChanged) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        Alert.alert(i18n.t('error'), i18n.t('invalid_email_format'));
        return;
      }
      if (trimmedEmail.includes('@temp.proutapp.local')) {
        Alert.alert(i18n.t('error'), i18n.t('invalid_email'));
        return;
      }
    }

    if (phoneChanged && normalizedPhone && normalizedPhone.length < 8) {
      Alert.alert(i18n.t('error'), i18n.t('phone_min_digits'));
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
        Alert.alert(i18n.t('error'), i18n.t('cannot_check_pseudo'));
        return;
      }

      if (existingProfile) {
        Alert.alert(i18n.t('error'), i18n.t('pseudo_already_used'));
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
        messages.push(i18n.t('pseudo'));
      }

      // Mettre à jour le téléphone si modifié
      if (phoneChanged) {
        updates.phone = normalizedPhone;
        messages.push(i18n.t('phone'));
      }

      // Mettre à jour le profil si nécessaire
      if (Object.keys(updates).length > 0) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update(updates)
          .eq('id', userId);

        if (profileError) {
          if (profileError.code === '23505' || profileError.message?.includes('unique')) {
            Alert.alert(i18n.t('error'), i18n.t('pseudo_already_used'));
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
            Alert.alert(i18n.t('error'), i18n.t('email_already_used'));
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
        ? i18n.t('fields_updated_success', { fields: messages.join(', ') }) + (emailChanged && isCurrentEmailTemporary ? ' ' + i18n.t('email_confirmation_sent') : '')
        : i18n.t('no_change');

      Alert.alert(i18n.t('success'), successMessage, [
        {
          text: 'OK',
          onPress: () => safeReplace(router, '/Profil', { skipInitialCheck: false }),
        },
      ]);
    } catch (err) {
      console.error('Erreur lors de la mise à jour:', err);
      if (err instanceof Error) {
        if (err.message.includes('network') || err.message.includes('fetch')) {
          Alert.alert(i18n.t('error'), i18n.t('connection_error_body'));
        } else {
          handleSupabaseError(err, 'Impossible de mettre à jour le profil');
        }
      } else {
        Alert.alert(i18n.t('error'), i18n.t('error_occurred'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Mettre à jour le pseudo avec confirmation (fonction conservée pour compatibilité mais non utilisée)
  const updatePseudo = async () => {
    if (!pseudo || !userId) {
      Alert.alert(i18n.t('error'), i18n.t('enter_new_pseudo'));
      return;
    }

    const trimmedPseudo = pseudo.trim();

    // Vérifier que le pseudo n'est pas vide après trim
    if (!trimmedPseudo) {
      Alert.alert(i18n.t('error'), i18n.t('cannot_be_empty'));
      return;
    }

    if (trimmedPseudo === currentPseudo) {
      Alert.alert(i18n.t('info'), i18n.t('pseudo_identical'));
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
        Alert.alert(i18n.t('error'), i18n.t('cannot_check_pseudo'));
        setLoading(false);
        return;
      }

      if (existingProfile) {
        Alert.alert(i18n.t('error'), i18n.t('pseudo_already_used'));
        setLoading(false);
        return;
      }

      // Le pseudo est disponible, demander confirmation
      Alert.alert(
        i18n.t('confirm'),
        i18n.t('change_pseudo_confirm', { current: currentPseudo, new: trimmedPseudo }),
        [
          {
            text: i18n.t('cancel'),
            style: 'cancel',
            onPress: () => {
              setLoading(false);
            },
          },
          {
            text: i18n.t('confirm'),
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from('user_profiles')
                  .update({ pseudo: trimmedPseudo })
                  .eq('id', userId);

                if (error) {
                  // Gérer spécifiquement l'erreur de contrainte unique
                  if (error.code === '23505' || error.message?.includes('unique') || error.message?.includes('duplicate')) {
                    Alert.alert(i18n.t('error'), i18n.t('pseudo_already_used'));
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
                  Alert.alert(i18n.t('success'), i18n.t('pseudo_updated_success'));
                  // Recharger les données après la mise à jour
                  safeReplace(router, '/Profil', { skipInitialCheck: false });
                }
              } catch (err) {
                console.error('Erreur inattendue:', err);
                if (err instanceof Error && (err.message.includes('network') || err.message.includes('fetch'))) {
                  Alert.alert(i18n.t('error'), i18n.t('connection_error_body'));
                } else {
                  Alert.alert(i18n.t('error'), i18n.t('error_occurred'));
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
      Alert.alert(i18n.t('error'), i18n.t('verification_error'));
      setLoading(false);
    }
  };

  // Mettre à jour l'email avec confirmation
  const updateEmail = async () => {
    if (!email || !userId) {
      Alert.alert(i18n.t('error'), i18n.t('enter_new_email'));
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Valider le format de l'email (doit être un email valide, pas un email temporaire)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert(i18n.t('error'), i18n.t('invalid_email_format'));
      return;
    }

    // Vérifier que ce n'est pas un email temporaire
    if (trimmedEmail.includes('@temp.proutapp.local')) {
      Alert.alert(i18n.t('error'), i18n.t('invalid_email'));
      return;
    }

    // Normaliser l'email actuel pour la comparaison
    const normalizedCurrentEmail = currentEmail?.toLowerCase().trim() || '';

    if (trimmedEmail === normalizedCurrentEmail) {
      Alert.alert(i18n.t('info'), i18n.t('email_identical'));
      return;
    }

    // Afficher un message différent si l'email actuel est temporaire
    const isCurrentEmailTemporary = normalizedCurrentEmail.includes('@temp.proutapp.local');
    const confirmationMessage = isCurrentEmailTemporary
      ? i18n.t('set_email_confirm', { email: trimmedEmail })
      : i18n.t('change_email_confirm', { current: currentEmail, new: trimmedEmail });

    // Demander confirmation
    Alert.alert(
      i18n.t('confirm'),
      confirmationMessage,
      [
        {
          text: i18n.t('cancel'),
          style: 'cancel',
        },
        {
          text: i18n.t('confirm'),
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
                    i18n.t('error'),
                    i18n.t('invalid_email_format')
                  );
                } else if (updateError.message?.includes('already registered')) {
                  Alert.alert(i18n.t('error'), i18n.t('email_already_used'));
                } else {
                  handleSupabaseError(updateError, 'Impossible de mettre à jour l\'email');
                }
              } else {
                setCurrentEmail(trimmedEmail);
                Alert.alert(
                  i18n.t('success'),
                  i18n.t('fields_updated_success', { fields: i18n.t('email') }) + ' ' + i18n.t('email_confirmation_sent')
                );
                // Recharger les données après la mise à jour
                safeReplace(router, '/Profil', { skipInitialCheck: false });
              }
            } catch (err) {
              console.error('Erreur inattendue:', err);
              if (err instanceof Error) {
                if (err.message.includes('network') || err.message.includes('fetch')) {
                  Alert.alert(i18n.t('error'), i18n.t('connection_error_body'));
                } else if (err.message.includes('invalid') || err.message.includes('Email')) {
                  Alert.alert(
                    i18n.t('error'),
                    i18n.t('invalid_email')
                  );
                } else {
                  Alert.alert(i18n.t('error'), i18n.t('error_occurred'));
                }
              } else {
                Alert.alert(i18n.t('error'), i18n.t('error_occurred'));
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
      Alert.alert(i18n.t('error'), i18n.t('enter_new_phone'));
      return;
    }

    // Normaliser le numéro
    const normalizedPhone = normalizePhone(phone);
    const normalizedCurrentPhone = normalizePhone(currentPhone);

    if (normalizedPhone === normalizedCurrentPhone) {
      Alert.alert(i18n.t('info'), i18n.t('phone_identical'));
      return;
    }

    // Vérifier que le numéro est valide (au moins 8 chiffres)
    if (normalizedPhone.length < 8) {
      Alert.alert(i18n.t('error'), i18n.t('phone_min_digits'));
      return;
    }

    // Demander confirmation
    Alert.alert(
      i18n.t('confirm'),
      i18n.t('change_phone_confirm', { current: currentPhone, new: phone }),
      [
        {
          text: i18n.t('cancel'),
          style: 'cancel',
        },
        {
          text: i18n.t('confirm'),
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
                Alert.alert(i18n.t('success'), i18n.t('phone_updated_success'));
                // Recharger les données après la mise à jour
                safeReplace(router, '/Profil', { skipInitialCheck: false });
              }
            } catch (err) {
              console.error('Erreur inattendue:', err);
              if (err instanceof Error && (err.message.includes('network') || err.message.includes('fetch'))) {
                Alert.alert(i18n.t('error'), i18n.t('connection_error_body'));
              } else {
                Alert.alert(i18n.t('error'), i18n.t('error_occurred'));
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
      Alert.alert(i18n.t('error'), i18n.t('cannot_identify_account'));
      return;
    }

    Alert.alert(
      i18n.t('delete_account_confirm_title'),
      i18n.t('delete_account_confirm_body'),
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
                Alert.alert(i18n.t('error'), i18n.t('cannot_delete_account_support'));
                return;
              }

              // Déconnecter l'utilisateur (même si le compte est déjà supprimé)
              await supabase.auth.signOut();

              Alert.alert(i18n.t('account_deleted_title'), i18n.t('account_deleted_success'), [
                {
                  text: i18n.t('ok'),
                  onPress: () => {
                    safeReplace(router, '/AuthChoiceScreen');
                  },
                },
              ]);
            } catch (err) {
              console.error('Erreur inattendue:', err);
              Alert.alert(i18n.t('error'), i18n.t('error_occurred_deletion'));
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
      <>
        <Stack.Screen options={stackOptions} />
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Modifier votre profil</Text>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#604a3e" />
            </TouchableOpacity>
          </View>
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#604a3e" />
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
    );
  }

  return (
    <>
      <Stack.Screen options={stackOptions} />
      <KeyboardAvoidingView 
        style={styles.modalOverlay}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={styles.modalContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Modifier votre profil</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#604a3e" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          
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
              placeholder={i18n.t('phone_placeholder')}
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
                <Text style={styles.updateAllText}>{i18n.t('update_button')}</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.spacer} />

          <View style={styles.bottomSection}>
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
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
    paddingTop: 50,
    paddingBottom: 50,
  },
  modalContent: {
    backgroundColor: '#ebb89b',
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'column',
    maxHeight: '90%',
    width: '100%',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(96, 74, 62, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    height: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#604a3e',
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  scrollContainer: { flex: 1 },
  scrollContent: { 
    padding: 20, 
    flexGrow: 1,
  },
  section: { marginBottom: 15 },
  input: { 
    backgroundColor: '#fff', 
    padding: 15, 
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
  spacer: { flex: 1, minHeight: 20 },
  deleteButtonContainer: { marginTop: 10 },
  bottomSection: { marginBottom: 10 },
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
    borderWidth: 1, 
    borderColor: 'rgba(255, 68, 68, 0.3)'
  },
  deleteText: { color: '#ff4444', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 18, color: '#604a3e' },
});

