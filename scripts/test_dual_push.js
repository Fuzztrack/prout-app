/**
 * Script de TEST pour envoyer une notification à DEUX tokens (Android FCM + iOS Expo)
 * Usage: node scripts/test_dual_push.js "Titre" "Message"
 */

const { Expo } = require('expo-server-sdk');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// --- CONFIGURATION ---
const FIREBASE_KEY_PATH = path.join(__dirname, '..', 'firebase-service-account.json');
const ANDROID_TOKEN = "fqk9ezMDQH6mYBCzl99-Jv:APA91bHhvRneSAh1eTWZRs6weH3iiN5v0dIIDZLMzILsCRRrHG7m6KGesoDaeVR-i1_E53W-To4k_coefHwC6m9BHU_BPihiVMIAIAjWSFnJGfwzNPAFYU0";
const IOS_TOKEN = "ExponentPushToken[MVMlvoEKgqdu-y6nqulk_D]";

async function testDualPush() {
  const title = process.argv[2] || "Test Dual Proot !";
  const body = process.argv[3] || "Ceci est un test pour Android et iOS simultanément.";

  console.log(`🚀 Démarrage du test dual...`);

  // --- 1. ENVOI IOS (EXPO) ---
  const expo = new Expo();
  if (Expo.isExpoPushToken(IOS_TOKEN)) {
    console.log(`📱 Envoi iOS (Expo) vers ${IOS_TOKEN.substring(0, 30)}...`);
    try {
      const ticket = await expo.sendPushNotificationsAsync([{
        to: IOS_TOKEN,
        sound: 'default',
        title: title,
        body: body,
        data: { type: 'test_dual' },
      }]);
      console.log('✅ Succès iOS (Expo) ! Ticket:', ticket[0].status);
    } catch (err) {
      console.error('❌ Erreur iOS (Expo):', err.message);
    }
  } else {
    console.error('❌ Token iOS invalide');
  }

  // --- 2. ENVOI ANDROID (FCM) ---
  if (fs.existsSync(FIREBASE_KEY_PATH)) {
    const serviceAccount = require(FIREBASE_KEY_PATH);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    console.log(`🤖 Envoi Android (FCM) vers ${ANDROID_TOKEN.substring(0, 30)}...`);
    try {
      const response = await admin.messaging().send({
        notification: { title, body },
        token: ANDROID_TOKEN,
      });
      console.log('✅ Succès Android (FCM) ! ID:', response.substring(0, 50) + "...");
    } catch (err) {
      console.error('❌ Erreur Android (FCM):', err.message);
    }
  } else {
    console.error('❌ Fichier firebase-service-account.json introuvable pour Android.');
  }

  console.log("🏁 Test dual terminé !");
}

testDualPush().catch(console.error);
