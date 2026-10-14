-- Fonction SQL pour synchroniser les contacts et créer les relations d'amitié mutuelles
-- À exécuter dans l'éditeur SQL de Supabase

-- Cette fonction :
-- 1. Trouve les utilisateurs correspondant aux numéros de téléphone
-- 2. Crée automatiquement les relations A→B et B→A dans la table friends
-- 3. Déclenche le trigger de réciprocité si configuré
-- 4. Retourne les profils trouvés pour affichage immédiat

CREATE OR REPLACE FUNCTION sync_contacts(phones TEXT[])
RETURNS TABLE (
  id UUID,
  pseudo TEXT,
  phone TEXT
) 
SECURITY DEFINER -- Permet de contourner les restrictions RLS pour l'écriture
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Récupérer l'ID de l'utilisateur actuel (via auth.uid())
  current_user_id := auth.uid();

  -- 1. Insérer les relations A -> B
  INSERT INTO friends (user_id, friend_id, method, status)
  SELECT 
    current_user_id, -- Moi
    p.id,            -- Le contact trouvé
    'contact',
    'accepted'
  FROM user_profiles p
  WHERE p.phone = ANY(phones) -- On cherche parmi les numéros envoyés
    AND p.id != current_user_id -- Pas moi-même
  ON CONFLICT (user_id, friend_id) DO NOTHING;

  -- 2. Insérer les relations réciproques B -> A (amitié mutuelle garantie)
  INSERT INTO friends (user_id, friend_id, method, status)
  SELECT 
    p.id,            -- Le contact trouvé
    current_user_id, -- Moi
    'contact',
    'accepted'
  FROM user_profiles p
  WHERE p.phone = ANY(phones)
    AND p.id != current_user_id
  ON CONFLICT (user_id, friend_id) DO NOTHING;

  -- 3. Retourner les profils trouvés pour l'affichage immédiat dans l'app
  RETURN QUERY
  SELECT p.id, p.pseudo, p.phone
  FROM user_profiles p
  WHERE p.phone = ANY(phones)
    AND p.id != current_user_id;
END;
$$;

-- Vérification : Tester la fonction (remplacer les UUID et numéros par des valeurs réelles)
-- SELECT * FROM sync_contacts(ARRAY['+33612345678', '+33712345678']);


