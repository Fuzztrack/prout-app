-- Script pour créer les politiques RLS sur pending_messages
-- À exécuter dans l'éditeur SQL de Supabase si les politiques n'existent pas

-- 1. Activer RLS sur pending_messages (si pas déjà activé)
ALTER TABLE public.pending_messages ENABLE ROW LEVEL SECURITY;

-- 2. Supprimer les anciennes politiques (si elles existent)
DROP POLICY IF EXISTS "Users can read messages sent to them" ON public.pending_messages;
DROP POLICY IF EXISTS "Users can read messages they sent" ON public.pending_messages;
DROP POLICY IF EXISTS "Users can insert messages" ON public.pending_messages;
DROP POLICY IF EXISTS "Users can delete their own received messages" ON public.pending_messages;
DROP POLICY IF EXISTS "Users can update their own received messages" ON public.pending_messages;

-- 3. Politique SELECT : Les utilisateurs peuvent lire les messages qui leur sont destinés (to_user_id)
CREATE POLICY "Users can read messages sent to them"
ON public.pending_messages
FOR SELECT
USING (auth.uid() = to_user_id);

-- 4. Politique SELECT : Les utilisateurs peuvent lire les messages qu'ils ont envoyés (from_user_id)
-- IMPORTANT : Cette politique est nécessaire pour que fetchSentPendingMessages fonctionne
CREATE POLICY "Users can read messages they sent"
ON public.pending_messages
FOR SELECT
USING (auth.uid() = from_user_id);

-- 5. Politique INSERT : Les utilisateurs peuvent insérer des messages (via le backend avec service role key)
-- Note : Le backend utilise la service role key donc cette politique n'est pas strictement nécessaire
-- mais on la crée pour la sécurité si jamais le client essaie d'insérer directement
CREATE POLICY "Users can insert messages"
ON public.pending_messages
FOR INSERT
WITH CHECK (auth.uid() = from_user_id);

-- 6. Politique UPDATE : Les utilisateurs peuvent mettre à jour les messages qui leur sont destinés
-- (pour marquer comme READ: ou supprimer)
CREATE POLICY "Users can update their own received messages"
ON public.pending_messages
FOR UPDATE
USING (auth.uid() = to_user_id)
WITH CHECK (auth.uid() = to_user_id);

-- 7. Politique DELETE : Les utilisateurs peuvent supprimer les messages qui leur sont destinés
-- (pour la purge après lecture)
CREATE POLICY "Users can delete their own received messages"
ON public.pending_messages
FOR DELETE
USING (auth.uid() = to_user_id);

-- Vérification : Lister les politiques créées
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as command_type,
    qual as using_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'pending_messages'
ORDER BY policyname;
