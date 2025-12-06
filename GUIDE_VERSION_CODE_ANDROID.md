# 📋 Guide : Version Code Android pour Google Play Store

## ⚠️ Règle d'or

**À chaque fois que tu refais un build (`eas build`) pour l'envoyer sur le Store, incrémente le `versionCode` (+1).**

## 📝 Configuration dans `app.json`

Le `versionCode` doit être défini dans la section `android` :

```json
{
  "expo": {
    "android": {
      "package": "com.fuzztrack.proutapp",
      "versionCode": 1,  // <--- C'EST LUI LE PLUS IMPORTANT !
      "googleServicesFile": "./google-services.json",
      "permissions": [...]
    }
  }
}
```

## 🔢 Incrémentation du versionCode

### Premier build (jamais uploadé sur Google Play)
- ✅ `versionCode: 1` → **OK pour le premier upload**

### Builds suivants
- 🔧 Correction de bug → `versionCode: 2`
- ✨ Ajout fonctionnalité → `versionCode: 3`
- 🐛 Nouvelle correction → `versionCode: 4`
- etc.

## ⚠️ Erreur à éviter

**Si tu essaies d'envoyer un .aab avec un `versionCode` qui a déjà été utilisé (même pour un test qui a échoué), Google le rejettera.**

### Exemple d'erreur Google Play Console :
```
❌ Erreur : Ce versionCode (1) a déjà été utilisé. 
Utilisez un versionCode supérieur.
```

## ✅ Vérifications avant chaque build

1. **Vérifier le `versionCode` dans `app.json`**
   - S'assurer qu'il est supérieur au dernier uploadé

2. **Vérifier le `package`**
   - Doit être identique à celui de l'App Store iOS : `com.fuzztrack.proutapp`

3. **Vérifier les permissions**
   - Les permissions sont gérées automatiquement par les plugins Expo
   - `expo-notifications` → Permissions notifications
   - `expo-contacts` → Permissions contacts

4. **Vérifier `googleServicesFile`**
   - Doit pointer vers `./google-services.json`

## 🚀 Workflow recommandé

### Avant chaque build pour production :

```bash
# 1. Ouvrir app.json
# 2. Incrémenter versionCode
# 3. Sauvegarder
# 4. Lancer le build
eas build --platform android --profile production --local
```

### Exemple de séquence :

```json
// Build 1 (premier upload)
"versionCode": 1

// Build 2 (correction bug)
"versionCode": 2

// Build 3 (nouvelle fonctionnalité)
"versionCode": 3
```

## 📊 Suivi des versions

Il est recommandé de noter quelque part les versions uploadées :

| Version | versionCode | Date | Description |
|---------|-------------|------|-------------|
| 1.0.0   | 1           | ...  | Premier upload |
| 1.0.1   | 2           | ...  | Correction bug |
| 1.1.0   | 3           | ...  | Nouvelle fonctionnalité |

---

## ✅ Configuration actuelle

- **Package** : `com.fuzztrack.proutapp` ✅
- **Version Code** : `1` ✅ (Premier build)
- **Google Services** : Configuré ✅
- **Permissions** : Configurées via plugins Expo ✅

---

**Note** : Le `versionCode` est différent du `version` (qui est `1.0.0`). Le `version` est ce que l'utilisateur voit dans le Store, le `versionCode` est un numéro interne qui doit toujours augmenter.




