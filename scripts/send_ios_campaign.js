/**
 * Script pour envoyer une campagne de notification aux utilisateurs iOS
 * Usage: node scripts/send_ios_campaign.js "Titre" "Message"
 */

const { Expo } = require('expo-server-sdk');
const { createClient } = require('@supabase/supabase-js');
// On essaie de charger dotenv si disponible pour les tests locaux
try {
  require('dotenv').config();
} catch (e) {
  // Ignoré si non présent
}

// Configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://utfwujyymaikraaigvuv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; 

async function sendCampaign() {
  const title = process.argv[2];
  const body = process.argv[3];

  if (!title || !body) {
    console.log('Usage: node scripts/send_ios_campaign.js "Mon Titre" "Mon Message"');
    return;
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Erreur: SUPABASE_SERVICE_ROLE_KEY doit être défini dans ton environnement.");
    console.log("Tu peux le trouver dans ton tableau de bord Supabase (Settings > API).");
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const expo = new Expo();

  console.log(`🚀 Démarrage de la campagne iOS: "${title}" - "${body}"`);

  // 1. Récupérer les tokens iOS depuis Supabase
  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select('id, pseudo, expo_push_token')
    .eq('push_platform', 'ios')
    .not('expo_push_token', 'is', null);

  if (error) {
    console.error("❌ Erreur Supabase:", error);
    return;
  }

  // Filtrer les tokens valides au format Expo
  const validProfiles = profiles.filter(p => Expo.isExpoPushToken(p.expo_push_token));

  console.log(`🔍 Utilisateurs iOS trouvés : ${profiles.length}`);
  console.log(`✅ Tokens Expo valides : ${validProfiles.length}`);

  if (validProfiles.length === 0) {
    console.log("Terminé: Aucun token valide à notifier.");
    return;
  }

  // 2. Préparer les messages
  let messages = [];
  for (let profile of validProfiles) {
    messages.push({
      to: profile.expo_push_token,
      sound: 'default',
      title: title,
      body: body,
      data: { type: 'campaign', sender: 'system' },
    });
  }

  // 3. Envoyer par paquets (l'API Expo a des limites par requête)
  let chunks = expo.chunkPushNotifications(messages);
  let tickets = [];

  for (let chunk of chunks) {
    try {
      let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      console.log(`📦 Paquet envoyé (${chunk.length} notifications)`);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error("❌ Erreur lors de l'envoi d'un paquet:", error);
    }
  }

  // Note: On pourrait ici inspecter les 'tickets' pour supprimer les tokens invalides de Supabase
  console.log("🏁 Campagne terminée !");
}

sendCampaign().catch(console.error);
