import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  DeviceEventEmitter,
  Dimensions,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import i18n from '../lib/i18n';
import { useAppStore } from '../lib/store';
import { sendFriendRequestNotification } from '../lib/sendProut';
import { playSound } from '@/lib/audioService';
import * as Contacts from 'expo-contacts';
import { ensureContactPermissionWithDisclosure } from '../lib/contactConsent';
import { syncUserContacts } from '../lib/contactSync';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_MAX_HEIGHT = SCREEN_HEIGHT * 0.85;
const MODAL_MIN_HEIGHT = Math.min(SCREEN_HEIGHT * 0.52, 400);
const MODAL_QR_HEIGHT = Math.min(SCREEN_HEIGHT * 0.82, 560);
const ROW_HEIGHT_ESTIMATE = 62;
const MAX_VISIBLE_ROWS = 12;

export function SearchUser({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'username' | 'contacts' | 'qrcode'>('username');
  const [syncingContacts, setSyncingContacts] = useState(false);
  const [qrMode, setQrMode] = useState<'my_code' | 'scan'>('my_code');
  const [scanned, setScanned] = useState(false);
  const isProcessingScanRef = useRef(false);

  const [permission, requestPermission] = useCameraPermissions();
  const queryClient = useQueryClient();

  // Mode recherche par pseudo
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQueryRef = useRef<string>('');
  const MIN_QUERY_LENGTH = 2;

  const currentPseudo = useAppStore((state) => state.pseudo);
  const storeAvatarUrl = useAppStore((state) => state.avatarUrl);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(storeAvatarUrl);

  useEffect(() => {
    if (storeAvatarUrl) {
      setAvatarUrl(storeAvatarUrl);
    }
  }, [storeAvatarUrl]);

  // Charger notre ID et profil (avatar/pseudo) au démarrage
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUserId(data.user.id);
        supabase
          .from('user_profiles')
          .select('pseudo, avatar_url')
          .eq('id', data.user.id)
          .maybeSingle()
          .then(({ data: profile }) => {
            if (profile?.avatar_url) {
              setAvatarUrl(profile.avatar_url);
            }
          });
      }
    });
  }, []);

  // Réinitialiser le scanner quand la modale s'ouvre/se ferme
  useEffect(() => {
    if (!visible) {
      setScanned(false);
      isProcessingScanRef.current = false;
      setQuery('');
      setResults([]);
    }
  }, [visible]);

  // Gérer le bouton retour matériel sur Android
  useEffect(() => {
    if (!visible) return;
    const onBackPress = () => {
      onClose();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [visible, onClose]);

  const performSearch = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      latestQueryRef.current = trimmed;

      if (trimmed.length < MIN_QUERY_LENGTH) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        let profilesQuery = supabase
          .from('user_profiles')
          .select('id, pseudo')
          .ilike('pseudo', `${trimmed}%`)
          .order('pseudo', { ascending: true })
          .limit(10);

        if (currentUserId) {
          profilesQuery = profilesQuery.neq('id', currentUserId);
        }

        const { data: profiles, error } = await profilesQuery;
        if (error) throw error;

        if (latestQueryRef.current !== trimmed) return;

        if (profiles && profiles.length > 0) {
          const { data: friendships } = await supabase
            .from('friends')
            .select('friend_id, status')
            .eq('user_id', currentUserId)
            .in('friend_id', profiles.map((p) => p.id));

          const enrichedResults = profiles.map((profile) => {
            const relation = friendships?.find((f) => f.friend_id === profile.id);
            return {
              ...profile,
              friendStatus: relation?.status || null,
            };
          });

          setResults(enrichedResults);
        } else {
          setResults([]);
        }
      } catch (e: any) {
        Alert.alert(i18n.t('error'), e.message);
      } finally {
        if (latestQueryRef.current === trimmed) {
          setLoading(false);
        }
      }
    },
    [currentUserId]
  );

  useEffect(() => {
    if (activeTab !== 'username') return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 250);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch, activeTab]);

  const handleSearch = async () => {
    await performSearch(query);
  };

  const handleAddFriend = async (friendId: string) => {
    try {
      if (!currentUserId) return;

      const { error } = await supabase.from('friends').insert({
        user_id: currentUserId,
        friend_id: friendId,
        method: 'search',
        status: 'pending',
      });

      if (error) {
        if (error.code === '23505') {
          Alert.alert(i18n.t('info'), i18n.t('already_linked'));
        } else {
          throw error;
        }
      } else {
        Alert.alert(i18n.t('success'), i18n.t('request_sent'));
        setResults((prev) =>
          prev.map((p) => (p.id === friendId ? { ...p, friendStatus: 'pending' } : p))
        );
        sendFriendRequestNotification(friendId, currentPseudo || 'Un ami').catch(() => {});
      }
    } catch (e: any) {
      Alert.alert(i18n.t('error'), i18n.t('cannot_add_friend'));
      console.log(e);
    }
  };

  // Scan et validation instantanée d'ami QR Code
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || isProcessingScanRef.current) return;
    isProcessingScanRef.current = true;
    setScanned(true);

    try {
      let targetId: string | null = null;
      let targetPseudo: string | null = null;

      if (data.startsWith('proutapp://friend?') || data.startsWith('prout://friend?')) {
        const idMatch = data.match(/[?&]id=([^&]+)/);
        const pseudoMatch = data.match(/[?&]pseudo=([^&]+)/);
        if (idMatch) targetId = idMatch[1];
        if (pseudoMatch) targetPseudo = decodeURIComponent(pseudoMatch[1]);
      } else {
        try {
          const parsed = JSON.parse(data);
          if (parsed.id) {
            targetId = parsed.id;
            targetPseudo = parsed.pseudo;
          }
        } catch {
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.trim())) {
            targetId = data.trim();
          }
        }
      }

      if (!targetId) {
        Alert.alert(i18n.t('error'), i18n.t('invalid_qr_code') || 'QR Code non reconnu.');
        setTimeout(() => {
          setScanned(false);
          isProcessingScanRef.current = false;
        }, 2000);
        return;
      }

      if (targetId === currentUserId) {
        Alert.alert(i18n.t('info'), i18n.t('own_qr_code') || "C'est votre propre QR Code !");
        setTimeout(() => {
          setScanned(false);
          isProcessingScanRef.current = false;
        }, 2000);
        return;
      }

      // Vérifier si déjà amis ou demande en cours
      const { data: existing } = await supabase
        .from('friends')
        .select('id, status, user_id, friend_id')
        .or(`and(user_id.eq.${currentUserId},friend_id.eq.${targetId}),and(user_id.eq.${targetId},friend_id.eq.${currentUserId})`);

      const isAlreadyAccepted = existing?.some((r) => r.status === 'accepted');
      if (isAlreadyAccepted) {
        Alert.alert(i18n.t('info'), i18n.t('already_friend'));
        setTimeout(() => {
          setScanned(false);
          isProcessingScanRef.current = false;
        }, 2000);
        return;
      }

      // Récupérer le pseudo si absent du QR code
      if (!targetPseudo) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('pseudo')
          .eq('id', targetId)
          .maybeSingle();
        if (profile?.pseudo) targetPseudo = profile.pseudo;
      }

      // Si une demande existait en attente dans un sens ou dans l'autre, la valider
      const pendingReverse = existing?.find(
        (r) => r.user_id === targetId && r.friend_id === currentUserId && r.status === 'pending'
      );
      if (pendingReverse) {
        await supabase.from('friends').update({ status: 'accepted' }).eq('id', pendingReverse.id);
      }

      const pendingSelf = existing?.find(
        (r) => r.user_id === currentUserId && r.friend_id === targetId && r.status === 'pending'
      );
      if (pendingSelf) {
        await supabase.from('friends').update({ status: 'accepted' }).eq('id', pendingSelf.id);
      }

      // Amitié instantanée et réciproque en face à face
      let friendshipError: any = null;
      const { error: rpcError } = await supabase.rpc('create_mutual_friendship', {
        p_user_id_1: currentUserId,
        p_user_id_2: targetId,
      });

      if (rpcError) {
        console.warn('RPC create_mutual_friendship fallback to upsert:', rpcError);
        // Fallback avec la méthode valide 'contact' (respecte la contrainte friends_method_check)
        const { error: insertError } = await supabase.from('friends').upsert(
          {
            user_id: currentUserId,
            friend_id: targetId,
            method: 'contact',
            status: 'accepted',
          },
          { onConflict: 'user_id,friend_id' }
        );
        if (insertError) {
          friendshipError = insertError;
        }
      }

      if (friendshipError) {
        console.error('Erreur ajout ami QR:', friendshipError);
        Alert.alert(i18n.t('error'), i18n.t('cannot_add_friend'));
        setTimeout(() => {
          setScanned(false);
          isProcessingScanRef.current = false;
        }, 2000);
        return;
      }

      // Feedback succès haptique + sonore
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      playSound('toot1').catch(() => {});

      // Rafraîchir les listes
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      DeviceEventEmitter.emit('REFRESH_DATA', { source: 'qr_code_friend' });

      Alert.alert(
        '🎉 ' + (i18n.t('friend_added_qr_success') || 'Vous êtes maintenant amis !'),
        targetPseudo ? `${targetPseudo} a été ajouté à vos amis !` : undefined,
        [{ text: i18n.t('ok'), onPress: () => onClose() }]
      );
    } catch (err: any) {
      console.error('Exception scan QR code:', err);
      Alert.alert(i18n.t('error'), err?.message || 'Erreur lors du scan.');
      setTimeout(() => {
        setScanned(false);
        isProcessingScanRef.current = false;
      }, 2000);
    }
  };

  const handleManualContactSync = async () => {
    try {
      setSyncingContacts(true);
      const status = await ensureContactPermissionWithDisclosure(true);
      if (status === Contacts.PermissionStatus.GRANTED) {
        const count = await syncUserContacts(true);
        queryClient.invalidateQueries({ queryKey: ['friends'] });
        if (count > 0) {
          Alert.alert(i18n.t('success'), i18n.t('contact_sync_success', { count }));
        } else {
          Alert.alert(i18n.t('info'), i18n.t('contact_sync_none'));
        }
      }
    } catch (e) {
      console.warn('Erreur sync contacts:', e);
    } finally {
      setSyncingContacts(false);
    }
  };

  const currentModalHeight =
    activeTab === 'qrcode'
      ? MODAL_QR_HEIGHT
      : activeTab === 'contacts'
      ? Math.min(SCREEN_HEIGHT * 0.58, 430)
      : Math.min(
          MODAL_MAX_HEIGHT,
          MODAL_MIN_HEIGHT + Math.min(results.length, MAX_VISIBLE_ROWS) * ROW_HEIGHT_ESTIMATE
        );

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={[styles.modalContent, { height: currentModalHeight, maxHeight: MODAL_MAX_HEIGHT }]}>
          {/* Header avec bouton fermer */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{i18n.t('search_title')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color="#604a3e" />
            </TouchableOpacity>
          </View>

          {/* Onglets : Par pseudo / Contacts / QR Code */}
          <View style={styles.tabsBar}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'username' && styles.tabButtonActive]}
              onPress={() => setActiveTab('username')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="search"
                size={15}
                color={activeTab === 'username' ? '#fff' : '#604a3e'}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.tabText, activeTab === 'username' && styles.tabTextActive]}>
                {i18n.t('search_tab_username') || 'Par pseudo'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'contacts' && styles.tabButtonActive]}
              onPress={() => setActiveTab('contacts')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="people"
                size={15}
                color={activeTab === 'contacts' ? '#fff' : '#604a3e'}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.tabText, activeTab === 'contacts' && styles.tabTextActive]}>
                {i18n.t('search_tab_contacts') || 'Contacts'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'qrcode' && styles.tabButtonActive]}
              onPress={() => setActiveTab('qrcode')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="qr-code"
                size={15}
                color={activeTab === 'qrcode' ? '#fff' : '#604a3e'}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.tabText, activeTab === 'qrcode' && styles.tabTextActive]}>
                {i18n.t('search_tab_qrcode') || 'QR Code'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Contenu Onglet 1 : Recherche classique par pseudo */}
          {activeTab === 'username' ? (
            <View style={styles.contentContainer}>
              <View style={styles.searchBox}>
                <TextInput
                  style={styles.input}
                  placeholder={i18n.t('search_placeholder')}
                  value={query}
                  onChangeText={setQuery}
                  autoCapitalize="none"
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                  placeholderTextColor="#999"
                  keyboardAppearance="light"
                />
              </View>

              <TouchableOpacity
                style={[styles.searchButtonMain, (loading || !query.trim()) && styles.searchButtonDisabled]}
                onPress={handleSearch}
                disabled={loading || !query.trim()}
              >
                <Ionicons name="search" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.searchButtonText}>
                  {loading ? i18n.t('loading') : i18n.t('search_btn')}
                </Text>
              </TouchableOpacity>

              {loading ? (
                <ActivityIndicator style={{ marginTop: 20 }} color="#604a3e" />
              ) : (
                <FlatList
                  data={results}
                  keyExtractor={(item) => item.id}
                  style={styles.resultsList}
                  contentContainerStyle={{ paddingBottom: 20 }}
                  ListEmptyComponent={
                    query.length > 0 ? <Text style={styles.empty}>{i18n.t('no_results')}</Text> : null
                  }
                  renderItem={({ item }) => (
                    <View style={styles.userRow}>
                      <View style={styles.userInfo}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>{item.pseudo.charAt(0).toUpperCase()}</Text>
                        </View>
                        <Text style={styles.pseudo}>{item.pseudo}</Text>
                      </View>

                      {item.friendStatus === 'accepted' ? (
                        <Text style={styles.statusText}>{i18n.t('already_friend')}</Text>
                      ) : (
                        <TouchableOpacity
                          style={[styles.addButton, item.friendStatus === 'pending' && styles.addButtonPending]}
                          onPress={() => item.friendStatus !== 'pending' && handleAddFriend(item.id)}
                          disabled={item.friendStatus === 'pending'}
                        >
                          <Ionicons
                            name={item.friendStatus === 'pending' ? 'time-outline' : 'person-add-outline'}
                            size={20}
                            color={item.friendStatus === 'pending' ? '#ff4444' : '#604a3e'}
                          />
                          <Text
                            style={[
                              styles.addButtonText,
                              item.friendStatus === 'pending' && styles.addButtonTextPending,
                            ]}
                          >
                            {item.friendStatus === 'pending' ? i18n.t('pending_btn') : i18n.t('add_btn')}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                />
              )}
            </View>
          ) : activeTab === 'contacts' ? (
            <View style={styles.contactsContainer}>
              <View style={styles.contactsCard}>
                <View style={styles.contactsIconWrap}>
                  <Ionicons name="people-outline" size={38} color="#604a3e" />
                </View>
                <Text style={styles.contactsCardTitle}>
                  {i18n.t('contact_sync_button')}
                </Text>
                <Text style={styles.contactsCardDesc}>
                  {i18n.t('contact_sync_explainer')}
                </Text>

                <TouchableOpacity
                  style={[styles.contactSyncBtn, syncingContacts && styles.searchButtonDisabled]}
                  onPress={handleManualContactSync}
                  disabled={syncingContacts}
                  activeOpacity={0.8}
                >
                  {syncingContacts ? (
                    <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                  ) : (
                    <Ionicons name="sync-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.contactSyncBtnText}>
                    {syncingContacts ? i18n.t('loading') : i18n.t('contact_sync_button')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Contenu Onglet 3 : QR Code (Mon Code / Scanner) */
            <View style={styles.qrContainer}>
              {/* Sous-sélecteur : Mon QR Code / Scanner un ami */}
              <View style={styles.qrSubToggle}>
                <TouchableOpacity
                  style={[styles.subToggleBtn, qrMode === 'my_code' && styles.subToggleBtnActive]}
                  onPress={() => {
                    setQrMode('my_code');
                    setScanned(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="qr-code-outline"
                    size={16}
                    color={qrMode === 'my_code' ? '#fff' : '#604a3e'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.subToggleText, qrMode === 'my_code' && styles.subToggleTextActive]}>
                    {i18n.t('my_qr_code') || 'Mon QR Code'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.subToggleBtn, qrMode === 'scan' && styles.subToggleBtnActive]}
                  onPress={() => {
                    setQrMode('scan');
                    setScanned(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="camera-outline"
                    size={16}
                    color={qrMode === 'scan' ? '#fff' : '#604a3e'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.subToggleText, qrMode === 'scan' && styles.subToggleTextActive]}>
                    {i18n.t('scan_qr_code') || 'Scanner un ami'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Mode A : Mon QR Code */}
              {qrMode === 'my_code' ? (
                <ScrollView
                  style={styles.myQrScrollView}
                  contentContainerStyle={styles.myQrContent}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  <View style={styles.qrCard}>
                    <View style={styles.qrAvatarContainer}>
                      {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.qrAvatarImage} />
                      ) : (
                        <View style={styles.qrAvatarFallback}>
                          <Text style={styles.qrAvatarText}>
                            {(currentPseudo || 'P').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.qrPseudo}>{currentPseudo || 'Mon profil'}</Text>

                    <View style={styles.qrWrapper}>
                      {currentUserId ? (
                        <QRCode
                          value={`proutapp://friend?id=${currentUserId}&pseudo=${encodeURIComponent(
                            currentPseudo || ''
                          )}`}
                          size={160}
                          color="#4A3428"
                          backgroundColor="#FFFFFF"
                        />
                      ) : (
                        <ActivityIndicator color="#604a3e" />
                      )}
                    </View>

                    <Text style={styles.qrInstruction}>
                      {i18n.t('qr_code_instruction') || 'Montre ce code à ton ami pour qu’il te scanne'}
                    </Text>
                  </View>
                </ScrollView>
              ) : (
                /* Mode B : Scanner la caméra */
                <View style={styles.scanContent}>
                  {!permission ? (
                    <View style={styles.permissionBox}>
                      <ActivityIndicator color="#604a3e" />
                    </View>
                  ) : !permission.granted ? (
                    <View style={styles.permissionBox}>
                      <Ionicons name="camera-outline" size={48} color="#604a3e" style={{ marginBottom: 12 }} />
                      <Text style={styles.permissionText}>
                        {i18n.t('camera_permission_scan') || "Autorisez l'accès à la caméra pour scanner"}
                      </Text>
                      <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission} activeOpacity={0.85}>
                        <Text style={styles.permissionBtnText}>{i18n.t('ok') || 'Autoriser'}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.cameraWrapper}>
                      <CameraView
                        key={`camera-${qrMode}`}
                        style={StyleSheet.absoluteFill}
                        facing="back"
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                      />
                      <View style={styles.cameraOverlay} pointerEvents="none">
                        <View style={styles.scannerTarget}>
                          <View style={[styles.corner, styles.topLeft]} />
                          <View style={[styles.corner, styles.topRight]} />
                          <View style={[styles.corner, styles.bottomLeft]} />
                          <View style={[styles.corner, styles.bottomRight]} />
                        </View>
                        <Text style={styles.scannerHint}>
                          {scanned
                            ? i18n.t('loading') || 'Traitement...'
                            : i18n.t('scan_qr_instruction') || 'Place le QR code de ton ami dans le cadre'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {!Device.isDevice && (
                    <TouchableOpacity
                      style={styles.simTestBtn}
                      onPress={() => {
                        Alert.prompt?.(
                          'Test Simulateur QR',
                          "Entrez l'UUID d'un utilisateur à ajouter en ami :",
                          (testId) => {
                            if (testId?.trim()) void handleBarCodeScanned({ data: testId.trim() });
                          }
                        );
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.simTestBtnText}>🧪 Tester un scan sur simulateur</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    zIndex: 99999,
    elevation: 99999,
  },
  modalContent: {
    width: '94%',
    backgroundColor: '#fff5eb',
    borderRadius: 22,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(96, 74, 62, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    height: 56,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#604a3e',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  tabsBar: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(96, 74, 62, 0.08)',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: '#EFE7DC',
  },
  tabButtonActive: {
    backgroundColor: '#604a3e',
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#604a3e',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  searchBox: {
    marginBottom: 10,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.2)',
  },
  input: {
    backgroundColor: 'transparent',
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  searchButtonMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#604a3e',
    padding: 12,
    borderRadius: 15,
    marginBottom: 8,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  resultsList: {
    flex: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.1)',
  },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(96, 74, 62, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: { fontWeight: 'bold', color: '#604a3e', fontSize: 16 },
  pseudo: { fontSize: 15, fontWeight: 'bold', color: '#604a3e' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.1)',
  },
  addButtonPending: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderColor: 'rgba(255, 68, 68, 0.3)',
  },
  addButtonText: { color: '#604a3e', fontWeight: 'bold', marginLeft: 5, fontSize: 12 },
  addButtonTextPending: { color: '#ff4444' },
  statusText: { color: '#604a3e', fontStyle: 'italic', opacity: 0.8, fontSize: 12 },
  empty: { textAlign: 'center', color: '#604a3e', marginTop: 20, opacity: 0.7 },

  // --- Styles QR Code ---
  qrContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },
  qrSubToggle: {
    flexDirection: 'row',
    backgroundColor: '#EBE2D5',
    borderRadius: 16,
    padding: 3,
    marginBottom: 16,
  },
  subToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 13,
  },
  subToggleBtnActive: {
    backgroundColor: '#604a3e',
  },
  subToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#604a3e',
  },
  subToggleTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  myQrScrollView: {
    flex: 1,
    width: '100%',
  },
  myQrContent: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  qrCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.1)',
  },
  qrAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#FF8A3D',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(96, 74, 62, 0.15)',
  },
  qrAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  qrAvatarFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  qrPseudo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4A3428',
    marginBottom: 10,
  },
  qrWrapper: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
  },
  qrInstruction: {
    fontSize: 12,
    color: '#776E65',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  scanContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraWrapper: {
    width: '100%',
    alignSelf: 'stretch',
    height: 270,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerTarget: {
    width: 170,
    height: 170,
    position: 'relative',
    marginBottom: 12,
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: '#FF8A3D',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  scannerHint: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  permissionBox: {
    width: '100%',
    height: 270,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.1)',
  },
  permissionText: {
    color: '#604a3e',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  permissionBtn: {
    backgroundColor: '#604a3e',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  permissionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  simTestBtn: {
    backgroundColor: 'rgba(96, 74, 62, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: 6,
  },
  simTestBtnText: {
    color: '#604a3e',
    fontSize: 12,
    fontWeight: '600',
  },

  // --- Styles Contacts ---
  contactsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.1)',
  },
  contactsIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(96, 74, 62, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  contactsCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4A3428',
    textAlign: 'center',
    marginBottom: 8,
  },
  contactsCardDesc: {
    fontSize: 13.5,
    color: '#604a3e',
    textAlign: 'center',
    lineHeight: 19,
    opacity: 0.85,
    marginBottom: 20,
    paddingHorizontal: 6,
  },
  contactSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#604a3e',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    width: '100%',
  },
  contactSyncBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
