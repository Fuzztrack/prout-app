-- Purge des anciens messages dans pending_messages
-- À exécuter une fois ou périodiquement dans l'éditeur SQL Supabase.
--
-- 1) Supprimer tous les messages déjà marqués READ: (lus)
-- 2) Optionnel : supprimer les messages de plus de 7 jours (même non lus)

-- 1. Messages lus (READ:)
DELETE FROM public.pending_messages
WHERE message_content LIKE 'READ:%';

-- 2. (Optionnel) Messages de plus de 7 jours
-- DELETE FROM public.pending_messages
-- WHERE created_at < (now() - INTERVAL '7 days');
