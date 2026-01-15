# Configuration des variables d'environnement du Backend

## 🔴 Problème actuel

Le backend renvoie : `Unregistered API key` lors de la récupération de la locale depuis Supabase.

## ✅ Variables d'environnement requises

Le backend a besoin de ces variables dans ton provider de déploiement (Render, Railway, etc.) :

### 1. Supabase Configuration

```bash
SUPABASE_URL=https://utfwujyymaikraaigvuv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ta_service_role_key_ici
```

⚠️ **IMPORTANT** : La `SUPABASE_SERVICE_ROLE_KEY` doit être la clé **"service_role"** (secret), PAS la clé "anon".

### 2. Où trouver la Service Role Key Supabase

1. Va sur https://supabase.com/dashboard
2. Sélectionne ton projet
3. Va dans **Settings > API**
4. Tu verras deux clés :
   - **`anon` public** : Celle-ci est pour le frontend (déjà dans `.env`)
   - **`service_role` secret** : Celle-ci est pour le backend ⚠️

5. Copie la clé **`service_role`** (elle commence généralement par `eyJ...` comme un JWT)

### 3. Configuration dans Render.com

1. Va sur https://dashboard.render.com
2. Sélectionne ton service backend (ex: `prout-backend`)
3. Va dans **Environment** (menu de gauche)
4. Clique sur **Add Environment Variable**
5. Ajoute :
   - **Key** : `SUPABASE_URL`
   - **Value** : `https://utfwujyymaikraaigvuv.supabase.co`
6. Clique sur **Add Environment Variable** à nouveau
7. Ajoute :
   - **Key** : `SUPABASE_SERVICE_ROLE_KEY`
   - **Value** : `ta_service_role_key_ici` (colle la vraie clé service_role)
8. **Redémarre le service** (bouton "Manual Deploy" ou attendre le redéploiement automatique)

### 4. Vérification

Après configuration, vérifie les logs du backend. Tu devrais voir :
```
✅ Supabase client initialized
```

Et plus d'erreur `Unregistered API key`.

## ⚠️ Note sur la clé fournie

La clé `sb_secret_FBhnOtjQ94fwofT67Fqgow_KNSAE27n` que tu as fournie semble être une clé personnalisée, pas la Service Role Key Supabase standard.

Si c'est bien la clé que tu veux utiliser, assure-toi qu'elle a les permissions nécessaires pour lire la table `user_profiles` dans Supabase.

Sinon, utilise la vraie Service Role Key depuis le dashboard Supabase (format JWT commençant par `eyJ...`).

## 📋 Checklist

- [ ] Variables `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` ajoutées dans Render
- [ ] Service backend redémarré
- [ ] Logs montrent "✅ Supabase client initialized"
- [ ] Plus d'erreur "Unregistered API key"
- [ ] Test d'envoi de prout : la locale est bien récupérée
