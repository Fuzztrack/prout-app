-- ============================================================
-- MIGRATION : MODULE GROOPPROOT (Groupes & Chat Collectif)
-- Totalement additif et sans aucun impact sur l'existant
-- ============================================================

-- 1. Table des Groupes
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(name) >= 2 AND char_length(name) <= 50),
    avatar_url TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    retention_mode TEXT NOT NULL DEFAULT '24h' CHECK (retention_mode IN ('24h', 'permanent')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Table des Membres du Groupe (Créateur + Amis invités)
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('creator', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_read_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_group_user UNIQUE(group_id, user_id)
);

-- 3. Table des Messages de Groupe
CREATE TABLE IF NOT EXISTS public.group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_pseudo TEXT NOT NULL,
    message TEXT,
    sound_key TEXT,
    image_url TEXT,
    is_view_once BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);

-- 4. Index d'Optimisation des requêtes
CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON public.group_messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_messages_expires ON public.group_messages(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_groups_last_interaction ON public.groups(last_interaction_at DESC);

-- 5. Fonction de Sécurité (empêche les boucles infinies de récursion RLS)
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

-- 6. Activation de la Sécurité Ligne par Ligne (RLS)
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- 7. Politiques RLS : GROUPS
DROP POLICY IF EXISTS "groups_select_members" ON public.groups;
CREATE POLICY "groups_select_members"
ON public.groups FOR SELECT
USING (public.is_group_member(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS "groups_insert_creator" ON public.groups;
CREATE POLICY "groups_insert_creator"
ON public.groups FOR INSERT
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "groups_update_creator" ON public.groups;
CREATE POLICY "groups_update_creator"
ON public.groups FOR UPDATE
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "groups_delete_creator" ON public.groups;
CREATE POLICY "groups_delete_creator"
ON public.groups FOR DELETE
USING (auth.uid() = created_by);

-- 8. Politiques RLS : GROUP_MEMBERS
DROP POLICY IF EXISTS "group_members_select" ON public.group_members;
CREATE POLICY "group_members_select"
ON public.group_members FOR SELECT
USING (public.is_group_member(group_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "group_members_insert" ON public.group_members;
CREATE POLICY "group_members_insert"
ON public.group_members FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.groups WHERE id = group_id AND created_by = auth.uid())
  OR auth.uid() = user_id
);

DROP POLICY IF EXISTS "group_members_update_own" ON public.group_members;
CREATE POLICY "group_members_update_own"
ON public.group_members FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "group_members_delete" ON public.group_members;
CREATE POLICY "group_members_delete"
ON public.group_members FOR DELETE
USING (
  auth.uid() = user_id 
  OR EXISTS (SELECT 1 FROM public.groups WHERE id = group_id AND created_by = auth.uid())
);

-- 9. Politiques RLS : GROUP_MESSAGES
DROP POLICY IF EXISTS "group_messages_select" ON public.group_messages;
CREATE POLICY "group_messages_select"
ON public.group_messages FOR SELECT
USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "group_messages_insert" ON public.group_messages;
CREATE POLICY "group_messages_insert"
ON public.group_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id 
  AND public.is_group_member(group_id)
);

DROP POLICY IF EXISTS "group_messages_delete" ON public.group_messages;
CREATE POLICY "group_messages_delete"
ON public.group_messages FOR DELETE
USING (
  auth.uid() = sender_id 
  OR EXISTS (SELECT 1 FROM public.groups WHERE id = group_id AND created_by = auth.uid())
);

-- 10. Triggers Automatiques Utilitaires
-- A. Met à jour automatiquement la date de dernière activité du groupe lors d'un message
CREATE OR REPLACE FUNCTION public.update_group_last_interaction()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.groups
  SET last_interaction_at = NEW.created_at
  WHERE id = NEW.group_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_group_messages_last_interaction ON public.group_messages;
CREATE TRIGGER trg_group_messages_last_interaction
AFTER INSERT ON public.group_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_group_last_interaction();

-- B. Calcule automatiquement l'expiration à 24h si le groupe est en mode 24h
CREATE OR REPLACE FUNCTION public.set_group_message_expiration()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_retention text;
BEGIN
  SELECT retention_mode INTO v_retention FROM public.groups WHERE id = NEW.group_id;
  IF v_retention = '24h' AND NEW.expires_at IS NULL THEN
    NEW.expires_at := NEW.created_at + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_group_message_expiration ON public.group_messages;
CREATE TRIGGER trg_set_group_message_expiration
BEFORE INSERT ON public.group_messages
FOR EACH ROW
EXECUTE FUNCTION public.set_group_message_expiration();

-- 11. Activation de la diffusion Realtime (pour recevoir les messages instantanément)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'groups'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'group_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'group_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
  END IF;
EXCEPTION
  WHEN undefined_object THEN NULL;
END;
$$;
