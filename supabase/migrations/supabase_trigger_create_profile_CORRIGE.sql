-- ============================================================
-- 🧹 1. NETTOYAGE (On supprime les anciennes méthodes manuelles)
-- ============================================================

-- On supprime la fonction RPC complexe avec les retry (plus besoin)
DROP FUNCTION IF EXISTS create_user_profile(UUID, TEXT, TEXT, TEXT);

-- On supprime l'ancien trigger s'il existait déjà pour éviter les doublons
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ============================================================
-- 🚀 2. CRÉATION DU SYSTÈME AUTOMATIQUE (TRIGGER)
-- ============================================================

-- La fonction qui va créer le profil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER -- Exécute en tant qu'admin (contourne les restrictions de session)
SET search_path = public -- Sécurité recommandée
LANGUAGE plpgsql
AS $$
DECLARE
  v_pseudo TEXT;
  v_phone TEXT;
  v_expo_push_token TEXT;
BEGIN
  -- Extraire les métadonnées de l'utilisateur créé
  -- Ces données viennent de 'options.data' du signUp()
  v_pseudo := NEW.raw_user_meta_data->>'pseudo';
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_expo_push_token := NEW.raw_user_meta_data->>'expo_push_token';

  -- ⚠️ VALIDATION : Si pas de pseudo, ne pas créer le profil
  -- (l'utilisateur devra compléter son profil plus tard)
  IF v_pseudo IS NULL OR TRIM(v_pseudo) = '' THEN
    RAISE WARNING 'Pas de pseudo dans les métadonnées pour l''utilisateur %, profil non créé', NEW.id;
    RETURN NEW; -- On continue quand même, l'utilisateur pourra créer son profil plus tard
  END IF;

  -- 🔒 SÉCURITÉ : Vérifier si le pseudo est déjà utilisé par un autre utilisateur
  -- Si oui, lever une exception qui empêchera la création de l'utilisateur
  -- et remontera l'erreur au client
  IF EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE pseudo = TRIM(v_pseudo)
    AND id != NEW.id
  ) THEN
    -- Lever une exception qui remontera au client via authError
    RAISE EXCEPTION 'Pseudo "%" déjà utilisé. Veuillez en choisir un autre.', TRIM(v_pseudo)
      USING ERRCODE = '23505', 
            HINT = 'unique_pseudo';
  END IF;

  -- ✅ CRÉATION : Cette insertion se fait AVANT l'envoi de l'email de confirmation
  INSERT INTO public.user_profiles (id, pseudo, phone, expo_push_token)
  VALUES (
    NEW.id, -- L'ID vient de auth.users
    TRIM(v_pseudo), -- Nettoyer les espaces
    NULLIF(TRIM(v_phone), '')::TEXT, -- Convertir chaîne vide en NULL
    NULLIF(TRIM(v_expo_push_token), '')::TEXT -- Convertir chaîne vide en NULL
  )
  ON CONFLICT (id) DO NOTHING; -- Si le profil existe déjà (cas rare), ne rien faire

  RETURN NEW;
END;
$$;

-- Le déclencheur qui active la fonction à chaque inscription
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 🔒 3. SÉCURITÉ (Rappel des politiques RLS)
-- ============================================================

-- Assure-toi que RLS est activé
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Autoriser la lecture pour les utilisateurs authentifiés (pour que les amis puissent voir ce profil)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON user_profiles;
DROP POLICY IF EXISTS "Users can read public profiles" ON user_profiles;
CREATE POLICY "Users can read public profiles" 
ON user_profiles FOR SELECT 
USING (auth.role() = 'authenticated'); -- Seulement les utilisateurs authentifiés

-- Autoriser la lecture de son propre profil
DROP POLICY IF EXISTS "Users can read their own profile" ON user_profiles;
CREATE POLICY "Users can read their own profile" 
ON user_profiles FOR SELECT 
USING (auth.uid() = id);

-- Autoriser la modification (pour que l'utilisateur puisse changer son pseudo plus tard)
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile" 
ON user_profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- NOTE: Plus besoin de politique "INSERT", c'est le serveur qui le fait maintenant via le trigger.

-- ============================================================
-- ✅ VÉRIFICATION
-- ============================================================
-- Pour vérifier que le trigger est bien créé :
-- SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
--
-- Pour vérifier les politiques RLS :
-- SELECT * FROM pg_policies WHERE tablename = 'user_profiles';

