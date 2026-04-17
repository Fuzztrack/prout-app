-- ==============================================================================
-- Remise à zéro des compteurs de complicité
-- Exécuter dans l'éditeur SQL Supabase
-- ==============================================================================

-- 1. Remettre à zéro les colonnes complicité dans friends
UPDATE public.friends
SET 
  complicity_score = 0,
  complicity_level = 'complicity_level_1',
  interaction_count = 0,
  rapid_response_count = 0;

-- 2. (Optionnel) Vider l'historique des interactions pour repartir de zéro
-- Décommenter si vous voulez que les prochaines interactions recalculent tout depuis le début
-- TRUNCATE TABLE public.interaction_logs;
