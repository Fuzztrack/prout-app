-- Fonction pour mettre à jour last_interaction_at sans modifier le status existant
-- Si la relation n'existe pas, elle sera créée avec status='accepted'
-- Version simplifiée et robuste
CREATE OR REPLACE FUNCTION update_friend_interaction(
  p_user_id UUID,
  p_friend_id UUID,
  p_last_interaction_at TIMESTAMPTZ
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
  existing_method TEXT;
BEGIN
  -- 1. Essayer de mettre à jour la relation existante (préserve status et method)
  UPDATE friends
  SET last_interaction_at = p_last_interaction_at
  WHERE user_id = p_user_id 
    AND friend_id = p_friend_id;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- 2. Si aucune ligne n'a été mise à jour, créer la relation
  IF updated_count = 0 THEN
    -- Vérifier si une relation inverse existe pour récupérer le method
    -- (si B→A existe déjà, utiliser le même method pour A→B)
    SELECT method INTO existing_method
    FROM friends
    WHERE user_id = p_friend_id 
      AND friend_id = p_user_id
    LIMIT 1;
    
    -- Utiliser INSERT avec ON CONFLICT
    -- Si une relation inverse existe, utiliser son method, sinon utiliser 'search' par défaut
    -- 'search' semble être une valeur acceptée par la contrainte CHECK d'après le code
    INSERT INTO friends (user_id, friend_id, last_interaction_at, status, method)
    VALUES (
      p_user_id, 
      p_friend_id, 
      p_last_interaction_at, 
      'accepted',
      COALESCE(existing_method, 'search')  -- Utiliser 'search' si aucune relation inverse n'existe
    )
    ON CONFLICT (user_id, friend_id) 
    DO UPDATE SET 
      last_interaction_at = EXCLUDED.last_interaction_at;
  END IF;
  
  -- Note: status et method existants sont toujours préservés lors de l'UPDATE
  -- Seule last_interaction_at est mise à jour
END;
$$;

COMMENT ON FUNCTION update_friend_interaction IS 'Met à jour last_interaction_at pour une relation friends, ou crée la relation si elle n''existe pas. Préserve le status et method existants lors de la mise à jour.';
