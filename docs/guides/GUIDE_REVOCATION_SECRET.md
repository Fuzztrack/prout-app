# Guide de révocation du secret exposé sur GitHub

## 🔴 Problème détecté
GitGuardian a détecté une clé Supabase anon key (JWT) hardcodée dans le code source.

## ✅ Actions effectuées

1. **Modification de `lib/supabase.ts`** : Suppression de la clé hardcodée, utilisation uniquement de la variable d'environnement
2. **Ajout de `lib/supabase.js` au `.gitignore`** : Ce fichier compilé ne sera plus suivi par Git

## 📋 Étapes à suivre

### Étape 1 : Configurer la nouvelle clé secrète

**Option A : Via fichier `.env` (développement local)**
Créer un fichier `.env` à la racine du projet :
```env
EXPO_PUBLIC_SUPABASE_URL=https://utfwujyymaikraaigvuv.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=REDACTED_BY_FUZZ
```

**Option B : Via EAS Secrets (production)**
```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value REDACTED_BY_FUZZ
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value https://utfwujyymaikraaigvuv.supabase.co
```

### Étape 2 : Supprimer les fichiers compilés du dépôt Git

```bash
# Supprimer lib/supabase.js de Git (mais pas du système de fichiers)
git rm --cached lib/supabase.js

# Commit cette suppression
git add .gitignore lib/supabase.ts
git commit -m "Security: Remove hardcoded Supabase key and ignore compiled files"
```

### Étape 3 : Nettoyer l'historique Git (IMPORTANT)

⚠️ **ATTENTION** : Cette opération réécrit l'historique Git. Tous les collaborateurs devront refaire leur clone.

**Option A : Utiliser git-filter-repo (recommandé)**

```bash
# Installer git-filter-repo si nécessaire
pip install git-filter-repo

# Supprimer le secret de tout l'historique
git filter-repo --invert-paths --path lib/supabase.ts --path lib/supabase.js

# Force push (⚠️ réécrit l'historique)
git push origin --force --all
git push origin --force --tags
```

**Option B : Utiliser git filter-branch (si git-filter-repo n'est pas disponible)**

```bash
# Supprimer les fichiers contenant le secret de tout l'historique
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch lib/supabase.ts lib/supabase.js" \
  --prune-empty --tag-name-filter cat -- --all

# Nettoyer les références
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (⚠️ réécrit l'historique)
git push origin --force --all
git push origin --force --tags
```

**Option C : Remplacer le secret dans l'historique (alternative)**

Si tu veux garder les fichiers mais remplacer le secret par un placeholder :

```bash
# Installer bfg-repo-cleaner ou utiliser git filter-branch
# Remplacer l'ancienne clé par un placeholder
git filter-branch --force --tree-filter \
  "find . -type f -name '*.ts' -o -name '*.js' | xargs sed -i '' 's/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.*/YOUR_SUPABASE_ANON_KEY_HERE/g'" \
  --prune-empty --tag-name-filter cat -- --all

git push origin --force --all
```

### Étape 4 : Marquer comme résolu sur GitGuardian

1. Aller sur https://dashboard.gitguardian.com
2. Trouver l'alerte pour le dépôt `Fuzztrack/prout-app`
3. Cliquer sur "Mark as Resolved" ou "Fix This Secret Leak"
4. Si le secret a été révoqué, marquer comme "Revoked"

### Étape 5 : Révoquer l'ancienne clé Supabase (recommandé)

1. Aller sur https://supabase.com/dashboard
2. Sélectionner le projet
3. Aller dans Settings > API
4. Révoquer l'ancienne "anon key" et en générer une nouvelle
5. Mettre à jour la variable d'environnement avec la nouvelle clé

### Étape 6 : Vérifier que tout fonctionne

```bash
# Tester que l'app fonctionne avec la nouvelle configuration
npm start
# ou
npx expo start
```

## 🔒 Prévention future

1. **Ne jamais commiter de secrets** : Toujours utiliser des variables d'environnement
2. **Vérifier `.gitignore`** : S'assurer que tous les fichiers sensibles sont ignorés
3. **Utiliser GitGuardian** : Configurer des alertes pour détecter les secrets
4. **Code Review** : Vérifier les PRs pour détecter les secrets avant merge
5. **Utiliser des outils** : `git-secrets`, `truffleHog`, etc.

## 📝 Fichiers modifiés

- ✅ `lib/supabase.ts` : Clé hardcodée supprimée
- ✅ `.gitignore` : `lib/supabase.js` ajouté

## ⚠️ Notes importantes

- La nouvelle clé `REDACTED_BY_FUZZ` ne doit **JAMAIS** être commitée dans le code
- Le fichier `.env` est déjà dans `.gitignore` (c'est bien)
- Après le force push, tous les collaborateurs devront refaire `git clone` ou `git pull --rebase`
