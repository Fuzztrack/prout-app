const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://utfwujyymaikraaigvuv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function listUsersNoToken() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Erreur: SUPABASE_SERVICE_ROLE_KEY manquante.");
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Récupérer tous les utilisateurs de Auth
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error("❌ Erreur Auth:", authError);
    return;
  }

  // 2. Récupérer tous les profils avec leur token
  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, expo_push_token');

  if (profileError) {
    console.error("❌ Erreur Profils:", profileError);
    return;
  }

  const profileMap = new Map();
  profiles.forEach(p => {
    profileMap.set(p.id, p.expo_push_token);
  });

  console.log("Emails des utilisateurs confirmés sans token push :");
  console.log("--------------------------------------------------");

  const usersWithoutToken = users.filter(user => {
    // Exclure ceux qui n'ont pas confirmé leur mail
    if (!user.email_confirmed_at) return false;

    const token = profileMap.get(user.id);
    // Garder ceux qui n'ont pas de token (null ou vide)
    return !token || token.trim() === '';
  });

  usersWithoutToken.forEach(user => {
    console.log(user.email);
  });

  console.log("--------------------------------------------------");
  console.log(`Total: ${usersWithoutToken.length} utilisateurs.`);
}

listUsersNoToken().catch(console.error);
