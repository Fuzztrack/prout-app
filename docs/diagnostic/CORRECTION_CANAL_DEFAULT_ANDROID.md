# 🔧 Correction : Canal de Notification par Défaut Android

## ❌ Problème Identifié

Dans les logs Android, on observe :
```
FirebaseMessaging: Notification Channel set in AndroidManifest.xml has not been created by the app. Default value will be used.
```

**Canal utilisé** : `expo_notifications_fallback_notification_channel` (canal fallback)
**Son joué** : Son système par défaut (`content://settings/system/notification_sound`)

### Cause du Problème

**Incohérence entre le manifest et les canaux créés** :

| Fichier | Canal défini | Problème |
|---------|--------------|----------|
| `withAndroidNotificationMetadata.js` | `prout1-v14` | ❌ N'existe pas |
| `lib/notifications.ts` | `prout1`, `prout2`, etc. | ✅ Canaux créés |
| `backend/src/prout/prout.service.ts` | `prout1`, `prout2`, etc. | ✅ Envoyé correctement |

**Résultat** : Android ne trouve pas le canal `prout1-v14` défini dans le manifest, donc utilise le canal fallback avec le son système.

---

## ✅ Solution Appliquée

### Correction dans `withAndroidNotificationMetadata.js`

**Ligne 30** : Changé de `'prout1-v14'` à `'prout1'`

```javascript
// AVANT (incorrect)
'android:value': 'prout1-v14', // Doit matcher le code JS

// APRÈS (correct)
'android:value': 'prout1', // Doit correspondre au canal créé dans lib/notifications.ts
```

**Fichier modifié** : `withAndroidNotificationMetadata.js`

---

## 📋 Cohérence Finale

Maintenant, tous les fichiers utilisent le même format :

| Fichier | Canal | Statut |
|---------|-------|--------|
| `withAndroidNotificationMetadata.js` | `prout1` | ✅ Corrigé |
| `lib/notifications.ts` | `prout1`, `prout2`, etc. | ✅ Correct |
| `backend/src/prout/prout.service.ts` | `prout1`, `prout2`, etc. | ✅ Correct |
| `AndroidManifest.xml` (généré) | `prout1` | ✅ Sera corrigé après rebuild |

---

## 🚀 Actions Requises

### 1. Nettoyer et Rebuilder l'Application

Le `AndroidManifest.xml` est généré lors du build, il faut donc :

```bash
# Nettoyer le build Android
cd android
./gradlew clean
cd ..
rm -rf android/app/build

# Rebuilder
cd android
./gradlew assembleRelease
cd ..
```

### 2. Désinstaller et Réinstaller l'App

Pour supprimer les anciens canaux persistants :

```bash
# Désinstaller complètement
adb uninstall com.fuzztrack.proutapp

# Installer la nouvelle version
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

### 3. Tester

Après réinstallation, les logs devraient montrer :
- ✅ Utilisation du canal `prout1` au lieu du canal fallback
- ✅ Son personnalisé joué au lieu du son système

---

## 🔍 Vérification dans les Logs

Après correction, vous devriez voir :

**✅ Bon comportement** :
```
Notification channel: prout1
Sound: prout1 (custom)
```

**❌ Mauvais comportement (avant correction)** :
```
Notification channel: expo_notifications_fallback_notification_channel
Sound: content://settings/system/notification_sound
```

---

**Date de correction** : $(date)
**Statut** : ✅ Correction appliquée - Rebuild nécessaire

