import { supabase } from './supabase';

const EDGE_FUNCTION_URL = 'https://utfwujyymaikraaigvuv.supabase.co/functions/v1/prout-proxy';

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
  };
}

// Envoi du prout via ton backend Nest.js (proxied via Supabase Edge Function)
export async function sendProutViaBackend(
  recipientToken: string,
  sender: string,
  proutKey: string,
  platform?: 'ios' | 'android',
  extraData?: Record<string, any>
) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers,
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
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${EDGE_FUNCTION_URL}/read`, {
      method: 'POST',
      headers,
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

export async function markMessagesReadViaBackend(
  messageIds: string[],
  senderId: string,
  receiverId: string
) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${EDGE_FUNCTION_URL}/readMany`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messageIds,
        senderId,
        receiverId,
      }),
    });

    return { ok: res.ok, status: res.status };
  } catch (err: any) {
    return { ok: false as const, status: undefined as number | undefined };
  }
}

export async function purgeChatViaBackend(userId: string, friendId: string) {
  console.log(`🔍 [purgeChatViaBackend] DÉBUT - userId: ${userId}, friendId: ${friendId}`);
  
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${EDGE_FUNCTION_URL}/purge`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, friendId }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.warn(`❌ [purgeChatViaBackend] Erreur backend purgeChat (${res.status}):`, errorText);
      return false;
    }
    
    const result = await res.json().catch(() => ({}));
    console.log(`✅ [purgeChatViaBackend] Succès:`, result);
    return true;
  } catch (err: any) {
    console.error('❌ [purgeChatViaBackend] Erreur réseau/Backend purgeChat:', err?.message || err);
    return false;
  }
}

export async function markConversationReadViaBackend(senderId: string, receiverId: string) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${EDGE_FUNCTION_URL}/readConversation`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ senderId, receiverId }),
    });

    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false as const, status: undefined as number | undefined };
  }
}

const pendingRateLimitCooldownMs = 8_000;
let pendingReceivedBlockedUntil = 0;
let pendingSentBlockedUntil = 0;

export async function editMessageViaBackend(
  messageId: string,
  newText: string,
  senderId: string
) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${EDGE_FUNCTION_URL}/edit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messageId,
        newText,
        senderId,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Erreur backend editMessage (${res.status}):`, text);
      return { success: false, status: res.status, message: text };
    }
    
    return { success: true };
  } catch (err: any) {
    console.error('Erreur réseau/Backend editMessage:', err?.message || err);
    return { success: false, message: err?.message };
  }
}

export async function fetchPendingReceivedViaBackend(userId: string) {
  const now = Date.now();
  if (now < pendingReceivedBlockedUntil) {
    return [];
  }
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${EDGE_FUNCTION_URL}/pendingReceived`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        pendingReceivedBlockedUntil = Date.now() + pendingRateLimitCooldownMs;
      }
      console.warn(`❌ [fetchPendingReceivedViaBackend] Erreur backend (${res.status})`);
      return null;
    }

    const result = await res.json().catch(() => ({} as any));
    if (!result?.success || !Array.isArray(result?.messages)) return [];
    return result.messages as any[];
  } catch (err: any) {
    console.warn('❌ [fetchPendingReceivedViaBackend] Erreur réseau:', err?.message || err);
    return null;
  }
}

export async function fetchPendingSentViaBackend(userId: string) {
  const now = Date.now();
  if (now < pendingSentBlockedUntil) {
    return [];
  }
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${EDGE_FUNCTION_URL}/pendingSent`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        pendingSentBlockedUntil = Date.now() + pendingRateLimitCooldownMs;
      }
      console.warn(`❌ [fetchPendingSentViaBackend] Erreur backend (${res.status})`);
      return null;
    }

    const result = await res.json().catch(() => ({} as any));
    if (!result?.success || !Array.isArray(result?.messages)) return [];
    return result.messages as any[];
  } catch (err: any) {
    console.warn('❌ [fetchPendingSentViaBackend] Erreur réseau:', err?.message || err);
    return null;
  }
}
