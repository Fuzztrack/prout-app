-- ==============================================================================
-- Ajustements logique complicité
-- 1) Bonus "réponse rapide" réduit (10 → 3 points) pour ne pas faire monter le score trop vite
-- 2) Décroissance du score si pas d'interaction depuis 1 jour (× 0,92 par jour)
-- Exécuter dans l'éditeur SQL Supabase après le script complicity complet
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
    v_last_log RECORD;
    v_last_interaction_ts TIMESTAMPTZ;
    v_days_inactive INTEGER;
    v_rapid_bonus INTEGER := 3;  -- 3 points par réponse rapide (< 60 s) au lieu de 10
BEGIN
    v_user1 := NEW.sender_id;
    v_user2 := NEW.receiver_id;

    BEGIN
        -- A. Total des interactions (les deux sens)
        SELECT COUNT(*) INTO v_total_interactions
        FROM public.interaction_logs
        WHERE (sender_id = v_user1 AND receiver_id = v_user2)
           OR (sender_id = v_user2 AND receiver_id = v_user1);

        -- B. Réciprocité (ratio)
        SELECT COUNT(*) INTO v_messages_user1
        FROM public.interaction_logs
        WHERE sender_id = v_user1 AND receiver_id = v_user2;
        v_messages_user2 := v_total_interactions - v_messages_user1;

        IF v_total_interactions > 0 THEN
            IF v_messages_user1 = 0 OR v_messages_user2 = 0 THEN
                v_ratio := 0.5;
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

        -- C. Dernière interaction AVANT celle-ci (pour réponse rapide + décroissance)
        SELECT MAX(created_at) INTO v_last_interaction_ts
        FROM public.interaction_logs
        WHERE ((sender_id = v_user1 AND receiver_id = v_user2)
           OR (sender_id = v_user2 AND receiver_id = v_user1))
          AND created_at < NEW.created_at;

        -- Réponse rapide : dernier message reçu par l'expéditeur (v_user1) venant de v_user2
        SELECT * INTO v_last_log
        FROM public.interaction_logs
        WHERE sender_id = v_user2 AND receiver_id = v_user1
          AND created_at < NEW.created_at
        ORDER BY created_at DESC
        LIMIT 1;

        SELECT rapid_response_count INTO v_rapid_responses
        FROM public.friends
        WHERE user_id = v_user1 AND friend_id = v_user2;

        IF v_last_log IS NOT NULL AND EXTRACT(EPOCH FROM (NEW.created_at - v_last_log.created_at)) < 60 THEN
             v_rapid_responses := COALESCE(v_rapid_responses, 0) + 1;
        END IF;

        -- D. Score : 1 pt par interaction + bonus réponse rapide (3 pts au lieu de 10)
        v_base_score := (v_total_interactions * 1) + (COALESCE(v_rapid_responses, 0) * v_rapid_bonus);

        IF v_ratio < 0.3 THEN
            v_final_score := FLOOR(v_base_score * 0.8);
        ELSE
            v_final_score := v_base_score;
        END IF;

        -- E. Décroissance si pas d'interaction depuis au moins 1 jour
        IF v_last_interaction_ts IS NOT NULL THEN
            v_days_inactive := FLOOR(EXTRACT(EPOCH FROM (NEW.created_at - v_last_interaction_ts)) / 86400)::INTEGER;
            IF v_days_inactive >= 1 THEN
                v_final_score := GREATEST(0, FLOOR(v_final_score * power(0.92, v_days_inactive)));
            END IF;
        END IF;

        -- F. Niveau
        IF v_final_score >= 500 THEN
            v_level_text := 'complicity_level_elite';
        ELSIF v_final_score >= 200 THEN
            v_level_text := 'complicity_level_3';
        ELSIF v_final_score >= 50 THEN
            v_level_text := 'complicity_level_2';
        ELSE
            v_level_text := 'complicity_level_1';
        END IF;

        -- G. Mise à jour friends (les deux sens)
        UPDATE public.friends
        SET 
            complicity_score = v_final_score,
            complicity_level = v_level_text,
            interaction_count = v_total_interactions,
            rapid_response_count = COALESCE(rapid_response_count, 0) + (CASE WHEN v_last_log IS NOT NULL AND EXTRACT(EPOCH FROM (NEW.created_at - v_last_log.created_at)) < 60 THEN 1 ELSE 0 END)
        WHERE user_id = v_user1 AND friend_id = v_user2;

        UPDATE public.friends
        SET 
            complicity_score = v_final_score,
            complicity_level = v_level_text,
            interaction_count = v_total_interactions,
            rapid_response_count = COALESCE(rapid_response_count, 0) + (CASE WHEN v_last_log IS NOT NULL AND EXTRACT(EPOCH FROM (NEW.created_at - v_last_log.created_at)) < 60 THEN 1 ELSE 0 END)
        WHERE user_id = v_user2 AND friend_id = v_user1;

    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Erreur lors du calcul de complicité: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$;
