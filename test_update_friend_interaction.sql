-- Script de test et diagnostic pour update_friend_interaction
-- À exécuter dans Supabase SQL Editor

-- 1. Vérifier si la fonction existe
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
    AND routine_name = 'update_friend_interaction';

-- 2. Vérifier la structure de la table friends
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'friends'
ORDER BY ordinal_position;

-- 3. Vérifier les contraintes UNIQUE sur friends
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.table_name = 'friends'
    AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY');

-- 3b. Vérifier les contraintes CHECK sur friends (pour voir les valeurs acceptées pour method)
SELECT
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.table_name = 'friends'
    AND tc.constraint_type = 'CHECK';

-- 3c. Vérifier les valeurs uniques actuellement utilisées pour method
SELECT DISTINCT method, COUNT(*) as count
FROM friends
GROUP BY method
ORDER BY count DESC;

-- 4. Tester la fonction avec des UUIDs de test
-- Remplacez les UUIDs par de vrais IDs de votre base
DO $$
DECLARE
    test_user_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
    test_friend_id UUID := '00000000-0000-0000-0000-000000000002'::UUID;
    test_timestamp TIMESTAMPTZ := NOW();
BEGIN
    -- Appeler la fonction
    PERFORM update_friend_interaction(test_user_id, test_friend_id, test_timestamp);
    
    -- Vérifier le résultat
    RAISE NOTICE 'Fonction exécutée avec succès';
    
    -- Vérifier si la ligne existe
    IF EXISTS (
        SELECT 1 FROM friends 
        WHERE user_id = test_user_id 
        AND friend_id = test_friend_id
    ) THEN
        RAISE NOTICE 'Ligne trouvée dans friends';
        -- Afficher les valeurs
        PERFORM * FROM friends 
        WHERE user_id = test_user_id 
        AND friend_id = test_friend_id;
    ELSE
        RAISE WARNING 'Ligne non trouvée après appel de la fonction';
    END IF;
END $$;

-- 5. Vérifier quelques entrées récentes dans friends
SELECT 
    user_id,
    friend_id,
    last_interaction_at,
    status,
    method,
    created_at
FROM friends
WHERE last_interaction_at IS NOT NULL
ORDER BY last_interaction_at DESC
LIMIT 10;
