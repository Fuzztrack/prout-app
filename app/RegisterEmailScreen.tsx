import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CustomButton } from '../components/CustomButton';
import { getRedirectUrl, supabase } from '../lib/supabase';

export default function RegisterEmailScreen() {
  const router = useRouter();
  
  const [pseudo, setPseudo] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!pseudo.trim()) return Alert.alert("Oups", "Il nous faut un Pseudo !");
    if (!email.trim()) return Alert.alert("Oups", "L'email est obligatoire.");
    if (!password || password.length < 6) return Alert.alert("Sécurité", "Le mot de passe doit faire au moins 6 caractères.");

    setLoading(true);
    
    try {
      const cleanPhone = phone.trim() === '' ? null : phone.trim();

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          emailRedirectTo: getRedirectUrl(),
          data: { 
            pseudo: pseudo.trim(),
            phone: cleanPhone 
          } 
        }
      });

      if (error) throw error;

      // Si une session est créée (email confirmé automatiquement ou pas de confirmation requise)
      if (data.session && data.user) {
        // Attendre un peu pour laisser le trigger créer le profil si nécessaire
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Mettre à jour le profil avec le pseudo depuis les métadonnées
        const pseudoFromMetadata = data.user.user_metadata?.pseudo || pseudo.trim();
        const phoneFromMetadata = data.user.user_metadata?.phone || (phone.trim() === '' ? null : phone.trim());
        
        // Vérifier si le profil existe avant de faire update ou upsert
        const { data: checkProfile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle();
        
        const updateData = {
          pseudo: pseudoFromMetadata || pseudo.trim(),
          phone: phoneFromMetadata || (phone.trim() === '' ? null : phone.trim()),
          updated_at: new Date().toISOString()
        };
        
        let updateError, updateResult;
        if (checkProfile) {
          updateResult = await supabase
            .from('user_profiles')
            .update(updateData)
            .eq('id', data.user.id)
            .select();
          updateError = updateResult.error;
        } else {
          updateResult = await supabase
            .from('user_profiles')
            .upsert({ 
              id: data.user.id,
              ...updateData
            }, {
              onConflict: 'id'
            })
            .select();
          updateError = updateResult.error;
        }
        
        if (updateError) {
          console.error('❌ Erreur mise à jour pseudo après inscription:', updateError);
          // Essayer une deuxième fois avec upsert pour être sûr
          await new Promise(resolve => setTimeout(resolve, 1000));
          await supabase
            .from('user_profiles')
            .upsert({ 
              id: data.user.id,
              pseudo: pseudoFromMetadata || pseudo.trim(),
              phone: phoneFromMetadata || (phone.trim() === '' ? null : phone.trim()),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'id'
            });
        }
        
        router.replace('/(tabs)');
      } else {
        // Pas de session (email de confirmation requis)
        // Le pseudo sera mis à jour lors de la confirmation de l'email
        Alert.alert(
          "Compte créé ! 📬", 
          "Un email de confirmation vient d'être envoyé.\nCliquez sur le lien reçu pour activer votre compte.",
          [{ text: "J'ai compris", onPress: () => router.replace('/LoginScreen') }]
        );
      }

    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        
        <View style={styles.header}>
            <Image 
                source={require('../assets/images/prout-meme.png')} 
                style={styles.headerImage} 
                resizeMode="contain" 
            />
            <Text style={styles.title}>Créer un compte</Text>
            <Text style={styles.subtitle}>Rejoignez la communauté du bruit !</Text>
        </View>

        <View style={styles.inputGroup}>
            <Text style={styles.label}>Pseudo <Text style={styles.required}>*</Text></Text>
            <TextInput 
                value={pseudo} 
                onChangeText={setPseudo} 
                style={styles.input} 
                placeholder="Ex: CaptainProut" 
                placeholderTextColor="#999"
            />
        </View>

        <View style={styles.inputGroup}>
            <Text style={styles.label}>Email <Text style={styles.required}>*</Text></Text>
            <TextInput 
                value={email} 
                onChangeText={setEmail} 
                style={styles.input} 
                placeholder="exemple@email.com" 
                keyboardType="email-address" 
                autoCapitalize="none" 
                placeholderTextColor="#999"
            />
            <Text style={styles.helperText}>Un lien de validation vous sera envoyé.</Text>
        </View>

        <View style={styles.inputGroup}>
            <Text style={styles.label}>Téléphone <Text style={styles.optional}>(Facultatif)</Text></Text>
            <TextInput 
                value={phone} 
                onChangeText={setPhone} 
                style={styles.input} 
                placeholder="06 12 34 56 78" 
                keyboardType="phone-pad" 
                placeholderTextColor="#999"
            />
            <Text style={styles.helperText}>Permet à vos amis de vous retrouver plus facilement.</Text>
        </View>

        <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe <Text style={styles.required}>*</Text></Text>
            <View style={styles.passwordContainer}>
                <TextInput 
                    value={password} 
                    onChangeText={setPassword} 
                    style={styles.passInput} 
                    placeholder="6 caractères minimum"
                    placeholderTextColor="#999"
                    secureTextEntry={!showPassword} 
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    <Ionicons name={showPassword ? "eye-off" : "eye"} size={24} color="#604a3e" />
                </TouchableOpacity>
            </View>
        </View>

        <View style={styles.footer}>
            <CustomButton 
                title={loading ? "Création en cours..." : "S'inscrire"} 
                onPress={handleSignup} 
                disabled={loading} 
                color="#604a3e" 
                textColor="#ebb89b" 
            />
            
            <CustomButton 
                title="Annuler et Retour" 
                onPress={() => router.back()} 
                color="transparent" 
                textColor="#604a3e" 
                small 
            />
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ebb89b' },
  scroll: { padding: 20, paddingBottom: 50 },
  
  header: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
  headerImage: { width: 120, height: 100, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#604a3e', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#604a3e', opacity: 0.8, marginTop: 5 },

  inputGroup: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#604a3e', marginBottom: 8, marginLeft: 2 },
  required: { color: '#D32F2F' },
  optional: { fontWeight: 'normal', fontSize: 14, opacity: 0.7 },
  
  input: { 
    backgroundColor: 'white', 
    borderRadius: 10, 
    padding: 15, 
    fontSize: 16, 
    borderWidth: 1, 
    borderColor: 'rgba(96, 74, 62, 0.2)',
    color: '#333'
  },
  
  passwordContainer: { 
    flexDirection: 'row', 
    backgroundColor: 'white', 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: 'rgba(96, 74, 62, 0.2)',
    alignItems: 'center',
    paddingRight: 10
  },
  passInput: { 
    flex: 1, 
    padding: 15, 
    fontSize: 16,
    color: '#333'
  },
  eyeIcon: { padding: 5 },

  helperText: { fontSize: 12, color: '#604a3e', marginTop: 5, marginLeft: 5, opacity: 0.7 },

  footer: { marginTop: 10 }
});