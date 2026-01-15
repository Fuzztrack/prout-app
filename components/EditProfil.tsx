import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { normalizePhone } from '../lib/normalizePhone';
import { useRouter } from 'expo-router';
import { safeReplace } from '../lib/navigation';
import i18n from '../lib/i18n';

export function EditProfil({ onClose }: { onClose: () => void }) {
  const router = useRouter(); // Toujours nécessaire pour la déconnexion
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
          onClose();
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
          Alert.alert(i18n.t('error'), 'Impossible de charger votre profil');
          onClose();
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
          Alert.alert(i18n.t('error'), 'Impossible de charger votre profil');
        }
        onClose();
      } finally {
        setLoading(false);
      }
    };

    loadCurrentUser();
  }, []);

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
        Alert.alert(i18n.t('error'), 'Veuillez entrer un email valide');
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
        messages.push('pseudo');
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
      const successMessage = i18n.t('update_success_msg', { fields: messages.join(', ') });
      // TODO: Adapter le message si email temporaire/confirmation (non traduit ici pour simplifier)

      Alert.alert(i18n.t('update_success'), successMessage, [
        {
          text: i18n.t('ok'),
          onPress: onClose, // Fermer après succès
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
        Alert.alert(i18n.t('error'), i18n.t('error'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Supprimer le compte
  const unsubscribe = async () => {
    if (!userId) {
      Alert.alert(i18n.t('error'), 'Impossible d\'identifier votre compte');
      return;
    }

    Alert.alert(
      i18n.t('delete_account_confirm_title'),
      i18n.t('delete_account_confirm_body'),
      [
        {
          text: i18n.t('cancel'),
          style: 'cancel',
        },
        {
          text: i18n.t('confirm'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // Appeler la fonction RPC pour supprimer complètement le compte
              const { error: deleteError } = await supabase.rpc('delete_user_account');

              if (deleteError) {
                console.error('Erreur lors de la suppression du compte:', deleteError);
                Alert.alert(i18n.t('error'), 'Impossible de supprimer le compte. Veuillez contacter le support.');
                return;
              }

              // Déconnecter l'utilisateur (même si le compte est déjà supprimé)
              await supabase.auth.signOut();

              Alert.alert(i18n.t('success'), i18n.t('account_deleted_success'), [
                {
                  text: i18n.t('ok'),
                  onPress: () => {
                    safeReplace(router, '/AuthChoiceScreen');
                  },
                },
              ]);
            } catch (err) {
              console.error('Erreur inattendue:', err);
              Alert.alert(i18n.t('error'), 'Une erreur est survenue lors de la suppression du compte');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    Alert.alert(
      i18n.t('logout_title'),
      i18n.t('logout_confirm'),
      [
        { text: i18n.t('cancel'), style: 'cancel' },
        { 
          text: i18n.t('logout'), 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await supabase.auth.signOut();
            safeReplace(router, '/AuthChoiceScreen');
          }
        }
      ]
    );
  };

  const contactSupport = () => {
    Linking.openURL('mailto:hello@theproutapp.com?subject=Support Prout');
  };

  if (!userId) {
    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={true}
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{i18n.t('edit_profile')}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#604a3e" />
              </TouchableOpacity>
            </View>
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#604a3e" />
              <Text style={styles.loadingText}>Chargement...</Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{i18n.t('edit_profile')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#604a3e" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.section}>
              <Text style={styles.label}>{i18n.t('pseudo')}</Text>
              <TextInput 
                placeholder={i18n.t('pseudo')}
                value={pseudo} 
                onChangeText={setPseudo} 
                style={styles.input}
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>{i18n.t('email')}</Text>
              <TextInput
                placeholder={i18n.t('email')}
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>{i18n.t('phone')}</Text>
              <TextInput
                placeholder={i18n.t('phone')}
                value={phone}
                onChangeText={setPhone}
                style={styles.input}
                keyboardType="phone-pad"
                placeholderTextColor="#999"
              />
            </View>

            {/* Bouton de mise à jour */}
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
                  <Text style={styles.updateAllText}>{i18n.t('update_btn')}</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Bouton de déconnexion */}
            <TouchableOpacity 
              style={styles.logoutButton} 
              onPress={handleLogout}
              disabled={loading}
            >
              <Ionicons name="log-out-outline" size={24} color="#604a3e" />
              <Text style={styles.logoutText}>{i18n.t('logout')}</Text>
            </TouchableOpacity>

            <View style={styles.spacer} />

            <View style={styles.bottomSection}>
              <TouchableOpacity style={styles.supportButton} onPress={contactSupport}>
                <Ionicons name="mail-outline" size={20} color="#604a3e" />
                <Text style={styles.supportText}>{i18n.t('contact_support')}</Text>
              </TouchableOpacity>
              <Text style={styles.versionText}>Prout version 1.0.1</Text>

              <View style={styles.deleteButtonContainer}>
                <TouchableOpacity 
                  style={styles.deleteButton} 
                  onPress={unsubscribe} 
                  disabled={loading}
                >
                  <Ionicons name="trash-outline" size={20} color="#ff4444" />
                  <Text style={styles.deleteText}>{i18n.t('delete_account')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  scrollContent: {
    padding: 20,
    flexGrow: 1,
  },
  section: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    color: '#604a3e',
    fontWeight: '600',
    marginBottom: 5,
    marginLeft: 5,
  },
  input: { 
    backgroundColor: 'white', 
    padding: 15, 
    borderRadius: 12, 
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
  
  logoutButton: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'rgba(96, 74, 62, 0.1)', 
    padding: 15, 
    borderRadius: 15,
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(96, 74, 62, 0.2)',
  },
  logoutText: { color: '#604a3e', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },

  spacer: { flex: 1, minHeight: 20 },
  deleteButtonContainer: { marginTop: 10 },
  bottomSection: { marginBottom: 20 },
  
  supportButton: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    padding: 10,
    marginBottom: 5,
  },
  supportText: {
    color: '#604a3e',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
    textDecorationLine: 'underline',
  },
  versionText: {
    marginTop: 6,
    textAlign: 'center',
    color: '#604a3e',
    fontSize: 12,
    opacity: 0.75,
  },

  deleteButton: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    padding: 10, 
  },
  deleteText: { color: '#ff4444', fontWeight: 'bold', fontSize: 14, marginLeft: 8 },
  
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 18, color: '#604a3e', marginTop: 10 },
});

