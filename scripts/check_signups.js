/**
 * Script de diagnostic des inscriptions ProutApp
 * Usage: node scripts/check_signups.js [nombre_jours]
 * Exemple: node scripts/check_signups.js 7
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://utfwujyymaikraaigvuv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

async function checkSignups() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error(`${RED}❌ SUPABASE_SERVICE_ROLE_KEY manquante dans .env${RESET}`);
    return;
  }

  const daysBack = parseInt(process.argv[2], 10) || 7;
  const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log(`\n${BOLD}${CYAN}🔍 DIAGNOSTIC DES INSCRIPTIONS (Derniers ${daysBack} jours)${RESET}`);
  console.log(`${CYAN}====================================================${RESET}\n`);

  // 1. Récupérer tous les comptes auth
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (authError) {
    console.error(`${RED}❌ Erreur Auth : ${authError.message}${RESET}`);
    return;
  }

  // 2. Récupérer tous les profils
  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, pseudo, expo_push_token, push_platform, created_at');
  if (profileError) {
    console.error(`${RED}❌ Erreur Profiles : ${profileError.message}${RESET}`);
    return;
  }

  const profileMap = new Map(profiles.map(p => [p.id, p]));

  // Filtrer les utilisateurs récents
  const recentUsers = users
    .filter(u => new Date(u.created_at) >= cutoffDate)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Identifier les anomalies globales
  const allMissingProfiles = users.filter(u => !profileMap.has(u.id));
  const allUnconfirmed = users.filter(u => !u.email_confirmed_at && !u.phone_confirmed_at);

  console.log(`${BOLD}📊 VUE D'ENSEMBLE GLOBALE :${RESET}`);
  console.log(`- Total inscrits (Auth) : ${BOLD}${users.length}${RESET}`);
  console.log(`- Profils créés : ${BOLD}${profiles.length}${RESET}`);
  console.log(`- Comptes sans profil : ${allMissingProfiles.length > 0 ? RED : GREEN}${allMissingProfiles.length}${RESET}`);
  console.log(`- Emails non confirmés : ${allUnconfirmed.length > 0 ? YELLOW : GREEN}${allUnconfirmed.length}${RESET}\n`);

  if (recentUsers.length === 0) {
    console.log(`${YELLOW}Aucune nouvelle inscription enregistrée sur les ${daysBack} derniers jours.${RESET}\n`);
    return;
  }

  console.log(`${BOLD}📋 DÉTAIL DES ${recentUsers.length} DERNIÈRES INSCRIPTIONS :${RESET}`);
  console.log(`--------------------------------------------------------------------------------`);

  let issueCount = 0;

  for (const user of recentUsers) {
    const profile = profileMap.get(user.id);
    const isEmailConfirmed = !!user.email_confirmed_at;
    const hasProfile = !!profile;
    const hasPseudo = !!(profile && profile.pseudo && profile.pseudo.trim() !== '');
    const hasToken = !!(profile && profile.expo_push_token);

    const isHealthy = isEmailConfirmed && hasProfile && hasPseudo && hasToken;
    if (!isHealthy) issueCount++;

    const dateStr = new Date(user.created_at).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });

    console.log(`\n👤 ${BOLD}${user.email || 'Sans email'}${RESET} (Inscrit le ${dateStr})`);
    console.log(`   ID : ${user.id}`);

    // Statut Email
    if (isEmailConfirmed) {
      console.log(`   ✉️  Email confirmé : ${GREEN}OUI${RESET}`);
    } else {
      console.log(`   ✉️  Email confirmé : ${RED}NON (bloqué en attente de validation)${RESET}`);
    }

    // Statut Profil
    if (!hasProfile) {
      console.log(`   📄 Profil : ${RED}MANQUANT (aucune ligne dans user_profiles)${RESET}`);
    } else if (!hasPseudo) {
      console.log(`   🏷️  Pseudo : ${RED}NON DÉFINI${RESET}`);
    } else {
      console.log(`   🏷️  Pseudo : ${GREEN}"${profile.pseudo}"${RESET}`);
    }

    // Statut Push Token
    if (hasToken) {
      console.log(`   🔔 Notifications : ${GREEN}ACTIVES (${profile.push_platform || 'expo'})${RESET}`);
    } else {
      console.log(`   🔔 Notifications : ${YELLOW}INACTIVES (pas de token push / permissions refusées)${RESET}`);
    }
  }

  console.log(`\n--------------------------------------------------------------------------------`);
  if (issueCount === 0) {
    console.log(`${GREEN}🎉 Toutes les inscriptions récentes sont 100% saines et complètes !${RESET}\n`);
  } else {
    console.log(`${YELLOW}⚠️ ${issueCount} inscription(s) sur ${recentUsers.length} présente(nt) un point d'attention.${RESET}\n`);
  }
}

checkSignups().catch(console.error);
