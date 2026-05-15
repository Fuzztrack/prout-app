# Résumé Final - Correction des Sons Android en Arrière-Plan

Ce document récapitule la dernière analyse et la procédure finale pour résoudre le problème des sons Android.

## Le Problème Persistant : Son de notification Android incorrect en arrière-plan

Malgré toutes les corrections apportées au backend (sérialisation `m_d`, restauration du bloc `notification`) et au frontend (parsing `m_d`, logs verbeux, correction du plugin natif Android), le problème persiste : quand l'application Android est fermée, les notifications jouent toujours le son `trrl1` au lieu du son personnalisé.

### Analyse approfondie

1.  **Backend :** Les logs backend confirment que le `proutKey` correct (`toot*`, `mood*`, etc.) est bien envoyé à FCM et qu'il est inclus dans le `dataKeys` (maintenant `m_d`).
2.  **Frontend (Application ouverte) :** Tous les sons fonctionnent parfaitement. Cela prouve que les fichiers `.wav` sont bien présents dans le bundle JavaScript et que le moteur audio de l'application sait les jouer.
3.  **Frontend (Application fermée, Natif Android) :** Le code Kotlin `ProutMessagingService.kt` (généré par notre plugin `withAndroidProutMessaging.js`) contient la logique `resolveSoundUri` qui recherche le fichier sonore dans les ressources `res/raw` d'Android. Si le fichier n'est pas trouvé, il utilise des sons de secours (`toot1`, puis `trrl1`). Le fait que `trrl1` soit joué signifie que le système natif ne trouve pas les fichiers `.wav` correspondant aux `proutKey` spécifiés.
4.  **Plugin `withAndroidProutMessaging.js` :** L'inspection de ce plugin a confirmé que la liste `ANDROID_NOTIFICATION_SOUND_KEYS` contient bien tous les sons (`toot*`, `bzzz*`, `trrl*`, etc.) et que le plugin a bien une boucle pour copier ces fichiers dans `android/app/src/main/res/raw`.
5.  **Proguard :** Les règles Proguard sont correctement configurées pour empêcher la suppression des ressources sonores lors des builds de production.

**Conclusion :** Le problème n'est PAS dans la logique d'envoi du backend, ni dans la liste des sons dans le plugin, ni dans le code JavaScript du frontend. Il s'agit très probablement d'un problème de **cache ou de build natif persistant** sur Android, qui empêche la copie des ressources sonores à jour dans le dossier `res/raw` de l'application compilée.

## La Solution Finale (Procédure de Nettoyage Forcé)

Pour s'assurer que toutes les ressources sont correctement copiées et intégrées dans le build natif Android, il est nécessaire d'effectuer un nettoyage approfondi, suivi d'une régénération et d'une recompilation.

**Procédure à suivre rigoureusement :**

1.  **Nettoyage complet des caches Expo et Gradle :**
    ```bash
    npx expo start --clear # Lance le serveur et le ferme immédiatement pour nettoyer le cache Expo
    # Attendre que le serveur Expo se lance et se ferme (Ctrl+C si besoin)

    cd android
    ./gradlew clean # Nettoie le cache de build Gradle du projet Android
    cd ..
    ```

2.  **Régénération du projet natif Android avec un nettoyage :**
    ```bash
    npx expo prebuild --clean --platform android
    ```
    *Ceci va supprimer et recréer entièrement le dossier `android`, garantissant que le plugin `withAndroidProutMessaging.js` (avec la bonne liste de sons) est ré-exécuté et copie les fichiers `*.wav` dans `res/raw`.* 

3.  **Lancement et recompilation de l'application Android :**
    ```bash
    npx expo run:android
    ```
    *Ce commande va reconstruire le projet Android de zéro en utilisant les ressources fraichement copiées, puis lancer l'application sur ton appareil/émulateur.* 

4.  **Validation Finale :**
    *   Ferme complètement l'application sur ton appareil Android.
    *   Envoie un message depuis ton simulateur iOS (ou un autre appareil).
    *   Vérifie que la notification Android joue maintenant le **bon son personnalisé** (pas `trrl1`).

Si cette procédure ne résout pas le problème, il faudra envisager des limites de taille pour le package de son dans Android ou une autre forme de filtrage. Mais c'est très peu probable si la procédure est suivie à la lettre.
