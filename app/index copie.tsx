// app/index.tsx - Point d'entrée simplifié
import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SplashScreen() {
  const router = useRouter();
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      // Éviter les navigations multiples
      if (hasNavigatedRef.current) return;
      
      // 1. Intro déjà vue ?
      const seen = await AsyncStorage.getItem('@welcome_screen_seen');
      if (!seen) {
        hasNavigatedRef.current = true;
        router.replace('/WelcomeScreen');
        return;
      }

      // 2. Session active ?
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // 3. Profil complet ? Attendre un peu pour que le trigger SQL crée le profil si nécessaire
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('pseudo')
          .eq('id', user.id)
          .maybeSingle();

        // Considérer "Nouveau Membre" comme un pseudo invalide (c'est juste un placeholder du trigger)
        const hasValidPseudo = profile && profile.pseudo && profile.pseudo !== 'Nouveau Membre';

        hasNavigatedRef.current = true;
        if (hasValidPseudo) {
          router.replace('/home');
        } else {
          router.replace('/CompleteProfileScreen');
        }
      } else {
        // Pas de session -> Écran de choix
        hasNavigatedRef.current = true;
        router.replace('/SignupScreen');
      }
    };

    // Petit délai pour laisser l'UI respirer
    setTimeout(init, 500);
  }, [router]);

  return (
    <View style={styles.container}>
      <Image source={require('../assets/images/prout-meme.png')} style={styles.image} resizeMode="contain" />
      <ActivityIndicator size="large" color="#604a3e" style={{ marginTop: 20 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ebb89b', justifyContent: 'center', alignItems: 'center' },
  image: { width: 200, height: 200 },
});
