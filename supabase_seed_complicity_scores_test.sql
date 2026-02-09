-- ==============================================================================
-- Scores de complicité de test pour un utilisateur
-- ==============================================================================
-- Met des scores aléatoires (entre 2 et 258) pour toutes les amitiés
-- de l'utilisateur 2a0df841-f11b-4e3b-9d7f-53f8f762232e.
-- À exécuter dans l'éditeur SQL Supabase.

UPDATE public.friends f
SET
  complicity_score = s.rand_score,
  complicity_level = CASE
    WHEN s.rand_score < 50  THEN 'complicity_level_1'
    WHEN s.rand_score < 200 THEN 'complicity_level_2'
    ELSE 'complicity_level_3'
  END
FROM (
  SELECT id, (2 + floor(random() * 257)::INTEGER) AS rand_score
  FROM public.friends
  WHERE user_id = '2a0df841-f11b-4e3b-9d7f-53f8f762232e'
    AND status = 'accepted'
) s
WHERE f.id = s.id;
