# ✅ Checklist Déploiement Backend - Son Notification

## 🐛 Problème actuel

Les logs montrent que le backend déployé envoie toujours :
```json
{
  "sound": null,
  "title": "Fuzz t'a envoyé un prout ! 💨"
}
```

Au lieu de :
```json
{
  "sound": "prout12",
  "title": "PROUT ! 💨"
}
```

## ✅ Code local corrigé

Le fichier `backend/src/prout/prout.service.ts` a été mis à jour avec :
- ✅ `sound: proutKey` (sans extension, ex: "prout12")
- ✅ `title: 'PROUT ! 💨'`
- ✅ Utilisation uniquement d'Expo Server SDK

## 🚀 Étapes de déploiement

### 1. Vérifier que le code est bien poussé sur Git

```bash
cd backend
git status
git add src/prout/prout.service.ts
git commit -m "Fix: Ajout du son dans les notifications Expo Push"
git push
```

### 2. Redéployer sur Render

1. Aller sur https://dashboard.render.com
2. Sélectionner le service backend
3. Cliquer sur **"Manual Deploy"** → **"Deploy latest commit"**
4. Attendre la fin du déploiement

### 3. Vérifier les logs après déploiement

Les logs devraient maintenant montrer :
```
📤 Préparation envoi Prout: { 
  to: 'ExponentPushToken[...', 
  sound: 'prout12', 
  proutKey: 'prout12' 
}
```

Et le message Expo Push devrait contenir :
```json
{
  "sound": "prout12",
  "title": "PROUT ! 💨"
}
```

## ⚠️ Points importants

1. **Format du son** : Utiliser juste le nom sans extension (`"prout12"` pas `"prout12.wav"`)
   - Expo convertit automatiquement les fichiers `.wav` en `.caf` pour iOS
   - Le nom dans `app.json` doit correspondre (ex: `"./assets/sounds/prout12.wav"`)

2. **Cache Render** : Si le déploiement ne fonctionne pas, essayer :
   - Redémarrer le service sur Render
   - Vérifier que le commit est bien déployé

3. **Vérification** : Après déploiement, envoyer un prout et vérifier les logs backend

## 📝 Format attendu du message

```typescript
{
  to: "ExponentPushToken[...]",
  sound: "prout12", // ✅ Nom sans extension
  title: "PROUT ! 💨",
  body: "Fuzz t'a envoyé : La Rafale Infernale",
  android: {
    channelId: "prout12", // ✅ Nom sans suffixe
    icon: './assets/images/icon.png',
    color: '#ebb89b',
    vibrate: [0, 250, 250, 250],
  },
  data: {
    type: 'prout',
    proutKey: "prout12",
    sender: "Fuzz",
    proutName: "La Rafale Infernale"
  }
}
```



