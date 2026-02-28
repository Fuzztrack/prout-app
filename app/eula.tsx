import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import i18n from '../lib/i18n';

export default function EulaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.wrapper}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>{i18n.t('eula_title')}</Text>
        <Text style={styles.body}>{i18n.t('eula_intro')}</Text>

        <Text style={styles.sectionTitle}>{i18n.t('eula_section_1_title')}</Text>
        <Text style={styles.body}>{i18n.t('eula_section_1_body')}</Text>

        <Text style={styles.sectionTitle}>{i18n.t('eula_section_2_title')}</Text>
        <Text style={styles.body}>{i18n.t('eula_section_2_body')}</Text>

        <Text style={styles.sectionTitle}>{i18n.t('eula_section_3_title')}</Text>
        <Text style={styles.body}>{i18n.t('eula_section_3_body')}</Text>

        <Text style={styles.sectionTitle}>{i18n.t('eula_section_4_title')}</Text>
        <Text style={styles.body}>{i18n.t('eula_section_4_body')}</Text>

        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#604a3e" />
          <Text style={styles.backText}>{i18n.t('back')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#ebb89b' },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40 },
  title: { color: '#604a3e', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  sectionTitle: { color: '#604a3e', fontSize: 17, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  body: { color: '#604a3e', fontSize: 15, lineHeight: 22, opacity: 0.9 },
  backButton: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.2)',
  },
  backText: { color: '#604a3e', fontWeight: '700', fontSize: 16, marginLeft: 8 },
});
