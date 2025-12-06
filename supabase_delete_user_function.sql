-- ============================================
-- Fonction RPC pour supprimer complètement un utilisateur
-- ============================================
-- Cette fonction supprime à la fois auth.users et user_profiles
-- Elle doit être exécutée dans l'éditeur SQL de Supabase
-- ============================================

-- 1. Créer la fonction RPC pour supprimer complètement un utilisateur
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Permet d'exécuter avec les privilèges du créateur de la fonction
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Récupérer l'ID de l'utilisateur actuellement authentifié
  current_user_id := auth.uid();
  
  -- Vérifier que l'utilisateur est authentifié
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;
  
  -- Supprimer le profil dans user_profiles (le trigger CASCADE supprimera aussi friends et invitations)
  DELETE FROM user_profiles WHERE id = current_user_id;
  
  -- Supprimer le compte auth.users (nécessite SECURITY DEFINER pour accéder à auth.users)
  -- Note: Cette opération supprime automatiquement toutes les données liées via CASCADE
  DELETE FROM auth.users WHERE id = current_user_id;
  
  -- Si on arrive ici, la suppression a réussi
  RETURN;
END;
$$;

-- 2. Autoriser les utilisateurs authentifiés à exécuter cette fonction
-- (La fonction elle-même vérifie déjà que l'utilisateur supprime son propre compte)
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;

-- ============================================
-- Vérification des contraintes CASCADE
-- ============================================
-- Assurez-vous que les contraintes CASCADE existent pour supprimer automatiquement
-- les données liées (friends, invitations) quand user_profiles est supprimé
-- ============================================

-- Vérifier les contraintes existantes
SELECT 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND ccu.table_name = 'auth.users'
  AND rc.delete_rule != 'CASCADE';

-- Si nécessaire, ajouter/modifier les contraintes CASCADE :
-- ALTER TABLE user_profiles
-- DROP CONSTRAINT IF EXISTS user_profiles_id_fkey,
-- ADD CONSTRAINT user_profiles_id_fkey 
-- FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
--
-- ALTER TABLE friends
-- DROP CONSTRAINT IF EXISTS friends_user_id_fkey,
-- ADD CONSTRAINT friends_user_id_fkey 
-- FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--
-- ALTER TABLE friends
-- DROP CONSTRAINT IF EXISTS friends_friend_id_fkey,
-- ADD CONSTRAINT friends_friend_id_fkey 
-- FOREIGN KEY (friend_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--
-- ALTER TABLE invitations
-- DROP CONSTRAINT IF EXISTS invitations_from_user_id_fkey,
-- ADD CONSTRAINT invitations_from_user_id_fkey 
-- FOREIGN KEY (from_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--
-- ALTER TABLE invitations
-- DROP CONSTRAINT IF EXISTS invitations_to_user_id_fkey,
-- ADD CONSTRAINT invitations_to_user_id_fkey 
-- FOREIGN KEY (to_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


