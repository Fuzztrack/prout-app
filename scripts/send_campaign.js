/**
 * Script de campagne global (iOS + Android)
 * Usage: node scripts/send_campaign.js "Titre" "Message"
 */

const { Expo } = require('expo-server-sdk');
const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

try {
  require('dotenv').config();
} catch (e) {}

// --- CONFIGURATION ---
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://utfwujyymaikraaigvuv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; 
const FIREBASE_KEY_PATH = path.join(__dirname, '..', 'firebase-service-account.json');

async function sendGlobalCampaign() {
  const title = process.argv[2];
  const body = process.argv[3];

  if (!title || !body) {
    console.log('Usage: node scripts/send_campaign.js "Titre" "Message"');
    return;
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Erreur: SUPABASE_SERVICE_ROLE_KEY manquante.");
    return;
  }

  // Initialisation Firebase si le fichier existe
  let firebaseEnabled = false;
  if (fs.existsSync(FIREBASE_KEY_PATH)) {
    const serviceAccount = require(FIREBASE_KEY_PATH);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    firebaseEnabled = true;
    console.log("✅ Firebase Admin initialisé pour Android.");
  } else {
    console.warn("⚠️ Fichier firebase-service-account.json introuvable. Les Android seront ignorés.");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const expo = new Expo();

  console.log(`🚀 Démarrage de la campagne globale: "${title}"`);

  // 1. Récupérer TOUS les tokens
  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select('id, pseudo, expo_push_token, push_platform')
    .not('expo_push_token', 'is', null);

  if (error) {
    console.error("❌ Erreur Supabase:", error);
    return;
  }

  const expoMessages = [];
  const fcmTokens = [];

  profiles.forEach(p => {
    if (Expo.isExpoPushToken(p.expo_push_token)) {
      expoMessages.push({
        to: p.expo_push_token,
        sound: 'default',
        title: title,
        body: body,
        data: { type: 'campaign' },
      });
    } else if (firebaseEnabled && (p.push_platform === 'android' || !p.push_platform)) {
      // Si ce n'est pas un token Expo, on suppose que c'est un token FCM natif (Android)
      fcmTokens.push(p.expo_push_token);
    }
  });

  console.log(`📊 Statistiques : ${expoMessages.length} iOS (Expo), ${fcmTokens.length} Android (FCM)`);

  // 2. Envoi iOS (Expo)
  if (expoMessages.length > 0) {
    let chunks = expo.chunkPushNotifications(expoMessages);
    for (let chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
        console.log(`✅ Paquet Expo envoyé (${chunk.length} messages)`);
      } catch (err) {
        console.error("❌ Erreur paquet Expo:", err);
      }
    }
  }

  // 3. Envoi Android (Firebase)
  if (firebaseEnabled && fcmTokens.length > 0) {
    // Firebase peut envoyer par paquets de 500
    const fcmChunks = [];
    for (let i = 0; i < fcmTokens.length; i += 500) {
      fcmChunks.push(fcmTokens.slice(i, i + 500));
    }

    for (let chunk of fcmChunks) {
      const message = {
        notification: { title, body },
        tokens: chunk,
      };
      try {
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`✅ Paquet FCM envoyé : ${response.successCount} succès, ${response.failureCount} erreurs`);
      } catch (err) {
        console.error("❌ Erreur paquet FCM:", err);
      }
    }
  }

  console.log("🏁 Campagne terminée !");
}

sendGlobalCampaign().catch(console.error);
