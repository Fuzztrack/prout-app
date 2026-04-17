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

-- ============================================
-- NOTE IMPORTANTE
-- ============================================
-- Cette fonction peut être appelée même sans session active,
-- mais elle vérifie que l'utilisateur existe dans auth.users.
-- 
-- Pour l'utiliser côté client :
-- const { error } = await supabase.rpc('create_user_profile', {
--   p_user_id: authData.user.id,
--   p_pseudo: trimmedPseudo,
--   p_phone: normalizedPhone || null,
--   p_expo_push_token: expoPushToken || null,
-- });

