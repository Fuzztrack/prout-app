import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function Index() {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  
  // Sécurité pour éviter la double navigation
  const hasNavigated = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const decideNavigation = async () => {
      console.log('🧭 Routeur: Analyse de la destination...');

      try {
        // 0. Vérifier si on est déjà sur la page reset-password (ne pas rediriger)
        const currentPath = segments.join('/');
        if (currentPath.includes('reset-password')) {
          console.log('➡️ Sur la page reset-password, pas de redirection automatique');
          return;
        }

        // 1. Vérifier si l'intro a été vue
        const hasSeenWelcome = await AsyncStorage.getItem('hasSeenWelcome');
        
        if (!isMounted) return;

        if (!hasSeenWelcome) {
          console.log('➡️ Direction: Welcome');
          if (!hasNavigated.current) {
            hasNavigated.current = true;
            router.replace('/WelcomeScreen');
          }
          return;
        }

        // 2. Vérifier la session active
        // On utilise getUser() pour valider le token côté serveur (plus sûr)
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // Récupérer les métadonnées utilisateur pour obtenir le pseudo
          const pseudoFromMetadata = user.user_metadata?.pseudo;
          const phoneFromMetadata = user.user_metadata?.phone;
          
          // 3. Vérifier le profil
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('pseudo')
            .eq('id', user.id)
            .maybeSingle();

          if (!isMounted) return;

          // Si le pseudo est dans les métadonnées mais pas dans le profil (ou = "Nouveau Membre"), le mettre à jour
          if (pseudoFromMetadata && (!profile || profile.pseudo === 'Nouveau Membre' || !profile.pseudo)) {
            // Attendre un peu pour laisser le trigger créer le profil si nécessaire
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Vérifier si le profil existe avant de faire update ou upsert
            const { data: checkProfile } = await supabase
              .from('user_profiles')
              .select('id')
              .eq('id', user.id)
              .maybeSingle();
            
            const updateData = {
              pseudo: pseudoFromMetadata,
              phone: phoneFromMetadata || null,
              updated_at: new Date().toISOString()
            };
            
            let updateError, updateResult;
            if (checkProfile) {
              // Le profil existe, utiliser update
              updateResult = await supabase
                .from('user_profiles')
                .update(updateData)
                .eq('id', user.id)
                .select();
              updateError = updateResult.error;
            } else {
              // Le profil n'existe pas, utiliser upsert
              updateResult = await supabase
                .from('user_profiles')
                .upsert({ 
                  id: user.id,
                  ...updateData
                }, {
                  onConflict: 'id'
                })
                .select();
              updateError = updateResult.error;
            }
            
            if (updateError) {
              console.error('❌ Erreur mise à jour pseudo:', updateError);
              // Retry après un délai avec upsert pour être sûr
              await new Promise(resolve => setTimeout(resolve, 1000));
              const retryResult = await supabase
                .from('user_profiles')
                .upsert({ 
                  id: user.id,
                  pseudo: pseudoFromMetadata,
                  phone: phoneFromMetadata || null,
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'id'
                });
              
              if (retryResult.error) {
                console.error('❌ Erreur retry mise à jour pseudo:', retryResult.error);
              } else {
                // Vérifier que c'est bien mis à jour
                const { data: verifyProfile } = await supabase
                  .from('user_profiles')
                  .select('pseudo')
                  .eq('id', user.id)
                  .maybeSingle();
                
                // Vérifier si le pseudo vient d'Apple
                const fullNameCheck = user.user_metadata?.full_name || user.user_metadata?.name || null;
                const extractedFirstNameCheck = fullNameCheck ? fullNameCheck.split(' ')[0].trim() : null;
                const isPseudoFromAppleCheck = extractedFirstNameCheck && verifyProfile?.pseudo === extractedFirstNameCheck;
                
                if (verifyProfile && verifyProfile.pseudo && verifyProfile.pseudo !== 'Nouveau Membre') {
                  if (isPseudoFromAppleCheck) {
                    // Pseudo vient d'Apple, rediriger vers CompleteProfileScreen
                    if (!hasNavigated.current) {
                      hasNavigated.current = true;
                      router.replace('/CompleteProfileScreen');
                    }
                  } else {
                    if (!hasNavigated.current) {
                      hasNavigated.current = true;
                      router.replace('/(tabs)');
                    }
                  }
                  return;
                }
              }
            } else {
              // Vérifier que c'est bien mis à jour
              const { data: verifyProfile } = await supabase
                .from('user_profiles')
                .select('pseudo')
                .eq('id', user.id)
                .maybeSingle();
              
              // Vérifier si le pseudo vient d'Apple
              const fullNameCheck2 = user.user_metadata?.full_name || user.user_metadata?.name || null;
              const extractedFirstNameCheck2 = fullNameCheck2 ? fullNameCheck2.split(' ')[0].trim() : null;
              const isPseudoFromAppleCheck2 = extractedFirstNameCheck2 && verifyProfile?.pseudo === extractedFirstNameCheck2;
              
              if (verifyProfile && verifyProfile.pseudo && verifyProfile.pseudo !== 'Nouveau Membre') {
                if (isPseudoFromAppleCheck2) {
                  // Pseudo vient d'Apple, rediriger vers CompleteProfileScreen
                  if (!hasNavigated.current) {
                    hasNavigated.current = true;
                    router.replace('/CompleteProfileScreen');
                  }
                } else {
                  if (!hasNavigated.current) {
                    hasNavigated.current = true;
                    router.replace('/(tabs)');
                  }
                }
                return;
              }
            }
          }

          // Vérifier le profil après mise à jour (ou si pas de pseudo dans métadonnées)
          const { data: finalProfile } = await supabase
            .from('user_profiles')
            .select('pseudo')
            .eq('id', user.id)
            .maybeSingle();

          // Vérifier si le pseudo vient d'être extrait depuis Apple (correspond au prénom)
          const fullName = user.user_metadata?.full_name || user.user_metadata?.name || null;
          const extractedFirstName = fullName ? fullName.split(' ')[0].trim() : null;
          const isPseudoFromApple = extractedFirstName && 
                                    finalProfile?.pseudo === extractedFirstName &&
                                    (!user.user_metadata?.pseudo || user.user_metadata?.pseudo === extractedFirstName);

          // Si le pseudo vient d'Apple, toujours rediriger vers CompleteProfileScreen pour validation
          if (isPseudoFromApple) {
            console.log('➡️ Direction: Complétion (pseudo extrait depuis Apple, validation requise)');
            if (!hasNavigated.current) {
              hasNavigated.current = true;
              router.replace('/CompleteProfileScreen');
            }
            return;
          }

          // Si le profil existe ET que ce n'est pas le nom par défaut du Trigger
          if (finalProfile && finalProfile.pseudo && finalProfile.pseudo !== 'Nouveau Membre') {
            console.log('➡️ Direction: Home');
            if (!hasNavigated.current) {
              hasNavigated.current = true;
              router.replace('/(tabs)'); 
            }
          } else {
            // Sinon (pas de profil ou "Nouveau Membre"), on va compléter
            console.log('➡️ Direction: Complétion');
            if (!hasNavigated.current) {
              hasNavigated.current = true;
              router.replace('/CompleteProfileScreen');
            }
          }
        } else {
          // 4. Pas d'utilisateur -> Écran de choix
          console.log('➡️ Direction: Auth Choice');
          if (!hasNavigated.current) {
            hasNavigated.current = true;
            router.replace('/AuthChoiceScreen');
          }
        }
      } catch (e) {
        console.log('❌ Erreur Routeur:', e);
        // En cas de doute, retour à l'auth
        if (!hasNavigated.current && isMounted) {
          hasNavigated.current = true;
          router.replace('/AuthChoiceScreen');
        }
      }
    };

    // Petit délai pour laisser le temps au Splash Screen natif de partir proprement
    // et à l'interface de se charger
    const timer = setTimeout(() => {
      decideNavigation();
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  return (
    <View style={styles.container}>
      <Image 
        source={require('../assets/images/prout-meme.png')} 
        style={styles.image} 
        resizeMode="contain" 
      />
      <ActivityIndicator size="large" color="#604a3e" style={{ marginTop: 20 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#ebb89b', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  image: {
    width: 200,
    height: 200,
  }
});