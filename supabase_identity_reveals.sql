-- TABLE: identity_reveals
CREATE TABLE IF NOT EXISTS public.identity_reveals (
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alias text,
  status text DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (requester_id, friend_id)
);

-- Ensure the table is protected
ALTER TABLE public.identity_reveals ENABLE ROW LEVEL SECURITY;

-- Keep updated_at in sync
CREATE OR REPLACE FUNCTION public.identity_reveals_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS identity_reveals_set_updated_at ON public.identity_reveals;
CREATE TRIGGER identity_reveals_set_updated_at
BEFORE Update ON public.identity_reveals
FOR EACH ROW EXECUTE FUNCTION public.identity_reveals_touch_updated_at();

-- POLICIES
DROP POLICY IF EXISTS "Identity requester can view" ON public.identity_reveals;
CREATE POLICY "Identity requester can view"
ON public.identity_reveals
FOR SELECT
USING (requester_id = auth.uid());

DROP POLICY IF EXISTS "Identity requester can insert" ON public.identity_reveals;
CREATE POLICY "Identity requester can insert"
ON public.identity_reveals
FOR INSERT
WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "Identity participants can update" ON public.identity_reveals;
CREATE POLICY "Identity participants can update"
ON public.identity_reveals
FOR UPDATE
USING (requester_id = auth.uid() OR friend_id = auth.uid())
WITH CHECK (requester_id = auth.uid() OR friend_id = auth.uid());

-- Optional: allow deletion by requester
DROP POLICY IF EXISTS "Identity requester can delete" ON public.identity_reveals;
CREATE POLICY "Identity requester can delete"
ON public.identity_reveals
FOR DELETE
USING (requester_id = auth.uid());

