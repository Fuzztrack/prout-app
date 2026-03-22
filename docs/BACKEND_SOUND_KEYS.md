# Clés sons — backend (prout legacy + toot)

- **`prout1` … `prout20`** : à **conserver** côté API / payloads (compatibilité, anciens envois).
- **`toot1`, `toot3`, `toot4`, …** : **ajouter** à la whitelist pour les clients actuels (liste exacte dans `lib/backendSoundKeys.ts` → `TOOT_KEYS_FOR_BACKEND`).

Fichier TypeScript utilisable pour validation : `lib/backendSoundKeys.ts` (`isAllowedLegacyOrTootSoundKey`, etc.).

Les autres familles (ex. `trrl*`, `bzzz*`, `pop*`, `mood*`) suivent la logique métier existante des notifications.

---

## Prebuild Android (intégrer les `.wav` du plugin `expo-notifications`)

Depuis la racine du repo ProotApp :

```bash
npx expo prebuild --platform android --clean
```

Équivalent npm :

```bash
npm run prebuild:android
```

Ensuite, build natif :

```bash
npx expo run:android
# ou release
npx expo run:android --variant release
```

Le prebuild régénère `android/` et copie les fichiers listés dans `app.json` → `plugins` → `expo-notifications` → `sounds` vers les ressources natives.
