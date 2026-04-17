-- ============================================
-- TRIGGER POUR CRÉER AUTOMATIQUEMENT LE PROFIL
-- Lorsqu'un utilisateur est créé dans auth.users
-- ============================================

-- Fonction trigger qui crée le profil dans user_profiles
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_pseudo TEXT;
  v_phone TEXT;
  v_expo_push_token TEXT;
BEGIN
  -- Extraire les métadonnées de l'utilisateur créé
  -- Ces données viennent de options.data dans signUp()
  v_pseudo := NEW.raw_user_meta_data->>'pseudo';
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_expo_push_token := NEW.raw_user_meta_data->>'expo_push_token';

  -- Si pas de pseudo dans les métadonnées, ne pas créer le profil
  -- (l'utilisateur devra compléter son profil plus tard)
  IF v_pseudo IS NULL OR v_pseudo = '' THEN
    RAISE WARNING 'Pas de pseudo dans les métadonnées pour l''utilisateur %, profil non créé', NEW.id;
    RETURN NEW;
  END IF;

  -- Vérifier si le pseudo est déjà utilisé par un autre utilisateur
  IF EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE pseudo = v_pseudo 
    AND id != NEW.id
  ) THEN
    -- Lever une exception qui remontera au client
    RAISE EXCEPTION 'Pseudo "%" déjà utilisé. Veuillez en choisir un autre.', v_pseudo
      USING ERRCODE = '23505', 
            HINT = 'unique_pseudo';
  END IF;

  -- Créer le profil dans user_profiles
  INSERT INTO user_profiles (id, pseudo, phone, expo_push_token)
  VALUES (
    NEW.id,
    v_pseudo,
    NULLIF(v_phone, '')::TEXT, -- Convertir chaîne vide en NULL
    NULLIF(v_expo_push_token, '')::TEXT -- Convertir chaîne vide en NULL
  )
  ON CONFLICT (id) DO NOTHING; -- Si le profil existe déjà, ne rien faire

  RETURN NEW;
END;
$$;

-- Créer le trigger sur auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- NOTES IMPORTANTES
-- ============================================
-- Ce trigger s'exécute automatiquement après chaque INSERT dans auth.users
-- Il extrait les métadonnées (pseudo, phone, expo_push_token) depuis raw_user_meta_data
-- et crée automatiquement le profil dans user_profiles
--
-- Avantages :
-- - Pas de problème de timing (le trigger s'exécute après la création de l'utilisateur)
-- - Pas besoin de fonction RPC côté client
-- - Pas besoin de retries ou de délais
-- - Gestion automatique des erreurs (pseudo déjà utilisé remonte au client)
--
-- Les métadonnées sont envoyées via options.data dans signUp() :
-- supabase.auth.signUp({
--   email: ...,
--   password: ...,
--   options: {
--     data: {
--       pseudo: ...,
--       phone: ...,
--       expo_push_token: ...
--     }
--   }
-- })

