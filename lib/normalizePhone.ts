export function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;

  // 1. Garder uniquement chiffres et +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // 2. Gestion format FR (06/07 -> +336/+337)
  if (cleaned.startsWith('06') || cleaned.startsWith('07')) {
    cleaned = '+33' + cleaned.substring(1);
  }

  // 3. Si commence par 00 -> +
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }

  // 4. Si pas de +, on laisse tel quel (à adapter si besoin)
  return cleaned;
}

