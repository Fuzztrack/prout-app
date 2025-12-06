-- ============================================
-- Système d'amitié avec invitations et contacts
-- Solution SANS trigger automatique pour les contacts (création réciproque côté client)
-- ============================================

-- ============================================
-- 0️⃣ Préparation : ajouter les colonnes method et status si elles n'existent pas
-- ============================================

ALTER TABLE friends
ADD COLUMN IF NOT EXISTS method TEXT CHECK (method IN ('contact', 'invitation')) DEFAULT 'contact',
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('pending', 'accepted')) DEFAULT 'accepted';

-- Mettre à jour les données existantes
UPDATE friends SET method = 'contact', status = 'accepted' WHERE method IS NULL OR status IS NULL;

-- ============================================
-- 1️⃣ Supprimer les anciens triggers et fonctions
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
-- 2️⃣ Créer la fonction trigger BEFORE pour définir le status ET protéger contre les conflits
-- ============================================

CREATE OR REPLACE FUNCTION handle_friend_creation()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Si method est NULL ou vide, définir à 'contact' par défaut
  IF NEW.method IS NULL OR NEW.method = '' THEN
    NEW.method := 'contact';
  END IF;

  -- 🔹 Relation par invitation (pending) - Vérifier EN PREMIER
  -- IMPORTANT : Vérifier explicitement que method = 'invitation' (pas de confusion avec 'contact')
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
    -- ✅ PROTECTION : Vérifier s'il y a une invitation en pending dans l'autre sens
    -- Si A→B est en pending avec method='invitation', empêcher la création de B→A avec method='contact'
    IF EXISTS (
      SELECT 1 FROM friends
      WHERE user_id = NEW.friend_id
      AND friend_id = NEW.user_id
      AND method = 'invitation'
      AND status = 'pending'
    ) THEN
      -- Il y a une invitation en pending, ne pas créer la relation contact
      RAISE EXCEPTION 'Cannot create contact relationship: pending invitation exists';
    END IF;
    
    NEW.status := 'accepted';
    RETURN NEW;
  END IF;

  -- Si method n'est ni 'invitation' ni 'contact', erreur
  RAISE EXCEPTION 'Invalid method: %', NEW.method;
END;
$$;

-- Créer le trigger BEFORE
CREATE TRIGGER trg_friend_creation
BEFORE INSERT ON friends
FOR EACH ROW
EXECUTE FUNCTION handle_friend_creation();

-- ============================================
-- 3️⃣ SUPPRIMER le trigger automatique pour les contacts
-- La réciproque sera créée côté client (dans matchContactsAutomatically)
-- ============================================

-- PAS DE TRIGGER AUTOMATIQUE pour éviter la récursion
-- Le code client créera les deux relations (A→B et B→A) manuellement

-- ============================================
-- 4️⃣ Créer la fonction trigger AFTER UPDATE pour créer la réciproque lors de l'acceptation
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
-- 5️⃣ Créer une fonction RPC pour créer les amitiés mutuelles (contacts)
-- Cette fonction permet de contourner la RLS pour créer B→A
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
-- 6️⃣ Configurer les politiques RLS
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
-- Vérification
-- ============================================
-- Pour vérifier que tout fonctionne :
-- SELECT * FROM friends WHERE method = 'contact' LIMIT 5;
-- SELECT * FROM friends WHERE method = 'invitation' AND status = 'pending' LIMIT 5;

