import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Device from 'expo-device';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CustomButton } from '../components/CustomButton';
import { safePush, safeReplace } from '../lib/navigation';
import { getRedirectUrl, supabase } from '../lib/supabase';
import i18n from '../lib/i18n';

// Sécurité pour OAuth
WebBrowser.maybeCompleteAuthSession();

export default function AuthChoiceScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

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

  const openAuthSessionSafe = async (
    url: string,
    redirectUrl: string,
    options?: WebBrowser.WebBrowserOpenOptions,
  ) => {
    await closeAuthSessionIfNeeded();
    return WebBrowser.openAuthSessionAsync(url, redirectUrl, options);
  };

  // 1. Vérification simple pour éviter les sessions fantômes
  useEffect(() => {
    let isMounted = true;
    const checkUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          await supabase.auth.signOut();
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

  // Helper pour gérer le résultat OAuth
  const handleOAuthResult = async (result: any, timeoutId: NodeJS.Timeout) => {
    // Marquer qu'on est dans un flux OAuth pour éviter la redirection automatique dans _layout.tsx
    if (typeof (global as any).__isOAuthFlow === 'function') {
      (global as any).__isOAuthFlow(true);
    }
    
    if (result.type === 'cancel') {
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
      
      // Vérifier si l'URL contient les tokens
      if (result.url && result.url.includes('access_token') && result.url.includes('refresh_token')) {
        console.log('🔑 Tokens trouvés dans l\'URL, création de la session...');
        try {
          const accessTokenMatch = result.url.match(/access_token=([^&]+)/);
          const refreshTokenMatch = result.url.match(/refresh_token=([^&]+)/);

          if (accessTokenMatch && refreshTokenMatch) {
            const { data, error } = await supabase.auth.setSession({
              access_token: decodeURIComponent(accessTokenMatch[1]),
              refresh_token: decodeURIComponent(refreshTokenMatch[1]),
            });
            
            if (error) {
              console.error('❌ Erreur création session:', error);
              if (typeof (global as any).__isOAuthFlow === 'function') {
                (global as any).__isOAuthFlow(false);
              }
              setLoading(false);
              return false;
            }
            
            if (data.session?.user) {
              console.log('✅ Session créée pour:', data.session.user.id);
              setLoading(false);
              
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
                      data: { pseudo: firstName, pseudo_validated: false }
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
              const finalPseudoFromMetadata = updatedUser?.user_metadata?.pseudo || pseudoFromMetadata;
              
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
              const pseudoValidated = updatedUser?.user_metadata?.pseudo_validated === true;
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
              replaceWithSkip('/(tabs)');
              
              return true;
            }
          }
        } catch (e: any) {
          console.error('❌ Erreur traitement URL:', e);
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
        if (typeof (global as any).__isOAuthFlow === 'function') {
          (global as any).__isOAuthFlow(false);
        }
        setLoading(false);
        return false;
      }
      
      if (session?.user) {
        console.log('✅ Session créée pour:', session.user.id);
        if (typeof (global as any).__isOAuthFlow === 'function') {
          (global as any).__isOAuthFlow(false);
        }
        setLoading(false);
        // Même si on n'a pas eu les tokens dans l'URL, une session existe → on déclenche la suite
        replaceWithSkip('/confirm-email');
        return true;
      } else {
        console.warn('⚠️ Pas de session après OAuth');
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
    setLoading(true);
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
          console.warn('⏱️ Timeout Google Sign In - réactivation du bouton');
          if (typeof (global as any).__isOAuthFlow === 'function') {
            (global as any).__isOAuthFlow(false);
          }
          setLoading(false);
        }, 10000);
        
        await handleOAuthResult(result, timeoutId);
      }
    } catch (e: any) {
      Alert.alert(i18n.t('google_error'), e.message);
      setLoading(false);
    }
  };

  // 3. Connexion Apple
  const handleAppleLogin = async () => {
    setLoading(true);
    console.log('🍏 1. Début Apple Sign In');
    
    // Timeout de sécurité
    const timeoutId = setTimeout(() => {
      console.warn('⏱️ Timeout Apple Sign In - réactivation du bouton');
      setLoading(false);
    }, 10000);
    
    try {
      if (Platform.OS === 'ios') {
        // Vérifier si on est sur un simulateur (l'authentification native bloque sur simulateur)
        const isSimulator = !Device.isDevice;
        console.log('🍏 2. Appareil réel:', !isSimulator);
        
        if (isSimulator) {
          // Sur simulateur, utiliser directement OAuth Web (l'authentification native bloque)
          console.log('🍏 3. Simulateur détecté, utilisation OAuth Web directement');
          // Si non disponible (simulateur ou appareil non compatible), utiliser OAuth Web
          console.log('⚠️ Apple Authentication non disponible, utilisation du flux OAuth Web');
          const redirectUrl = Platform.OS === 'ios' ? 'prrtapp://login-callback' : 'proutapp://login-callback';
          
          console.log('🍏 4. Début OAuth Web Apple...');
          const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'apple',
            options: {
              redirectTo: redirectUrl,
              skipBrowserRedirect: true,
            },
          });

          if (error) {
            console.error('❌ Erreur OAuth Apple:', error);
            clearTimeout(timeoutId);
            throw error;
          }

          console.log('🍏 5. URL OAuth obtenue, ouverture navigateur...');
          if (data?.url) {
            // Marquer qu'on est dans un flux OAuth
            if ((global as any).__isOAuthFlow) {
              (global as any).__isOAuthFlow(true);
            }
            
            const result = await openAuthSessionSafe(
              data.url, 
              redirectUrl,
              {
                presentationStyle: WebBrowser.WebBrowserPresentationStyle.MODAL,
                showInRecents: false,
              }
            );
            console.log('🍏 6. Résultat navigateur:', result.type);
            await handleOAuthResult(result, timeoutId);
            return;
          }
          clearTimeout(timeoutId);
          setLoading(false);
          return;
        }
        
        // Vérifier si Apple Authentication est disponible
        console.log('🍏 3. Vérification disponibilité Apple Authentication...');
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        console.log('🍏 4. Apple Authentication disponible:', isAvailable);
        
        if (!isAvailable) {
          // Si non disponible, utiliser OAuth Web
          console.log('⚠️ Apple Authentication non disponible, utilisation du flux OAuth Web');
          const redirectUrl = Platform.OS === 'ios' ? 'prrtapp://login-callback' : 'proutapp://login-callback';
          
          console.log('🍏 5. Début OAuth Web Apple...');
          const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'apple',
            options: {
              redirectTo: redirectUrl,
              skipBrowserRedirect: true,
            },
          });

          if (error) {
            console.error('❌ Erreur OAuth Apple:', error);
            clearTimeout(timeoutId);
            throw error;
          }

          console.log('🍏 6. URL OAuth obtenue, ouverture navigateur...');
          if (data?.url) {
            // Marquer qu'on est dans un flux OAuth
            if ((global as any).__isOAuthFlow) {
              (global as any).__isOAuthFlow(true);
            }
            
            const result = await openAuthSessionSafe(
              data.url, 
              redirectUrl,
              {
                presentationStyle: WebBrowser.WebBrowserPresentationStyle.MODAL,
                showInRecents: false,
              }
            );
            console.log('🍏 7. Résultat navigateur:', result.type);
            await handleOAuthResult(result, timeoutId);
            return;
          }
          clearTimeout(timeoutId);
          setLoading(false);
          return;
        }

        // iOS - Authentification native avec FaceID (seulement sur appareil réel)
        try {
          console.log('🍏 5. Début authentification native Apple...');
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });

          console.log('🍏 5. Credential Apple reçu');
          if (!credential.identityToken) {
            throw new Error('Pas de token Apple reçu');
          }

          console.log('🍏 6. Token Apple reçu, envoi à Supabase...');
          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
            nonce: credential.nonce ?? undefined,
            options: {
              clientId: 'com.fuzztrack.proutapp',
            },
          });

          if (error) {
            console.error('❌ Erreur Supabase Apple:', error);
            clearTimeout(timeoutId);
            throw error;
          }

          console.log('✅ 7. Supabase connecté avec Apple !', data.user?.id);
          clearTimeout(timeoutId);
          
          // Marquer qu'on est dans un flux OAuth pour éviter la redirection automatique
          if (typeof (global as any).__isOAuthFlow === 'function') {
            (global as any).__isOAuthFlow(true);
          }
          
          // Extraire le prénom depuis Apple et rediriger directement vers CompleteProfileScreen
          if (data.user) {
            const fullName = credential.fullName?.givenName || credential.fullName?.familyName || null;
            let pseudoToUse = null;
            if (fullName) {
              pseudoToUse = fullName.split(' ')[0].trim();
              if (pseudoToUse && pseudoToUse.length > 0) {
                await supabase.auth.updateUser({
                  data: { pseudo: pseudoToUse, pseudo_from_apple: true, pseudo_validated: false }
                });
                console.log('✅ Prénom Apple stocké dans les métadonnées:', pseudoToUse);
              }
            }
            
            // Réinitialiser le flag OAuth après la navigation
            if (typeof (global as any).__isOAuthFlow === 'function') {
              (global as any).__isOAuthFlow(false);
            }
            
            replaceWithSkip('/CompleteProfileScreen'); // Toujours rediriger vers CompleteProfileScreen pour validation
          }
        } catch (nativeError: any) {
          // Si l'authentification native échoue (simulateur), fallback sur OAuth Web
          if (nativeError.code === 'ERR_REQUEST_CANCELED') {
            console.log('🍏 Annulation par l\'utilisateur');
            clearTimeout(timeoutId);
            setLoading(false);
            return;
          }
          
          console.error('❌ Erreur authentification native Apple:', nativeError);
          console.log('⚠️ Fallback sur OAuth Web...');
          
          const redirectUrl = Platform.OS === 'ios' ? 'prrtapp://login-callback' : 'proutapp://login-callback';
          
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

          if (data?.url) {
            // Marquer qu'on est dans un flux OAuth
            if ((global as any).__isOAuthFlow) {
              (global as any).__isOAuthFlow(true);
            }
            
            const result = await openAuthSessionSafe(
              data.url, 
              redirectUrl,
              {
                presentationStyle: WebBrowser.WebBrowserPresentationStyle.MODAL,
                showInRecents: false,
              }
            );
            await handleOAuthResult(result, timeoutId);
            return;
          }
          clearTimeout(timeoutId);
          if ((global as any).__isOAuthFlow) {
            (global as any).__isOAuthFlow(false);
          }
          setLoading(false);
        }
      } else {
        // Android - OAuth Web
        console.log('🍏 2. Android - Début OAuth Web Apple...');
        const redirectUrl = Platform.OS === 'ios' ? 'prrtapp://login-callback' : 'proutapp://login-callback';
        
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

        console.log('🍏 3. Android - URL OAuth obtenue');
        if (data?.url) {
          // Marquer qu'on est dans un flux OAuth
          if ((global as any).__isOAuthFlow) {
            (global as any).__isOAuthFlow(true);
          }
          
          const result = await openAuthSessionSafe(
            data.url, 
            redirectUrl,
            {
              presentationStyle: WebBrowser.WebBrowserPresentationStyle.MODAL,
              showInRecents: false,
            }
          );
          console.log('🍏 4. Android - Résultat navigateur:', result.type);
          await handleOAuthResult(result, timeoutId);
          return;
        }
        clearTimeout(timeoutId);
        setLoading(false);
      }
    } catch (e: any) {
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

  if (checking) {
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
            source={require('../assets/images/Prrt.png')} 
            style={styles.headerImage}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>{i18n.t('welcome')}</Text>

        <View style={styles.socialContainer}>
          <TouchableOpacity
            onPress={handleGoogleLogin}
            disabled={loading}
            style={styles.iconButton}
          >
            <Image
              source={require('../assets/images/google.png')}
              style={styles.socialIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleAppleLogin}
            disabled={loading}
            style={styles.iconButton}
          >
            <Image
              source={require('../assets/images/apple.png')}
              style={styles.appleIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.socialText}>{i18n.t('continue_with_social')}</Text>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.orText}>{i18n.t('or')}</Text>
          <View style={styles.divider} />
        </View>

        <CustomButton 
          title={i18n.t('signup_with_email')} 
          onPress={() => safePush(router, '/RegisterEmailScreen', { skipInitialCheck: false })} 
          color="#604a3e"
          textColor="#ebb89b"
        />

        <CustomButton
          title={i18n.t('already_have_account')}
          onPress={() => safePush(router, '/LoginScreen', { skipInitialCheck: false })}
          color="transparent"
          textColor="#604a3e"
          small
        />
      </ScrollView>
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 30,
    marginBottom: 15,
  },
  iconButton: {
    padding: 10,
  },
  socialIcon: {
    width: 44,
    height: 44,
  },
  appleIcon: {
    width: 64,
    height: 64,
  },
  socialText: {
    color: '#604a3e',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
});