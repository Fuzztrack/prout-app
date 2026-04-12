import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CustomButton } from '../components/CustomButton';
import { logSessionSnapshot, maskToken } from '../lib/authDebug';
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
    safeReplace(router, path, { skipInitialCheck: false });
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

  const startAppleOAuthFlow = async (timeoutId: NodeJS.Timeout) => {
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
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.MODAL,
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

  // Helper pour gérer le résultat OAuth
  const handleOAuthResult = async (result: any, timeoutId: NodeJS.Timeout) => {
    // Marquer qu'on est dans un flux OAuth pour éviter la redirection automatique dans _layout.tsx
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
      if (__DEV__) {
        console.log('🍏 [OAuthCallback]', {
          hasAccessToken: !!result.url?.includes('access_token='),
          hasRefreshToken: !!result.url?.includes('refresh_token='),
          hasError: !!result.url?.includes('error='),
        });
      }
      
      // Vérifier si l'URL contient les tokens
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
              return false;
            }
            
            if (data.session?.user) {
              console.log('✅ Session créée pour:', data.session.user.id);
              
              // ✅ TENTATIVE D'ENREGISTREMENT DU TOKEN PUSH IMMÉDIATE APRÈS OAUTH
              // Sur iOS, le retour du navigateur peut parfois être trop rapide pour le listener global
              registerPushTokenForUser(data.session.user.id).catch(err => {
                console.warn('⚠️ Erreur enregistrement token post-OAuth:', err);
              });

              console.log('🍏 [AuthDebug:oauthTokens]', {
                accessTokenPreview: maskToken(accessToken),
                refreshTokenPreview: maskToken(refreshToken),
              });
              logSessionSnapshot('AuthDebug:setSession', data.session);
              isOAuthBrowserAuthInProgressRef.current = false;
              
              // Récupérer les métadonnées utilisateur pour le pseudo
              const { data: { user } } = await supabase.auth.getUser();
              
              // 1. D'abord, chercher le pseudo d'inscription explicite
              let pseudoFromMetadata = user?.user_metadata?.pseudo || null;
              
              // 2. Si pas de pseudo d'inscription, extraire le prénom depuis Apple (full_name ou name)
              if (!pseudoFromMetadata || pseudoFromMetadata === 'Nouveau Membre') {
                const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || null;
                if (fullName) {
                  // Extraire le prénom (première partie avant l'espace)
                  const firstName = fullName.split(' ')[0].trim();
                  if (firstName && firstName.length > 0) {
                    pseudoFromMetadata = firstName;
                    console.log('👤 Prénom extrait depuis Apple:', firstName);
                    
                    // Stocker le prénom dans les métadonnées pour les prochaines connexions
                    const { error: updateMetaError } = await supabase.auth.updateUser({
                      data: {
                        ...(user?.user_metadata ?? {}),
                        pseudo: firstName,
                        pseudo_validated: false,
                      }
                    });
                    if (updateMetaError) {
                      console.error('❌ Erreur mise à jour métadonnées:', updateMetaError);
                    } else {
                      console.log('✅ Prénom stocké dans les métadonnées');
                    }
                  }
                }
              }
              
              console.log('👤 Pseudo final à utiliser:', pseudoFromMetadata);
              console.log('📦 Toutes les métadonnées:', JSON.stringify(user?.user_metadata, null, 2));
              
              // Vérifier d'abord le profil actuel
              const { data: currentProfile } = await supabase
                .from('user_profiles')
                .select('pseudo')
                .eq('id', data.session.user.id)
                .maybeSingle();
              
              console.log('📋 Profil actuel dans la DB:', currentProfile?.pseudo || 'aucun');
              
              // Mettre à jour le pseudo si nécessaire
              if (pseudoFromMetadata && pseudoFromMetadata !== 'Nouveau Membre') {
                await new Promise(resolve => setTimeout(resolve, 1000));
                
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
                
                let updateError;
                if (checkProfile) {
                  const { error } = await supabase
                    .from('user_profiles')
                    .update(updateData)
                    .eq('id', data.session.user.id);
                  updateError = error;
                } else {
                  const { error } = await supabase
                    .from('user_profiles')
                    .upsert({
                      id: data.session.user.id,
                      ...updateData
                    }, {
                      onConflict: 'id'
                    });
                  updateError = error;
                }
                
                if (updateError) {
                  console.error('❌ Erreur mise à jour pseudo:', updateError);
                } else {
                  console.log('✅ Pseudo mis à jour:', pseudoFromMetadata);
                  // Attendre que la mise à jour soit propagée dans la base
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  
                  // Vérifier que le profil a bien été mis à jour
                  const { data: verifyProfile } = await supabase
                    .from('user_profiles')
                    .select('pseudo')
                    .eq('id', data.session.user.id)
                    .maybeSingle();
                  
                  if (verifyProfile?.pseudo === pseudoFromMetadata) {
                    console.log('✅ Profil vérifié, pseudo correct:', verifyProfile.pseudo);
                  } else {
                    console.warn('⚠️ Profil pas encore synchronisé, pseudo DB:', verifyProfile?.pseudo, 'attendu:', pseudoFromMetadata);
                  }
                }
              }
              
              // Recharger les métadonnées après la mise à jour
              const { data: { user: updatedUser } } = await supabase.auth.getUser();
              const { data: { session: postCallbackSession } } = await supabase.auth.getSession();
              logSessionSnapshot('AuthDebug:postCallback:getSession', postCallbackSession);
              const finalPseudoFromMetadata = updatedUser?.user_metadata?.pseudo || pseudoFromMetadata;

              const effectiveUser = await ensureUserEulaAccepted(updatedUser);

              if (!isUserEulaAccepted(effectiveUser)) {
                console.log('➡️ OAuth OK → EULA acceptation requise');
                if (typeof (global as any).__isOAuthFlow === 'function') {
                  (global as any).__isOAuthFlow(false);
                }
                replaceWithSkip('/eula-accept');
                return true;
              }

              await syncLocalEulaAcceptanceFromUser(effectiveUser);
              
              // Vérifier le profil et naviguer
              const { data: profile } = await supabase
                .from('user_profiles')
                .select('pseudo')
                .eq('id', data.session.user.id)
                .maybeSingle();
              
              console.log('📋 Profil final trouvé:', profile?.pseudo || 'aucun');
              console.log('👤 Pseudo final depuis métadonnées:', finalPseudoFromMetadata);
              
              // Fonction pour détecter si un pseudo semble aléatoire (contient des chiffres/lettres aléatoires)
              const isPseudoRandom = (pseudo: string | null | undefined): boolean => {
                if (!pseudo) return true;
                if (pseudo === 'Nouveau Membre') return true;
                // Détecter les pseudos générés automatiquement par Supabase (format: User_[UUID])
                if (pseudo.startsWith('User_') && pseudo.length > 10) return true;
                // Détecter les pseudos qui semblent aléatoires (ex: "abc123xyz", UUID, etc.)
                const randomPattern = /^[a-z0-9]{8,}$/i; // 8+ caractères alphanumériques sans espaces
                const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                return randomPattern.test(pseudo) && !pseudo.includes(' ') || uuidPattern.test(pseudo);
              };
              
              // IMPORTANT :
              // Après OAuth, on est toujours sur cet écran (Welcome/AuthChoiceScreen).
              // RootLayout/index ne sera pas forcément monté → si on "attend" sa redirection, on reste bloqué ici.
              // Donc on navigue directement.
              const pseudoValidated = effectiveUser?.user_metadata?.pseudo_validated === true;
              const finalPseudo = profile?.pseudo || finalPseudoFromMetadata || null;
              const hasRealPseudo = !!finalPseudo && finalPseudo !== 'Nouveau Membre' && !isPseudoRandom(finalPseudo);
              
              // Fin du flux OAuth : on libère le routeur global et on navigue
              if (typeof (global as any).__isOAuthFlow === 'function') {
                (global as any).__isOAuthFlow(false);
              }
              
              if (!pseudoValidated || !hasRealPseudo) {
                console.log('➡️ OAuth OK → CompleteProfileScreen (validation requise)');
                replaceWithSkip('/CompleteProfileScreen');
                return true;
              }
              
              console.log('➡️ OAuth OK → Home');
              replaceWithSkip('/');
              
              return true;
            }
          } else {
            console.error('❌ Tokens OAuth introuvables ou invalides dans l’URL callback');
          }
        } catch (e: any) {
          console.error('❌ Erreur traitement URL:', e);
          isOAuthBrowserAuthInProgressRef.current = false;
          if (typeof (global as any).__isOAuthFlow === 'function') {
            (global as any).__isOAuthFlow(false);
          }
          setLoading(false);
          return false;
        }
      }
      
      // Si pas de tokens dans l'URL, attendre que le callback soit traité
      console.log('⏳ Pas de tokens dans l\'URL, attente callback...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Vérifier si la session a été créée
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('❌ Erreur récupération session:', sessionError);
        isOAuthBrowserAuthInProgressRef.current = false;
        if (typeof (global as any).__isOAuthFlow === 'function') {
          (global as any).__isOAuthFlow(false);
        }
        setLoading(false);
        return false;
      }
      
      if (session?.user) {
        console.log('✅ Session créée pour:', session.user.id);
        logSessionSnapshot('AuthDebug:postCallback:getSession', session);
        isOAuthBrowserAuthInProgressRef.current = false;
        if (typeof (global as any).__isOAuthFlow === 'function') {
          (global as any).__isOAuthFlow(false);
        }
        // Même si on n'a pas eu les tokens dans l'URL, une session existe → on déclenche la suite
        replaceWithSkip('/confirm-email');
        return true;
      } else {
        console.warn('⚠️ Pas de session après OAuth');
        isOAuthBrowserAuthInProgressRef.current = false;
        if (typeof (global as any).__isOAuthFlow === 'function') {
          (global as any).__isOAuthFlow(false);
        }
        setLoading(false);
        return false;
      }
    }
    
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
        // Marquer qu'on est dans un flux OAuth pour éviter la redirection automatique dans _layout.tsx
        if (typeof (global as any).__isOAuthFlow === 'function') {
          (global as any).__isOAuthFlow(true);
        }
        isOAuthBrowserAuthInProgressRef.current = true;
        
        const result = await openAuthSessionSafe(
          data.url, 
          redirectUrl,
          {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.MODAL,
            showInRecents: false,
          }
        );
        
        // Utiliser handleOAuthResult pour gérer le résultat de manière cohérente
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

  // 3. Connexion Apple
  const handleAppleLogin = async () => {
    if (!(await ensureEulaAccepted())) return;
    setLoading(true);
    isOAuthBrowserAuthInProgressRef.current = false;
    console.log('🍏 1. Début Apple Sign In');
    
    // Timeout de sécurité
    const timeoutId = setTimeout(() => {
      if (isOAuthBrowserAuthInProgressRef.current) {
        console.log('⏱️ Auth Apple toujours en cours dans le navigateur, on garde le chargement actif.');
        return;
      }
      console.warn('⏱️ Timeout Apple Sign In - réactivation du bouton');
      setLoading(false);
    }, 20000);
    
    try {
      // Flux unique OAuth Apple (iOS + Android) pour garantir un comportement stable au 1er essai.
      console.log(`🍏 2. ${Platform.OS === 'ios' ? 'iOS' : 'Android'} - Début OAuth Web Apple...`);
      await startAppleOAuthFlow(timeoutId);
      return;
    } catch (e: any) {
      isOAuthBrowserAuthInProgressRef.current = false;
      clearTimeout(timeoutId);
      if (e.code === 'ERR_REQUEST_CANCELED') {
        console.log('🍏 Connexion Apple annulée');
        if (typeof (global as any).__isOAuthFlow === 'function') {
          (global as any).__isOAuthFlow(false);
        }
        setLoading(false);
        return;
      }
      console.error('❌ ERREUR GLOBALE Apple:', e);
      console.error('❌ Détails erreur:', JSON.stringify(e, null, 2));
      if (typeof (global as any).__isOAuthFlow === 'function') {
        (global as any).__isOAuthFlow(false);
      }
      Alert.alert(
        'Erreur Apple', 
        e.message || 'Impossible de se connecter avec Apple. Essayez sur un appareil réel si vous êtes sur simulateur.'
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