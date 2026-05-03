import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Image,
} from 'react-native';
import Modal from 'react-native-modal';
import i18n from '@/lib/i18n';

const USE_NATIVE_MODAL_DRIVER = Platform.OS !== 'android';

export type IdentityModalProps = {
  isVisible: boolean;
  onClose: () => void;
  friend: any;
  friendName: string | null;
  onModalShow: () => void;
  onModalHide: () => void;
};

export const IdentityModal = ({
  isVisible,
  onClose,
  friend,
  friendName,
  onModalShow,
  onModalHide,
}: IdentityModalProps) => {
  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      onModalShow={onModalShow}
      onModalHide={onModalHide}
      style={styles.identityModal}
      backdropOpacity={0.85}
      animationIn="zoomIn"
      animationOut="zoomOut"
      useNativeDriver={USE_NATIVE_MODAL_DRIVER}
      useNativeDriverForBackdrop={USE_NATIVE_MODAL_DRIVER}
    >
      <View style={styles.identityModalContent}>
        {friend?.avatar_url ? (
          <View style={styles.identityAvatarContainer}>
            <Image
              source={{ uri: friend.avatar_url }}
              style={styles.identityAvatar}
            />
          </View>
        ) : (
          <View style={[styles.identityAvatarContainer, styles.identityAvatarPlaceholder]}>
            <Text style={styles.identityAvatarPlaceholderText}>
              {(friendName || friend?.pseudo || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.identityNameContainer}>
          <Text style={styles.identityNameValue}>
            {friendName || friend?.pseudo || i18n.t('unknown_user')}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.identityCloseButton}
          onPress={onClose}
        >
          <Text style={styles.identityCloseButtonText}>{i18n.t('ok') || 'OK'}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  identityModal: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 0,
  },
  identityModalContent: {
    backgroundColor: '#ebb89b',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '85%',
    maxWidth: 400,
  },
  identityAvatarContainer: {
    marginBottom: 20,
  },
  identityAvatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#d9d9d9',
  },
  identityAvatarPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#604a3e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  identityAvatarPlaceholderText: {
    fontSize: 60,
    fontWeight: 'bold',
    color: '#fff',
  },
  identityNameContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  identityNameValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#604a3e',
    textAlign: 'center',
  },
  identityCloseButton: {
    backgroundColor: '#604a3e',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginTop: 10,
  },
  identityCloseButtonText: {
    color: '#ebb89b',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
