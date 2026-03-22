/**
 * Référence pour la validation côté backend (payloads push, `proutKey`, etc.).
 *
 * - **prout*** : clés legacy — à conserver pour la compatibilité (anciens clients, historique).
 * - **toot***  : clés catégorie toot/proot (app actuelle, Android notamment).
 *
 * Les deux familles peuvent coexister : le même son peut être référencé par `prout4` ou `toot4`
 * selon le client ; le service peut normaliser ou accepter les deux.
 *
 * @see `lib/runtimeSounds.android.ts` — `TOOT_KEYS` (source in-app Android)
 */

/** prout1 … prout20 (legacy notifications / historique) */
export const PROUT_LEGACY_KEYS = [
  'prout1',
  'prout2',
  'prout3',
  'prout4',
  'prout5',
  'prout6',
  'prout7',
  'prout8',
  'prout9',
  'prout10',
  'prout11',
  'prout12',
  'prout13',
  'prout14',
  'prout15',
  'prout16',
  'prout17',
  'prout18',
  'prout19',
  'prout20',
] as const;

/** Clés toot utilisées par l’app (à garder aligné avec `runtimeSounds.android.ts` → `TOOT_KEYS`) */
export const TOOT_KEYS_FOR_BACKEND = [
  'toot1',
  'toot3',
  'toot4',
  'toot6',
  'toot8',
  'toot9',
  'toot10',
  'toot11',
  'toot12',
  'toot13',
  'toot14',
  'toot16',
  'toot17',
  'toot18',
  'toot19',
  'toot20',
] as const;

/** Union pratique pour whitelist / validation (sans dédoublonner le sens métier) */
export function isAllowedLegacyOrTootSoundKey(key: string): boolean {
  const k = key.toLowerCase();
  return (
    PROUT_LEGACY_KEYS.includes(k as (typeof PROUT_LEGACY_KEYS)[number]) ||
    TOOT_KEYS_FOR_BACKEND.includes(k as (typeof TOOT_KEYS_FOR_BACKEND)[number])
  );
}
