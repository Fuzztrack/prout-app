# 📁 FICHIERS SLIDER COMPLETS - Prêts à copier

## 🎯 FICHIER 1 : Composant Principal du Slider

### `components/FriendsList.tsx`
*(Voir le fichier complet ci-dessous - 977 lignes)*

---

## 🔧 FICHIER 2 : Dépendance - Normalisation téléphone

### `lib/normalizePhone.ts`

```typescript
export function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;

  // 1. Garder uniquement chiffres et +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // 2. Gestion format FR (06/07 -> +336/+337)
  if (cleaned.startsWith('06') || cleaned.startsWith('07')) {
    cleaned = '+33' + cleaned.substring(1);
  }

  // 3. Si commence par 00 -> +
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }

  // 4. Si pas de +, on laisse tel quel (à adapter si besoin)
  return cleaned;
}
```

---

## 🔧 FICHIER 3 : Dépendance - Envoi Backend

### `lib/sendProutBackend.ts`

```typescript
// Envoi du prout via ton backend Nest.js
export async function sendProutViaBackend(recipientToken: string, sender: string, proutKey: string) {
  const API_URL = 'https://prout-backend.onrender.com/prout';
  const API_KEY = '82d6d94d97ad501a596bf866c2831623';     // doit matcher backend .env

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({
      token: recipientToken,
      sender,
      proutKey,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('❌ Backend error:', res.status, text);
    console.error('Request body:', { token: recipientToken.substring(0, 20) + '...', sender, proutKey });
    throw new Error(`Backend error: ${res.status} ${text}`);
  }
  const result = await res.json();
  return result;
}
```

---

## 🖼️ Assets Images Requis

Placez dans `assets/images/` :

- ✅ `animprout1.png` - Image animation début
- ✅ `animprout2.png` - Image animation milieu  
- ✅ `animprout3.png` - Image animation fin
- ✅ `animprout4.png` - Image finale après envoi

---

## 🔊 Assets Sons Requis

Placez dans `assets/sounds/` :

- ✅ `prout1.ogg` à `prout20.ogg` (20 fichiers)

---

## 📦 Dépendances npm Requises

```json
{
  "dependencies": {
    "@expo/vector-icons": "^15.0.3",
    "@react-native-async-storage/async-storage": "^2.2.0",
    "expo-audio": "~1.0.15",
    "expo-contacts": "~15.0.10",
    "@supabase/supabase-js": "^2.81.1",
    "react": "19.1.0",
    "react-native": "0.81.5"
  }
}
```

---

## 🐛 PROBLÈMES CONNUS

### 1. Slider bloqué sur iOS, ne revient pas en place

**Problème :** L'animation spring ne se termine pas correctement ou l'état n'est pas réinitialisé.

**Solutions à tester :**
- S'assurer que `pan.flattenOffset()` est appelé avant l'animation
- Réinitialiser explicitement la valeur de `pan` après l'animation
- Vérifier que `useNativeDriver: true` ne cause pas de conflit

### 2. Token non valide

**Problème :** Token d'authentification expiré ou invalide.

**Solutions :**
- Vérifier que Supabase refresh le token automatiquement
- Implémenter un retry avec refresh token
- Vérifier la configuration Supabase dans `lib/supabase.ts`

---

## 📝 NOTE IMPORTANTE

Le fichier `components/FriendsList.tsx` complet (977 lignes) est trop long pour être inclus ici. 
Il doit être copié directement depuis le projet.

---

## 🔗 Utilisation

Le slider est utilisé dans `app/(tabs)/index.tsx` comme suit :

```typescript
import { FriendsList } from '@/components/FriendsList';

// Dans le composant :
<FriendsList onProutSent={() => {
  // Animation de secousse du header
}} />
```




