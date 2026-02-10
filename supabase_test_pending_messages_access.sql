-- Script de test pour vérifier l'accès aux messages pending_messages
-- À exécuter dans l'éditeur SQL de Supabase après avoir créé les politiques RLS

-- IMPORTANT : Ces requêtes doivent être exécutées avec le contexte d'un utilisateur authentifié
-- Pour tester, utilisez l'éditeur SQL avec "Run as" un utilisateur spécifique

-- 1. Test : Vérifier les messages reçus (to_user_id = auth.uid())
-- Remplacez 'USER_ID_HERE' par un ID d'utilisateur réel
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
WHERE to_user_id = 'USER_ID_HERE'  -- Remplacez par un ID réel
ORDER BY created_at DESC
LIMIT 10;

-- 2. Test : Vérifier les messages envoyés (from_user_id = auth.uid())
-- Remplacez 'USER_ID_HERE' par un ID d'utilisateur réel
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
WHERE from_user_id = 'USER_ID_HERE'  -- Remplacez par un ID réel
ORDER BY created_at DESC
LIMIT 10;

-- 3. Test : Compter les messages par utilisateur
SELECT 
    from_user_id,
    COUNT(*) as total_sent,
    COUNT(*) FILTER (WHERE message_content LIKE 'READ:%') as read_sent,
    COUNT(*) FILTER (WHERE message_content NOT LIKE 'READ:%') as unread_sent
FROM public.pending_messages
GROUP BY from_user_id
ORDER BY total_sent DESC
LIMIT 10;

SELECT 
    to_user_id,
    COUNT(*) as total_received,
    COUNT(*) FILTER (WHERE message_content LIKE 'READ:%') as read_received,
    COUNT(*) FILTER (WHERE message_content NOT LIKE 'READ:%') as unread_received
FROM public.pending_messages
GROUP BY to_user_id
ORDER BY total_received DESC
LIMIT 10;
