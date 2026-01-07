-- ============================================
-- Ajout de la colonne last_interaction_at à la table friends
-- Pour permettre le tri des amis par dernière interaction
-- ============================================

-- Ajouter la colonne last_interaction_at si elle n'existe pas
ALTER TABLE friends
ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;

-- Créer un index pour améliorer les performances du tri
CREATE INDEX IF NOT EXISTS idx_friends_last_interaction_at 
ON friends(user_id, last_interaction_at DESC);

-- Commentaire sur la colonne
COMMENT ON COLUMN friends.last_interaction_at IS 'Timestamp de la dernière interaction (prout ou message) pour trier les amis par ordre d''activité';

