/**
 * Script pour envoyer une notification à un utilisateur spécifique par son pseudo
 * Usage: node scripts/send_to_user.js "Pseudo" "Titre" "Message"
 */

const { Expo } = require('expo-server-sdk');
const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

try { require('dotenv').config(); } catch (e) {}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://utfwujyymaikraaigvuv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FIREBASE_KEY_PATH = path.join(__dirname, '..', 'firebase-service-account.json');

async function sendToUser() {
  const targetPseudo = process.argv[2];
  const title = process.argv[3] || "Message de Proot !";
  const body = process.argv[4] || "Coucou !";

  if (!targetPseudo) {
    console.log('Usage: node scripts/send_to_user.js "Dave" "Titre" "Message"');
    return;
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Erreur: SUPABASE_SERVICE_ROLE_KEY manquante dans .env");
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // 1. Trouver l'utilisateur
  console.log(`🔍 Recherche de l'utilisateur "${targetPseudo}"...`);
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('expo_push_token, push_platform, pseudo')
    .ilike('pseudo', targetPseudo) // Insensible à la casse
    .single();

  if (error || !profile || !profile.expo_push_token) {
    console.error(`❌ Impossible de trouver un token valide pour "${targetPseudo}".`);
    if (error) console.error('Détails:', error.message);
    return;
  }

  const token = profile.expo_push_token;
  const platform = profile.push_platform || (Expo.isExpoPushToken(token) ? 'ios' : 'android');
  console.log(`✅ Utilisateur trouvé : ${profile.pseudo} (${platform}).`);

  // 2. Envoyer
  if (Expo.isExpoPushToken(token)) {
    console.log(`🚀 Envoi via Expo (iOS)...`);
    const expo = new Expo();
    try {
      const tickets = await expo.sendPushNotificationsAsync([{ to: token, sound: 'default', title, body }]);
      console.log(`✅ Réponse Expo:`, tickets[0].status);
    } catch (err) {
      console.error(`❌ Erreur Expo:`, err.message);
    }
  } else {
    // Android / FCM
    console.log(`🚀 Envoi via Firebase (Android)...`);
    if (!fs.existsSync(FIREBASE_KEY_PATH)) {
      console.error("❌ Erreur: Fichier firebase-service-account.json manquant.");
      return;
    }
    const serviceAccount = require(FIREBASE_KEY_PATH);
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    try {
      const response = await admin.messaging().send({ notification: { title, body }, token: token });
      console.log(`✅ Succès Firebase ! ID:`, response.substring(0, 50) + "...");
    } catch (err) {
      console.error(`❌ Erreur Firebase:`, err.message);
    }
  }
}

sendToUser().catch(console.error);
