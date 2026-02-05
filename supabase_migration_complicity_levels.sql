-- ==============================================================================
-- MIGRATION : Mise à jour des niveaux de complicité existants
-- ==============================================================================
-- Ce script remplace les anciennes valeurs en texte par les nouvelles clés de traduction
-- Exécutez ce script après avoir exécuté supabase_complicity_feature_COMPLET.sql

-- Mettre à jour les anciennes valeurs françaises vers les nouvelles clés
UPDATE public.friends
SET complicity_level = 'complicity_level_1'
WHERE complicity_level IN ('Connaissances sonores', 'Bouquet Léger', 'Souffle Initial')
   OR complicity_level IS NULL;

UPDATE public.friends
SET complicity_level = 'complicity_level_2'
WHERE complicity_level IN ('Complices de fréquence', 'Cuvée Complice', 'Accord Partagé');

UPDATE public.friends
SET complicity_level = 'complicity_level_3'
WHERE complicity_level IN ('Âmes synchronisées', 'Grand Cru des Échanges', 'Sillage des Âmes');

UPDATE public.friends
SET complicity_level = 'complicity_level_elite'
WHERE complicity_level IN ('Résonance Absolue', 'Réserve Privée', 'Quintessence de l''Amitié');

-- Mettre à jour les valeurs par défaut pour les nouvelles lignes
ALTER TABLE public.friends
ALTER COLUMN complicity_level SET DEFAULT 'complicity_level_1';

-- Vérification : Afficher les valeurs uniques restantes (devrait être vide ou contenir uniquement les clés)
-- SELECT DISTINCT complicity_level FROM public.friends ORDER BY complicity_level;
