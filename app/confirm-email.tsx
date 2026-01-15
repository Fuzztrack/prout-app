import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { safeReplace } from '../lib/navigation';
import { supabase } from '../lib/supabase';
import i18n from '../lib/i18n';

export default function ConfirmEmailScreen() {
  const router = useRouter();
  const [status, setStatus] = useState(i18n.t('finalizing_connection'));

  useEffect(() => {
    let isMounted = true;

    const handleSuccess = async (userId: string) => {
      if (!isMounted) return;
      setStatus(i18n.t('verifying_profile'));
      
      // Petit délai pour laisser le temps au trigger SQL de créer le profil
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        // Récupérer les métadonnées utilisateur pour obtenir le pseudo
        const { data: { user } } = await supabase.auth.getUser();
        const pseudoFromMetadata = user?.user_metadata?.pseudo;
        const phoneFromMetadata = user?.user_metadata?.phone;
        const pseudoValidated = user?.user_metadata?.pseudo_validated === true;
        
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('pseudo')
          .eq('id', userId)
          .maybeSingle();

        if (!isMounted) return;

        // Si le pseudo est dans les métadonnées, le mettre à jour (même si le profil n'existe pas encore ou a "Nouveau Membre")
        if (pseudoFromMetadata) {
          const needsUpdate = !profile || profile.pseudo === 'Nouveau Membre' || !profile.pseudo;
          
          if (needsUpdate) {
            // Attendre un peu plus pour être sûr que le trigger a créé le profil
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Vérifier si le profil existe avant de faire update ou upsert
            const { data: checkProfile } = await supabase
              .from('user_profiles')
              .select('id')
              .eq('id', userId)
              .maybeSingle();
            
            const updateData = {
              pseudo: pseudoFromMetadata,
              phone: phoneFromMetadata || null,
              updated_at: new Date().toISOString()
            };
            
            let updateError, updateResult;
            if (checkProfile) {
              updateResult = await supabase
                .from('user_profiles')
                .update(updateData)
                .eq('id', userId)
                .select();
              updateError = updateResult.error;
            } else {
              updateResult = await supabase
                .from('user_profiles')
                .upsert({ 
                  id: userId,
                  ...updateData
                }, {
                  onConflict: 'id'
                })
                .select();
              updateError = updateResult.error;
            }
            
            if (updateError) {
              console.error('❌ Erreur mise à jour pseudo:', updateError);
              // Retry après un délai plus long avec upsert pour être sûr
              await new Promise(resolve => setTimeout(resolve, 2000));
              const retryResult = await supabase
                .from('user_profiles')
                .upsert({ 
                  id: userId,
                  pseudo: pseudoFromMetadata,
                  phone: phoneFromMetadata || null,
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'id'
                })
                .select();
              
              if (!retryResult.error) {
                const { data: verifyProfile } = await supabase
                  .from('user_profiles')
                  .select('pseudo')
                  .eq('id', userId)
                  .maybeSingle();
                
                if (verifyProfile && verifyProfile.pseudo && verifyProfile.pseudo !== 'Nouveau Membre') {
                  safeReplace(router, '/(tabs)');
                  return;
                }
              }
            } else {
              const { data: verifyProfile } = await supabase
                .from('user_profiles')
                .select('pseudo')
                .eq('id', userId)
                .maybeSingle();
              
              if (verifyProfile && verifyProfile.pseudo && verifyProfile.pseudo !== 'Nouveau Membre') {
                safeReplace(router, '/(tabs)');
                return;
              }
            }
          }
        }

        // Si le profil existe et a un vrai pseudo (pas le placeholder) -> Home
        if (profile && profile.pseudo && profile.pseudo !== 'Nouveau Membre') {
          safeReplace(router, '/(tabs)');
        } else if (!pseudoValidated) {
          safeReplace(router, '/CompleteProfileScreen');
        } else {
          safeReplace(router, '/(tabs)');
        }
      } catch (e) {
        console.error("❌ Erreur lors de la vérification du profil:", e);
        safeReplace(router, pseudoValidated ? '/(tabs)' : '/CompleteProfileScreen');
      }
    };

    // 1. Vérification immédiate (Si _layout a déjà fini le travail avant qu'on arrive)
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        handleSuccess(data.user.id);
      }
    });

    // 2. Écouteur (Si _layout est en train de travailler)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        handleSuccess(session.user.id);
      }
    });

    // 3. Sécurité : Si au bout de 5 secondes on est toujours là, c'est qu'il y a un souci
    const timeout = setTimeout(() => {
      if (isMounted) {
        safeReplace(router, '/AuthChoiceScreen');
      }
    }, 5000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#604a3e" />
      <Text style={styles.text}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#ebb89b' 
  },
  text: { 
    marginTop: 20, 
    color: '#604a3e', 
    fontSize: 16, 
    fontWeight: 'bold' 
  }
});