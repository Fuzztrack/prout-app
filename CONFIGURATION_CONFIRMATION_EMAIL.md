# 📧 CONFIGURATION DE LA CONFIRMATION D'EMAIL - GUIDE COMPLET

## 🔧 Configuration Supabase REQUISE

### 1. Activer la confirmation d'email

Dans le **Dashboard Supabase** :

1. Allez dans **Authentication** → **Settings** → **Email Auth**
2. **Activez** "Enable email confirmations"
3. Configurez les options :
   - **Secure email change** : Activé (recommandé)
   - **Double confirm email changes** : Optionnel

### 2. Configurer l'URL de redirection (CRITIQUE)

1. Allez dans **Authentication** → **URL Configuration**
2. Configurez les URLs suivantes :

   **Site URL** :
   ```
   proutapp://
   ```

   **Redirect URLs** (ajoutez ces deux lignes) :
   ```
   proutapp://confirm-email
   proutapp://reset-password
   ```

   **IMPORTANT** : Pour que le lien fonctionne depuis un email, vous devez aussi ajouter l'URL complète de votre projet Supabase avec le deep link :

   ```
   https://utfwujyymaikraaigvuv.supabase.co/auth/v1/verify
   ```

   Mais normalement, Supabase génère automatiquement le lien avec `redirect_to=proutapp://confirm-email` à la fin.

### 3. Personnaliser le template d'email

1. Allez dans **Authentication** → **Email Templates**
2. Sélectionnez **"Confirm signup"**
3. Le template doit contenir :
   ```html
   <h2>Confirmer votre inscription</h2>
   <p>Bonjour,</p>
   <p>Merci de vous être inscrit ! Pour activer votre compte, veuillez cliquer sur le lien ci-dessous :</p>
   <p><a href="{{ .ConfirmationURL }}">Confirmer mon email</a></p>
   <p>Ou copiez-collez ce lien dans votre navigateur :</p>
   <p style="word-break: break-all; color: #666; font-size: 12px;">{{ .ConfirmationURL }}</p>
   <p>Ce lien expire dans 24 heures.</p>
   ```

## 📱 Comment ça fonctionne

### Flux de confirmation :

1. **L'utilisateur s'inscrit** → Un email de confirmation est envoyé
2. **L'email contient un lien** comme :
   ```
   https://utfwujyymaikraaigvuv.supabase.co/auth/v1/verify?token=...&type=signup&redirect_to=proutapp://confirm-email
   ```
3. **L'utilisateur clique sur le lien** :
   - Sur mobile : Le lien s'ouvre dans l'app via le deep link `proutapp://confirm-email`
   - Sur web : Le lien redirige vers `proutapp://confirm-email` qui ouvre l'app
4. **L'app traite le deep link** :
   - Extrait le token depuis l'URL
   - Appelle `supabase.auth.verifyOtp()` pour confirmer l'email
   - Vérifie que la session est créée
   - Redirige vers `LoginScreen`

## 🔍 Dépannage

### Erreur "requested path is invalid"

**Causes possibles** :
1. L'URL de redirection n'est pas correctement configurée dans Supabase
2. Le deep link `proutapp://confirm-email` n'est pas dans les Redirect URLs
3. Le scheme `proutapp` n'est pas configuré dans `app.json`

**Solutions** :
1. Vérifiez que `proutapp://confirm-email` est bien dans les Redirect URLs de Supabase
2. Vérifiez que `"scheme": "proutapp"` est présent dans `app.json`
3. Redémarrez l'app après avoir modifié la configuration

### Le lien ne s'ouvre pas dans l'app

**Causes possibles** :
1. L'app n'est pas installée sur le téléphone
2. Le scheme n'est pas correctement configuré
3. Le lien est ouvert dans un navigateur qui ne peut pas ouvrir l'app

**Solutions** :
1. Assurez-vous que l'app est installée
2. Testez le deep link manuellement : `proutapp://confirm-email`
3. Sur iOS, vérifiez que le scheme est dans `Info.plist`
4. Sur Android, vérifiez que le scheme est dans `AndroidManifest.xml`

### L'email est confirmé mais la session n'est pas créée

**Causes possibles** :
1. Le token a expiré
2. Le token a déjà été utilisé
3. Problème de réseau

**Solutions** :
1. Demandez un nouvel email de confirmation
2. Vérifiez votre connexion réseau
3. Vérifiez les logs dans la console pour voir l'erreur exacte

## ✅ Vérification

Pour vérifier que tout fonctionne :

1. Créez un compte avec un email valide
2. Vérifiez que vous recevez l'email de confirmation
3. Cliquez sur le lien dans l'email
4. L'app devrait s'ouvrir et afficher "Email confirmé"
5. Essayez de vous connecter → devrait fonctionner

## 📝 Notes importantes

- Le lien de confirmation expire après 24 heures par défaut
- Un utilisateur peut demander un nouvel email de confirmation depuis la page de connexion
- La confirmation d'email est obligatoire pour se connecter (si activée dans Supabase)
- Le deep link handler dans `app/_layout.tsx` gère automatiquement la confirmation

