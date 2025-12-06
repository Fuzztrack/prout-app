# 🔧 Solution : Conflit de Ressources .ogg / .wav sur Android

## ❌ Problème Rencontré

Erreur lors du build Android release :
```
ERROR: [raw/assets_sounds_prout1] ... assets_sounds_prout1.wav 
[raw/assets_sounds_prout1] ... assets_sounds_prout1.ogg: 
Error: Duplicate resources
```

**Cause** : Android identifie les ressources par leur nom **SANS extension**. Donc :
- `prout1.wav` → Ressource Android : `prout1`
- `prout1.ogg` → Ressource Android : `prout1`
- **Conflit** : Les deux fichiers créent la même ressource !

## ✅ Solution Appliquée

### 1. Configuration Actuelle (CORRECTE)

**`app.json`** contient uniquement les fichiers `.wav` :
```json
"sounds": [
  "./assets/sounds/prout1.wav",
  "./assets/sounds/prout2.wav",
  // ... seulement .wav
]
```

**Aucune référence aux `.ogg`** dans la configuration.

### 2. Nettoyage du Build

Les fichiers `.ogg` étaient présents dans les anciens builds Android. Solution :

```bash
# Nettoyer complètement le build Android
rm -rf android/app/build
rm -rf android/.gradle
rm -rf android/app/.cxx
```

### 3. Vérification

**Fichiers `.ogg` présents** :
- ✅ `ios/Prout/*.ogg` (20 fichiers) - **Normal pour iOS**, ne pose pas de problème
- ❌ `android/app/build/.../*.ogg` - **Anciens fichiers de build**, doivent être supprimés

## 🎯 Actions à Effectuer

### Pour un Build Propre

1. **Nettoyer le build Android** :
   ```bash
   cd android
   ./gradlew clean
   cd ..
   rm -rf android/app/build android/.gradle
   ```

2. **Rebuilder** :
   ```bash
   # Build release local
   cd android && ./gradlew assembleRelease
   
   # OU build EAS
   eas build --platform android --profile production
   ```

### Vérifications

✅ **Dans `app.json`** : Seulement des fichiers `.wav` dans `sounds`
✅ **Dans `assets/sounds/`** : Seulement des fichiers `.wav` (pas de `.ogg`)
✅ **Build nettoyé** : Pas de fichiers générés `.ogg` dans `android/app/build/`

## 📝 Notes Importantes

- Les fichiers `.ogg` dans `ios/Prout/` sont **normaux** pour iOS et ne causent pas de conflit
- Le conflit vient uniquement des fichiers `.ogg` dans le **build Android**
- Android utilise **uniquement les fichiers `.wav`** déclarés dans `app.json`
- Après nettoyage, le build ne devrait plus générer de fichiers `.ogg` en conflit

## 🔍 Si le Problème Persiste

1. Vérifier qu'il n'y a pas de fichiers `.ogg` dans `assets/sounds/`
2. Vérifier que `app.json` ne référence que des `.wav`
3. Nettoyer complètement : `rm -rf android/app/build android/.gradle android/app/.cxx`
4. Rebuilder depuis zéro

---

**Date** : $(date)
**Statut** : ✅ Solution appliquée - Build nettoyé

