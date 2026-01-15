-- Ajoute une colonne pour stocker la locale de l'utilisateur (langue de l'app)
-- Permet d'envoyer des notifications dans la bonne langue

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'fr';

COMMENT ON COLUMN user_profiles.locale IS 'Langue de l''utilisateur: fr, en, es (anglais par défaut si non supportée)';
