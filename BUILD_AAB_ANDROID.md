# 📦 Configuration Build AAB Android

## ✅ Modification effectuée

Le profil `production` dans `eas.json` a été configuré pour générer un **AAB** (Android App Bundle) au lieu d'un APK.

### Fichier modifié : `eas.json`

**Profil production Android** :
```json
"production": {
  "android": {
    "buildType": "app-bundle"  // ✅ Changé de "apk" à "app-bundle"
  }
}
```

---

## 📋 Différence APK vs AAB

### APK (Android Package)
- Format d'installation direct
- Utilisé pour les tests et la distribution directe
- Plus volumineux (contient toutes les architectures)

### AAB (Android App Bundle) ✅ **Production**
- Format requis par Google Play Store
- Plus optimisé (Google génère des APKs optimisés par appareil)
- Plus petit (Google ne télécharge que ce qui est nécessaire)
- **OBLIGATOIRE** pour la soumission au Play Store

---

## 🚀 Build AAB

Maintenant, quand vous lancez :

```bash
eas build --platform android --profile production --local
```

Le build générera un fichier **`.aab`** (Android App Bundle) au lieu d'un `.apk`.

### Emplacement du fichier

Après le build, le fichier `.aab` sera disponible dans :
- `build_*.aab` dans le dossier de build
- Ou dans le dossier `dist/` selon votre configuration

---

## 📝 Profils disponibles

- **`preview`** : Génère un **APK** (pour tests)
- **`production`** : Génère un **AAB** (pour Play Store) ✅

---

## ✅ Résumé

- ✅ Profil `production` configuré pour AAB
- ✅ Prêt pour la soumission au Play Store
- ✅ Build optimisé pour la production

Vous pouvez maintenant lancer votre build ! 🚀

