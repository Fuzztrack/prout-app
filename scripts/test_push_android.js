/**
 * Script de TEST pour envoyer une notification à un token Android (FCM natif)
 * Usage: node scripts/test_push_android.js "Titre" "Message"
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// --- CONFIGURATION ---
const FIREBASE_KEY_PATH = path.join(__dirname, '..', 'firebase-service-account.json');
const TEST_TOKEN = "fqk9ezMDQH6mYBCzl99-Jv:APA91bHhvRneSAh1eTWZRs6weH3iiN5v0dIIDZLMzILsCRRrHG7m6KGesoDaeVR-i1_E53W-To4k_coefHwC6m9BHU_BPihiVMIAIAjWSFnJGfwzNPAFYU0";

async function testAndroidPush() {
  const title = process.argv[2] || "Test Android Proot !";
  const body = process.argv[3] || "Ceci est un test de notification Android via FCM.";

  if (!fs.existsSync(FIREBASE_KEY_PATH)) {
    console.error(`❌ Erreur: Fichier ${FIREBASE_KEY_PATH} introuvable.`);
    return;
  }

  // Initialisation Firebase
  const serviceAccount = require(FIREBASE_KEY_PATH);
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  console.log(`🚀 Envoi du test Android vers ${TEST_TOKEN.substring(0, 20)}...`);

  const message = {
    notification: {
      title: title,
      body: body,
    },
    token: TEST_TOKEN,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('✅ Succès ! Message envoyé avec ID:', response);
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi FCM:', error);
  }
}

testAndroidPush().catch(console.error);
