/**
 * Script de TEST pour envoyer une notification à un token spécifique
 * Usage: node scripts/test_push_ios.js "Titre" "Message"
 */

const { Expo } = require('expo-server-sdk');

async function testPush() {
  const token = "ExponentPushToken[MVMlvoEKgqdu-y6nqulk_D]";
  const title = process.argv[2] || "Test Proot !";
  const body = process.argv[3] || "Ceci est un test de notification iOS.";

  const expo = new Expo();

  if (!Expo.isExpoPushToken(token)) {
    console.error(`❌ Token invalide: ${token}`);
    return;
  }

  console.log(`🚀 Envoi du test vers ${token}...`);

  const messages = [{
    to: token,
    sound: 'default',
    title: title,
    body: body,
    data: { type: 'test' },
  }];

  try {
    const ticketChunk = await expo.sendPushNotificationsAsync(messages);
    console.log('✅ Ticket reçu:', ticketChunk);
    
    // Note: Le ticket ne signifie pas que le mobile a reçu, 
    // mais que le serveur Expo a accepté la demande.
    if (ticketChunk[0].status === 'error') {
      console.error('❌ Erreur Expo:', ticketChunk[0].message);
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi:', error);
  }
}

testPush();
