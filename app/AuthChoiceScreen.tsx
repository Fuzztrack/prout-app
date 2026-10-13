import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CustomButton } from '../components/CustomButton';
import { logSessionSnapshot } from '../lib/authDebug';
import { ensureUserEulaAccepted, hasAcceptedEulaLocally, isUserEulaAccepted, syncLocalEulaAcceptanceFromUser } from '../lib/eula';
import { safePush, safeReplace } from '../lib/navigation';
import { registerPushTokenForUser } from '../lib/pushTokenRegistration';
import { getRedirectUrl, supabase } from '../lib/supabase';
import i18n from '../lib/i18n';

// Sécurité pour OAuth
WebBrowser.maybeCompleteAuthSession();

const extractAuthCallbackTokens = (url: string) => {
  const accessTokenMatch = url.match(/[?#&]access_token=([^&]+)/);
  const refreshTokenMatch = url.match(/[?#&]refresh_token=([^&]+)/);

  return {
    accessToken: accessTokenMatch ? decodeURIComponent(accessTokenMatch[1]) : null,
    refreshToken: refreshTokenMatch ? decodeURIComponent(refreshTokenMatch[1]) : null,
  };
};

export default function AuthChoiceScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [checkingEula, setCheckingEula] = useState(true);
  const isOAuthBrowserAuthInProgressRef = useRef(false);

  const replaceWithSkip = (path: string) => {
    safeReplace(router, path as any, { skipInitialCheck: false });
  };

  const closeAuthSessionIfNeeded = async () => {
    try {
      await WebBrowser.dismissBrowser();
    } catch {
      // Aucun navigateur à fermer
    }
  };

  const ensureEulaAccepted = async () => {
    if (await hasAcceptedEulaLocally()) return true;
    replaceWithSkip('/eula-accept?next=%2FAuthChoiceScreen');
    return false;
  };

  const openAuthSessionSafe = async (
    url: string,
    redirectUrl: string,
    options?: WebBrowser.WebBrowserOpenOptions,
  ) => {
    await closeAuthSessionIfNeeded();
    return WebBrowser.openAuthSessionAsync(url, redirectUrl, options);
  };

  const startAppleOAuthFlow = async (timeoutId: ReturnType<typeof setTimeout>) => {
    const redirectUrl = getRedirectUrl();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      clearTimeout(timeoutId);
      throw error;
    }

    if (!data?.url) {
      isOAuthBrowserAuthInProgressRef.current = false;
      clearTimeout(timeoutId);
      if (typeof (global as any).__isOAuthFlow === 'function') {
        (global as any).__isOAuthFlow(false);
      }
      setLoading(false);
      return;
    }

    if (typeof (global as any).__isOAuthFlow === 'function') {
      (global as any).__isOAuthFlow(true);
    }
    isOAuthBrowserAuthInProgressRef.current = true;

    const result = await openAuthSessionSafe(
      data.url,
      redirectUrl,
      {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        showInRecents: false,
      }
    );
    await handleOAuthResult(result, timeoutId);
  };

  // 1. Vérification simple de la session au montage
  useEffect(() => {
    let isMounted = true;
    const checkUser = async () => {
      try {
        // On vérifie s'il y a une session active, mais on ne déconnecte pas de force
        // pour laisser une chance au rafraîchissement auto ou au mode offline
        const { data: { user } } = await supabase.auth.getUser();
        if (user && isMounted) {
           // Si un utilisateur est déjà là (devrait être rare ici), on laisse index.tsx gérer
           console.log("👤 Utilisateur déjà connecté sur AuthChoiceScreen");
        }
      } catch (e) {
        console.log("Erreur AuthChoice:", e);
      } finally {
        if (isMounted) {
          setChecking(false);
        }
      }
    };

    checkUser();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const guardEula = async () => {
      try {
        const accepted = await hasAcceptedEulaLocally();
        if (!mounted) return;
        if (!accepted) {
          replaceWithSkip('/eula-accept?next=%2FAuthChoiceScreen');
          return;
        }
      } finally {
        if (mounted) {
          setCheckingEula(false);
        }
      }
    };
    guardEula().catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Helper unique pour finaliser la connexion (OAuth Google / Apple web / Apple native)
  const finalizeAuthenticatedUser = async (sessionUser: any) => {
    console.log('✅ Finalisation connexion pour:', sessionUser.id);

    // Tentative d'enregistrement du token push
    registerPushTokenForUser(sessionUser.id).catch(err => {
      console.warn('⚠️ Erreur enregistrement token post-auth:', err);
    });

    isOAuthBrowserAuthInProgressRef.current = false;

    // Récupérer et synchroniser les données utilisateur & EULA
    const { data: { user } } = await supabase.auth.getUser();
    const effectiveUser = await ensureUserEulaAccepted(user || sessionUser);

    if (!isUserEulaAccepted(effectiveUser)) {
      console.log('➡️ Auth OK → EULA acceptation requise');
      if (typeof (global as any).__isOAuthFlow === 'function') {
        (global as any).__isOAuthFlow(false);
      }
      replaceWithSkip('/eula-accept');
      return true;
    }

    await syncLocalEulaAcceptanceFromUser(effectiveUser);

    // Vérifier le profil en base
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, pseudo')
      .eq('id', sessionUser.id)
      .maybeSingle();

    console.log('📋 Profil final trouvé:', profile?.pseudo || 'aucun');

    const pseudoValidated = effectiveUser?.user_metadata?.pseudo_validated === true;

    // Fin du flux OAuth : libération du routeur
    if (typeof (global as any).__isOAuthFlow === 'function') {
      (global as any).__isOAuthFlow(false);
    }

    const isSystemPseudo = (p: string | null | undefined): boolean => {
      if (!p || p === 'Nouveau Membre') return true;
      if (p.toLowerCase().startsWith('user_') && p.length > 10) return true;
      return false;
    };

    // Si le pseudo est déjà validé explicitement ET qu'un profil valide existe : direction Home
    if (pseudoValidated && profile?.pseudo && !isSystemPseudo(profile.pseudo)) {
      console.log('➡️ Auth OK → Home (profil déjà validé)');
      replaceWithSkip('/(tabs)');
      return true;
    }

    // Sinon, nouvel utilisateur ou pseudo non validé : direction la finalisation d'inscription
    console.log('➡️ Auth OK → Vérification Permissions -> CompleteProfileScreen');
    const Notifications = require('expo-notifications');
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'undetermined') {
        console.log('➡️ Direction: NotificationPermissionScreen');
        replaceWithSkip('/NotificationPermissionScreen?next=%2FCompleteProfileScreen');
      } else {
        console.log('➡️ Direction: CompleteProfileScreen');
        replaceWithSkip('/CompleteProfileScreen');
      }
    } catch (e) {
      console.warn('⚠️ Erreur lors de la vérification des permissions, redirection par défaut:', e);
      replaceWithSkip('/CompleteProfileScreen');
    }

    return true;
  };

  // Helper pour gérer le résultat OAuth
  const handleOAuthResult = async (result: any, timeoutId: ReturnType<typeof setTimeout>) => {
    if (typeof (global as any).__isOAuthFlow === 'function') {
      (global as any).__isOAuthFlow(true);
    }

    if (result.type === 'cancel') {
      isOAuthBrowserAuthInProgressRef.current = false;
      clearTimeout(timeoutId);
      if (typeof (global as any).__isOAuthFlow === 'function') {
        (global as any).__isOAuthFlow(false);
      }
      setLoading(false);
      return false;
    }

    if (result.type === 'success') {
      console.log('✅ OAuth réussi, traitement de l\'URL...');
      console.log('🔗 URL callback:', result.url);
      clearTimeout(timeoutId);

      // 1. Détection des erreurs retournées dans l'URL par le fournisseur
      if (result.url) {
        const errorMatch = result.url.match(/[?#&]error=([^&]+)/);
        const errorDescMatch = result.url.match(/[?#&]error_description=([^&]+)/);
        if (errorMatch) {
          const rawDesc = errorDescMatch ? errorDescMatch[1] : errorMatch[1];
          const errorMsg = decodeURIComponent(rawDesc.replace(/\+/g, ' '));
          console.error('❌ Erreur OAuth dans callback:', errorMsg);
          isOAuthBrowserAuthInProgressRef.current = false;
          if (typeof (global as any).__isOAuthFlow === 'function') {
            (global as any).__isOAuthFlow(false);
          }
          setLoading(false);
          Alert.alert(i18n.t('error') || 'Erreur', errorMsg);
          return false;
        }
      }

      // 2. Vérifier si l'URL contient les tokens
      if (result.url && result.url.includes('access_token') && result.url.includes('refresh_token')) {
        console.log('🔑 Tokens trouvés dans l\'URL, création de la session...');
        try {
          const { accessToken, refreshToken } = extractAuthCallbackTokens(result.url);

          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error('❌ Erreur création session:', error);
              isOAuthBrowserAuthInProgressRef.current = false;
              if (typeof (global as any).__isOAuthFlow === 'function') {
                (global as any).__isOAuthFlow(false);
              }
              setLoading(false);
              Alert.alert(i18n.t('error') || 'Erreur', error.message);
              return false;
            }

            if (data.session?.user) {
              console.log('✅ Session créée pour:', data.session.user.id);
              logSessionSnapshot('AuthDebug:setSession', data.session);

              const { data: { user } } = await supabase.auth.getUser();

              // Extraire le prénom pour les fournisseurs OAuth (Google / Apple web) si pas de pseudo
              let pseudoFromMetadata = user?.user_metadata?.pseudo || null;
              if (!pseudoFromMetadata || pseudoFromMetadata === 'Nouveau Membre') {
                const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || null;
                if (fullName) {
                  const firstName = fullName.split(' ')[0].trim();
                  if (firstName && firstName.length > 0) {
                    pseudoFromMetadata = firstName;
                    await supabase.auth.updateUser({
                      data: {
                        ...(user?.user_metadata ?? {}),
                        pseudo: firstName,
                        pseudo_validated: false,
                      }
                    }).catch(() => {});
                  }
                }
              }

              // Mettre à jour le profil en base si pseudo disponible
              if (pseudoFromMetadata && pseudoFromMetadata !== 'Nouveau Membre') {
                const { data: checkProfile } = await supabase
                  .from('user_profiles')
                  .select('id, pseudo')
                  .eq('id', data.session.user.id)
                  .maybeSingle();

                const updateData = {
                  pseudo: pseudoFromMetadata,
                  phone: user?.user_metadata?.phone || null,
                  updated_at: new Date().toISOString()
                };

                if (checkProfile) {
                  await supabase.from('user_profiles').update(updateData).eq('id', data.session.user.id);
                } else {
                  await supabase.from('user_profiles').upsert({ id: data.session.user.id, ...updateData }, { onConflict: 'id' });
                }
              }

              return await finalizeAuthenticatedUser(data.session.user);
            }
          }
        } catch (e: any) {
          console.error('❌ Erreur traitement URL:', e);
          isOAuthBrowserAuthInProgressRef.current = false;
          if (typeof (global as any).__isOAuthFlow === 'function') {
            (global as any).__isOAuthFlow(false);
          }
          setLoading(false);
          Alert.alert(i18n.t('error') || 'Erreur', e.message || i18n.t('error'));
          return false;
        }
      }

      // 3. Fallback : attente de la session si tokens absents de l'URL directe
      console.log('⏳ Pas de tokens dans l\'URL, attente callback...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        console.warn('⚠️ Pas de session après OAuth');
        isOAuthBrowserAuthInProgressRef.current = false;
        if (typeof (global as any).__isOAuthFlow === 'function') {
          (global as any).__isOAuthFlow(false);
        }
        setLoading(false);
        Alert.alert(i18n.t('error') || 'Erreur', sessionError?.message || i18n.t('session_invalid'));
        return false;
      }

      return await finalizeAuthenticatedUser(session.user);
    }

    isOAuthBrowserAuthInProgressRef.current = false;
    setLoading(false);
    return false;
  };

  // 2. Connexion Google
  const handleGoogleLogin = async () => {
    if (!(await ensureEulaAccepted())) return;
    setLoading(true);
    isOAuthBrowserAuthInProgressRef.current = false;
    try {
      const redirectUrl = getRedirectUrl();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        if (typeof (global as any).__isOAuthFlow === 'function') {
          (global as any).__isOAuthFlow(true);
        }
        isOAuthBrowserAuthInProgressRef.current = true;

        const result = await openAuthSessionSafe(
          data.url, 
          redirectUrl,
          {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
            showInRecents: false,
          }
        );

        const timeoutId = setTimeout(() => {
          if (isOAuthBrowserAuthInProgressRef.current) {
            console.log('⏱️ Auth Google toujours en cours dans le navigateur, on garde le chargement actif.');
            return;
          }
          console.warn('⏱️ Timeout Google Sign In - réactivation du bouton');
          if (typeof (global as any).__isOAuthFlow === 'function') {
            (global as any).__isOAuthFlow(false);
          }
          setLoading(false);
        }, 20000);

        await handleOAuthResult(result, timeoutId);
      }
    } catch (e: any) {
      isOAuthBrowserAuthInProgressRef.current = false;
      Alert.alert(i18n.t('google_error'), e.message);
      setLoading(false);
    }
  };

  // 3. Connexion Apple (iOS native avec Face ID / Touch ID, et fallback OAuth Web pour Android)
  const handleAppleLogin = async () => {
    if (!(await ensureEulaAccepted())) return;
    setLoading(true);
    isOAuthBrowserAuthInProgressRef.current = false;
    console.log('🍏 1. Début Apple Sign In');

    try {
      // Priorité à l'authentification Apple native sur iOS (Face ID / Touch ID)
      if (Platform.OS === 'ios') {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        if (isAvailable) {
          console.log('🍏 2. iOS - Apple Authentication native...');
          let credential;
          try {
            credential = await AppleAuthentication.signInAsync({
              requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
              ],
            });
          } catch (nativeErr: any) {
            if (nativeErr.code === 'ERR_REQUEST_CANCELED') {
              console.log('🍏 Connexion Apple annulée par l\'utilisateur');
              setLoading(false);
              return;
            }
            console.warn('⚠️ Échec Apple native, tentative fallback web:', nativeErr);
            throw nativeErr;
          }

          if (!credential.identityToken) {
            throw new Error(i18n.t('cannot_connect_apple'));
          }

          console.log('🍏 3. Token Apple reçu, connexion Supabase via signInWithIdToken...');
          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
          });

          if (error) {
            console.error('❌ Erreur Supabase Apple:', error);
            throw error;
          }

          if (data.session?.user) {
            console.log('✅ 4. Supabase connecté avec Apple native !', data.session.user.id);

            // Apple ne fournit le prénom et nom QUE lors de la TOUTE PREMIÈRE inscription
            const givenName = credential.fullName?.givenName?.trim();
            const familyName = credential.fullName?.familyName?.trim();
            const fullName = [givenName, familyName].filter(Boolean).join(' ');

            if (givenName || fullName) {
              const pseudoToSet = givenName || fullName;
              try {
                await supabase.auth.updateUser({
                  data: {
                    pseudo: pseudoToSet,
                    full_name: fullName || givenName,
                    pseudo_from_apple: true,
                    pseudo_validated: false,
                  },
                });
                console.log('✅ Prénom Apple stocké dans les métadonnées:', pseudoToSet);
              } catch (metaErr) {
                console.warn('⚠️ Erreur mise à jour métadonnées Apple:', metaErr);
              }
            }

            await finalizeAuthenticatedUser(data.session.user);
            return;
          }
        }
      }

      // Android ou fallback si Apple Authentication native n'est pas disponible (ex: simulateur sans compte)
      console.log(`🍏 Fallback OAuth Web Apple (${Platform.OS})...`);
      const timeoutId = setTimeout(() => {
        if (isOAuthBrowserAuthInProgressRef.current) {
          console.log('⏱️ Auth Apple toujours en cours dans le navigateur, on garde le chargement actif.');
          return;
        }
        console.warn('⏱️ Timeout Apple Sign In - réactivation du bouton');
        setLoading(false);
      }, 20000);

      await startAppleOAuthFlow(timeoutId);
      return;
    } catch (e: any) {
      isOAuthBrowserAuthInProgressRef.current = false;
      if (e.code === 'ERR_REQUEST_CANCELED') {
        console.log('🍏 Connexion Apple annulée par l\'utilisateur');
        if (typeof (global as any).__isOAuthFlow === 'function') {
          (global as any).__isOAuthFlow(false);
        }
        setLoading(false);
        return;
      }
      console.error('❌ ERREUR GLOBALE Apple:', e);
      if (typeof (global as any).__isOAuthFlow === 'function') {
        (global as any).__isOAuthFlow(false);
      }
      Alert.alert(
        i18n.t('apple_error'),
        e.message || i18n.t('cannot_connect_apple')
      );
      setLoading(false);
    }
  };

  if (checking || checkingEula) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#604a3e" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Image 
            source={require('../assets/images/proot.png')} 
            style={styles.headerImage}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>{i18n.t('welcome')}</Text>

        <View style={styles.socialContainer}>
          <TouchableOpacity
            onPress={() => {
              handleAppleLogin().catch(() => {});
            }}
            disabled={loading}
            style={[styles.oauthButton, styles.appleOauthButton, loading && styles.oauthButtonDisabled]}
          >
            <View style={styles.oauthButtonContent}>
              <Image source={require('../assets/images/apple.png')} style={styles.oauthAppleIcon} resizeMode="contain" />
              <Text style={styles.appleOauthButtonText}>Sign in with Apple</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              handleGoogleLogin().catch(() => {});
            }}
            disabled={loading}
            style={[styles.oauthButton, styles.googleOauthButton, loading && styles.oauthButtonDisabled]}
          >
            <View style={styles.oauthButtonContent}>
              <Image source={require('../assets/images/google.png')} style={styles.oauthGoogleIcon} resizeMode="contain" />
              <Text style={styles.googleOauthButtonText}>Sign in with Google</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.orText}>{i18n.t('or')}</Text>
          <View style={styles.divider} />
        </View>

        <CustomButton 
          title={i18n.t('signup_with_email')} 
          onPress={async () => {
            if (!(await ensureEulaAccepted())) return;
            safePush(router, '/RegisterEmailScreen', { skipInitialCheck: false });
          }} 
          color="#604a3e"
          textColor="#ebb89b"
        />

        <CustomButton
          title={i18n.t('already_have_account')}
          onPress={async () => {
            if (!(await ensureEulaAccepted())) return;
            safePush(router, '/LoginScreen', { skipInitialCheck: false });
          }}
          color="transparent"
          textColor="#604a3e"
          small
        />

        <TouchableOpacity
          style={styles.eulaLinkButton}
          onPress={() => safePush(router, '/eula', { skipInitialCheck: false })}
          activeOpacity={0.85}
        >
          <Text style={styles.eulaLinkText}>Read EULA and Safety Policy</Text>
        </TouchableOpacity>
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#604a3e" />
          <Text style={styles.loadingOverlayText}>{i18n.t('finalizing_connection')}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ebb89b' },
  scrollContent: { flexGrow: 1, padding: 20, justifyContent: 'center', paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ebb89b' },
  header: { alignItems: 'center', marginBottom: 20 },
  headerImage: { width: 200, height: 200 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: '#604a3e', marginBottom: 40 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  divider: { flex: 1, height: 1, backgroundColor: '#604a3e', opacity: 0.3 },
  orText: { marginHorizontal: 10, color: '#604a3e', fontWeight: 'bold' },
  socialContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: 12,
    marginBottom: 15,
  },
  oauthButton: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  oauthButtonDisabled: {
    opacity: 0.6,
  },
  oauthButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  appleOauthButton: {
    backgroundColor: '#ffffff',
    borderColor: '#1a1a1a',
  },
  googleOauthButton: {
    backgroundColor: '#ffffff',
    borderColor: '#1a1a1a',
  },
  oauthAppleIcon: {
    width: 20,
    height: 20,
    tintColor: '#000000',
  },
  oauthGoogleIcon: {
    width: 18,
    height: 18,
  },
  appleOauthButtonText: {
    color: '#1a1a1a',
    fontSize: 17,
    fontWeight: '700',
  },
  googleOauthButtonText: {
    color: '#1a1a1a',
    fontSize: 17,
    fontWeight: '600',
  },
  eulaLinkButton: {
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 24,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  eulaLinkText: {
    color: '#604a3e',
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(235, 184, 155, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingOverlayText: {
    color: '#604a3e',
    fontSize: 16,
    fontWeight: '600',
  },
});