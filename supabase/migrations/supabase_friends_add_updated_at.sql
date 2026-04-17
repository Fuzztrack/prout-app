-- ==============================================================================
-- Fix: column "updated_at" does not exist (erreur 500 lors de l'envoi de prout)
-- ==============================================================================
-- La table friends est mise à jour par update_friend_interaction (RPC) ou par
-- upsert depuis le backend. Un trigger ou le schéma Supabase peut s'attendre
-- à une colonne updated_at. On l'ajoute si elle n'existe pas.
-- Exécuter dans l'éditeur SQL Supabase.
-- ==============================================================================

ALTER TABLE public.friends
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Optionnel : trigger pour maintenir updated_at à chaque UPDATE
CREATE OR REPLACE FUNCTION public.friends_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS friends_set_updated_at ON public.friends;
CREATE TRIGGER friends_set_updated_at
  BEFORE UPDATE ON public.friends
  FOR EACH ROW
  EXECUTE FUNCTION public.friends_touch_updated_at();

COMMENT ON COLUMN public.friends.updated_at IS 'Dernière mise à jour de la ligne (pour cohérence avec les triggers/schema).';
