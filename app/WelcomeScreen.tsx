// app/WelcomeScreen.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CustomButton } from '../components/CustomButton';
import { ensureContactPermissionWithDisclosure } from '../lib/contactConsent';
import { hasAcceptedEulaLocally } from '../lib/eula';
import { safeReplace } from '../lib/navigation';

export default function WelcomeScreen() {
  const router = useRouter();
  const [checkingEula, setCheckingEula] = useState(true);

  useEffect(() => {
    let mounted = true;
    const guardEula = async () => {
      try {
        const accepted = await hasAcceptedEulaLocally();
        if (!mounted) return;
        if (!accepted) {
          safeReplace(router, '/eula-accept?next=%2FWelcomeScreen', { skipInitialCheck: false });
          return;
        }
      } finally {
        if (mounted) setCheckingEula(false);
      }
    };
    guardEula().catch(() => {
      if (mounted) setCheckingEula(false);
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  if (checkingEula) {
    return <View style={styles.container} />;
  }

  const handleContinue = async () => {
    await Notifications.requestPermissionsAsync();
    await ensureContactPermissionWithDisclosure();
    await AsyncStorage.setItem('hasSeenWelcome', 'true');
    // Repasser par l'index pour conserver un routage centralisé.
    safeReplace(router, '/', { skipInitialCheck: false });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Image
            source={require('../assets/images/proot.png')}
            style={styles.headerImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>Bienvenue sur Proot ! 💨</Text>
        <Text style={styles.text}>
          Pour fonctionner, nous avons besoin de vos contacts (noms et numéros) pour trouver vos amis. Ces données sont synchronisées sur nos serveurs Supabase (utfwujyymaikraaigvuv.supabase.co) et ne sont pas partagées en dehors de l’app.
        </Text>
        <CustomButton
          title="C'est parti !"
          onPress={handleContinue}
          color="#604a3e"
          textColor="#ebb89b"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ebb89b' },
  scrollContent: { flexGrow: 1, padding: 20, justifyContent: 'center', paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 30 },
  headerImage: { width: 180, height: 140, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#604a3e' },
  text: { fontSize: 16, textAlign: 'center', marginBottom: 40, color: '#604a3e' },
});

