import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

// Sécurité pour OAuth
WebBrowser.maybeCompleteAuthSession();

interface AppleAuthButtonProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function AppleAuthButton({ onSuccess, onError }: AppleAuthButtonProps) {
  const [loading, setLoading] = useState(false);

  // CAS A : iOS - Utilisation du bouton natif Apple avec FaceID
  if (Platform.OS === 'ios') {
    return (
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={8}
        style={styles.appleButton}
        onPress={async () => {
          try {
            setLoading(true);
            
            // Demander l'authentification Apple native
            const credential = await AppleAuthentication.signInAsync({
              requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
              ],
            });

            if (!credential.identityToken) {
              throw new Error('Pas de token Apple reçu');
            }

            // Connexion à Supabase avec le token Apple
            const { data, error } = await supabase.auth.signInWithIdToken({
              provider: 'apple',
              token: credential.identityToken,
            });

            if (error) throw error;

            if (data.user) {
              onSuccess?.();
              // La navigation sera gérée par _layout.tsx via onAuthStateChange
            }
          } catch (e: any) {
            if (e.code === 'ERR_REQUEST_CANCELED') {
              // L'utilisateur a annulé, on ne fait rien
              setLoading(false);
              return;
            }
            console.error('Erreur connexion Apple:', e);
            Alert.alert(i18n.t('error'), i18n.t('cannot_connect_apple'));
            onError?.(e);
            setLoading(false);
          }
        }}
      />
    );
  }

  // CAS B : Android - Utilisation du flux OAuth Web (comme Google)
  const handleAppleLogin = async () => {
    setLoading(true);
    try {
      // Utiliser proutapp://login-callback spécifiquement pour Apple sur Android
      const redirectUrl = Platform.OS === 'web' 
        ? (typeof window !== 'undefined' ? window.location.origin : '')
        : 'proutapp://login-callback';
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (result.type === 'cancel') {
          setLoading(false);
        } else if (result.type === 'success') {
          onSuccess?.();
          // La navigation sera gérée par _layout.tsx via onAuthStateChange
        }
      }
    } catch (e: any) {
      console.error('Erreur connexion Apple:', e);
      Alert.alert(i18n.t('apple_error'), e.message || i18n.t('cannot_connect_apple'));
      onError?.(e);
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleAppleLogin}
      disabled={loading}
      style={[styles.appleButtonAndroid, loading && styles.appleButtonDisabled]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#ffffff" />
      ) : (
        <View style={styles.appleButtonContent}>
          <Text style={styles.appleButtonText}>🍎</Text>
          <Text style={styles.appleButtonText}>Continuer avec Apple</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  appleButton: {
    width: '100%',
    height: 50,
    marginBottom: 15,
  },
  appleButtonAndroid: {
    backgroundColor: '#000000',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 15,
    minHeight: 50,
  },
  appleButtonDisabled: {
    opacity: 0.6,
  },
  appleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  appleButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

