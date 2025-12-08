-- Ajout de la colonne is_zen_mode pour le mode "Ne pas déranger"
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS is_zen_mode boolean DEFAULT false;

