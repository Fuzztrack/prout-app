-- Config distante pour soft update (version store recommandée)
CREATE TABLE IF NOT EXISTS public.app_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  latest_version text NOT NULL,
  min_version text,
  soft_update_message text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_config (id, latest_version, soft_update_message)
VALUES (
  1,
  '1.1.53',
  NULL
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_config_public_read" ON public.app_config;
CREATE POLICY "app_config_public_read"
  ON public.app_config
  FOR SELECT
  TO anon, authenticated
  USING (true);

COMMENT ON TABLE public.app_config IS
  'latest_version = dernière version store. Soft prompt si app installée < latest_version.';
