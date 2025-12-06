# Configuration de sync_contacts - Match téléphone avec enregistrement automatique

## 🎯 Problème résolu

Avant cette modification, l'app affichait les contacts trouvés dans `user_profiles` mais **n'enregistrait pas** les relations dans la table `friends`. Cela causait :
- Les amis apparaissaient dans l'app mais pas dans la base de données
- La réciprocité ne fonctionnait pas (A voit B mais B ne voit pas A)
- Les relations n'étaient pas persistées

## ✅ Solution : Fonction SQL `sync_contacts`

La fonction SQL `sync_contacts` :
1. **Trouve** les utilisateurs correspondant aux numéros de téléphone
2. **Crée automatiquement** les relations A→B et B→A dans `friends`
3. **Déclenche** le trigger de réciprocité si configuré
4. **Retourne** les profils trouvés pour affichage immédiat

## 📋 Étapes d'installation

### 1. Exécuter la fonction SQL dans Supabase

1. Ouvrez votre projet Supabase
2. Allez dans **SQL Editor**
3. Copiez-collez le contenu du fichier `supabase_sync_contacts.sql`
4. Cliquez sur **Run** pour exécuter la fonction

### 2. Vérifier que la fonction est créée

Dans Supabase SQL Editor, exécutez :
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'sync_contacts';
```

Vous devriez voir `sync_contacts` dans les résultats.

### 3. Tester la fonction (optionnel)

```sql
-- Remplacez les numéros et UUID par des valeurs réelles de votre base
SELECT * FROM sync_contacts(ARRAY['+33612345678', '+33712345678']);
```

## 🔄 Modifications apportées au code

### `components/FriendsList.tsx`
- ✅ Supprimé l'import de `matchContactsViaBackend`
- ✅ Remplacé l'appel backend par `supabase.rpc('sync_contacts', { phones })`
- ✅ Les relations sont maintenant créées directement dans Supabase

### `app/Invitation.tsx`
- ✅ Supprimé l'import de `matchContactsViaBackend`
- ✅ Remplacé l'appel backend par `supabase.rpc('sync_contacts', { phones })`
- ✅ Normalisation du numéro avant l'appel

## 🧪 Vérification après installation

### 1. Vérifier dans Supabase que les relations sont créées

```sql
SELECT * FROM friends 
WHERE method = 'contact' 
ORDER BY created_at DESC;
```

Vous devriez voir des paires A→B et B→A pour chaque match téléphone.

### 2. Tester dans l'app

1. Ouvrez l'app
2. Allez dans la liste d'amis
3. Les contacts trouvés devraient apparaître
4. Vérifiez dans Supabase que les lignes sont bien créées dans `friends`

## 📝 Notes importantes

- La fonction utilise `SECURITY DEFINER` pour contourner les restrictions RLS
- Les relations sont créées avec `method = 'contact'` et `status = 'accepted'`
- Si une relation existe déjà, elle n'est pas dupliquée (`ON CONFLICT DO NOTHING`)
- La fonction retourne les profils trouvés pour affichage immédiat dans l'app

## 🚨 Dépannage

### Erreur : "function sync_contacts does not exist"
→ La fonction n'a pas été créée. Réexécutez le script SQL dans Supabase.

### Erreur : "permission denied"
→ Vérifiez que la fonction utilise `SECURITY DEFINER` et que l'utilisateur a les permissions nécessaires.

### Les relations ne sont pas créées
→ Vérifiez les logs de l'app (console) pour voir les erreurs éventuelles.
→ Vérifiez que les numéros de téléphone sont bien normalisés (format +33...).


