import * as Contacts from 'expo-contacts';

/**
 * Demande la permission d'accéder aux contacts.
 * L'explication (disclosure) est gérée par l'écran ContactPermissionScreen.
 * Apple exige que la demande système suive immédiatement l'explication,
 * sans bouton de refus intermédiaire qui bloquerait l'affichage de la demande système.
 */
export async function ensureContactPermissionWithDisclosure(): Promise<Contacts.PermissionStatus> {
  try {
    // On demande directement la permission système.
    // L'explication a déjà été donnée par l'écran ContactPermissionScreen qui appelle cette fonction.
    const { status } = await Contacts.requestPermissionsAsync();
    return status;
  } catch (e) {
    console.warn('Erreur lors de la demande de permission contacts:', e);
    return Contacts.PermissionStatus.DENIED;
  }
}
