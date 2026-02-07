-- ==============================================================================
-- MIGRATION : Mise à jour des niveaux de complicité existants vers les clés de traduction
-- ==============================================================================
-- Ce script met à jour les niveaux stockés en français vers les clés de traduction
-- pour permettre la traduction côté client.

UPDATE public.friends
SET complicity_level = 'complicity_level_1'
WHERE complicity_level IN ('Connaissances sonores', 'Bouquet Léger');

UPDATE public.friends
SET complicity_level = 'complicity_level_2'
WHERE complicity_level IN ('Complices de fréquence', 'Cuvée Complice');

UPDATE public.friends
SET complicity_level = 'complicity_level_3'
WHERE complicity_level IN ('Âmes synchronisées', 'Grand Cru des Échanges');

UPDATE public.friends
SET complicity_level = 'complicity_level_elite'
WHERE complicity_level IN ('Résonance Absolue', 'Réserve Privée');

-- Vérification : Afficher les niveaux restants (devrait être vide ou ne contenir que les nouvelles clés)
-- SELECT DISTINCT complicity_level FROM public.friends ORDER BY complicity_level;
