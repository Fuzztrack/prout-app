# 🔧 Correction Android → iOS : Token non valide

## 🔍 Diagnostic

Vous avez **DEUX problèmes** à corriger :

### ❌ Problème 1 : Code Android bloque les tokens iOS

Dans `components/FriendsList.tsx`, lignes 802-807, il y a une vérification qui **rejette les tokens iOS** quand l'expéditeur est sur Android :

```typescript
if (Platform.OS === 'android' && fcmToken.startsWith('ExponentPushToken[')) {
  console.warn('⚠️ Token Expo Push détecté sur Android. FCM natif requis.');
  Alert.alert("Erreur", "Le token de notification n'est pas valide...");
  return; // ❌ BLOQUE l'envoi vers iOS !
}
```

**Pourquoi c'est un problème** :
- Quand Android envoie vers iOS, le token du destinataire iOS est au format `ExponentPushToken[...]`
- Ce code le bloque avant même qu'il n'arrive au backend
- C'est pour ça que vous avez "token non valide"

### ❌ Problème 2 : Backend ne gère pas les tokens iOS

Le backend essaie d'envoyer les tokens iOS (`ExponentPushToken[...]`) à Firebase FCM, ce qui échoue.

---

## ✅ Solutions

### 🔧 Solution 1 : Corriger le code Android (OBLIGATOIRE)

**Il faut supprimer ou modifier cette vérification** car elle bloque les envois Android → iOS.

**Fichier** : `components/FriendsList.tsx` (lignes 799-809)

**Correction** : Supprimer complètement cette vérification ou la rendre plus intelligente.

### 🔧 Solution 2 : Corriger le Backend (OBLIGATOIRE)

Le backend doit détecter le type de token et utiliser l'API Expo pour iOS.

Voir `FIX_BACKEND_TOKEN_IOS.md` pour les instructions complètes.

---

## 🎯 Réponse à votre question

**Faut-il mettre à jour le build Android ou juste le backend ?**

**Réponse : LES DEUX !**

1. ✅ **Code Android** : Corriger la vérification qui bloque les tokens iOS (ce fichier)
2. ✅ **Backend** : Corriger la gestion des tokens iOS (voir `FIX_BACKEND_TOKEN_IOS.md`)
3. ✅ **Rebuild Android** : Après avoir corrigé le code, rebuild l'app Android

---

## 📝 Ordre des actions

1. **Maintenant** : Corriger le code Android (supprimer la vérification)
2. **Maintenant** : Corriger le backend (installer `expo-server-sdk` et modifier `prout.service.ts`)
3. **Ensuite** : Rebuild Android pour avoir le nouveau code

---

## 🚀 Après corrections

- ✅ Android pourra envoyer vers iOS (le token ne sera plus bloqué)
- ✅ Le backend saura traiter les tokens iOS (via Expo Push API)
- ✅ iOS pourra continuer d'envoyer vers Android (déjà fonctionnel)




