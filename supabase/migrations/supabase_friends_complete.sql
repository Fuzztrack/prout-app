-- ============================================
-- SYSTÈME COMPLET D'AMITIÉ AVEC INVITATIONS ET CONTACTS
-- Script prêt à copier-coller pour Supabase
-- ============================================

-- ============================================
-- 0️⃣ PRÉPARATION : Ajouter les colonnes method et status
-- ============================================

ALTER TABLE friends
ADD COLUMN IF NOT EXISTS method TEXT CHECK (method IN ('contact', 'invitation')),
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('pending', 'accepted')) DEFAULT 'accepted';

-- ⚠️ IMPORTANT : Supprimer la valeur par défaut de method pour éviter les conflits
ALTER TABLE friends ALTER COLUMN method DROP DEFAULT;

-- Mettre à jour les données existantes
UPDATE friends SET method = 'contact', status = 'accepted' WHERE method IS NULL OR status IS NULL;

-- ============================================
-- 1️⃣ NETTOYAGE : Supprimer les anciens triggers et fonctions
-- ============================================

DROP TRIGGER IF EXISTS mutual_friends_trigger ON friends;
DROP TRIGGER IF EXISTS trigger_make_friends_mutual ON friends;
DROP TRIGGER IF EXISTS trg_friend_creation ON friends;
DROP TRIGGER IF EXISTS trg_create_reciprocal ON friends;
DROP TRIGGER IF EXISTS trg_invitation_accept ON friends;
DROP FUNCTION IF EXISTS make_friends_mutual() CASCADE;
DROP FUNCTION IF EXISTS handle_friend_creation() CASCADE;
DROP FUNCTION IF EXISTS create_reciprocal_friendship() CASCADE;
DROP FUNCTION IF EXISTS handle_invitation_accept() CASCADE;

-- ============================================
-- 2️⃣ TRIGGER BEFORE INSERT : handle_friend_creation()
-- Gère la création des relations (invitation ou contact)
-- ============================================

CREATE OR REPLACE FUNCTION handle_friend_creation()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_received_method TEXT;
  v_has_pending_invitation BOOLEAN;
