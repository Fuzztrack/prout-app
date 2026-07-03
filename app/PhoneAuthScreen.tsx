import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { CustomButton } from '../components/CustomButton';
import { hasAcceptedEulaLocally } from '../lib/eula';
import { safeReplace } from '../lib/navigation';
import { supabase } from '../lib/supabase';
import i18n from '../lib/i18n';

export default function PhoneAuthScreen() {
  const router = useRouter();

  // États principaux
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [countryCode, setCountryCode] = useState('+33');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  
  // États de chargement et timers
  const [loading, setLoading] = useState(false);
  const [checkingEula, setCheckingEula] = useState(true);
  const [timer, setTimer] = useState(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Garde EULA à l'ouverture de l'écran
  useEffect(() => {
    let mounted = true;
    const guardEula = async () => {
      try {
        const accepted = await hasAcceptedEulaLocally();
        if (!mounted) return;
        if (!accepted) {
          safeReplace(router, '/eula-accept?next=%2FPhoneAuthScreen', { skipInitialCheck: false });
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

  // Gestion du compte à rebours pour le renvoi du SMS
  useEffect(() => {
    if (step === 'otp' && timer > 0) {
      timerRef.current = setTimeout(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [step, timer]);

  if (checkingEula) {
    return <View style={styles.container} />;
  }

  // Formatage intelligent du numéro
  const getFormattedPhone = () => {
    let cleanNum = phoneNumber.trim().replace(/\s+/g, '');
    
    // Supprimer le premier 0 si l'utilisateur l'a saisi avec l'indicatif (ex: +33 06...)
    if (cleanNum.startsWith('0')) {
      cleanNum = cleanNum.slice(1);
    }
    
    const cleanPrefix = countryCode.trim().replace(/\s+/g, '');
    return `${cleanPrefix}${cleanNum}`;
  };

  // 1. Envoyer le code SMS OTP
  const handleSendOTP = async () => {
    if (!phoneNumber.trim()) {
      return Alert.alert(
        i18n.t('error') || 'Erreur',
        i18n.t('invalid_phone') || 'Veuillez entrer un numéro de téléphone valide.'
      );
    }

    setLoading(true);
    const fullPhone = getFormattedPhone();

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
      });

      if (error) throw error;

      // Passage à l'étape OTP
      setStep('otp');
      setTimer(60);
    } catch (e: any) {
      console.error('❌ Erreur envoi SMS OTP:', e.message);
      Alert.alert(
        i18n.t('error') || 'Erreur',
        e.message || "Impossible d'envoyer le code SMS. Vérifiez le numéro de téléphone."
      );
    } finally {
      setLoading(false);
    }
  };

  // 2. Vérifier le code OTP
  const handleVerifyOTP = async () => {
    if (otpCode.trim().length < 6) {
      return Alert.alert(
        i18n.t('error') || 'Erreur',
        i18n.t('verification_error') || 'Veuillez saisir le code à 6 chiffres.'
      );
    }

    setLoading(true);
    const fullPhone = getFormattedPhone();

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: otpCode.trim(),
        type: 'sms',
      });

      if (error) throw error;

      if (data.session && data.user) {
        // Redirection vers confirm-email pour initialiser le profil (EULA, Pseudo...)
        safeReplace(router, '/confirm-email');
      } else {
        throw new Error("La session n'a pas pu être établie.");
      }
    } catch (e: any) {
      console.error('❌ Erreur vérification OTP:', e.message);
      Alert.alert(
        i18n.t('error') || 'Erreur',
        e.message || 'Le code saisi est invalide ou expiré.'
      );
    } finally {
      setLoading(false);
    }
  };

  // 3. Renvoyer le SMS
  const handleResendOTP = async () => {
    if (timer > 0) return;
    setLoading(true);
    const fullPhone = getFormattedPhone();

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
      });

      if (error) throw error;

      setTimer(60);
      setOtpCode('');
      Alert.alert(
        i18n.t('success') || 'Succès',
        i18n.t('code_resent') || 'Un nouveau code vous a été envoyé par SMS.'
      );
    } catch (e: any) {
      console.error('❌ Erreur renvoi OTP:', e.message);
      Alert.alert(
        i18n.t('error') || 'Erreur',
        e.message || "Échec de l'envoi du code."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        
        <View style={styles.header}>
          <Text style={styles.title}>
            {step === 'phone' 
              ? (i18n.t('phone_auth_title') || 'Votre Numéro') 
              : (i18n.t('otp_auth_title') || 'Code de Validation')}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'phone'
              ? (i18n.t('phone_auth_subtitle') || 'Saisissez votre numéro pour continuer')
              : (i18n.t('otp_auth_subtitle') || `Saisi le code envoyé au ${countryCode} ${phoneNumber}`)}
          </Text>
        </View>

        {step === 'phone' ? (
          // ÉTAPE 1 : SAISIE DU TÉLÉPHONE
          <View style={styles.form}>
            <View style={styles.phoneInputRow}>
              {/* Indicatif pays */}
              <View style={styles.countryCodeContainer}>
                <TextInput
                  value={countryCode}
                  onChangeText={setCountryCode}
                  style={styles.countryCodeInput}
                  keyboardType="phone-pad"
                  placeholder="+33"
                  maxLength={5}
                  placeholderTextColor="#999"
                />
              </View>
              {/* Numéro principal */}
              <View style={styles.mainPhoneContainer}>
                <TextInput
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  style={styles.phoneInput}
                  placeholder="6 12 34 56 78"
                  keyboardType="phone-pad"
                  placeholderTextColor="#999"
                  autoFocus
                  keyboardAppearance="light"
                />
              </View>
            </View>
            <Text style={styles.helperText}>
              {i18n.t('phone_helper') || "Un code de validation vous sera envoyé par SMS."}
            </Text>
          </View>
        ) : (
          // ÉTAPE 2 : SAISIE DU CODE OTP
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Code à 6 chiffres</Text>
              <TextInput
                value={otpCode}
                onChangeText={setOtpCode}
                style={styles.otpInput}
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                placeholderTextColor="#999"
                autoFocus
                keyboardAppearance="light"
              />
            </View>

            <View style={styles.resendContainer}>
              {timer > 0 ? (
                <Text style={styles.resendText}>
                  Renvoyer le code dans {timer}s
                </Text>
              ) : (
                <TouchableOpacity onPress={handleResendOTP}>
                  <Text style={styles.resendLink}>Renvoyer un code par SMS</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* BOUTONS D'ACTION */}
        <View style={styles.footer}>
          {loading ? (
            <ActivityIndicator size="large" color="#604a3e" style={{ marginVertical: 15 }} />
          ) : (
            <CustomButton
              title={step === 'phone' ? 'Envoyer le code' : 'Valider'}
              onPress={step === 'phone' ? handleSendOTP : handleVerifyOTP}
              color="#604a3e"
              textColor="#ebb89b"
            />
          )}

          {step === 'otp' && (
            <CustomButton
              title="Modifier le numéro"
              onPress={() => setStep('phone')}
              color="transparent"
              textColor="#604a3e"
              small
            />
          )}

          <CustomButton
            title={i18n.t('cancel') || 'Annuler'}
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
  scroll: { padding: 20, paddingBottom: 50, justifyContent: 'center', flexGrow: 1 },
  
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#604a3e', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#604a3e', opacity: 0.8, marginTop: 10, textAlign: 'center' },

  form: { marginBottom: 30 },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  countryCodeContainer: {
    width: 80,
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.2)',
  },
  countryCodeInput: {
    padding: 15,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  mainPhoneContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.2)',
  },
  phoneInput: {
    padding: 15,
    fontSize: 16,
    color: '#333',
  },
  helperText: { fontSize: 13, color: '#604a3e', marginTop: 10, opacity: 0.7, textAlign: 'center' },

  inputGroup: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#604a3e', marginBottom: 8, textAlign: 'center' },
  otpInput: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    fontSize: 22,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.2)',
    color: '#333',
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: 'bold',
  },
  resendContainer: { alignItems: 'center', marginTop: 15 },
  resendText: { color: '#604a3e', opacity: 0.6, fontSize: 14 },
  resendLink: { color: '#604a3e', fontWeight: 'bold', fontSize: 14, textDecorationLine: 'underline' },

  footer: { marginTop: 10 },
});
