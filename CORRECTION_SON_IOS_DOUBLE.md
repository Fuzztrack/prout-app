# ✅ Correction - Double son iOS

## 🔍 Problème

Sur iOS, quand une notification arrive :
- ✅ Le son prout personnalisé se joue (via `notificationAudioPlayer`)
- ❌ **MAIS** le son de notification système iOS se joue aussi (doublon)

## 🔧 Solution appliquée

### 1. Backend : Désactiver le son système dans la notification Expo

**Fichier** : `backend/src/prout/prout.service.ts` (ligne 147)

**Avant** :
```typescript
sound: proutKey, // Nom du son correspondant au prout
```

**Après** :
```typescript
sound: null, // Désactiver le son système pour iOS
```

### 2. Frontend : Désactiver le son système dans le handler

**Fichier** : `app/_layout.tsx` (ligne 71)

**Avant** :
```typescript
shouldPlaySound: true,
```

**Après** :
```typescript
shouldPlaySound: false, // Désactiver le son système iOS
```

---

## ✅ Résultat attendu

Après ces modifications :
- ✅ **Seul le son prout personnalisé** se jouera
- ✅ **Plus de son système iOS** en double
- ✅ Le son sera joué uniquement via `notificationAudioPlayer`

---

## 🚀 Déploiement

### Backend (OBLIGATOIRE)

1. **Commit et push** les changements :
```bash
cd backend
git add src/prout/prout.service.ts
git commit -m "Désactiver son système iOS pour éviter double son"
git push
```

2. **Redéployer sur Render** (automatique ou manuel)

### Frontend (LOCAL ou BUILD)

Les modifications dans `app/_layout.tsx` prendront effet :
- **En développement** : Rechargez l'app (`Cmd + R`)
- **En production** : Rebuild l'app iOS

---

## 🧪 Test

1. Redéployez le backend
2. Testez un envoi Android → iOS
3. Vérifiez qu'**un seul son** se joue (le prout personnalisé)

---

## 📋 Checklist

- [x] Backend modifié (`sound: null`)
- [x] Frontend modifié (`shouldPlaySound: false`)
- [ ] Backend commité et pushé
- [ ] Backend redéployé sur Render
- [ ] Test Android → iOS après redéploiement

