-- Ajoute la colonne push_ios_bundle pour distinguer :
-- - ancienne app iOS Prout : com.fuzztrack.proutapp (titre "Prout!" + sons prout*.wav)
-- - nouvelle app iOS Prrt! : com.prrt.app (titre "Prrt!" + sons prrt/bzzz/trrl)

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS push_ios_bundle TEXT;

COMMENT ON COLUMN public.user_profiles.push_ios_bundle IS
  'Bundle ID iOS de l''app (ex: com.prrt.app ou com.fuzztrack.proutapp). Utilisé par le backend pour choisir le titre ("Prrt!" vs "Prout!") et le son de notification.';
