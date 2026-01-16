// Envoi du prout via ton backend Nest.js
export async function sendProutViaBackend(
  recipientToken: string,
  sender: string,
  proutKey: string,
  platform?: 'ios' | 'android',
  extraData?: Record<string, any>
) {
  const API_URL = 'https://prout-backend.onrender.com/prout';
  const API_KEY = '82d6d94d97ad501a596bf866c2831623';     // doit matcher backend .env

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        token: recipientToken,
        sender,
        proutKey,
        platform,
        extraData,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      let errorMessage = text;
      try {
        const errorJson = JSON.parse(text);
        errorMessage = errorJson.message || errorJson.error || text;
      } catch {
        // Si ce n'est pas du JSON, garder le texte tel quel
      }
      console.error(`Erreur backend (${res.status}):`, errorMessage);

      // Cas spécifique : appli désinstallée => 400/410 avec message target_app_uninstalled
      if (
        (res.status === 400 || res.status === 410) &&
        errorMessage?.includes('target_app_uninstalled')
      ) {
        const err: any = new Error('target_app_uninstalled');
        err.code = 'target_app_uninstalled';
        throw err;
      }

      throw new Error(`Backend error: ${res.status} ${errorMessage}`);
    }
    const result = await res.json();
    return result;
  } catch (err: any) {
    console.error('Erreur réseau/Backend:', err?.message || err);
    throw err;
  }
}

export async function markMessageReadViaBackend(
  messageId: string,
  senderId: string
) {
  const API_URL = 'https://prout-backend.onrender.com/prout/read';
  const API_KEY = '82d6d94d97ad501a596bf866c2831623';

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        messageId,
        senderId,
      }),
    });

    if (!res.ok) {
      // On logue mais on ne bloque pas l'UI
      console.warn(`Erreur backend markRead (${res.status})`);
    }
    return true;
  } catch (err: any) {
    console.warn('Erreur réseau/Backend markRead:', err?.message || err);
    return false;
  }
}

