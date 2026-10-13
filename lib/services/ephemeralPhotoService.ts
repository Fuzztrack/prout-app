import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Upload une photo éphémère vers Supabase Storage dans avatars/${userId}/ephemeral_${timestamp}_${randomSuffix}.jpg.
 * Respecte la politique RLS du bucket avatars (qui exige auth.uid() comme dossier racine).
 */
export async function uploadEphemeralPhoto(imageUri: string, senderId?: string): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const userId = session?.user?.id || senderId;

    if (!token || !userId) {
      console.warn('⚠️ [ephemeralPhotoService] Aucun token de session ou userId pour upload');
      return null;
    }

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const fileName = `${userId}/ephemeral_${timestamp}_${randomSuffix}.jpg`;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/avatars/${fileName}`;

    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      name: `ephemeral_${timestamp}.jpg`,
      type: 'image/jpeg',
    } as any);

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey || '',
        'x-upsert': 'true',
      },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('❌ [ephemeralPhotoService] Upload échoué:', res.status, errText);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (e) {
    console.error('❌ [ephemeralPhotoService] Exception uploadEphemeralPhoto:', e);
    return null;
  }
}

/**
 * Supprime une photo éphémère du stockage Supabase à partir de son URL publique.
 */
export async function deleteEphemeralPhoto(imageUrl: string): Promise<boolean> {
  try {
    if (!imageUrl) return false;
    // URL publique format: .../avatars/{userId}/ephemeral_{timestamp}_{randomSuffix}.jpg
    const match = imageUrl.match(/avatars\/([^?#]+)/);
    if (!match || !match[1]) return false;
    const filePath = match[1];

    // Sécurité : on ne supprime que les fichiers commençant par ephemeral_ dans le sous-dossier
    if (!filePath.includes('ephemeral_')) return false;

    const { error } = await supabase.storage
      .from('avatars')
      .remove([filePath]);

    if (error) {
      console.warn('⚠️ [ephemeralPhotoService] Erreur suppression:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('⚠️ [ephemeralPhotoService] Exception deleteEphemeralPhoto:', e);
    return false;
  }
}

/**
 * Sécurité 24h : Parcourt le dossier de l'utilisateur dans avatars et supprime tous les fichiers
 * éphémères dont le timestamp date de plus de 24h.
 */
export async function cleanupExpiredEphemeralPhotos(userId?: string): Promise<number> {
  try {
    let targetUserId = userId;
    if (!targetUserId) {
      const { data: { session } } = await supabase.auth.getSession();
      targetUserId = session?.user?.id;
    }
    if (!targetUserId) return 0;

    const { data: files, error } = await supabase.storage
      .from('avatars')
      .list(targetUserId, { limit: 100 });

    if (error || !files || files.length === 0) return 0;

    const now = Date.now();
    const expiredFilePaths: string[] = [];

    for (const f of files) {
      if (!f.name || !f.name.startsWith('ephemeral_')) continue;
      // Format attendu: ephemeral_${timestamp}_${random}.jpg
      const parts = f.name.split('_');
      if (parts.length >= 2) {
        const fileTs = parseInt(parts[1], 10);
        if (!isNaN(fileTs) && now - fileTs > TWENTY_FOUR_HOURS_MS) {
          expiredFilePaths.push(`${targetUserId}/${f.name}`);
        }
      }
    }

    if (expiredFilePaths.length > 0) {
      console.log(`🧹 [ephemeralPhotoService] Purge de sécurité : ${expiredFilePaths.length} photos éphémères > 24h pour ${targetUserId}`);
      await supabase.storage.from('avatars').remove(expiredFilePaths);
      return expiredFilePaths.length;
    }
    return 0;
  } catch (e) {
    console.warn('⚠️ [ephemeralPhotoService] Exception cleanupExpiredEphemeralPhotos:', e);
    return 0;
  }
}
