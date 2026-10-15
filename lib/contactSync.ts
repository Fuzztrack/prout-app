import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts';
import { supabase } from './supabase';
import { normalizePhone } from './normalizePhone';
import { queryClient } from './queryClient';
import { CONTACT_CONSENT_KEY } from './contactConsent';

let isSyncing = false;
let lastSyncTime = 0;
const SYNC_THROTTLE_MS = 60 * 1000; // 1 minute entre deux synchronisations automatiques

/**
 * Synchronise les numéros de téléphone du carnet d'adresses avec Supabase
 * et crée automatiquement les relations d'amitié réciproques pour les correspondances.
 *
 * @param force Si true, ignore le délai de throttle (ex: pull-to-refresh)
 * @returns Nombre d'amis trouvés ou 0
 */
export async function syncUserContacts(force: boolean = false): Promise<number> {
  const now = Date.now();
  if (isSyncing) return 0;
  if (!force && now - lastSyncTime < SYNC_THROTTLE_MS) {
    return 0;
  }

  try {
    isSyncing = true;

    // 1. Vérifier obligatoirement que l'utilisateur est authentifié
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      if (__DEV__) console.log('⚠️ [ContactSync] Utilisateur non connecté, synchronisation ignorée');
      return 0;
    }

    // 2. Vérifier que l'utilisateur n'a pas refusé le consentement
    const storedConsent = await AsyncStorage.getItem(CONTACT_CONSENT_KEY);
    if (storedConsent === 'denied') {
      if (__DEV__) console.log('ℹ️ [ContactSync] Consentement contacts refusé par l\'utilisateur');
      return 0;
    }

    // 3. Vérifier la permission actuelle sans boîte de dialogue intempestive
    const { status } = await Contacts.getPermissionsAsync();
    if (status !== 'granted') {
      return 0;
    }

    // 2. Récupérer les contacts avec numéros
    const { data: contacts } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers],
    });

    if (!contacts || contacts.length === 0) {
      lastSyncTime = now;
      return 0;
    }

    // 3. Extraire et préparer les numéros (bruts et normalisés)
    const phoneSet = new Set<string>();

    for (const contact of contacts) {
      if (!contact.phoneNumbers) continue;
      for (const phoneItem of contact.phoneNumbers) {
        const raw = (phoneItem.number || '').replace(/[^\d+]/g, '');
        if (raw.length >= 6) {
          phoneSet.add(raw);
          const norm = normalizePhone(raw);
          if (norm && norm.length >= 6) {
            phoneSet.add(norm);
          }
        }
      }
    }

    const uniquePhones = Array.from(phoneSet);
    if (uniquePhones.length === 0) {
      lastSyncTime = now;
      return 0;
    }

    if (__DEV__) {
      console.log(`📱 [ContactSync] Recherche de correspondance pour ${uniquePhones.length} numéros...`);
    }

    // 4. Appel RPC Supabase sync_contacts
    const { data: matchedFriends, error } = await supabase.rpc('sync_contacts', {
      phones: uniquePhones,
    });

    if (error) {
      console.warn('⚠️ [ContactSync] Erreur RPC sync_contacts:', error.message);
      return 0;
    }

    lastSyncTime = now;

    if (matchedFriends && matchedFriends.length > 0) {
      if (__DEV__) {
        console.log(`✅ [ContactSync] ${matchedFriends.length} ami(s) trouvés par téléphone !`);
      }
      // Recharger immédiatement la liste d'amis
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      return matchedFriends.length;
    }

    return 0;
  } catch (err) {
    console.warn('⚠️ [ContactSync] Exception lors de la synchronisation des contacts:', err);
    return 0;
  } finally {
    isSyncing = false;
  }
}