BEGIN
  -- 🔍 DEBUG : Capturer la valeur reçue AVANT toute modification
  v_received_method := NEW.method;
  
  -- ⚠️ CRITIQUE : Vérifier d'abord si method est NULL ou vide
  -- Si method n'est pas fourni explicitement, définir à 'contact' par défaut
  IF NEW.method IS NULL OR TRIM(COALESCE(NEW.method, '')) = '' THEN
    NEW.method := 'contact';
  ELSE
    -- Nettoyer la valeur fournie
    NEW.method := TRIM(NEW.method);
  END IF;

  -- 🔹 Relation par invitation (pending) - Vérifier EN PREMIER
  -- IMPORTANT : Vérifier explicitement que method = 'invitation'
  IF NEW.method = 'invitation' THEN
    -- ✅ PROTECTION : Vérifier s'il y a déjà une relation acceptée dans l'autre sens
    -- Si B→A existe déjà avec status='accepted', ne pas créer une invitation A→B
    IF EXISTS (
      SELECT 1 FROM friends
      WHERE user_id = NEW.friend_id
      AND friend_id = NEW.user_id
      AND status = 'accepted'
    ) THEN
      -- Il y a déjà une relation acceptée, ne pas créer d'invitation
      RAISE EXCEPTION 'Cannot create invitation: friendship already exists';
    END IF;
    
    -- On permet la création d'une invitation même s'il y a une invitation en pending dans l'autre sens
    -- (les deux utilisateurs peuvent s'inviter mutuellement)
    
    NEW.status := 'pending';
    RETURN NEW;
  END IF;

  -- 🔹 Relation par contact (automatique) - Vérifier EN SECOND
  -- IMPORTANT : Vérifier explicitement que method = 'contact'
  IF NEW.method = 'contact' THEN
    -- Vérifier s'il y a une invitation en pending dans l'autre sens
    SELECT EXISTS (
      SELECT 1 FROM friends
      WHERE user_id = NEW.friend_id
      AND friend_id = NEW.user_id
      AND method = 'invitation'
      AND status = 'pending'
    ) INTO v_has_pending_invitation;
    
    -- ✅ PROTECTION : Vérifier s'il y a une invitation en pending dans l'autre sens
    -- Si A→B est en pending avec method='invitation', empêcher la création de B→A avec method='contact'
    IF v_has_pending_invitation THEN
      -- Il y a une invitation en pending, ne pas créer la relation contact
      -- 🔍 DEBUG : Inclure la valeur reçue dans l'erreur pour comprendre le problème
      RAISE EXCEPTION 'Cannot create contact relationship: pending invitation exists. Received method: %, Final method: %', v_received_method, NEW.method;
    END IF;
    
    NEW.status := 'accepted';
    RETURN NEW;
  END IF;

  -- Si method n'est ni 'invitation' ni 'contact', erreur
  RAISE EXCEPTION 'Invalid method: %. Expected ''contact'' or ''invitation''. Received: %', NEW.method, v_received_method;
END;
$$;

-- Créer le trigger BEFORE INSERT
CREATE TRIGGER trg_friend_creation
BEFORE INSERT ON friends
FOR EACH ROW
EXECUTE FUNCTION handle_friend_creation();

-- ============================================
-- 3️⃣ TRIGGER AFTER UPDATE : handle_invitation_accept()
-- Crée automatiquement la réciproque quand une invitation est acceptée
-- ============================================

CREATE OR REPLACE FUNCTION handle_invitation_accept()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Quand une invitation passe de 'pending' à 'accepted'
  IF OLD.status = 'pending' 
     AND NEW.status = 'accepted' 
     AND NEW.method = 'invitation' THEN
    
    -- Vérifier que la réciproque n'existe pas déjà
    IF NOT EXISTS (
      SELECT 1 FROM friends
      WHERE user_id = NEW.friend_id
      AND friend_id = NEW.user_id
    ) THEN
      -- Créer automatiquement la réciproque B→A avec status='accepted'
      INSERT INTO friends (user_id, friend_id, method, status)
      VALUES (NEW.friend_id, NEW.user_id, 'invitation', 'accepted')
      ON CONFLICT (user_id, friend_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Créer le trigger AFTER UPDATE
DROP TRIGGER IF EXISTS trg_invitation_accept ON friends;
CREATE TRIGGER trg_invitation_accept
AFTER UPDATE ON friends
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION handle_invitation_accept();

-- ============================================
-- 4️⃣ FONCTION RPC : create_mutual_friendship()
-- Crée les deux relations mutuelles pour les contacts (A→B et B→A)
-- Utilisée par le matching automatique des contacts
-- ============================================

CREATE OR REPLACE FUNCTION create_mutual_friendship(
  p_user_id_1 UUID,
  p_user_id_2 UUID
)
RETURNS VOID
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Vérifier que l'utilisateur actuel est l'un des deux utilisateurs
  IF auth.uid() IS NULL OR (auth.uid() != p_user_id_1 AND auth.uid() != p_user_id_2) THEN
    RAISE EXCEPTION 'Unauthorized: You can only create friendships involving yourself';
  END IF;

  -- Vérifier qu'il n'y a pas d'invitation en pending dans l'un ou l'autre sens
  IF EXISTS (
    SELECT 1 FROM friends
    WHERE (
      (user_id = p_user_id_1 AND friend_id = p_user_id_2)
      OR (user_id = p_user_id_2 AND friend_id = p_user_id_1)
    )
    AND method = 'invitation'
    AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Cannot create contact relationship: pending invitation exists';
  END IF;

  -- Créer la relation A→B si elle n'existe pas déjà
  INSERT INTO friends (user_id, friend_id, method, status)
  VALUES (p_user_id_1, p_user_id_2, 'contact', 'accepted')
  ON CONFLICT (user_id, friend_id) DO NOTHING;

  -- Créer la relation B→A si elle n'existe pas déjà
  INSERT INTO friends (user_id, friend_id, method, status)
  VALUES (p_user_id_2, p_user_id_1, 'contact', 'accepted')
  ON CONFLICT (user_id, friend_id) DO NOTHING;
END;
$$;

-- Accorder les permissions d'exécution
GRANT EXECUTE ON FUNCTION create_mutual_friendship(UUID, UUID) TO authenticated;

-- ============================================
-- 5️⃣ POLITIQUES RLS (Row Level Security)
-- ============================================

-- Activer RLS
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- 🔹 Autoriser SELECT sur amis acceptés
DROP POLICY IF EXISTS "Users can read their friends" ON friends;
CREATE POLICY "Users can read their friends" ON friends
FOR SELECT
USING (
  (auth.uid() = user_id OR auth.uid() = friend_id)
  AND status = 'accepted'
);

-- 🔹 Autoriser SELECT sur invitations en attente (où user est l'invitant)
DROP POLICY IF EXISTS "Users can read pending invitations" ON friends;
CREATE POLICY "Users can read pending invitations" ON friends
FOR SELECT
USING (
  auth.uid() = user_id
  AND method = 'invitation'
  AND status = 'pending'
);

-- 🔹 Autoriser SELECT sur invitations reçues (où user est l'invité)
DROP POLICY IF EXISTS "Users can read received invitations" ON friends;
CREATE POLICY "Users can read received invitations" ON friends
FOR SELECT
USING (
  auth.uid() = friend_id
  AND method = 'invitation'
  AND status = 'pending'
);

-- 🔹 Autoriser INSERT si user_id = auth.uid()
DROP POLICY IF EXISTS "Users can insert their own friends" ON friends;
CREATE POLICY "Users can insert their own friends" ON friends
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 🔹 Autoriser UPDATE du status (accepter invitation)
DROP POLICY IF EXISTS "Users can update invitation status" ON friends;
CREATE POLICY "Users can update invitation status" ON friends
FOR UPDATE
USING (auth.uid() = user_id OR auth.uid() = friend_id)
WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

-- ============================================
-- FIN DU SCRIPT
-- ============================================

