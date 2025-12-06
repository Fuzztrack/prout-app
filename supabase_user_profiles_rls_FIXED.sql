-- ============================================
-- POLITIQUES RLS POUR LA TABLE user_profiles
-- Script corrigé pour résoudre l'erreur RLS lors de l'inscription
-- ============================================

-- ============================================
-- ÉTAPE 1 : NETTOYAGE COMPLET
-- Supprimer TOUTES les politiques existantes pour éviter les conflits
-- ============================================

-- Supprimer toutes les politiques possibles (même celles qui n'existent pas)
DROP POLICY IF EXISTS "Users can read their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can read public profiles" ON user_profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- ============================================
-- ÉTAPE 2 : ACTIVER RLS
-- ============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ÉTAPE 3 : CRÉER LES POLITIQUES
-- ============================================

-- 1. SELECT : Lire son propre profil
CREATE POLICY "Users can read their own profile" ON user_profiles
FOR SELECT
USING (auth.uid() = id);

-- 2. INSERT : Créer son propre profil (CRITIQUE pour l'inscription)
-- Cette politique permet à un utilisateur de créer son profil avec son propre ID
CREATE POLICY "Users can insert their own profile" ON user_profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 3. UPDATE : Modifier son propre profil
CREATE POLICY "Users can update their own profile" ON user_profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. SELECT : Lire les profils publics (pour les invitations, recherche, etc.)
-- Cette politique permet à tous les utilisateurs authentifiés de lire les profils publics
CREATE POLICY "Users can read public profiles" ON user_profiles
FOR SELECT
USING (auth.role() = 'authenticated');

-- ============================================
-- ÉTAPE 4 : VÉRIFICATION
-- ============================================

-- Pour vérifier que les politiques sont bien créées, exécutez :
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies 
-- WHERE tablename = 'user_profiles'
-- ORDER BY policyname;

-- Pour vérifier que RLS est activé :
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'user_profiles';

