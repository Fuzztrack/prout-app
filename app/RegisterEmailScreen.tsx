import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CustomButton } from '../components/CustomButton';
import { safeReplace } from '../lib/navigation';
import { getRedirectUrl, supabase } from '../lib/supabase';
import i18n from '../lib/i18n';

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
    if (!password || password.length < 6) return Alert.alert(i18n.t('security'), i18n.t('password_min_length'));

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
            phone: cleanPhone,
            pseudo_validated: true
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
        
        safeReplace(router, '/(tabs)');
      } else {
        // Pas de session (email de confirmation requis)
        // Le pseudo sera mis à jour lors de la confirmation de l'email
        Alert.alert(
          i18n.t('account_created_title'), 
          i18n.t('account_created_body'),
          [{ text: i18n.t('ok'), onPress: () => safeReplace(router, '/LoginScreen', { skipInitialCheck: false }) }]
        );
      }

    } catch (e: any) {
      Alert.alert(i18n.t('error'), e.message);
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
            <Text style={styles.title}>{i18n.t('create_account_title')}</Text>
            <Text style={styles.subtitle}>{i18n.t('join_community')}</Text>
        </View>

        <View style={styles.inputGroup}>
            <Text style={styles.label}>{i18n.t('pseudo_label')} <Text style={styles.required}>{i18n.t('required')}</Text></Text>
            <TextInput 
                value={pseudo} 
                onChangeText={setPseudo} 
                style={styles.input} 
                placeholder={i18n.t('pseudo_placeholder')} 
                placeholderTextColor="#999"
            />
        </View>

        <View style={styles.inputGroup}>
            <Text style={styles.label}>{i18n.t('email_label')} <Text style={styles.required}>{i18n.t('required')}</Text></Text>
            <TextInput 
                value={email} 
                onChangeText={setEmail} 
                style={styles.input} 
                placeholder={i18n.t('email_placeholder')} 
                keyboardType="email-address" 
                autoCapitalize="none" 
                placeholderTextColor="#999"
            />
            <Text style={styles.helperText}>{i18n.t('validation_link_sent')}</Text>
        </View>

        <View style={styles.inputGroup}>
            <Text style={styles.label}>{i18n.t('phone_label')} <Text style={styles.optional}>{i18n.t('optional')}</Text></Text>
            <TextInput 
                value={phone} 
                onChangeText={setPhone} 
                style={styles.input} 
                placeholder={i18n.t('phone_format_placeholder')} 
                keyboardType="phone-pad" 
                placeholderTextColor="#999"
            />
            <Text style={styles.helperText}>Permet à vos amis de vous retrouver plus facilement.</Text>
        </View>

        <View style={styles.inputGroup}>
            <Text style={styles.label}>{i18n.t('password_label_form')} <Text style={styles.required}>{i18n.t('required')}</Text></Text>
            <View style={styles.passwordContainer}>
                <TextInput 
                    value={password} 
                    onChangeText={setPassword} 
                    style={styles.passInput} 
                    placeholder={i18n.t('password_placeholder')}
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
                title={loading ? i18n.t('creating_account') : i18n.t('sign_up')} 
                onPress={handleSignup} 
                disabled={loading} 
                color="#604a3e" 
                textColor="#ebb89b" 
            />
            
            <CustomButton 
                title={i18n.t('cancel_and_return')} 
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