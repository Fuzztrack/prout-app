import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';

interface FeedbackModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const USE_NATIVE_DRIVER = Platform.OS !== 'android';

export const FeedbackModal = ({ isVisible, onClose, onSuccess }: FeedbackModalProps) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const currentPseudo = useAppStore((state) => state.pseudo);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      Alert.alert(i18n.t('error'), i18n.t('feedback_empty_error'));
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert(i18n.t('error'), i18n.t('feedback_error_body'));
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('user_feedback').insert({
        user_id: user.id,
        pseudo: currentPseudo || null,
        content: trimmed,
      });

      if (error) throw error;

      setContent('');
      onSuccess();
      onClose();

      Alert.alert(
        i18n.t('feedback_success_title'),
        i18n.t('feedback_success_body')
      );
    } catch (e: any) {
      console.error('Erreur envoi feedback:', e);
      Alert.alert(
        i18n.t('feedback_error_title'),
        i18n.t('feedback_error_body')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setContent('');
      onClose();
    }
  };

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      style={styles.modal}
      backdropOpacity={0.4}
      animationIn="fadeIn"
      animationOut="fadeOut"
      useNativeDriver={USE_NATIVE_DRIVER}
      useNativeDriverForBackdrop={USE_NATIVE_DRIVER}
      avoidKeyboard
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{i18n.t('feedback_modal_title')}</Text>
            <TouchableOpacity onPress={handleClose} disabled={loading} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#604a3e" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>{i18n.t('feedback_modal_subtitle')}</Text>

          <TextInput
            style={styles.textInput}
            multiline
            numberOfLines={4}
            placeholder={i18n.t('feedback_modal_placeholder')}
            placeholderTextColor="#999"
            value={content}
            onChangeText={setContent}
            editable={!loading}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ebb89b" />
            ) : (
              <Text style={styles.submitButtonText}>
                {i18n.t('feedback_modal_submit')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'center',
    margin: 0,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#fff5eb',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.2)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    color: '#604a3e',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    color: '#604a3e',
    fontSize: 14,
    opacity: 0.9,
    marginBottom: 14,
    lineHeight: 20,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    minHeight: 110,
    maxHeight: 180,
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.2)',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#604a3e',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ebb89b',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
