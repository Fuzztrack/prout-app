import React from 'react';
import { Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../lib/i18n';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.85;
const HEADER_HEIGHT = 60;
const SCROLL_VIEW_HEIGHT = MODAL_HEIGHT - HEADER_HEIGHT;

interface PrivacyPolicyModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PrivacyPolicyModal({ visible, onClose }: PrivacyPolicyModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{i18n.t('privacy_policy_title')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#604a3e" />
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            bounces={true}
            alwaysBounceVertical={false}
            scrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.text}>
              <Text style={styles.bold}>{i18n.t('privacy_policy_app_title')}</Text>{'\n\n'}
              <Text style={styles.italic}>{i18n.t('privacy_policy_last_update')}</Text>{'\n\n'}
              {i18n.t('privacy_policy_intro')}{'\n\n'}

              <Text style={styles.sectionTitle}>{i18n.t('privacy_policy_section1_title')}</Text>{'\n'}
              {i18n.t('privacy_policy_section1_content')}{'\n\n'}

              <Text style={styles.sectionTitle}>{i18n.t('privacy_policy_section2_title')}</Text>{'\n'}
              {i18n.t('privacy_policy_section2_intro')}{'\n\n'}
              <Text style={styles.subTitle}>{i18n.t('privacy_policy_section2a_title')}</Text>{'\n'}
              {i18n.t('privacy_policy_section2a_content')}{'\n\n'}

              <Text style={styles.subTitle}>{i18n.t('privacy_policy_section2b_title')}</Text>{'\n'}
              {i18n.t('privacy_policy_section2b_content')}{'\n\n'}

              <Text style={styles.subTitle}>{i18n.t('privacy_policy_section2c_title')}</Text>{'\n'}
              {i18n.t('privacy_policy_section2c_content')}{'\n\n'}

              <Text style={styles.sectionTitle}>{i18n.t('privacy_policy_section3_title')}</Text>{'\n'}
              {i18n.t('privacy_policy_section3_content')}{'\n\n'}

              <Text style={styles.sectionTitle}>{i18n.t('privacy_policy_section4_title')}</Text>{'\n'}
              {i18n.t('privacy_policy_section4_content')}{'\n\n'}

              <Text style={styles.sectionTitle}>{i18n.t('privacy_policy_section5_title')}</Text>{'\n'}
              {i18n.t('privacy_policy_section5_intro')}{'\n\n'}
              <Text style={styles.bold}>{i18n.t('privacy_policy_section5_how_to_delete')}</Text>{'\n'}
              {i18n.t('privacy_policy_section5_delete_content')}{'\n\n'}

              <Text style={styles.sectionTitle}>{i18n.t('privacy_policy_section6_title')}</Text>{'\n'}
              {i18n.t('privacy_policy_section6_content')}{'\n\n'}

              <Text style={styles.sectionTitle}>{i18n.t('privacy_policy_section7_title')}</Text>{'\n'}
              {i18n.t('privacy_policy_section7_content')}{'\n\n'}
              <Text style={styles.bold}>{i18n.t('privacy_policy_contact')}</Text>
            </Text>
          </ScrollView>
        </View>
      </View>
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
    maxHeight: MODAL_HEIGHT,
    height: MODAL_HEIGHT,
    backgroundColor: '#fff5eb', // Crème clair
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(96, 74, 62, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
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
  scrollView: {
    flex: 1,
    maxHeight: SCROLL_VIEW_HEIGHT,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
    flexGrow: 1,
  },
  text: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  bold: {
    fontWeight: 'bold',
  },
  italic: {
    fontStyle: 'italic',
    color: '#666',
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#604a3e',
    marginTop: 10,
    marginBottom: 5,
  },
  subTitle: {
    fontWeight: '600',
    fontSize: 15,
    color: '#604a3e',
    marginTop: 5,
    marginBottom: 2,
  },
});

