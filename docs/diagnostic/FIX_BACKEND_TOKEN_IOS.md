# 🔧 Correction Backend - Tokens iOS (ExponentPushToken)

## 📋 Problème

Le backend rejette les tokens iOS au format `ExponentPushToken[...]` car il essaie de les envoyer à Firebase FCM (qui est pour Android).

## ✅ Solution

Il faut détecter le type de token et utiliser l'API Expo Push pour iOS.

## 📝 Code à ajouter dans le Backend

### 1. Installer la dépendance

```bash
npm install expo-server-sdk
```

### 2. Modifier `backend/src/prout/prout.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Expo } from 'expo-server-sdk'; // ⚠️ Ajouter cette import

@Injectable()
export class ProutService {
  private expo = new Expo(); // ⚠️ Initialiser Expo SDK

  async sendProut(recipientToken: string, sender: string, proutKey: string) {
    console.log(`🚀 Tentative d'envoi à : ${recipientToken.substring(0, 25)}...`);

    // 1. DÉTECTION : Est-ce un token Expo (iOS) ?
    if (Expo.isExpoPushToken(recipientToken)) {
      console.log('📱 Type détecté : iOS (Expo Push)');
      return this.sendExpoNotification(recipientToken, sender, proutKey);
    } 

    // 2. SINON : C'est un token Android (FCM natif)
    console.log('🤖 Type détecté : Android (FCM)');
    return this.sendFCMNotification(recipientToken, sender, proutKey);
  }

  // ⚠️ NOUVELLE MÉTHODE pour iOS (Expo)
  private async sendExpoNotification(token: string, sender: string, proutKey: string) {
    const proutName = this.getProutName(proutKey); // Tu as déjà cette fonction
    
    const messages = [{
      to: token,
      sound: 'default', // Sur iOS, les sons custom sont complexes, commence par default
      title: 'PROUT ! 💨',
      body: `${sender} t'a envoyé ${proutName || 'un prout'} !`,
      data: { 
        sender,
        proutKey,
        proutName 
      },
    }];

    try {
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets = [];
      
      for (let chunk of chunks) {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      }

      // Vérifier les erreurs dans les tickets
      for (let ticket of tickets) {
        if (ticket.status === 'error') {
          console.error('❌ Erreur ticket Expo:', ticket.message);
          if (ticket.details?.error === 'DeviceNotRegistered') {
            throw new BadRequestException('Token Expo invalide ou expiré');
          }
        }
      }

      return { success: true, platform: 'ios' };
    } catch (error) {
      console.error('❌ Erreur Expo:', error);
      throw error;
    }
  }

  // Ta méthode existante pour Android (ne change pas)
  private async sendFCMNotification(token: string, sender: string, proutKey: string) {
    // ... ton code actuel avec fetch('https://fcm.googleapis.com/fcm/send' ...
  }

  private getProutName(proutKey: string): string {
    // Ton mapping existant des noms de prouts
    const proutNames: Record<string, string> = {
      prout1: "La Petite Bourrasque",
      prout2: "Le Crépitant",
      // ... etc
    };
    return proutNames[proutKey] || proutKey;
  }
}
```

## 🚀 Déploiement

1. Ajouter `expo-server-sdk` dans `package.json` du backend
2. Modifier `prout.service.ts` avec le code ci-dessus
3. Redéployer le backend (Render/Heroku/etc.)

## ✅ Résultat attendu

- Les tokens iOS (`ExponentPushToken[...]`) seront correctement traités via l'API Expo
- Les tokens Android (FCM) continueront de fonctionner comme avant
- Plus d'erreurs "Token invalide" pour iOS




