import { supabase, supabaseUrl, supabaseAnonKey } from './supabase';
import { sendProutViaBackend } from './sendProutBackend';
import { getChannelIdForSound } from './notifications';
import i18n from './i18n';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface GroopProotGroup {
  id: string;
  name: string;
  avatar_url: string | null;
  created_by: string;
  retention_mode: '24h' | 'permanent';
  created_at: string;
  last_interaction_at: string;
  role?: 'creator' | 'member';
  members_count?: number;
}

export interface CreateGroupParams {
  name: string;
  retentionMode: '24h' | 'permanent';
  memberIds: string[];
}

/**
 * Crée un nouveau groupe GroopProot avec ses membres
 */
export async function createGroopProot({ name, retentionMode, memberIds }: CreateGroupParams): Promise<GroopProotGroup> {
  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 50) {
    throw new Error('Le nom du groupe doit comporter entre 2 et 50 caractères.');
  }

  if (memberIds.length < 2 || memberIds.length > 10) {
    throw new Error('Veuillez sélectionner entre 2 et 10 amis.');
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Utilisateur non connecté.');
  }

  // 1. Création du groupe
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      name: trimmedName,
      created_by: user.id,
      retention_mode: retentionMode,
    })
    .select()
    .single();

  if (groupError || !group) {
    console.error('❌ [createGroopProot] Error creating group:', groupError);
    throw groupError || new Error('Erreur lors de la création du groupe.');
  }

  // 2. Ajout du créateur et des membres
  const membersToInsert = [
    { group_id: group.id, user_id: user.id, role: 'creator' as const },
    ...memberIds.map(uid => ({
      group_id: group.id,
      user_id: uid,
      role: 'member' as const,
    })),
  ];

  const { error: membersError } = await supabase
    .from('group_members')
    .insert(membersToInsert);

  if (membersError) {
    console.error('❌ [createGroopProot] Error adding members:', membersError);
    // Nettoyage en cas d'erreur
    await supabase.from('groups').delete().eq('id', group.id);
    throw membersError;
  }

  return {
    ...group,
    role: 'creator',
    members_count: memberIds.length + 1,
  };
}

/**
 * Récupère les groupes de l'utilisateur avec le compte de membres
 */
export async function fetchUserGroups(userId: string): Promise<GroopProotGroup[]> {
  try {
    const { data: memberRows, error: memberError } = await supabase
      .from('group_members')
      .select('group_id, role, last_read_at')
      .eq('user_id', userId);

    if (memberError || !memberRows || memberRows.length === 0) {
      return [];
    }

    const groupIds = memberRows.map(m => m.group_id);

    // Récupérer les détails des groupes
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds);

    if (groupsError || !groups) {
      console.error('❌ [fetchUserGroups] Error fetching groups:', groupsError);
      return [];
    }

    // Récupérer le nombre de membres par groupe
    const { data: allMembers, error: allMembersError } = await supabase
      .from('group_members')
      .select('group_id')
      .in('group_id', groupIds);

    const countsMap: Record<string, number> = {};
    if (!allMembersError && allMembers) {
      allMembers.forEach(m => {
        countsMap[m.group_id] = (countsMap[m.group_id] || 0) + 1;
      });
    }

    const roleMap: Record<string, 'creator' | 'member'> = {};
    memberRows.forEach(m => {
      roleMap[m.group_id] = m.role as 'creator' | 'member';
    });

    return groups.map(g => ({
      ...g,
      role: roleMap[g.id] || 'member',
      members_count: countsMap[g.id] || 1,
    }));
  } catch (e) {
    console.error('❌ [fetchUserGroups] Unexpected error:', e);
    return [];
  }
}

/**
 * Envoie un Prout simultané à tous les membres du groupe (hors expéditeur)
 */
