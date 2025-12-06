// app/WelcomeScreen.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CustomButton } from '../components/CustomButton';
import { safeReplace } from '../lib/navigation';

export default function WelcomeScreen() {
  const router = useRouter();

  const handleContinue = async () => {
    await Notifications.requestPermissionsAsync();
    await Contacts.requestPermissionsAsync();
    await AsyncStorage.setItem('hasSeenWelcome', 'true');
    safeReplace(router, '/AuthChoiceScreen');
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
            source={require('../assets/images/prout-meme.png')} 
            style={styles.headerImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>Bienvenue sur ProutApp ! 💨</Text>
        <Text style={styles.text}>
          Pour fonctionner, nous avons besoin de vos contacts et des notifications.
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

