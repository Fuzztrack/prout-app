import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ensureUserEulaAccepted, isUserEulaAccepted, syncLocalEulaAcceptanceFromUser } from '../lib/eula';
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
        const effectiveUser = await ensureUserEulaAccepted(user);
        const pseudoFromMetadata = effectiveUser?.user_metadata?.pseudo;
        const phoneFromMetadata = effectiveUser?.user_metadata?.phone;
        const pseudoValidated = effectiveUser?.user_metadata?.pseudo_validated === true;

        if (!isUserEulaAccepted(effectiveUser)) {
          safeReplace(router, '/eula-accept');
          return;
        }

        await syncLocalEulaAcceptanceFromUser(effectiveUser);
        
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
            
            let updateError;
            if (checkProfile) {
              const res = await supabase.from('user_profiles').update(updateData).eq('id', userId);
              updateError = res.error;
            } else {
              const res = await supabase.from('user_profiles').upsert({ id: userId, ...updateData }, { onConflict: 'id' });
              updateError = res.error;
            }
            
            if (updateError) {
              console.error('❌ Erreur mise à jour pseudo:', updateError);
              // Retry avec upsert
              await new Promise(resolve => setTimeout(resolve, 2000));
              await supabase.from('user_profiles').upsert({ id: userId, ...updateData }, { onConflict: 'id' });
            }
          }
        }

        // Vérification finale du profil
        const { data: finalProfile } = await supabase
          .from('user_profiles')
          .select('pseudo')
          .eq('id', userId)
          .maybeSingle();

        const isSystemPseudo = (p: string | null | undefined) => {
          if (!p || p === 'Nouveau Membre') return true;
          if (p.toLowerCase().startsWith('user_')) return true;
          return false;
        };

        const hasValidPseudo = finalProfile && finalProfile.pseudo && !isSystemPseudo(finalProfile.pseudo);

        if (hasValidPseudo && pseudoValidated) {
          safeReplace(router, '/');
        } else {
          safeReplace(router, '/CompleteProfileScreen');
        }

      } catch (e) {
        console.error("❌ Erreur lors de la vérification du profil:", e);
        safeReplace(router, '/AuthChoiceScreen');
      }
    };

    // 1. Vérification immédiate
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        handleSuccess(data.user.id);
      }
    });

    // 2. Écouteur
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        handleSuccess(session.user.id);
      }
    });

    // 3. Sécurité
    const timeout = setTimeout(() => {
      if (isMounted) {
        safeReplace(router, '/AuthChoiceScreen');
      }
    }, 10000); // Augmenté à 10s pour être plus large

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
