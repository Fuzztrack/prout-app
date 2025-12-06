# 📧 GUIDE POUR MODIFIER L'EMAIL

## ✅ Code déjà en place

Le code de modification d'email est déjà implémenté dans `app/EditProfil.tsx` avec :
- ✅ Validation du format email
- ✅ Rejet des emails temporaires (`@temp.proutapp.local`)
- ✅ Normalisation (trim + lowercase)
- ✅ Gestion d'erreurs spécifiques
- ✅ Messages utilisateur clairs

## 🔧 Configuration Supabase requise

Pour que la modification d'email fonctionne, vérifiez ces paramètres dans Supabase :

### 1. Vérifier les paramètres d'email dans Supabase Dashboard

1. Allez dans **Authentication** → **Settings** → **Email Auth**
2. Vérifiez que **"Enable email confirmations"** est activé (recommandé pour la sécurité)
3. Si activé, l'utilisateur devra confirmer le nouvel email avant qu'il soit actif

### 2. Options de configuration

**Option A : Confirmation d'email activée (Recommandé)**
- ✅ Plus sécurisé
- ✅ L'utilisateur reçoit un email de confirmation
- ⚠️ L'ancien email reste actif jusqu'à confirmation du nouveau

**Option B : Confirmation d'email désactivée**
- ✅ Changement immédiat
- ⚠️ Moins sécurisé (pas de vérification)

## 📝 Comment modifier l'email

### Pour l'utilisateur :

1. **Aller dans "Profil"** → **"Modifier votre profil"**
2. **Entrer le nouvel email** dans le champ Email
3. **Cliquer sur "Mettre à jour"**
4. **Confirmer** la modification
5. **Vérifier la boîte email** pour confirmer (si confirmation activée)

### Cas particuliers :

#### Si vous avez un email temporaire (`@temp.proutapp.local`)
- Le système détecte automatiquement que c'est un email temporaire
- Vous pouvez le remplacer par un email réel
- Message d'aide affiché automatiquement

#### Si l'email existe déjà
- Erreur : "Cet email est déjà utilisé par un autre compte"
- Vous devrez utiliser un autre email

## 🔍 Vérifications à faire

### 1. Vérifier que le code fonctionne

Testez ces scénarios :
- ✅ Modifier un email temporaire vers un email réel
- ✅ Modifier un email réel vers un autre email réel
- ✅ Essayer d'utiliser un email déjà utilisé → doit afficher une erreur
- ✅ Essayer d'utiliser un email temporaire → doit être rejeté

### 2. Vérifier les logs

Si vous avez encore des erreurs, vérifiez :
- Les logs dans la console de l'app
- Les logs dans Supabase Dashboard → Logs → Auth

### 3. Erreurs courantes et solutions

**Erreur : "Email address is invalid"**
- ✅ **Solution** : Le code rejette maintenant les emails temporaires
- ✅ Vérifiez que vous utilisez un email réel (ex: `nom@example.com`)

**Erreur : "Email already registered"**
- ✅ **Solution** : L'email est déjà utilisé par un autre compte
- ✅ Utilisez un autre email

**Erreur : "Email not confirmed"**
- ✅ **Solution** : Vérifiez votre boîte email et cliquez sur le lien de confirmation
- ✅ Vérifiez aussi les spams

## 🛠️ Si ça ne fonctionne toujours pas

### Vérifier la configuration Supabase

1. **Dashboard Supabase** → **Authentication** → **Settings**
2. Vérifiez que **"Enable email confirmations"** est bien configuré
3. Vérifiez les **Email Templates** pour voir si les emails sont bien envoyés

### Vérifier les permissions RLS

Assurez-vous que l'utilisateur peut mettre à jour son propre email :
- L'email est dans `auth.users`, pas dans `user_profiles`
- Supabase Auth gère automatiquement les permissions
- Pas besoin de RLS pour `auth.users`

### Tester avec un email de test

1. Créez un compte avec un email temporaire
2. Essayez de le modifier vers un email réel
3. Vérifiez les logs pour voir l'erreur exacte

## 📋 Checklist de vérification

- [ ] Code de modification d'email présent dans `EditProfil.tsx`
- [ ] Validation du format email active
- [ ] Rejet des emails temporaires actif
- [ ] Configuration Supabase vérifiée
- [ ] Test avec email temporaire → email réel
- [ ] Test avec email réel → autre email réel
- [ ] Messages d'erreur clairs affichés

## 🎯 Résumé

Le code est **déjà en place** et devrait fonctionner. Si vous avez encore des erreurs :

1. **Vérifiez la configuration Supabase** (email confirmations)
2. **Testez avec un email réel** (pas temporaire)
3. **Vérifiez les logs** pour voir l'erreur exacte
4. **Assurez-vous** que l'email n'est pas déjà utilisé

Le code gère maintenant :
- ✅ Les emails temporaires
- ✅ La validation du format
- ✅ Les erreurs Supabase
- ✅ Les messages utilisateur clairs