export async function sendGroupProut({
  groupId,
  groupName,
  soundKey,
  senderPseudo,
  currentUserId,
}: {
  groupId: string;
  groupName: string;
  soundKey: string;
  senderPseudo: string;
  currentUserId: string;
}) {
  try {
    // 1. Récupérer les membres du groupe (hors expéditeur)
    const { data: members, error: membersError } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .neq('user_id', currentUserId);

    if (membersError || !members || members.length === 0) {
      return { sentCount: 0 };
    }

    const memberIds = members.map(m => m.user_id);

    // 2. Récupérer leurs profils push et statut Zen
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, expo_push_token, push_platform, is_zen_mode')
      .in('id', memberIds);

    if (profilesError || !profiles) {
      return { sentCount: 0 };
    }

    const channelId = getChannelIdForSound(soundKey);
    const title = `${senderPseudo} (${groupName})`;
    const body = 'Nouveau prout de groupe !';

    // 3. Envoyer la notification push à chaque membre disponible (non Zen)
    const sendPromises = profiles
      .filter(p => p.expo_push_token && !p.is_zen_mode)
      .map(async p => {
        const token = p.expo_push_token!;
        try {
          if (token.startsWith('ExponentPushToken')) {
            await fetch(EXPO_PUSH_URL, {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: token,
                title,
                body,
                sound: 'default',
                android: { channelId },
                data: {
                  type: 'group_prout',
                  groupId,
                  groupName,
                  key: soundKey,
                  sender: senderPseudo,
                },
              }),
            });
          } else {
            // Android natif via le backend proxy
            await sendProutViaBackend(
              token,
              `${senderPseudo} (${groupName})`,
              soundKey,
              (p.push_platform as 'ios' | 'android' | undefined) || 'android',
              {
                customTitle: title,
                customMessage: body,
                groupId,
                isGroup: true,
              }
            );
          }
        } catch (pushErr) {
          console.warn(`⚠️ [sendGroupProut] Failed to push to ${p.id}:`, pushErr);
        }
      });

    await Promise.all(sendPromises);

    // 4. Mettre à jour last_interaction_at du groupe
    await supabase
      .from('groups')
      .update({ last_interaction_at: new Date().toISOString() })
      .eq('id', groupId);

    return { sentCount: sendPromises.length };
  } catch (error) {
    console.error('❌ [sendGroupProut] Error:', error);
    throw error;
  }
}

/**
 * Quitter un groupe
 */
export async function leaveGroup(groupId: string, userId: string) {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) {
    console.error('❌ [leaveGroup] Error:', error);
    throw error;
  }
}

/**
 * Supprimer un groupe (créateur uniquement)
 */
export async function deleteGroup(groupId: string, userId: string) {
  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', groupId)
    .eq('created_by', userId);

  if (error) {
    console.error('❌ [deleteGroup] Error:', error);
    throw error;
  }
}

/**
 * Modifie le nom d'un groupe
 */
export async function updateGroupName(groupId: string, newName: string): Promise<string> {
  const trimmed = newName.trim();
  if (trimmed.length < 2 || trimmed.length > 50) {
    throw new Error('Le nom du groupe doit comporter entre 2 et 50 caractères.');
  }

  const { error } = await supabase
    .from('groups')
    .update({ name: trimmed })
    .eq('id', groupId);

  if (error) {
    console.error('❌ [updateGroupName] Error:', error);
    throw error;
  }

  return trimmed;
}

/**
 * Téléverse et met à jour la photo de profil du groupe
 */
