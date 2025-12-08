import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PrivacyPolicyModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PrivacyPolicyModal({ visible, onClose }: PrivacyPolicyModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Politique de Confidentialité</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#604a3e" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.text}>
              <Text style={styles.bold}>Politique de Confidentialité de l'application Prout</Text>{'\n\n'}
              <Text style={styles.italic}>Dernière mise à jour : 8 Décembre 2025</Text>{'\n\n'}
              Bienvenue sur Prout (ci-après "l'Application"). Nous prenons la confidentialité de vos données très au sérieux. Cette politique décrit quelles données nous collectons, comment nous les utilisons et quels sont vos droits, en conformité avec le Règlement Général sur la Protection des Données (RGPD).{'\n\n'}

              <Text style={styles.sectionTitle}>1. Responsable du traitement</Text>{'\n'}
              L'Application est éditée par The Prout Corporation (ci-après "Nous"). Pour toute question relative à vos données, vous pouvez nous contacter à : hello@theproutapp.com{'\n\n'}

              <Text style={styles.sectionTitle}>2. Les données que nous collectons</Text>{'\n'}
              Nous collectons uniquement les données strictement nécessaires au fonctionnement du service d'envoi de notifications sonores entre amis.{'\n\n'}
              <Text style={styles.subTitle}>A. Données que vous nous fournissez</Text>{'\n'}
              - Pseudo (Obligatoire) : Votre nom d'utilisateur public visible par vos amis.{'\n'}
              - Adresse Email (Obligatoire) : Utilisée uniquement pour l'authentification (création de compte, connexion) et la récupération de mot de passe.{'\n'}
              - Numéro de téléphone (Optionnel) : Utilisé pour vous permettre d'être retrouvé par vos amis présents dans votre carnet de contacts.{'\n'}
              - Nom complet (Optionnel) : Si vous choisissez de le renseigner, il peut être partagé avec vos amis pour confirmer votre identité.{'\n\n'}

              <Text style={styles.subTitle}>B. Données collectées automatiquement</Text>{'\n'}
              - Identifiant de l'appareil (Device ID) et Token de Notification (Push Token) : Nécessaires pour acheminer les notifications sonores ("Prouts") sur votre téléphone via les services d'Apple (APNs) et Google (FCM).{'\n'}
              - Données techniques : Modèle de téléphone, version du système d'exploitation (iOS/Android) pour le débogage technique.{'\n\n'}

              <Text style={styles.subTitle}>C. Accès aux Contacts (Carnet d'adresses)</Text>{'\n'}
              L'Application vous demande l'autorisation d'accéder à vos contacts téléphoniques.{'\n'}
              - But : Cet accès sert uniquement à vérifier si vos contacts utilisent déjà l'Application "Prout" afin de les ajouter automatiquement à votre liste d'amis.{'\n'}
              - Confidentialité : Nous ne stockons pas votre carnet d'adresses complet sur nos serveurs. Nous envoyons les numéros de téléphone de manière sécurisée (hashée ou chiffrée lors du transit) pour effectuer une comparaison ("matching") avec notre base d'utilisateurs, puis le résultat est renvoyé. Les contacts qui n'utilisent pas l'application ne sont ni contactés, ni enregistrés.{'\n\n'}

              <Text style={styles.sectionTitle}>3. Comment nous utilisons vos données</Text>{'\n'}
              Vos données sont utilisées exclusivement pour :{'\n'}
              - Vous connecter : Gestion de votre compte sécurisé via Supabase.{'\n'}
              - Le service "Prout" : Envoyer et recevoir des notifications sonores instantanées.{'\n'}
              - La mise en relation : Vous permettre de trouver vos amis et d'être trouvé.{'\n'}
              - Le support : Répondre à vos demandes via email.{'\n'}
              Nous ne vendons, ne louons et ne partageons jamais vos données personnelles à des tiers à des fins commerciales ou publicitaires.{'\n\n'}

              <Text style={styles.sectionTitle}>4. Partage et Sous-traitants</Text>{'\n'}
              Pour faire fonctionner l'Application, nous utilisons des services tiers de confiance. Vos données peuvent transiter par leurs serveurs :{'\n'}
              - Supabase (Base de données & Auth) : Hébergement sécurisé des comptes utilisateurs.{'\n'}
              - Expo (Infrastructure mobile) : Service technique pour l'envoi des notifications Push.{'\n'}
              - Google Firebase (FCM) : Acheminement des notifications sur Android.{'\n'}
              - Apple (APNs) : Acheminement des notifications sur iOS.{'\n'}
              - Render : Hébergement de notre serveur backend.{'\n'}
              Ces prestataires sont soumis à des obligations strictes de sécurité et de confidentialité.{'\n\n'}

              <Text style={styles.sectionTitle}>5. Suppression des données et Vos Droits</Text>{'\n'}
              Conformément au RGPD, vous disposez d'un droit d'accès, de modification et de suppression de vos données.{'\n\n'}
              <Text style={styles.bold}>Comment supprimer votre compte ?</Text>{'\n'}
              Vous pouvez demander la suppression complète de votre compte et de toutes vos données associées à tout moment :{'\n'}
              - En nous envoyant un email simple à hello@theproutapp.com.{'\n'}
              - Via le bouton "Supprimer mon compte" dans les paramètres de l'Application.{'\n'}
              Une fois la demande traitée, toutes vos données (pseudo, téléphone, email, amis, historique) sont définitivement effacées de nos serveurs.{'\n\n'}

              <Text style={styles.sectionTitle}>6. Sécurité</Text>{'\n'}
              Toutes les communications entre l'Application et nos serveurs sont chiffrées (HTTPS/SSL). Vos mots de passe ne sont jamais stockés en clair, ils sont hachés et sécurisés par notre fournisseur d'authentification.{'\n\n'}

              <Text style={styles.sectionTitle}>7. Modifications</Text>{'\n'}
              Nous pouvons mettre à jour cette politique de temps à autre. La version la plus récente sera toujours disponible via l'Application ou sur notre site web.{'\n\n'}
              <Text style={styles.bold}>Contact : hello@theproutapp.com</Text>
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
    paddingTop: 50,
    paddingBottom: 50,
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#fff5eb', // Crème clair
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(96, 74, 62, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#604a3e',
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  text: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  bold: {
    fontWeight: 'bold',
  },
  italic: {
    fontStyle: 'italic',
    color: '#666',
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#604a3e',
    marginTop: 10,
    marginBottom: 5,
  },
  subTitle: {
    fontWeight: '600',
    fontSize: 15,
    color: '#604a3e',
    marginTop: 5,
    marginBottom: 2,
  },
});

