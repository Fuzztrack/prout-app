# 🚀 Instructions pour la Nouvelle Architecture Modulaire

## ✅ Modifications Effectuées

Tous les fichiers ont été créés et modifiés avec succès :

1. ✅ **Script SQL** : `supabase_nouvelle_architecture.sql` créé
2. ✅ **app/SignupScreen.tsx** : Remplacé par l'écran de choix d'authentification
3. ✅ **app/RegisterEmailScreen.tsx** : Nouveau fichier créé (inscription email)
4. ✅ **app/CompleteProfileScreen.tsx** : Nouveau fichier créé (complétion profil)
5. ✅ **app/index.tsx** : Simplifié avec la nouvelle logique
6. ✅ **app/_layout.tsx** : Nouveaux écrans ajoutés au Stack

## 📋 Étapes à Suivre

### Étape 1 : Exécuter le Script SQL

1. Allez dans **Supabase Dashboard** → **SQL Editor**
2. Copiez-collez le contenu de `supabase_nouvelle_architecture.sql`
3. Exécutez le script

⚠️ **Important** : Ce script va :
- Nettoyer les anciennes politiques RLS
- Créer de nouvelles politiques permissives
- Créer/mettre à jour le trigger pour créer automatiquement un profil

### Étape 2 : Vérifier les Dépendances

Le package `expo-web-browser` est déjà installé dans votre `package.json` ✅

### Étape 3 : Redémarrer l'Application

```bash
npx expo start --clear
```

## 🔄 Nouveau Flux d'Authentification

### Flux Email :
1. **SignupScreen** (écran de choix) → "S'inscrire avec un Email"
2. **RegisterEmailScreen** → Formulaire email/pseudo/mot de passe
3. **Trigger SQL** → Crée automatiquement le profil avec le pseudo
4. Si email confirmation activée → **LoginScreen** (en attente de confirmation)
5. Après confirmation → **home**

### Flux Google OAuth :
1. **SignupScreen** (écran de choix) → "Continuer avec Google"
2. OAuth Google → Redirection via deep link
3. **CompleteProfileScreen** → Si pas de pseudo (profil créé avec "Nouveau Membre")
4. Après complétion → **home**

### Flux Connexion :
1. **SignupScreen** (écran de choix) → "J'ai déjà un compte"
2. **LoginScreen** → Email/mot de passe
3. Si profil complet → **home**
4. Si profil incomplet → **CompleteProfileScreen**

## 📁 Structure des Fichiers

```
app/
├── index.tsx                    # Point d'entrée simplifié
├── SignupScreen.tsx             # Écran de choix (Google/Email/Login)
├── RegisterEmailScreen.tsx      # Inscription avec email
├── CompleteProfileScreen.tsx    # Complétion du pseudo
├── LoginScreen.tsx              # Connexion (existant)
└── _layout.tsx                  # Router avec nouveaux écrans

supabase_nouvelle_architecture.sql  # Script SQL à exécuter
```

## ⚙️ Configuration Supabase

### Pour OAuth Google (optionnel) :

1. **Supabase Dashboard** → **Authentication** → **Providers**
2. Activez **Google**
3. Configurez les credentials Google OAuth
4. Ajoutez l'URL de redirection : `proutapp://confirm-email`

### Pour Email Confirmation :

1. **Authentication** → **Settings** → **Email Auth**
2. Activez "Enable email confirmations" si souhaité
3. Configurez les Redirect URLs :
   - `proutapp://confirm-email`
   - `proutapp://reset-password`

## 🎯 Avantages de cette Architecture

✅ **Séparation des responsabilités** : Chaque écran a un rôle unique
✅ **Pas de boucles infinies** : Logique de redirection claire
✅ **Modulaire** : Facile à maintenir et étendre
✅ **Gestion automatique des profils** : Le trigger SQL s'occupe de tout
✅ **Support OAuth** : Prêt pour Google (et autres providers)

## 🔍 Points d'Attention

1. **Trigger SQL** : Crée un profil avec "Nouveau Membre" si pas de pseudo dans les métadonnées
2. **CompleteProfileScreen** : Utilise `upsert` pour mettre à jour le pseudo
3. **OAuth Google** : Nécessite la configuration dans Supabase Dashboard
4. **Deep Links** : Gérés dans `app/_layout.tsx` (déjà en place)

## 🐛 Dépannage

### Si le profil n'est pas créé :
- Vérifiez que le trigger SQL a bien été exécuté
- Vérifiez les logs Supabase pour les erreurs

### Si OAuth Google ne fonctionne pas :
- Vérifiez la configuration dans Supabase Dashboard
- Vérifiez que `skipBrowserRedirect: true` est bien présent

### Si redirection en boucle :
- Vérifiez que `@welcome_screen_seen` est bien dans AsyncStorage
- Vérifiez les logs de navigation dans la console

## ✅ Checklist Finale

- [ ] Script SQL exécuté dans Supabase
- [ ] Application redémarrée avec `--clear`
- [ ] Test du flux email (inscription)
- [ ] Test du flux Google (si configuré)
- [ ] Test du flux connexion
- [ ] Vérification que les profils sont créés automatiquement

---

**Tout est prêt !** 🎉





