-- Script pour vérifier les politiques RLS sur pending_messages
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Vérifier si RLS est activé sur pending_messages
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'pending_messages';

-- 2. Lister toutes les politiques RLS sur pending_messages
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command_type, -- SELECT, INSERT, UPDATE, DELETE, ALL
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'pending_messages'
ORDER BY policyname;

-- 3. Vérifier les permissions de base sur la table
SELECT 
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'pending_messages'
ORDER BY grantee, privilege_type;

-- 4. Vérifier si la table existe et sa structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'pending_messages'
ORDER BY ordinal_position;

-- 5. Compter les messages dans la table (pour vérifier l'accès)
SELECT 
    COUNT(*) as total_messages,
    COUNT(*) FILTER (WHERE message_content LIKE 'READ:%') as read_messages,
    COUNT(*) FILTER (WHERE message_content NOT LIKE 'READ:%') as unread_messages
FROM public.pending_messages;

-- 6. Vérifier les messages récents (pour tester l'accès)
SELECT 
    id,
    from_user_id,
    to_user_id,
    message_content,
    created_at,
    CASE 
        WHEN message_content LIKE 'READ:%' THEN 'READ'
        ELSE 'UNREAD'
    END as status
FROM public.pending_messages
ORDER BY created_at DESC
LIMIT 10;
