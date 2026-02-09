-- Ajoute la colonne push_ios_bundle pour distinguer ancienne app Prout iOS (com.fuzztrack.proutapp)
-- et nouvelle app Prrt! iOS (com.prrt.app) pour le choix du son (prout*.wav vs prrt*.wav).

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS push_ios_bundle TEXT;

COMMENT ON COLUMN public.user_profiles.push_ios_bundle IS
  'Bundle ID iOS de l''app (ex: com.prrt.app ou com.fuzztrack.proutapp). Utilisé par le backend pour envoyer prrt*.wav ou prout*.wav.';
