-- 1. Nettoyage des anciennes politiques pour repartir propre

DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON user_profiles;



-- 2. Activation RLS

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;



-- 3. Politiques Permissives (Lecture/Écriture pour soi-même)

CREATE POLICY "Enable read access for authenticated users"

ON "public"."user_profiles" FOR SELECT TO authenticated USING (true);



CREATE POLICY "Users can insert their own profile"

ON "public"."user_profiles" FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);



CREATE POLICY "Users can update own profile"

ON "public"."user_profiles" FOR UPDATE TO authenticated USING (auth.uid() = id);



-- 4. Trigger de sécurité (Optionnel mais recommandé pour créer un profil vide si l'app plante)

CREATE OR REPLACE FUNCTION public.handle_new_user()

RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public

AS $$

BEGIN

  INSERT INTO public.user_profiles (id, pseudo)

  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'pseudo', 'Nouveau Membre'))

  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;

END;

$$;



DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created

  AFTER INSERT ON auth.users

  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

