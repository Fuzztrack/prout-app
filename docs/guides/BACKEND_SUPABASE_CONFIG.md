# Configuration Supabase pour le Backend

## 🔴 Problème détecté

Le backend renvoie l'erreur : `Unregistered API key` lors de la récupération de la locale depuis Supabase.

Cela signifie que les variables d'environnement Supabase ne sont pas correctement configurées dans le backend déployé.

## ✅ Solution

### Variables d'environnement requises

Le backend a besoin de ces deux variables :

1. **SUPABASE_URL** : L'URL de ton projet Supabase
   - Exemple : `https://utfwujyymaikraaigvuv.supabase.co`

2. **SUPABASE_SERVICE_ROLE_KEY** : La clé "service_role" (⚠️ PAS la clé "anon")
   - Cette clé permet de bypasser les RLS (Row Level Security)
   - Tu peux la trouver dans : Supabase Dashboard > Settings > API > `service_role` key (secret)

### Où configurer ces variables

#### Si tu utilises Render.com :

1. Va sur https://dashboard.render.com
2. Sélectionne ton service backend
3. Va dans "Environment"
4. Ajoute ces variables :
   ```
   SUPABASE_URL=https://utfwujyymaikraaigvuv.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=ta_service_role_key_ici
   ```
5. Redémarre le service

#### Si tu utilises Railway, Heroku, ou autre :

Configure les variables d'environnement de la même manière dans le dashboard de ton provider.

### ⚠️ IMPORTANT : Service Role Key vs Anon Key

- **Anon Key** (`EXPO_PUBLIC_SUPABASE_ANON_KEY`) : Pour le frontend, respecte les RLS
- **Service Role Key** (`SUPABASE_SERVICE_ROLE_KEY`) : Pour le backend, bypass les RLS pour lire les données utilisateur

⚠️ **NE JAMAIS** exposer la Service Role Key dans le frontend !

### Vérification

Une fois configuré, les logs du backend devraient afficher :
```
✅ Supabase client initialized
```

Et plus d'erreur `Unregistered API key` lors de l'envoi de notifications.

## 📋 Checklist

- [ ] Variables `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` configurées dans le backend
- [ ] Service backend redémarré après configuration
- [ ] Logs backend montrent "✅ Supabase client initialized"
- [ ] Plus d'erreur "Unregistered API key" dans les logs
- [ ] Les notifications arrivent dans la bonne langue
