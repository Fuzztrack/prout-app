# 📧 CONFIGURATION DE LA VALIDATION D'EMAIL À L'INSCRIPTION

## ✅ Code déjà modifié

Le code a été modifié pour gérer la validation d'email :
- ✅ `SignupScreen.tsx` : Informe l'utilisateur qu'il doit confirmer son email
- ✅ `LoginScreen.tsx` : Vérifie si l'email est confirmé avant de permettre la connexion
- ✅ Possibilité de renvoyer l'email de confirmation

## 🔧 Configuration Supabase REQUISE

### 1. Activer la confirmation d'email

Dans le **Dashboard Supabase** :

1. Allez dans **Authentication** → **Settings** → **Email Auth**
2. **Activez** "Enable email confirmations"
3. Configurez les options :
   - **Secure email change** : Activé (recommandé)
   - **Double confirm email changes** : Optionnel

### 2. Configurer l'URL de redirection

1. Allez dans **Authentication** → **URL Configuration**
2. Ajoutez l'URL de redirection pour la confirmation d'email :
   - **Site URL** : `proutapp://` (ou votre URL de production)
   - **Redirect URLs** : Ajoutez `proutapp://confirm-email` et `proutapp://reset-password`

### 3. Personnaliser le template d'email

1. Allez dans **Authentication** → **Email Templates**
2. Sélectionnez **"Confirm signup"**
3. Personnalisez le message si nécessaire
4. Le lien de confirmation sera automatiquement ajouté

## 📱 Flux utilisateur

### À l'inscription :

1. L'utilisateur remplit le formulaire d'inscription
2. Le compte est créé dans Supabase Auth
3. Un email de confirmation est envoyé automatiquement
4. L'utilisateur voit un message : "Un email de confirmation a été envoyé..."
5. Redirection vers la page de connexion

### À la connexion :

1. Si l'email n'est pas confirmé :
   - Message d'erreur : "Email non confirmé"
   - Option pour renvoyer l'email de confirmation
   - L'utilisateur ne peut pas se connecter tant que l'email n'est pas confirmé

2. Si l'email est confirmé :
   - Connexion normale
   - Redirection vers l'accueil

### Confirmation de l'email :

1. L'utilisateur clique sur le lien dans l'email
2. Supabase redirige vers l'URL configurée (`proutapp://confirm-email`)
3. L'application gère le deep link et confirme automatiquement l'email
4. L'utilisateur peut maintenant se connecter

## 🔗 Gestion des deep links (optionnel)

Si vous voulez gérer automatiquement la confirmation dans l'app, vous pouvez ajouter un handler dans `app/_layout.tsx` ou créer une page dédiée.

## ⚠️ Important

- **L'email est maintenant obligatoire** à l'inscription
- **La confirmation d'email est requise** pour se connecter
- Les utilisateurs doivent vérifier leur boîte de réception (et spams)
- Un bouton permet de renvoyer l'email de confirmation si nécessaire

## 🧪 Test

Pour tester :
1. Créez un compte avec un email valide
2. Vérifiez que vous recevez l'email de confirmation
3. Essayez de vous connecter sans confirmer → doit afficher une erreur
4. Cliquez sur le lien dans l'email
5. Essayez de vous connecter → doit fonctionner

