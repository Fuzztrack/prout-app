# Test du Backend Render

## 🔍 Vérification du Déploiement

Pour tester que votre backend Render fonctionne, exécutez cette commande (remplacez `VOTRE_URL` par l'URL de votre service Render) :

```bash
curl -X POST https://VOTRE_URL.onrender.com/prout \
  -H "Content-Type: application/json" \
  -H "x-api-key: 82d6d94d97ad501a596bf866c2831623" \
  -d '{
    "token": "test-token",
    "sender": "Test",
    "proutKey": "prout1"
  }'
```

## ✅ Réponses attendues

- **200 OK** : Backend fonctionne correctement (même si le token de test est invalide, Firebase devrait répondre)
- **401 Unauthorized** : Clé API incorrecte
- **400 Bad Request** : ProutKey invalide
- **500 Internal Server Error** : Problème de configuration Firebase

## 📝 Mise à Jour de l'App Frontend

Une fois que vous avez l'URL de votre backend Render, mettez à jour `lib/sendProutBackend.ts` :

```typescript
const API_URL = 'https://votre-backend.onrender.com/prout';
```

## 🐛 Dépannage

### Backend ne répond pas
- Vérifiez les logs sur Render Dashboard
- Vérifiez que les variables d'environnement sont bien configurées
- Vérifiez que `FIREBASE_SERVICE_ACCOUNT_JSON` contient bien le JSON complet

### Erreur Firebase
- Vérifiez que le JSON Firebase est bien collé dans `FIREBASE_SERVICE_ACCOUNT_JSON`
- Vérifiez les logs Render pour voir les erreurs détaillées


