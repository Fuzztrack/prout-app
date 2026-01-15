-- Script pour mettre à jour les locales des utilisateurs existants
-- À exécuter après avoir ajouté la colonne locale

-- Mettre à jour tous les utilisateurs qui n'ont pas de locale définie
-- Par défaut, on met 'en' (anglais) car c'est le fallback du backend
UPDATE user_profiles
SET locale = 'en'
WHERE locale IS NULL;

-- Vérifier les résultats
SELECT 
  locale,
  COUNT(*) as count
FROM user_profiles
GROUP BY locale
ORDER BY count DESC;
