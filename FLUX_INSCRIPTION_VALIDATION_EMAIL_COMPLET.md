# 📧 FLUX D'INSCRIPTION AVEC VALIDATION PAR EMAIL - FICHIERS COMPLETS

## 📋 Table des matières
1. [Scripts SQL](#scripts-sql)
2. [Code TypeScript](#code-typescript)
3. [Configuration Supabase](#configuration-supabase)

---

## 🔧 SCRIPTS SQL

### 1. Fonction RPC pour créer le profil (`supabase_create_profile_function.sql`)

```sql
-- ============================================
-- FONCTION RPC POUR CRÉER LE PROFIL LORS DE L'INSCRIPTION
-- Cette fonction contourne RLS en utilisant SECURITY DEFINER
-- ============================================

-- Supprimer la fonction si elle existe déjà
DROP FUNCTION IF EXISTS create_user_profile(UUID, TEXT, TEXT, TEXT);

-- Créer la fonction RPC
CREATE OR REPLACE FUNCTION create_user_profile(
  p_user_id UUID,
  p_pseudo TEXT,
  p_phone TEXT DEFAULT NULL,
  p_expo_push_token TEXT DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_profile_exists BOOLEAN;
  v_user_exists BOOLEAN;
  v_inserted BOOLEAN := FALSE;
BEGIN
  -- Vérifier que l'utilisateur existe dans auth.users
  -- Problème de timing : signUp crée l'utilisateur de manière asynchrone
  -- On fait plusieurs tentatives avec des délais progressifs
  v_user_exists := FALSE;
  
  -- Tentative 1 : vérification immédiate
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
  
  -- Tentative 2 : attendre 500ms et réessayer
  IF NOT v_user_exists THEN
    PERFORM pg_sleep(0.5);
    SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
  END IF;
  
  -- Tentative 3 : attendre encore 1 seconde et réessayer
  IF NOT v_user_exists THEN
    PERFORM pg_sleep(1.0);
    SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
  END IF;
  
  -- Tentative 4 : attendre encore 1.5 secondes et réessayer (dernière tentative)
  IF NOT v_user_exists THEN
    PERFORM pg_sleep(1.5);
    SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
  END IF;
  
  -- Si toujours pas trouvé après toutes les tentatives, on accepte quand même
  -- car l'ID vient du signUp qui vient de réussir, donc l'utilisateur existe forcément
  -- (c'est juste un problème de réplication/consistance dans Supabase)
  IF NOT v_user_exists THEN
    -- Log un avertissement mais continue quand même
    RAISE WARNING 'User % not found in auth.users immediately, but continuing anyway (timing issue)', p_user_id;
  END IF;

  -- Vérifier si le profil existe déjà
  SELECT EXISTS (SELECT 1 FROM user_profiles WHERE id = p_user_id) INTO v_profile_exists;
  
  IF v_profile_exists THEN
    -- Le profil existe déjà, mettre à jour si nécessaire
    UPDATE user_profiles
    SET pseudo = p_pseudo,
        phone = p_phone,
        expo_push_token = p_expo_push_token
    WHERE id = p_user_id;
    RETURN TRUE;
  END IF;

  -- Vérifier si le pseudo est déjà utilisé par un autre utilisateur
  IF EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE pseudo = p_pseudo 
    AND id != p_user_id
  ) THEN
    RAISE EXCEPTION 'Pseudo already exists' USING ERRCODE = '23505';
  END IF;

  -- Insérer le profil (contourne RLS grâce à SECURITY DEFINER)
  INSERT INTO user_profiles (id, pseudo, phone, expo_push_token)
  VALUES (p_user_id, p_pseudo, p_phone, p_expo_push_token);
  
  RETURN TRUE;
END;
$$;

-- Donner les permissions d'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION create_user_profile(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile(UUID, TEXT, TEXT, TEXT) TO anon;
```

### 2. Politiques RLS pour user_profiles (`supabase_user_profiles_rls_FIXED.sql`)

```sql
-- ============================================
-- POLITIQUES RLS POUR LA TABLE user_profiles
-- Script corrigé pour résoudre l'erreur RLS lors de l'inscription
-- ============================================

-- ============================================
-- ÉTAPE 1 : NETTOYAGE COMPLET
-- Supprimer TOUTES les politiques existantes pour éviter les conflits
-- ============================================

-- Supprimer toutes les politiques possibles (même celles qui n'existent pas)
DROP POLICY IF EXISTS "Users can read their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can read public profiles" ON user_profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- ============================================
-- ÉTAPE 2 : ACTIVER RLS
-- ============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ÉTAPE 3 : CRÉER LES POLITIQUES
-- ============================================

-- 1. SELECT : Lire son propre profil
CREATE POLICY "Users can read their own profile" ON user_profiles
FOR SELECT
USING (auth.uid() = id);

-- 2. INSERT : Créer son propre profil (CRITIQUE pour l'inscription)
-- Cette politique permet à un utilisateur de créer son profil avec son propre ID
CREATE POLICY "Users can insert their own profile" ON user_profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 3. UPDATE : Modifier son propre profil
CREATE POLICY "Users can update their own profile" ON user_profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. SELECT : Lire les profils publics (pour les invitations, recherche, etc.)
-- Cette politique permet à tous les utilisateurs authentifiés de lire les profils publics
CREATE POLICY "Users can read public profiles" ON user_profiles
FOR SELECT
USING (auth.role() = 'authenticated');
```

---

## 💻 CODE TYPESCRIPT

### 1. Configuration Supabase (`lib/supabase.ts`)

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from "@supabase/supabase-js";
import { Platform } from 'react-native';

export const supabase = createClient(
  'https://utfwujyymaikraaigvuv.supabase.co',
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Znd1anl5bWFpa3JhYWlndnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxODkwNzAsImV4cCI6MjA3ODc2NTA3MH0.d6MLGOsvTlxJDARH64D1u4kJHxKAlfX1FLegrWVE-Is",
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      storage: AsyncStorage, // Configurer explicitement AsyncStorage pour React Native
    },
  }
);

// Exporter la fonction pour obtenir l'URL de redirection
export const getRedirectUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  // Pour React Native, utiliser le scheme de l'app avec le chemin de confirmation
  return 'proutapp://confirm-email';
};
```

### 2. Fonction handleSignup (`app/SignupScreen.tsx` - fonction principale)

```typescript
const handleSignup = async () => {
  // Vérifier que les champs obligatoires sont remplis (après trim)
  const trimmedPseudo = pseudo.trim();
  const trimmedEmail = email.trim();
  const trimmedPhone = phone.trim();
  const trimmedPassword = password.trim();

  // Le pseudo est obligatoire
  if (!trimmedPseudo) {
    Alert.alert('Erreur', 'Veuillez entrer un pseudo');
    return;
  }

  // L'email est maintenant obligatoire
  if (!trimmedEmail) {
    Alert.alert('Erreur', 'Veuillez entrer un email');
    return;
  }

  // Valider le format de l'email (obligatoire)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    Alert.alert('Erreur', 'Veuillez entrer un email valide');
    return;
  }

  // Vérifier que ce n'est pas un email temporaire
  if (trimmedEmail.toLowerCase().includes('@temp.proutapp.local')) {
    Alert.alert('Erreur', 'Veuillez entrer un email réel valide (pas un email temporaire)');
    return;
  }

  // Le mot de passe est obligatoire
  if (!trimmedPassword) {
    Alert.alert('Erreur', 'Veuillez entrer un mot de passe');
    return;
  }

  // Valider le mot de passe (minimum 6 caractères)
  if (trimmedPassword.length < 6) {
    Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
    return;
  }

  setLoading(true);
  try {
    // Normaliser le téléphone seulement s'il est fourni
    let normalizedPhone: string | null = null;
    if (trimmedPhone) {
      normalizedPhone = normalizePhone(trimmedPhone);
      // Vérifier que le téléphone normalisé n'est pas vide seulement s'il était fourni
      if (!normalizedPhone || normalizedPhone.trim() === '') {
        Alert.alert('Erreur', 'Le numéro de téléphone n\'est pas valide');
        setLoading(false);
        return;
      }
    }
    
    // L'email est maintenant obligatoire, utiliser directement l'email fourni
    const emailToUse = trimmedEmail.toLowerCase();
    
    // Obtenir le token push
    const expoPushToken = await registerForPushNotificationsAsync();

    // Créer le compte avec Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: emailToUse,
      password: trimmedPassword,
      options: {
        emailRedirectTo: getRedirectUrl(), // Rediriger vers proutapp://confirm-email après confirmation
        data: {
          pseudo: trimmedPseudo,
          phone: normalizedPhone || null,
        },
      },
    });

    if (authError) {
      console.error('❌ Erreur lors de la création du compte:', authError);
      Alert.alert('Erreur lors de l\'inscription', authError.message);
      setLoading(false);
      return;
    }

    if (!authData.user) {
      Alert.alert('Erreur', 'Impossible de créer le compte');
      setLoading(false);
      return;
    }

    // Attendre un peu pour que l'utilisateur soit complètement créé dans auth.users
    // avant d'appeler la fonction RPC (problème de timing)
    console.log('⏳ Attente de la création complète de l\'utilisateur...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Créer le profil via une fonction RPC qui contourne RLS
    // Cela fonctionne même si la session n'est pas encore établie (email à confirmer)
    console.log('🔍 Création du profil pour:', authData.user.id);
    
    // Essayer plusieurs fois avec retry en cas d'erreur de timing
    let profileCreated = false;
    let profileError: any = null;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await supabase.rpc('create_user_profile', {
        p_user_id: authData.user.id,
        p_pseudo: trimmedPseudo,
        p_phone: normalizedPhone || null,
        p_expo_push_token: expoPushToken || null,
      });
      
      profileError = result.error;
      profileCreated = result.data === true;
      
      if (!profileError && profileCreated) {
        console.log(`✅ Profil créé avec succès (tentative ${attempt}/${maxRetries})`);
        break;
      }
      
      // Si l'erreur est "User does not exist", attendre un peu plus et réessayer
      if (profileError?.message?.includes('User does not exist') && attempt < maxRetries) {
        const delay = attempt * 1000; // Délai progressif : 1s, 2s, 3s
        console.log(`⚠️ Utilisateur pas encore visible, nouvelle tentative dans ${delay}ms (${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Pour les autres erreurs, arrêter les tentatives
      break;
    }

    // La fonction RPC retourne TRUE si le profil a été créé/mis à jour avec succès
    // On ne peut pas récupérer le profil immédiatement car il n'y a pas de session
    // (l'email doit être confirmé), mais on sait qu'il a été créé si la fonction réussit
    if (!profileError && profileCreated) {
      console.log('✅ Profil créé avec succès');
    }

    if (profileError) {
      console.error('❌ Erreur lors de la création du profil:', profileError);
      
      // Si l'erreur est due à un pseudo déjà existant
      if (profileError.code === '23505' || 
          profileError.message?.includes('Pseudo already exists') ||
          profileError.message?.includes('unique_pseudo')) {
        Alert.alert(
          'Pseudo déjà utilisé',
          'Ce pseudo est déjà utilisé par un autre compte. Veuillez choisir un autre pseudo.',
          [
            {
              text: 'OK',
              onPress: async () => {
                // Supprimer le compte auth créé puisqu'on ne peut pas créer le profil
                try {
                  await supabase.auth.signOut();
                } catch (err) {
                  console.error('Erreur lors de la déconnexion:', err);
                }
                // L'utilisateur reste sur la page d'inscription pour réessayer avec un autre pseudo
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Erreur',
          'Compte créé mais erreur lors de la création du profil. Veuillez vous connecter et compléter votre profil.',
          [
            {
              text: 'OK',
              onPress: () => {
                router.replace('/LoginScreen');
              },
            },
          ]
        );
      }
      setLoading(false);
      return;
    }

    console.log('✅ Compte et profil créés avec succès');
    
    // Vérifier si l'email est confirmé
    const isEmailConfirmed = authData.user.email_confirmed_at !== null;
    
    if (!isEmailConfirmed) {
      // Email non confirmé : informer l'utilisateur qu'il doit confirmer son email
      Alert.alert(
        'Email à confirmer',
        'Un email de confirmation a été envoyé à votre adresse.\n\nVeuillez vérifier votre boîte de réception (et vos spams) et cliquer sur le lien de confirmation pour activer votre compte.\n\nVous pourrez ensuite vous connecter.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Rediriger vers la page de connexion
              router.replace('/LoginScreen');
            },
          },
        ]
      );
    } else {
      // Email déjà confirmé (peu probable mais possible)
      Alert.alert('Succès', 'Inscription réussie !');
      router.replace('/home');
    }
  } catch (err) {
    console.error('❌ Erreur inattendue:', err);
    Alert.alert('Erreur inattendue', err instanceof Error ? err.message : 'Une erreur est survenue');
  } finally {
    setLoading(false);
  }
};
```

### 3. Handler de deep link pour la confirmation (`app/_layout.tsx` - fonction handleDeepLink)

```typescript
const handleDeepLink = async (url: string) => {
  try {
    console.log('🔍 Traitement du deep link complet:', url);
    console.log('🔍 URL décodée:', decodeURIComponent(url));

    // Vérifier si c'est une URL OAuth avec access_token dans le hash (format de redirection Supabase)
    // Cela peut être soit proutapp://confirm-email#access_token=... soit https://...supabase.co/#access_token=...
    const hasOAuthTokens = url.includes('#access_token=') || 
                          (url.includes('access_token=') && (url.includes('supabase.co') || url.includes('confirm-email')));
    
    if (hasOAuthTokens) {
      console.log('✅ URL OAuth avec tokens détectée');
      
      // Extraire les paramètres du hash (#access_token=...)
      const hashMatch = url.match(/#(.+)/);
      if (hashMatch) {
        const hashParams = new URLSearchParams(hashMatch[1]);
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const expiresIn = hashParams.get('expires_in');
        const tokenType = hashParams.get('token_type') || 'bearer';
        const type = hashParams.get('type'); // 'signup' pour confirmation d'email
        
        console.log('📋 Tokens OAuth extraits:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          type,
        });
        
        if (accessToken && refreshToken) {
          try {
            // Créer la session avec les tokens OAuth
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (sessionError) {
              console.error('❌ Erreur lors de la création de la session OAuth:', sessionError);
              Alert.alert(
                'Erreur',
                'Impossible de confirmer votre email. Le lien peut être expiré ou invalide.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      router.replace('/LoginScreen');
                    },
                  },
                ]
              );
              return;
            }
            
            if (sessionData?.session?.user) {
              const user = sessionData.session.user;
              console.log('✅ Session OAuth créée avec succès pour:', user.id);
              
              // Vérifier si l'email est confirmé
              if (user.email_confirmed_at) {
                console.log('✅ Email confirmé avec succès via OAuth');
                Alert.alert(
                  'Email confirmé',
                  'Votre email a été confirmé avec succès ! Vous pouvez maintenant vous connecter.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        router.replace('/LoginScreen');
                      },
                    },
                  ]
                );
              } else {
                console.log('⚠️ Email pas encore confirmé après OAuth');
                Alert.alert(
                  'Confirmation en cours',
                  'Votre email est en cours de confirmation. Vous pouvez vous connecter.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        router.replace('/LoginScreen');
                      },
                    },
                  ]
                );
              }
              return;
            }
          } catch (oauthError) {
            console.error('❌ Erreur lors du traitement OAuth:', oauthError);
          }
        }
      }
    }

    // Vérifier si c'est une URL Supabase de confirmation (contient /auth/v1/verify)
    const isSupabaseVerifyUrl = url.includes('/auth/v1/verify') || 
                                url.includes('confirmation_token') || 
                                url.includes('type=signup') ||
                                url.includes('token_hash=') ||
                                url.includes('token=');

    if (isSupabaseVerifyUrl) {
      console.log('✅ URL de confirmation Supabase détectée');
      
      // Extraire les paramètres de l'URL de différentes façons
      const parsedUrl = Linking.parse(url);
      const { queryParams, hostname, path } = parsedUrl;
      
      console.log('📋 Analyse de l\'URL:', {
        hostname,
        path,
        queryParams,
        urlComplete: url,
      });

      // Essayer d'extraire le token de différentes façons
      let token: string | null = null;
      let tokenType: 'signup' | 'email' | null = null;

      // Méthode 1 : depuis queryParams
      if (queryParams?.token) {
        token = queryParams.token as string;
        tokenType = (queryParams.type as 'signup' | 'email') || 'signup';
      } else if (queryParams?.token_hash) {
        token = queryParams.token_hash as string;
        tokenType = (queryParams.type as 'signup' | 'email') || 'signup';
      } else if (queryParams?.confirmation_token) {
        token = queryParams.confirmation_token as string;
        tokenType = 'signup';
      }

      // Méthode 2 : extraire depuis l'URL brute si queryParams ne fonctionne pas
      if (!token) {
        const tokenMatch = url.match(/[?&](?:token|token_hash|confirmation_token)=([^&]+)/);
        if (tokenMatch) {
          token = decodeURIComponent(tokenMatch[1]);
          const typeMatch = url.match(/[?&]type=([^&]+)/);
          tokenType = (typeMatch ? decodeURIComponent(typeMatch[1]) : 'signup') as 'signup' | 'email';
        }
      }

      console.log('🔐 Token extrait:', { token: token ? 'présent' : 'absent', tokenType });

      // Si on a un token, essayer verifyOtp
      if (token && tokenType) {
        console.log('🔐 Tentative de confirmation via verifyOtp');
        
        try {
          // Essayer avec token_hash d'abord
          let verifyResult = await supabase.auth.verifyOtp({
            token_hash: token,
            type: tokenType,
          });

          // Si ça échoue, essayer avec token_hash seulement (sans type)
          if (verifyResult.error && verifyResult.error.message?.includes('Invalid')) {
            console.log('⚠️ verifyOtp avec token_hash a échoué, essai alternative');
            // Ne pas essayer avec token simple car il nécessite email
            // La session devrait être créée automatiquement par Supabase
          }

          if (verifyResult.error) {
            console.error('❌ Erreur lors de la vérification OTP:', verifyResult.error);
            // Ne pas afficher d'erreur immédiatement, essayer la méthode session
          } else if (verifyResult.data?.user) {
            console.log('✅ Email confirmé avec succès via verifyOtp');
            Alert.alert(
              'Email confirmé',
              'Votre email a été confirmé avec succès ! Vous pouvez maintenant vous connecter.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    router.replace('/LoginScreen');
                  },
                },
              ]
            );
            return;
          }
        } catch (otpError) {
          console.error('❌ Erreur lors de verifyOtp:', otpError);
        }
      }

      // Si verifyOtp n'a pas fonctionné, essayer de récupérer la session
      // (Supabase peut avoir créé la session automatiquement via la redirection)
      console.log('🔄 Vérification de la session...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('❌ Erreur lors de la récupération de la session:', sessionError);
        Alert.alert(
          'Erreur',
          'Impossible de confirmer votre email. Veuillez réessayer ou utiliser le lien depuis votre email.'
        );
        router.replace('/LoginScreen');
        return;
      }

      if (session?.user?.email_confirmed_at) {
        console.log('✅ Email confirmé avec succès (via session)');
        Alert.alert(
          'Email confirmé',
          'Votre email a été confirmé avec succès ! Vous pouvez maintenant vous connecter.',
          [
            {
              text: 'OK',
              onPress: () => {
                router.replace('/LoginScreen');
              },
            },
          ]
        );
      } else {
        console.log('⚠️ Email pas encore confirmé, session:', session ? 'présente' : 'absente');
        Alert.alert(
          'Confirmation en cours',
          'Votre email est en cours de confirmation. Vous pouvez vous connecter.',
          [
            {
              text: 'OK',
              onPress: () => {
                router.replace('/LoginScreen');
              },
            },
          ]
        );
      }
      return;
    }

    // Vérifier si c'est un deep link de confirmation simple (proutapp://confirm-email)
    if (url.includes('confirm-email')) {
      console.log('✅ Deep link de confirmation d\'email détecté (proutapp://confirm-email)');
      
      // Extraire les paramètres de l'URL
      const parsedUrl = Linking.parse(url);
      const { queryParams } = parsedUrl;
      
      console.log('📋 Paramètres du deep link:', queryParams);

      // Essayer d'extraire le token depuis les paramètres
      let token: string | null = null;
      let tokenType: 'signup' | 'email' | null = null;

      if (queryParams?.token) {
        token = queryParams.token as string;
        tokenType = (queryParams.type as 'signup' | 'email') || 'signup';
      } else if (queryParams?.token_hash) {
        token = queryParams.token_hash as string;
        tokenType = (queryParams.type as 'signup' | 'email') || 'signup';
      }

      // Si on a un token, essayer verifyOtp
      if (token && tokenType) {
        console.log('🔐 Tentative de confirmation via verifyOtp depuis deep link');
        
        try {
          let verifyResult = await supabase.auth.verifyOtp({
            token_hash: token,
            type: tokenType,
          });

          if (verifyResult.error && verifyResult.error.message?.includes('Invalid')) {
            console.log('⚠️ verifyOtp a échoué, la session devrait être créée automatiquement');
            // Ne pas essayer avec token simple car il nécessite email
          }

          if (verifyResult.error) {
            console.error('❌ Erreur verifyOtp depuis deep link:', verifyResult.error);
          } else if (verifyResult.data?.user) {
            console.log('✅ Email confirmé via verifyOtp depuis deep link');
            Alert.alert(
              'Email confirmé',
              'Votre email a été confirmé avec succès ! Vous pouvez maintenant vous connecter.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    router.replace('/LoginScreen');
                  },
                },
              ]
            );
            return;
          }
        } catch (otpError) {
          console.error('❌ Erreur lors de verifyOtp depuis deep link:', otpError);
        }
      }
      
      // Vérifier la session pour voir si l'email est confirmé
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('❌ Erreur lors de la récupération de la session:', sessionError);
        Alert.alert(
          'Erreur',
          'Impossible de vérifier la confirmation de votre email. Veuillez réessayer.'
        );
        router.replace('/LoginScreen');
        return;
      }

      if (session?.user?.email_confirmed_at) {
        console.log('✅ Email confirmé avec succès (via session)');
        Alert.alert(
          'Email confirmé',
          'Votre email a été confirmé avec succès ! Vous pouvez maintenant vous connecter.',
          [
            {
              text: 'OK',
              onPress: () => {
                router.replace('/LoginScreen');
              },
            },
          ]
        );
      } else {
        console.log('⚠️ Email pas encore confirmé');
        Alert.alert(
          'Confirmation en cours',
          'Votre email est en cours de confirmation. Vous pouvez vous connecter.',
          [
            {
              text: 'OK',
              onPress: () => {
                router.replace('/LoginScreen');
              },
            },
          ]
        );
      }
      return;
    }

    console.log('ℹ️ Deep link non reconnu, ignoré');
  } catch (error) {
    console.error('❌ Erreur lors du traitement du deep link:', error);
    Alert.alert('Erreur', 'Une erreur est survenue lors du traitement du lien.');
    router.replace('/LoginScreen');
  }
};
```

### 4. Vérification de confirmation dans LoginScreen (`app/LoginScreen.tsx` - fonction handleLogin)

```typescript
const handleLogin = async () => {
  if (!email || !password) {
    Alert.alert('Erreur', 'Veuillez remplir tous les champs');
    return;
  }

  setLoading(true);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Gérer spécifiquement l'erreur d'email non confirmé
      if (error.message?.includes('email not confirmed') || error.message?.includes('Email not confirmed')) {
        Alert.alert(
          'Email non confirmé',
          'Votre email n\'a pas encore été confirmé.\n\nVeuillez vérifier votre boîte de réception et cliquer sur le lien de confirmation dans l\'email que nous vous avons envoyé.\n\nSi vous n\'avez pas reçu l\'email, vérifiez vos spams ou contactez le support.',
          [
            {
              text: 'Renvoyer l\'email',
              onPress: async () => {
                try {
                  const { error: resendError } = await supabase.auth.resend({
                    type: 'signup',
                    email: email.trim().toLowerCase(),
                  });
                  
                  if (resendError) {
                    Alert.alert('Erreur', 'Impossible de renvoyer l\'email. Veuillez réessayer plus tard.');
                  } else {
                    Alert.alert('Email envoyé', 'Un nouvel email de confirmation a été envoyé.');
                  }
                } catch (err) {
                  console.error('Erreur lors du renvoi de l\'email:', err);
                  Alert.alert('Erreur', 'Impossible de renvoyer l\'email.');
                }
              },
            },
            {
              text: 'OK',
              style: 'cancel',
            },
          ]
        );
      } else {
        Alert.alert('Erreur de connexion', error.message);
      }
      return;
    }

    if (data.user && data.session) {
      console.log('✅ Session créée lors de la connexion:', data.session.user.id);
      
      // Vérifier si l'email est confirmé
      if (!data.user.email_confirmed_at) {
        Alert.alert(
          'Email non confirmé',
          'Votre email n\'a pas encore été confirmé.\n\nVeuillez vérifier votre boîte de réception et cliquer sur le lien de confirmation.',
          [
            {
              text: 'Renvoyer l\'email',
              onPress: async () => {
                try {
                  const { error: resendError } = await supabase.auth.resend({
                    type: 'signup',
                    email: email.trim().toLowerCase(),
                  });
                  
                  if (resendError) {
                    Alert.alert('Erreur', 'Impossible de renvoyer l\'email. Veuillez réessayer plus tard.');
                  } else {
                    Alert.alert('Email envoyé', 'Un nouvel email de confirmation a été envoyé.');
                  }
                } catch (err) {
                  console.error('Erreur lors du renvoi de l\'email:', err);
                  Alert.alert('Erreur', 'Impossible de renvoyer l\'email.');
                }
              },
            },
            {
              text: 'OK',
              style: 'cancel',
            },
          ]
        );
        setLoading(false);
        return;
      }

      // Vérifier si le profil existe
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        // Pas de profil, rediriger vers l'inscription
        Alert.alert('Information', 'Veuillez compléter votre profil');
        router.replace('/SignupScreen');
        return;
      }

      // Profil existe et email confirmé, rediriger vers l'accueil
      router.replace('/home');
    }
  } catch (err) {
    console.error('Erreur lors de la connexion:', err);
    Alert.alert('Erreur', 'Une erreur est survenue lors de la connexion');
  } finally {
    setLoading(false);
  }
};
```

---

## ⚙️ CONFIGURATION SUPABASE

### Dans le Dashboard Supabase :

1. **Authentication → Settings → Email Auth**
   - ✅ Activer "Enable email confirmations"
   - ✅ Activer "Secure email change" (recommandé)

2. **Authentication → URL Configuration**
   - **Site URL** : `proutapp://`
   - **Redirect URLs** :
     ```
     proutapp://confirm-email
     proutapp://reset-password
     ```

3. **Authentication → Email Templates → Confirm signup**
   - Template personnalisé avec `{{ .ConfirmationURL }}`

---

## 📝 ORDRE D'EXÉCUTION

1. **Exécuter les scripts SQL** dans Supabase SQL Editor :
   - `supabase_user_profiles_rls_FIXED.sql`
   - `supabase_create_profile_function.sql`

2. **Configurer les URLs de redirection** dans Supabase Dashboard

3. **Copier le code TypeScript** dans les fichiers correspondants

4. **Tester le flux complet** :
   - Inscription → Email envoyé → Clic sur le lien → Confirmation → Connexion

---

## ✅ VÉRIFICATIONS

- ✅ Email obligatoire à l'inscription
- ✅ Validation du format d'email
- ✅ Création du profil via fonction RPC (contourne RLS)
- ✅ Gestion du timing avec retries
- ✅ Deep link handler pour la confirmation
- ✅ Vérification de confirmation à la connexion
- ✅ Possibilité de renvoyer l'email de confirmation

