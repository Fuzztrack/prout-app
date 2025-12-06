-- ============================================
-- 🧹 NETTOYAGE TOTAL (Pour être sûr)
-- ============================================

-- Suppression des anciens triggers potentiels (tous les noms possibles)
DROP TRIGGER IF EXISTS mutual_friends_trigger ON friends;
DROP TRIGGER IF EXISTS trigger_make_friends_mutual ON friends;
DROP TRIGGER IF EXISTS trg_friend_creation ON friends;
DROP TRIGGER IF EXISTS trg_create_reciprocal ON friends;
DROP TRIGGER IF EXISTS trg_invitation_accept ON friends;
DROP TRIGGER IF EXISTS trigger_reciprocal_friends ON friends; -- Le "zombie" identifié

-- Suppression des fonctions associées
DROP FUNCTION IF EXISTS make_friends_mutual() CASCADE;
DROP FUNCTION IF EXISTS handle_friend_creation() CASCADE;
DROP FUNCTION IF EXISTS create_reciprocal_friendship() CASCADE;
DROP FUNCTION IF EXISTS handle_invitation_accept() CASCADE;
DROP FUNCTION IF EXISTS make_friendship_reciprocal() CASCADE;

-- ============================================
-- 🛠 CORRECTION DE LA STRUCTURE
-- ============================================

ALTER TABLE friends 
ADD COLUMN IF NOT EXISTS method TEXT CHECK (method IN ('contact', 'invitation'));

ALTER TABLE friends 
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('pending', 'accepted')) DEFAULT 'accepted';

-- S'assurer que la valeur par défaut n'interfère pas
ALTER TABLE friends ALTER COLUMN method DROP DEFAULT;

-- Mettre à jour les données existantes
UPDATE friends SET method = 'contact', status = 'accepted' WHERE method IS NULL OR status IS NULL;

-- ============================================
-- 🚀 1. TRIGGER BEFORE INSERT (Gestion Status & Conflits)
-- ============================================

CREATE OR REPLACE FUNCTION handle_friend_creation()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_has_pending_invitation BOOLEAN;
BEGIN
  -- Si method est null ou vide, on force 'contact' par défaut
  IF NEW.method IS NULL OR TRIM(COALESCE(NEW.method, '')) = '' THEN
    NEW.method := 'contact';
  ELSE
    NEW.method := TRIM(NEW.method);
  END IF;

  -- CAS 1 : INVITATION
  IF NEW.method = 'invitation' THEN
    -- Vérifier si l'amitié existe déjà en sens inverse (déjà amis ?)
    IF EXISTS (
      SELECT 1 FROM friends
      WHERE user_id = NEW.friend_id
      AND friend_id = NEW.user_id
      AND status = 'accepted'
    ) THEN
      RAISE EXCEPTION 'Cannot create invitation: You are already friends';
    END IF;
    
    -- Une invitation commence toujours en pending
    NEW.status := 'pending';
    RETURN NEW;
  END IF;

  -- CAS 2 : CONTACT (Automatique)
  IF NEW.method = 'contact' THEN
    -- Vérifier s'il y a une invitation EN ATTENTE dans l'autre sens (B a invité A)
    SELECT EXISTS (
      SELECT 1 FROM friends
      WHERE user_id = NEW.friend_id
      AND friend_id = NEW.user_id
      AND method = 'invitation'
      AND status = 'pending'
    ) INTO v_has_pending_invitation;
    
    IF v_has_pending_invitation THEN
      -- On bloque la création "contact" brutale si une invitation attend
      RAISE EXCEPTION 'Pending invitation exists from this user. Accept it instead.';
    END IF;
    
    NEW.status := 'accepted';
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid method: %. Expected contact or invitation.', NEW.method;
END;
$$;

CREATE TRIGGER trg_friend_creation
BEFORE INSERT ON friends
FOR EACH ROW
EXECUTE FUNCTION handle_friend_creation();

-- ============================================
-- 🚀 2. TRIGGER AFTER UPDATE (Acceptation Invitation)
-- ============================================

CREATE OR REPLACE FUNCTION handle_invitation_accept()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Détection du passage de pending à accepted
  IF OLD.status = 'pending' 
     AND NEW.status = 'accepted' 
     AND NEW.method = 'invitation' THEN
    
    -- Créer la réciproque (B -> A) automatiquement
    INSERT INTO friends (user_id, friend_id, method, status)
    VALUES (NEW.friend_id, NEW.user_id, 'invitation', 'accepted')
    ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted';
    
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invitation_accept
AFTER UPDATE ON friends
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION handle_invitation_accept();

-- ============================================
-- 🚀 3. FONCTION RPC (Pour contacts mutuels)
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
  -- Sécurité basique
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

  -- Insertion A -> B
  INSERT INTO friends (user_id, friend_id, method, status)
  VALUES (p_user_id_1, p_user_id_2, 'contact', 'accepted')
  ON CONFLICT (user_id, friend_id) DO NOTHING;

  -- Insertion B -> A
  INSERT INTO friends (user_id, friend_id, method, status)
  VALUES (p_user_id_2, p_user_id_1, 'contact', 'accepted')
  ON CONFLICT (user_id, friend_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION create_mutual_friendship(UUID, UUID) TO authenticated;

-- ============================================
-- 🔐 POLITIQUES RLS (Row Level Security)
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

