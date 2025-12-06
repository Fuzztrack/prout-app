-- Ajoute une colonne pour suivre la plateforme de notification et
-- force les utilisateurs Android à régénérer un token FCM natif.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS push_platform TEXT;

-- Backfill heuristique : FCM natif contient généralement un ":", Expo commence par ExponentPushToken[
UPDATE user_profiles
SET push_platform = CASE
    WHEN expo_push_token ILIKE 'ExponentPushToken[%' THEN COALESCE(push_platform, 'ios')
    WHEN expo_push_token LIKE '%:%' THEN COALESCE(push_platform, 'android')
    ELSE push_platform
  END
WHERE expo_push_token IS NOT NULL;

-- Forcer le rafraîchissement des anciens utilisateurs Android encore en token Expo
UPDATE user_profiles
SET expo_push_token = NULL
WHERE push_platform = 'android'
  AND expo_push_token ILIKE 'ExponentPushToken[%';

COMMENT ON COLUMN user_profiles.push_platform IS 'ios ou android selon l''appareil ayant généré le push token';


