-- ============================================
-- POLITIQUES RLS POUR LA TABLE user_profiles
-- Permettre la création et la modification du profil
-- ============================================

-- Activer RLS sur la table user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 1. POLITIQUE SELECT : Lire son propre profil
-- ============================================

DROP POLICY IF EXISTS "Users can read their own profile" ON user_profiles;
CREATE POLICY "Users can read their own profile" ON user_profiles
FOR SELECT
USING (auth.uid() = id);

-- ============================================
-- 2. POLITIQUE INSERT : Créer son propre profil
-- IMPORTANT : Permet la création lors de l'inscription
-- ============================================

DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
CREATE POLICY "Users can insert their own profile" ON user_profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- ============================================
-- 3. POLITIQUE UPDATE : Modifier son propre profil
-- ============================================

DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile" ON user_profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================
-- 4. POLITIQUE SELECT : Lire les profils publics (pour les invitations, etc.)
-- Permet de rechercher des utilisateurs par pseudo/email/téléphone
-- ============================================

DROP POLICY IF EXISTS "Users can read public profiles" ON user_profiles;
CREATE POLICY "Users can read public profiles" ON user_profiles
FOR SELECT
USING (true); -- Tous les utilisateurs authentifiés peuvent lire les profils publics

-- ============================================
-- VÉRIFICATION
-- ============================================
-- Pour vérifier les politiques :
-- SELECT * FROM pg_policies WHERE tablename = 'user_profiles';

