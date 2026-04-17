-- Sécurité : purge des messages READ: orphelins
-- Objectif : si le backend crash avant le DELETE, on supprime les messages marqués READ:
-- après un délai de sécurité (2 minutes).
--
-- NOTE: on utilise created_at car la table pending_messages n'expose pas forcément updated_at.
-- Cela peut supprimer très vite un vieux message dès qu'il est marqué READ: (ce qui est OK : il est déjà lu).

CREATE OR REPLACE FUNCTION public.force_delete_old_read_messages()
RETURNS trigger AS $$
BEGIN
  DELETE FROM public.pending_messages
  WHERE message_content LIKE 'READ:%'
    AND created_at < (now() - INTERVAL '2 minutes');
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_security_cleanup_messages ON public.pending_messages;
CREATE TRIGGER trg_security_cleanup_messages
AFTER INSERT OR UPDATE ON public.pending_messages
FOR EACH STATEMENT
EXECUTE FUNCTION public.force_delete_old_read_messages();

