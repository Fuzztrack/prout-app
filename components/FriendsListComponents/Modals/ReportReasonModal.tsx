import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import Modal from 'react-native-modal';
import i18n from '@/lib/i18n';
import type { ReportableMessage } from '../ChatMessages';

type ReportReason = 'spam' | 'harassment' | 'hate_speech' | 'explicit_content' | 'other';

const USE_NATIVE_MODAL_DRIVER = Platform.OS !== 'android';

export type ReportReasonModalProps = {
  isVisible: boolean;
  onClose: () => void;
  onModalShow: () => void;
  isReady: boolean;
  onSelectReason: (reason: ReportReason) => void;
};

export const ReportReasonModal = ({
  isVisible,
  onClose,
  onModalShow,
  isReady,
  onSelectReason,
}: ReportReasonModalProps) => {
  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      onModalShow={onModalShow}
      style={styles.reportReasonModal}
      backdropOpacity={0.4}
      animationIn="fadeIn"
      animationOut="fadeOut"
      useNativeDriver={USE_NATIVE_MODAL_DRIVER}
      useNativeDriverForBackdrop={USE_NATIVE_MODAL_DRIVER}
    >
      <View style={styles.reportReasonCard}>
        <Text style={styles.reportReasonTitle}>{i18n.t('report_message_title')}</Text>
        <Text style={styles.reportReasonSubtitle}>{i18n.t('report_message_reason_prompt')}</Text>
        {([
          ['spam', i18n.t('report_reason_spam')],
          ['harassment', i18n.t('report_reason_harassment')],
          ['hate_speech', i18n.t('report_reason_hate_speech')],
          ['explicit_content', i18n.t('report_reason_explicit_content')],
          ['other', i18n.t('report_reason_other')],
        ] as Array<[ReportReason, string]>).map(([reason, label]) => (
          <TouchableOpacity
            key={reason}
            style={[
              styles.reportReasonOption,
              !isReady && styles.reportReasonOptionDisabled,
            ]}
            onPress={() => isReady && onSelectReason(reason)}
            activeOpacity={0.7}
          >
            <Text style={styles.reportReasonOptionText}>{label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.reportReasonCancel}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text style={styles.reportReasonCancelText}>{i18n.t('cancel')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  reportReasonModal: {
    justifyContent: 'center',
    margin: 0,
    paddingHorizontal: 20,
  },
  reportReasonCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
  },
  reportReasonTitle: {
    color: '#604a3e',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  reportReasonSubtitle: {
    color: '#604a3e',
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
    marginTop: 6,
    marginBottom: 14,
  },
  reportReasonOption: {
    backgroundColor: '#d2f1ef',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  reportReasonOptionDisabled: {
    opacity: 0.55,
  },
  reportReasonOptionText: {
    color: '#604a3e',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  reportReasonCancel: {
    marginTop: 6,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  reportReasonCancelText: {
    color: '#604a3e',
    fontSize: 15,
    fontWeight: '700',
  },
});
