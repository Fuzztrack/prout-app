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
  onRequestIdentityReveal: (friend: any, options?: { force?: boolean }) => void;
};

export const IdentityModal = ({
  isVisible,
  onClose,
  friend,
  friendName,
  onModalShow,
  onModalHide,
  onRequestIdentityReveal,
}: IdentityModalProps) => {
  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      onModalShow={onModalShow}
      onModalHide={onModalHide}
      style={styles.identityModal}
      backdropOpacity={0.5}
      animationIn="fadeIn"
      animationOut="fadeOut"
      animationOutTiming={250}
      useNativeDriver={USE_NATIVE_MODAL_DRIVER}
      useNativeDriverForBackdrop={USE_NATIVE_MODAL_DRIVER}
      hideModalContentWhileAnimating
      backdropTransitionOutTiming={1}
    >
      <View style={styles.identityModalContent}>
        {friend && (
          <>
            {/* Avatar en grand */}
            <View style={styles.identityAvatarContainer}>
              {friend.avatar_url ? (
                <Image
                  source={{ uri: friend.avatar_url }}
                  style={styles.identityAvatar}
                />
              ) : (
                <View style={styles.identityAvatarPlaceholder}>
                  <Text style={styles.identityAvatarPlaceholderText}>
                    {friend.pseudo ? friend.pseudo.charAt(0).toUpperCase() : '?'}
                  </Text>
                </View>
              )}
            </View>

            {/* Vrai nom connu */}
            {friendName && (
              <View style={styles.identityNameContainer}>
                <Text style={styles.identityNameValue}>✨ {friendName}</Text>
              </View>
            )}

            {/* Demande d'identité si le nom n'est pas connu */}
            {!friendName && (
              <View style={styles.identityRequestContainer}>
                <Text style={styles.identityRequestTitle}>
                  {friend.isPending
                    ? i18n.t('already_asked_identity_title')
                    : i18n.t('ask_identity_title')}
                </Text>
                <Text style={styles.identityRequestBody}>
                  {friend.isPending
                    ? i18n.t('already_asked_identity_body', { pseudo: friend.pseudo })
                    : i18n.t('ask_identity_body', { pseudo: friend.pseudo })}
                </Text>
                <View style={styles.identityRequestButtons}>
                  <TouchableOpacity
                    style={[styles.identityRequestButton, styles.identityRequestButtonCancel]}
                    onPress={onClose}
                  >
                    <Text style={styles.identityRequestButtonTextCancel}>
                      {i18n.t('cancel')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.identityRequestButton, styles.identityRequestButtonAsk]}
                    onPress={() => {
                      onClose();
                      if (friend.isPending) {
                        onRequestIdentityReveal(friend, { force: true });
                      } else {
                        onRequestIdentityReveal(friend);
                      }
                    }}
                  >
                    <Text style={styles.identityRequestButtonTextAsk}>
                      {friend.isPending
                        ? i18n.t('relaunch_btn')
                        : i18n.t('ask_btn')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Bouton fermer si le nom est connu */}
            {friendName && (
              <TouchableOpacity
                style={styles.identityCloseButton}
                onPress={onClose}
              >
                <Text style={styles.identityCloseButtonText}>{i18n.t('ok') || 'OK'}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
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
  identityRequestContainer: {
    alignItems: 'center',
    width: '100%',
  },
  identityRequestTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#604a3e',
    marginBottom: 12,
    textAlign: 'center',
  },
  identityRequestBody: {
    fontSize: 16,
    color: '#604a3e',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  identityRequestButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  identityRequestButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  identityRequestButtonCancel: {
    backgroundColor: 'rgba(96, 74, 62, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.3)',
  },
  identityRequestButtonAsk: {
    backgroundColor: '#604a3e',
  },
  identityRequestButtonTextCancel: {
    color: '#604a3e',
    fontWeight: 'bold',
    fontSize: 16,
  },
  identityRequestButtonTextAsk: {
    color: '#ebb89b',
    fontWeight: 'bold',
    fontSize: 16,
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
