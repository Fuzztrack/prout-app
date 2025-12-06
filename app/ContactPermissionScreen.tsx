// app/ContactPermissionScreen.tsx
import * as Contacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { Alert } from 'react-native';
import { CustomButton } from '../components/CustomButton';

export default function ContactPermissionScreen() {
  const router = useRouter();

  const handleNext = async () => {
    // Demander la permission de contacts
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      try {
        console.log('📱 Demande de permission de contacts...');
        const { status } = await Contacts.requestPermissionsAsync();
        console.log('📱 Statut de permission de contacts après demande:', status);
        
        if (status === 'denied') {
          Alert.alert(
            'Permission requise',
            'L\'accès aux contacts est nécessaire pour que l\'application fonctionne. Vous pourrez l\'activer plus tard dans les paramètres.'
          );
        } else if (status === 'granted') {
          console.log('✅ Permission de contacts accordée');
        }
      } catch (error) {
        console.warn('⚠️ Erreur lors de la demande de permission de contacts:', error);
      }
    }
    
    // Rediriger vers la page d'inscription
    router.replace('/AuthChoiceScreen');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image 
          source={require('../assets/images/prout-meme.png')} 
          style={styles.headerImage}
          resizeMode="contain"
        />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>Ça reste en nous !</Text>
        <Text style={styles.message}>
          Prout permet d'échanger des notifications avec ses amis, il faut donc que vous acceptiez l'accès à vos contact pour qu'elle fonctionne.
        </Text>
        
        <CustomButton
          title="Suivant"
          onPress={handleNext}
          textColor="#604a3e"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 0,
    backgroundColor: '#ebb89b',
  },
  header: {
    alignItems: 'center',
    marginBottom: 0,
    marginTop: 20,
  },
  headerImage: {
    width: 280,
    height: 210,
    marginBottom: 2,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#604a3e',
    textAlign: 'center',
    marginBottom: 30,
  },
  message: {
    fontSize: 16,
    color: '#604a3e',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
});

