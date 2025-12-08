import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';

const i18n = new I18n({
  fr: {
    // Général
    ok: "OK",
    cancel: "Annuler",
    error: "Erreur",
    success: "Succès",
    loading: "Chargement...",
    back: "Retour",
    send: "Envoyer",
    later: "Plus tard",
    confirm: "Confirmer",
    info: "Information",
    
    // Auth & Onboarding
    login: "Se connecter",
    register: "S'inscrire",
    
    // Home & Navigation
    share_message: "Rejoins-moi sur l'appli \"Prout !\", mon pseudo est %{pseudo} : http://theproutapp.com",
    tab_list: "Amis",
    
    // Friends List
    friends_requests: "🔔 Demandes d'amis",
    identity_requests: "🕵️ Demandes d'identité",
    no_friends: "Aucun ami confirmé 😢",
    invite_contacts: "Invitez vos contacts.",
    delete_friend: "Supprimer",
    confirm_delete_title: "Confirmer la suppression",
    confirm_delete_body: "Voulez-vous supprimer \"%{pseudo}\" de votre liste ?",
    delete_impossible_contact: "Cet ami est un contact par téléphone, il ne peut pas être supprimé ici",
    delete_impossible_title: "Suppression impossible",
    already_asked_identity_title: "Demande en attente",
    already_asked_identity_body: "Tu as déjà demandé à %{pseudo}. Relancer la demande ?",
    ask_identity_title: "Identité inconnue",
    ask_identity_body: "Tu ne sais pas qui est \"%{pseudo}\". Lui demander de se dévoiler ?",
    ask_btn: "Demander",
    relaunch_btn: "Relancer",
    respond_btn: "Répondre",
    friend_deleted_toast: "%{pseudo} a été supprimé de votre liste",
    
    // Actions Prout
    zen_mode_active_me_title: "Mode Zen Actif 🧘‍♂️",
    zen_mode_active_me_body: "Vous ne pouvez pas prouter en mode Zen. Désactivez-le dans votre profil pour reprendre les hostilités.",
    zen_mode_active_friend_title: "Chut ! 🤫",
    zen_mode_active_friend_body: "%{pseudo} est en mode Zen. Impossible de le déranger.",
    cooldown_alert: "Trop rapide !",
    cooldown_message: "Attendez un peu avant d'envoyer un autre prout.",
    not_connected: "Vous n'êtes pas connecté.",
    
    // Search
    search_title: "Rechercher un nouvel ami",
    search_placeholder: "Entrez un pseudo...",
    search_btn: "Rechercher",
    search_subtitle: "Recherchez votre ami avec son pseudo",
    add_btn: "Ajouter",
    pending_btn: "En attente",
    already_friend: "Déjà ami ✅",
    no_results: "Aucun prouteur trouvé.",
    request_sent: "Demande d'ami envoyée !",
    already_linked: "Vous êtes déjà en lien avec cette personne.",
    
    // Profil
    edit_profile: "Modifier votre profil",
    pseudo: "Pseudo",
    email: "Email",
    phone: "Téléphone",
    update_btn: "Enregistrer",
    logout: "Se déconnecter",
    logout_title: "Déconnexion",
    logout_confirm: "Voulez-vous vraiment vous déconnecter ?\n\nVous ne recevrez plus de prouts !",
    delete_account: "Supprimer le compte",
    delete_account_confirm_title: "Confirmer",
    delete_account_confirm_body: "Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.",
    contact_support: "Contacter le support",
    privacy_policy: "Politique de confidentialité",
    no_change: "Aucun changement détecté",
    update_success: "Succès",
    update_success_msg: "%{fields} mis à jour avec succès !",
    
    // Zen Mode
    zen_mode: "Mode Zen",
    zen_description: "Activez le mode Zen pour ne plus recevoir de notifications (ni pouvoir en envoyer). Idéal pour dormir ! 😴",
    zen_confirm_title: "Mode Zen 🌙",
    zen_confirm_body: "Vous ne recevrez plus de prouts, et ne pourrez plus en envoyer.",
    activate: "Activer",
    
    // Identity Reveal
    who_are_you: "Qui es-tu ? 👀",
    who_are_you_subtitle: "%{requester} souhaite connaître ton identité.",
    reveal_placeholder: "Ex: Michel Dupont",
    reveal_success_title: "Merci !",
    reveal_success_body: "Ton identité a été partagée avec ton ami.",
    reveal_error: "Impossible de partager ton identité.",
    reveal_missing_id: "Identifiant du demandeur manquant.",
    reveal_missing_name: "Merci d’indiquer votre nom ou un alias.",
    
    // Tuto
    tuto_header: "Comment ça marche ?",
    tuto_1_title: "Envoyer un Prout",
    tuto_1_desc: "Pour envoyer un prout, swipez vers la droite sur le nom de votre ami !",
    tuto_2_title: "Identité Secrète",
    tuto_2_desc: "Si vous voulez vérifier l’identité de votre ami, appuyez 2 secondes sur son pseudo.",
    tuto_3_title: "Supprimer un Ami",
    tuto_3_desc: "Un ami un peu trop envahissant ? Vous pouvez le supprimer de la liste avec un swipe vers la gauche.",
    tuto_4_title: "Mode Zen",
    tuto_4_desc: "Besoin de calme ? Vous pouvez utiliser le mode Zen pour ne plus recevoir de prouts. Vous ne pourrez pas en envoyer non plus.",

    // Network
    connection_error_title: "Impossible de se connecter",
    connection_error_body: "Vérifiez votre réseau.",
    connection_slow_title: "Connexion lente",
    connection_slow_body: "Impossible de charger la liste d'amis. Vérifiez votre réseau.",
  },
  en: {
    // General
    ok: "OK",
    cancel: "Cancel",
    error: "Error",
    success: "Success",
    loading: "Loading...",
    back: "Back",
    send: "Send",
    later: "Later",
    confirm: "Confirm",
    info: "Info",
    
    // Auth & Onboarding
    login: "Log In",
    register: "Sign Up",
    
    // Home & Navigation
    share_message: "Join me on \"Prout App\", my username is %{pseudo}: http://theproutapp.com",
    tab_list: "Friends",
    
    // Friends List
    friends_requests: "🔔 Friend Requests",
    identity_requests: "🕵️ Identity Requests",
    no_friends: "No confirmed friends 😢",
    invite_contacts: "Invite your contacts.",
    delete_friend: "Delete",
    confirm_delete_title: "Confirm deletion",
    confirm_delete_body: "Do you want to remove \"%{pseudo}\" from your list?",
    delete_impossible_contact: "This friend is a phone contact, they cannot be deleted here",
    delete_impossible_title: "Deletion impossible",
    already_asked_identity_title: "Request pending",
    already_asked_identity_body: "You already asked %{pseudo}. Ask again?",
    ask_identity_title: "Unknown Identity",
    ask_identity_body: "You don't know who \"%{pseudo}\" is. Ask them to reveal themselves?",
    ask_btn: "Ask",
    relaunch_btn: "Ask again",
    respond_btn: "Reply",
    friend_deleted_toast: "%{pseudo} has been removed from your list",
    
    // Actions Prout
    zen_mode_active_me_title: "Zen Mode Active 🧘‍♂️",
    zen_mode_active_me_body: "You cannot fart in Zen mode. Disable it in your profile to resume hostilities.",
    zen_mode_active_friend_title: "Hush! 🤫",
    zen_mode_active_friend_body: "%{pseudo} is in Zen mode. Cannot disturb them.",
    cooldown_alert: "Too fast!",
    cooldown_message: "Wait a bit before sending another fart.",
    not_connected: "You are not connected.",
    
    // Search
    search_title: "Find a new friend",
    search_placeholder: "Enter a username...",
    search_btn: "Search",
    search_subtitle: "Search for your friend by username",
    add_btn: "Add",
    pending_btn: "Pending",
    already_friend: "Already friends ✅",
    no_results: "No farter found.",
    request_sent: "Friend request sent!",
    already_linked: "You are already linked with this person.",
    
    // Profil
    edit_profile: "Edit Profile",
    pseudo: "Username",
    email: "Email",
    phone: "Phone",
    update_btn: "Save",
    logout: "Log Out",
    logout_title: "Log Out",
    logout_confirm: "Do you really want to log out?\n\nYou won't receive farts anymore!",
    delete_account: "Delete Account",
    delete_account_confirm_title: "Confirm",
    delete_account_confirm_body: "Are you sure you want to delete your account? This action is irreversible.",
    contact_support: "Contact Support",
    privacy_policy: "Privacy Policy",
    no_change: "No changes detected",
    update_success: "Success",
    update_success_msg: "%{fields} updated successfully!",
    
    // Zen Mode
    zen_mode: "Zen Mode",
    zen_description: "Enable Zen Mode to stop receiving notifications (and sending them). Ideal for sleeping! 😴",
    zen_confirm_title: "Zen Mode 🌙",
    zen_confirm_body: "You will no longer receive farts, and won't be able to send any.",
    activate: "Activate",
    
    // Identity Reveal
    who_are_you: "Who are you? 👀",
    who_are_you_subtitle: "%{requester} wants to know who you are.",
    reveal_placeholder: "Ex: John Doe",
    reveal_success_title: "Thanks!",
    reveal_success_body: "Your identity has been shared with your friend.",
    reveal_error: "Unable to share your identity.",
    reveal_missing_id: "Requester ID missing.",
    reveal_missing_name: "Please enter your name or an alias.",
    
    // Tuto
    tuto_header: "How it works?",
    tuto_1_title: "Send a Fart",
    tuto_1_desc: "To send a fart, swipe right on your friend's name!",
    tuto_2_title: "Secret Identity",
    tuto_2_desc: "If you want to verify a friend's identity, long press on their username.",
    tuto_3_title: "Delete a Friend",
    tuto_3_desc: "A friend too annoying? You can remove them from the list with a left swipe.",
    tuto_4_title: "Zen Mode",
    tuto_4_desc: "Need some quiet? You can use Zen Mode to stop receiving farts. You won't be able to send any either.",

    // Network
    connection_error_title: "Connection Failed",
    connection_error_body: "Check your network.",
    connection_slow_title: "Slow Connection",
    connection_slow_body: "Unable to load friends list. Check your network.",
  }
});

// Configuration
i18n.enableFallback = true;
// Récupérer la langue de l'appareil
const deviceLanguage = getLocales()[0]?.languageCode ?? 'fr';
i18n.locale = deviceLanguage;

export default i18n;

