-- ==============================================================================
-- FONCTIONNALITÉ COMPLICITÉ (SYNC-SCORE) - SCRIPT COMPLET
-- ==============================================================================
-- Ce script est idempotent (peut être exécuté plusieurs fois sans erreur)
-- Exécutez-le dans l'éditeur SQL de Supabase

-- ==============================================================================
-- 1. CRÉATION DE LA TABLE interaction_logs
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.interaction_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index pour accélérer les recherches d'historique entre deux amis
CREATE INDEX IF NOT EXISTS idx_interaction_logs_pair ON public.interaction_logs(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_created_at ON public.interaction_logs(created_at);

-- Sécurité RLS pour interaction_logs
ALTER TABLE public.interaction_logs ENABLE ROW LEVEL SECURITY;

-- Supprimer les politiques existantes si elles existent déjà (pour éviter les erreurs)
DROP POLICY IF EXISTS "Users can insert their own interactions" ON public.interaction_logs;
DROP POLICY IF EXISTS "Users can view their interactions" ON public.interaction_logs;

CREATE POLICY "Users can insert their own interactions" 
ON public.interaction_logs FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can view their interactions" 
ON public.interaction_logs FOR SELECT TO authenticated 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);


-- ==============================================================================
-- 2. AJOUT DES COLONNES DE SCORE À LA TABLE friends
-- ==============================================================================

ALTER TABLE public.friends 
ADD COLUMN IF NOT EXISTS complicity_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS complicity_level TEXT DEFAULT 'complicity_level_1',
ADD COLUMN IF NOT EXISTS interaction_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rapid_response_count INTEGER DEFAULT 0;


-- ==============================================================================
-- 3. CRÉATION DE LA CLÉ ÉTRANGÈRE VERS user_profiles (pour les jointures API)
-- ==============================================================================
-- Cette clé étrangère permet à l'API Supabase de faire le lien friends -> user_profiles
-- pour récupérer les pseudos et avatars lors des requêtes

ALTER TABLE public.friends
DROP CONSTRAINT IF EXISTS fk_friends_profiles;

ALTER TABLE public.friends
ADD CONSTRAINT fk_friends_profiles
FOREIGN KEY (friend_id)
REFERENCES public.user_profiles(id);


-- ==============================================================================
-- 4. FONCTION DE CALCUL DU SCORE (Algorithme "Smart")
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.calculate_complicity_score()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user1 UUID;
    v_user2 UUID;
    v_total_interactions INTEGER;
    v_rapid_responses INTEGER := 0;
    v_messages_user1 INTEGER;
    v_messages_user2 INTEGER;
    v_ratio FLOAT;
    v_base_score INTEGER;
    v_final_score INTEGER;
    v_level_text TEXT;
    
    -- Variables pour le calcul de réponse rapide
    v_last_log RECORD;