export async function updateGroupAvatar(groupId: string, imageUri: string): Promise<string> {
  const timestamp = Date.now();
  const fileName = `groups/${groupId}/${timestamp}.jpg`;

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    throw new Error('Session expirée ou invalide');
  }

  const uploadUrl = `${supabaseUrl}/storage/v1/object/avatars/${fileName}`;
  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    name: `${timestamp}.jpg`,
    type: 'image/jpeg',
  } as any);

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: supabaseAnonKey || '',
      'x-upsert': 'true',
    },
    body: formData,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Upload échoué (${uploadResponse.status}): ${errorText}`);
  }

  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(fileName);

  const publicUrl = urlData.publicUrl;

  const { error: updateError } = await supabase
    .from('groups')
    .update({ avatar_url: publicUrl })
    .eq('id', groupId);

  if (updateError) {
    console.error('❌ [updateGroupAvatar] Error updating group:', updateError);
    throw updateError;
  }

  return publicUrl;
}

/**
 * Supprime la photo de profil du groupe (retour à l'icône par défaut)
 */
export async function removeGroupAvatar(groupId: string): Promise<void> {
  const { error } = await supabase
    .from('groups')
    .update({ avatar_url: null })
    .eq('id', groupId);

  if (error) {
    console.error('❌ [removeGroupAvatar] Error:', error);
    throw error;
  }
}

/**
 * Modifie le mode de rétention d'un groupe (24h vs permanent)
 */
export async function updateGroupRetentionMode(
  groupId: string,
  retentionMode: '24h' | 'permanent'
): Promise<'24h' | 'permanent'> {
  const { error } = await supabase
    .from('groups')
    .update({ retention_mode: retentionMode })
    .eq('id', groupId);

  if (error) {
    console.error('❌ [updateGroupRetentionMode] Error:', error);
    throw error;
  }

  // Synchronisation des messages existants
  if (retentionMode === 'permanent') {
    await supabase
      .from('group_messages')
      .update({ expires_at: null })
      .eq('group_id', groupId);
  } else {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('group_messages')
      .delete()
      .eq('group_id', groupId)
      .lt('created_at', twentyFourHoursAgo);
  }

  return retentionMode;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  sender_pseudo: string;
  message: string | null;
  sound_key: string | null;
  image_url: string | null;
  is_view_once: boolean;
  created_at: string;
  expires_at: string | null;
}

/**
 * Récupère les messages d'un groupe ordonnés chronologiquement
 */
export async function fetchGroupMessages(groupId: string): Promise<GroupMessage[]> {
  try {
    const { data, error } = await supabase
      .from('group_messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ [fetchGroupMessages] Error:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('❌ [fetchGroupMessages] Unexpected error:', err);
    return [];
  }
}

/**
 * Publie un message dans un groupe et notifie les membres
 */
export async function sendGroupMessage({
  groupId,
  groupName,
  senderId,
  senderPseudo,
  text,
  soundKey,
  imageUrl,
  isViewOnce,
}: {
  groupId: string;
  groupName: string;
  senderId: string;
  senderPseudo: string;
  text?: string;
  soundKey?: string;
  imageUrl?: string;
  isViewOnce?: boolean;
}): Promise<GroupMessage> {
  const { data, error } = await supabase
    .from('group_messages')
    .insert({
      group_id: groupId,
      sender_id: senderId,
      sender_pseudo: senderPseudo,
      message: text || null,
      sound_key: soundKey || null,
      image_url: imageUrl || null,
      is_view_once: isViewOnce || false,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('❌ [sendGroupMessage] Error:', error);
    throw error || new Error('Erreur lors de l’envoi du message');
  }

  // Notifier en tâche de fond les membres du groupe
  if (soundKey) {
    sendGroupProut({
      groupId,
      groupName,
      soundKey,
      senderPseudo,
      currentUserId: senderId,
    }).catch(err => console.warn('⚠️ [sendGroupMessage] Push failed:', err));
  }

  return data;
}

/**
 * Purge les messages expirés (mode 24h)
 */
export async function purgeExpiredGroupMessages(groupId: string) {
  try {
    const nowIso = new Date().toISOString();
    await supabase
      .from('group_messages')
      .delete()
      .eq('group_id', groupId)
      .not('expires_at', 'is', null)
      .lte('expires_at', nowIso);
  } catch (e) {
    console.warn('⚠️ [purgeExpiredGroupMessages] Error:', e);
  }
}

export interface GroupMemberInfo {
  userId: string;
  pseudo: string;
  avatarUrl: string | null;
  role: 'creator' | 'member';
}

/**
 * Récupère la liste des membres d'un groupe avec leurs profils (pseudo, avatar)
 */
export async function fetchGroupMembers(groupId: string): Promise<GroupMemberInfo[]> {
  try {
    const { data: memberRows, error: memberError } = await supabase
      .from('group_members')
      .select('user_id, role')
      .eq('group_id', groupId);

    if (memberError || !memberRows || memberRows.length === 0) {
      return [];
    }

    const userIds = memberRows.map(m => m.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, pseudo, avatar_url')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const list: GroupMemberInfo[] = memberRows.map(m => {
      const p = profileMap.get(m.user_id);
      return {
        userId: m.user_id,
        pseudo: p?.pseudo || 'Membre',
        avatarUrl: p?.avatar_url || null,
        role: m.role as 'creator' | 'member',
      };
    });

    return list.sort((a, b) => {
      if (a.role === 'creator' && b.role !== 'creator') return -1;
      if (b.role === 'creator' && a.role !== 'creator') return 1;
      return a.pseudo.localeCompare(b.pseudo);
    });
  } catch (e) {
    console.error('❌ [fetchGroupMembers] Error:', e);
    return [];
  }
}
