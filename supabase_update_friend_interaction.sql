-- Fonction pour mettre à jour last_interaction_at sans modifier le status existant
-- Si la relation n'existe pas, elle sera créée avec status='accepted'
-- Utilise INSERT ... ON CONFLICT pour garantir que last_interaction_at est toujours mis à jour
CREATE OR REPLACE FUNCTION update_friend_interaction(
  p_user_id UUID,
  p_friend_id UUID,
  p_last_interaction_at TIMESTAMPTZ
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Utiliser INSERT ... ON CONFLICT pour créer ou mettre à jour
  -- Si la relation existe, seule last_interaction_at est mise à jour (status préservé)
  -- Si elle n'existe pas, elle est créée avec status='accepted'
  INSERT INTO friends (user_id, friend_id, last_interaction_at, status, method)
  VALUES (p_user_id, p_friend_id, p_last_interaction_at, 'accepted', 'prout')
  ON CONFLICT (user_id, friend_id) 
  DO UPDATE SET 
    last_interaction_at = EXCLUDED.last_interaction_at;
    -- Note: status et method ne sont pas mis à jour lors du UPDATE, ils restent inchangés
END;
$$;

COMMENT ON FUNCTION update_friend_interaction IS 'Met à jour last_interaction_at pour une relation friends, ou crée la relation si elle n''existe pas. Préserve le status et method existants lors de la mise à jour.';