BEGIN
    -- Identifier les deux amis concernés par la nouvelle interaction
    v_user1 := NEW.sender_id;
    v_user2 := NEW.receiver_id;

    -- Gestion d'erreur silencieuse pour ne jamais bloquer l'insertion
    BEGIN
        -- A. Compter le total des interactions (dans les deux sens)
        SELECT COUNT(*) INTO v_total_interactions
        FROM public.interaction_logs
        WHERE (sender_id = v_user1 AND receiver_id = v_user2)
           OR (sender_id = v_user2 AND receiver_id = v_user1);

        -- B. Calculer la réciprocité (Ratio)
        SELECT COUNT(*) INTO v_messages_user1
        FROM public.interaction_logs
        WHERE sender_id = v_user1 AND receiver_id = v_user2;
        
        v_messages_user2 := v_total_interactions - v_messages_user1;

        -- Éviter division par zéro
        IF v_total_interactions > 0 THEN
            -- Ratio d'équilibre (1.0 = parfait, 0.0 = sens unique)
            IF v_messages_user1 = 0 OR v_messages_user2 = 0 THEN
                v_ratio := 0.5; -- Pénalité forte si sens unique
            ELSE
                IF v_messages_user1 < v_messages_user2 THEN
                    v_ratio := v_messages_user1::FLOAT / v_messages_user2::FLOAT;
                ELSE
                    v_ratio := v_messages_user2::FLOAT / v_messages_user1::FLOAT;
                END IF;
            END IF;
        ELSE
            v_ratio := 1.0;
        END IF;

        -- C. Détecter si c'est une "Réponse Rapide" (< 60 secondes après le dernier message reçu)
        SELECT * INTO v_last_log
        FROM public.interaction_logs
        WHERE sender_id = v_user2 AND receiver_id = v_user1
        AND created_at < NEW.created_at
        ORDER BY created_at DESC
        LIMIT 1;

        -- D. Calcul du Score
        -- Formule : (Total * 1) + (Réponses Rapides * 10)
        SELECT rapid_response_count INTO v_rapid_responses
        FROM public.friends
        WHERE user_id = v_user1 AND friend_id = v_user2;
        
        -- Si c'était une réponse rapide, on incrémente (virtuellement pour le calcul)
        IF v_last_log IS NOT NULL AND EXTRACT(EPOCH FROM (NEW.created_at - v_last_log.created_at)) < 60 THEN
             v_rapid_responses := COALESCE(v_rapid_responses, 0) + 1;
        END IF;

        v_base_score := (v_total_interactions * 1) + (COALESCE(v_rapid_responses, 0) * 10);
        
        -- Application du ratio de réciprocité (Bonus/Malus)
        -- Si ratio < 0.3 (très déséquilibré), on réduit le score de 20%
        IF v_ratio < 0.3 THEN
            v_final_score := FLOOR(v_base_score * 0.8);
        ELSE
            v_final_score := v_base_score;
        END IF;

        -- E. Détermination du Niveau (Clés pour traduction côté client)
        IF v_final_score >= 500 THEN
            v_level_text := 'complicity_level_elite';
        ELSIF v_final_score >= 200 THEN
            v_level_text := 'complicity_level_3';
        ELSIF v_final_score >= 50 THEN
            v_level_text := 'complicity_level_2';
        ELSE
            v_level_text := 'complicity_level_1';
        END IF;

        -- F. Mise à jour de la table friends (dans les DEUX sens A->B et B->A)
        -- Mise à jour pour l'expéditeur vers le destinataire
        UPDATE public.friends
        SET 
            complicity_score = v_final_score,
            complicity_level = v_level_text,
            interaction_count = v_total_interactions,
            rapid_response_count = COALESCE(rapid_response_count, 0) + (CASE WHEN v_last_log IS NOT NULL AND EXTRACT(EPOCH FROM (NEW.created_at - v_last_log.created_at)) < 60 THEN 1 ELSE 0 END)
        WHERE user_id = v_user1 AND friend_id = v_user2;

        -- Mise à jour pour le destinataire vers l'expéditeur (symétrie des stats)
        UPDATE public.friends
        SET 
            complicity_score = v_final_score,
            complicity_level = v_level_text,
            interaction_count = v_total_interactions,
            rapid_response_count = COALESCE(rapid_response_count, 0) + (CASE WHEN v_last_log IS NOT NULL AND EXTRACT(EPOCH FROM (NEW.created_at - v_last_log.created_at)) < 60 THEN 1 ELSE 0 END)
        WHERE user_id = v_user2 AND friend_id = v_user1;

    EXCEPTION WHEN OTHERS THEN
        -- Log l'erreur mais NE BLOQUE PAS l'insertion
        RAISE WARNING 'Erreur lors du calcul de complicité: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$;


-- ==============================================================================
-- 5. TRIGGER SUR interaction_logs
-- ==============================================================================

DROP TRIGGER IF EXISTS trg_calculate_complicity ON public.interaction_logs;

CREATE TRIGGER trg_calculate_complicity
AFTER INSERT ON public.interaction_logs
FOR EACH ROW
EXECUTE FUNCTION public.calculate_complicity_score();


-- ==============================================================================
-- 6. MISE À JOUR DE LA FONCTION update_friend_interaction
-- ==============================================================================
-- Pour qu'elle insère aussi dans interaction_logs automatiquement

CREATE OR REPLACE FUNCTION update_friend_interaction(
  p_user_id UUID,
  p_friend_id UUID,
  p_last_interaction_at TIMESTAMPTZ
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
  existing_method TEXT;
BEGIN
  -- 1. LOG DE L'INTERACTION (Nouveau)
  -- On insère d'abord dans les logs, ce qui déclenchera le calcul du score via le trigger
  INSERT INTO public.interaction_logs (sender_id, receiver_id, created_at)
  VALUES (p_user_id, p_friend_id, p_last_interaction_at);

  -- 2. Essayer de mettre à jour la relation existante (préserve status et method)
  UPDATE friends
  SET last_interaction_at = p_last_interaction_at
  WHERE user_id = p_user_id 
    AND friend_id = p_friend_id;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- 3. Si aucune ligne n'a été mise à jour, créer la relation
  IF updated_count = 0 THEN
    SELECT method INTO existing_method
    FROM friends
    WHERE user_id = p_friend_id 
      AND friend_id = p_user_id
    LIMIT 1;
    
    INSERT INTO friends (user_id, friend_id, last_interaction_at, status, method)
    VALUES (
      p_user_id, 
      p_friend_id, 
      p_last_interaction_at, 
      'accepted',
      COALESCE(existing_method, 'search')
    )
    ON CONFLICT (user_id, friend_id) 
    DO UPDATE SET 
      last_interaction_at = EXCLUDED.last_interaction_at;
  END IF;
END;
$$;


-- ==============================================================================
-- 7. RAFRAÎCHISSEMENT DU CACHE DU SCHÉMA (pour que l'API détecte les nouvelles relations)
-- ==============================================================================

NOTIFY pgrst, 'reload config';
