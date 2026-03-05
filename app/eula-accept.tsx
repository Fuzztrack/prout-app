import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import i18n from '../lib/i18n';

const EULA_ACCEPTED_KEY = 'eula_accepted';

export default function EulaAcceptScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [agreed, setAgreed] = useState(false);

  const handleAccept = async () => {
    if (!agreed) return;
    try {
      await AsyncStorage.setItem(EULA_ACCEPTED_KEY, 'true');
      router.replace('/');
    } catch (e) {
      console.warn('❌ Impossible de sauvegarder l’acceptation EULA:', e);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.contentWrap}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            {
              paddingTop: insets.top + 16,
              paddingBottom: 24,
            },
          ]}
          showsVerticalScrollIndicator
        >
          <Text style={styles.title}>{i18n.t('eula_title')}</Text>
          <Text style={styles.body}>{i18n.t('eula_intro')}</Text>

          <View style={styles.zeroToleranceCard}>
            <Text style={styles.zeroToleranceBadge}>ZERO TOLERANCE</Text>
            <Text style={styles.zeroToleranceTitle}>{i18n.t('eula_section_1_title')}</Text>
            <Text style={styles.zeroToleranceText}>{i18n.t('eula_section_1_body')}</Text>
          </View>

          <Text style={styles.sectionTitle}>{i18n.t('eula_section_2_title')}</Text>
          <Text style={styles.body}>{i18n.t('eula_section_2_body')}</Text>

          <Text style={styles.sectionTitle}>{i18n.t('eula_section_3_title')}</Text>
          <Text style={styles.body}>{i18n.t('eula_section_3_body')}</Text>

          <Text style={styles.sectionTitle}>{i18n.t('eula_section_4_title')}</Text>
          <Text style={styles.body}>{i18n.t('eula_section_4_body')}</Text>
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + 16,
              paddingTop: 16,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setAgreed(!agreed)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={agreed ? 'checkmark-circle' : 'ellipse-outline'}
              size={26}
              color={agreed ? '#604a3e' : 'rgba(96, 74, 62, 0.6)'}
            />
            <Text style={styles.checkboxLabel}>{i18n.t('eula_accept_checkbox')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptButton, !agreed && styles.acceptButtonDisabled]}
            onPress={handleAccept}
            disabled={!agreed}
            activeOpacity={0.8}
          >
            <Text style={styles.acceptButtonText}>{i18n.t('eula_accept_button')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

export { EULA_ACCEPTED_KEY };

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#ebb89b' },
  contentWrap: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 20 },
  title: { color: '#604a3e', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  zeroToleranceCard: {
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(96, 74, 62, 0.28)',
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    padding: 14,
  },
  zeroToleranceBadge: {
    color: '#ffffff',
    backgroundColor: '#604a3e',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    marginBottom: 8,
  },
  zeroToleranceTitle: { color: '#604a3e', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  zeroToleranceText: { color: '#604a3e', fontSize: 15, lineHeight: 22, opacity: 0.92 },
  sectionTitle: { color: '#604a3e', fontSize: 17, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  body: { color: '#604a3e', fontSize: 15, lineHeight: 22, opacity: 0.9 },
  footer: {
    backgroundColor: '#ebb89b',
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(96, 74, 62, 0.15)',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  checkboxLabel: {
    color: '#604a3e',
    fontSize: 15,
    marginLeft: 10,
    flex: 1,
  },
  acceptButton: {
    backgroundColor: '#604a3e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonDisabled: {
    backgroundColor: 'rgba(96, 74, 62, 0.4)',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
  },
});
