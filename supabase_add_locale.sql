-- Ajoute une colonne pour stocker la locale de l'utilisateur (langue de l'app)
-- Permet d'envoyer des notifications dans la bonne langue

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'en';

-- Mettre à jour les valeurs NULL existantes avec 'en' par défaut
UPDATE user_profiles
SET locale = 'en'
WHERE locale IS NULL;

COMMENT ON COLUMN user_profiles.locale IS 'Langue de l''utilisateur: fr, en, es, pt-BR, de, it (anglais par défaut si non supportée)';
