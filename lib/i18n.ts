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
    tuto_notif_title: "Pas de notifications ?",
    tuto_notif_desc: "Vérifiez que les notifications sont autorisées pour l'app dans les réglages de votre téléphone.",
    tuto_sound_title: "Pas de son ?",
    tuto_sound_desc: "Vérifiez le mode silencieux et le volume des notifications.",
    tuto_1_title: "Envoyer un Prout",
    tuto_1_desc: "Pour envoyer un prout, swipez vers la droite sur le nom de votre ami ! Comme dans la vie, on ne sait pas toujours ce qui vient. Ce sera une surprise à chaque envoi !",
    tuto_2_title: "Ajouter un mot doux",
    tuto_2_desc: "Tapez le nom de votre ami pour saisir un message, puis swipez pour envoyer.",
    tuto_3_title: "Mode Zen",
    tuto_3_desc: "Besoin de calme ? Activez le mode Zen pour ne plus recevoir (ni envoyer) de prouts.",
    tuto_4_title: "Sourdine",
    tuto_4_desc: "En swipant à gauche le nom d'un contact, vous pouvez le mettre en sourdine.",

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
    tuto_notif_title: "No notifications?",
    tuto_notif_desc: "Check that app notifications are allowed in system settings.",
    tuto_sound_title: "No sound?",
    tuto_sound_desc: "Check silent mode and notification volume.",
    tuto_1_title: "Send a Fart",
    tuto_1_desc: "To send a fart, swipe right on your friend's name! Just like in real life, you never know what's going to happen! It will be a surprise every time!",
    tuto_2_title: "Add a note",
    tuto_2_desc: "Tap your friend's name to write a message, then swipe to send.",
    tuto_3_title: "Zen Mode",
    tuto_3_desc: "Need some quiet? Enable Zen Mode to stop receiving (and sending) farts.",
    tuto_4_title: "Mute",
    tuto_4_desc: "By swiping left on a contact's name, you can mute them.",

    // Network
    connection_error_title: "Connection Failed",
    connection_error_body: "Check your network.",
    connection_slow_title: "Slow Connection",
    connection_slow_body: "Unable to load friends list. Check your network.",
  },
  es: {
    // General
    ok: "OK",
    cancel: "Cancelar",
    error: "Error",
    success: "Éxito",
    loading: "Cargando...",
    back: "Volver",
    send: "Enviar",
    later: "Más tarde",
    confirm: "Confirmar",
    info: "Información",
    
    // Auth & Onboarding
    login: "Iniciar sesión",
    register: "Registrarse",
    
    // Home & Navigation
    share_message: "Únete a mí en la app \"Prout!\", mi nombre de usuario es %{pseudo}: http://theproutapp.com",
    tab_list: "Amigos",
    
    // Friends List
    friends_requests: "🔔 Solicitudes de amistad",
    identity_requests: "🕵️ Solicitudes de identidad",
    no_friends: "No hay amigos confirmados 😢",
    invite_contacts: "Invita a tus contactos.",
    delete_friend: "Eliminar",
    confirm_delete_title: "Confirmar eliminación",
    confirm_delete_body: "¿Quieres eliminar \"%{pseudo}\" de tu lista?",
    delete_impossible_contact: "Este amigo es un contacto telefónico, no se puede eliminar aquí",
    delete_impossible_title: "Eliminación imposible",
    already_asked_identity_title: "Solicitud pendiente",
    already_asked_identity_body: "Ya le preguntaste a %{pseudo}. ¿Volver a preguntar?",
    ask_identity_title: "Identidad desconocida",
    ask_identity_body: "No sabes quién es \"%{pseudo}\". ¿Pedirle que se revele?",
    ask_btn: "Preguntar",
    relaunch_btn: "Volver a preguntar",
    respond_btn: "Responder",
    friend_deleted_toast: "%{pseudo} ha sido eliminado de tu lista",
    
    // Actions Prout
    zen_mode_active_me_title: "Modo Zen Activo 🧘‍♂️",
    zen_mode_active_me_body: "No puedes hacer prout en modo Zen. Desactívalo en tu perfil para reanudar las hostilidades.",
    zen_mode_active_friend_title: "¡Chis! 🤫",
    zen_mode_active_friend_body: "%{pseudo} está en modo Zen. No se puede molestar.",
    cooldown_alert: "¡Demasiado rápido!",
    cooldown_message: "Espera un poco antes de enviar otro prout.",
    not_connected: "No estás conectado.",
    
    // Search
    search_title: "Buscar un nuevo amigo",
    search_placeholder: "Ingresa un nombre de usuario...",
    search_btn: "Buscar",
    search_subtitle: "Busca a tu amigo por nombre de usuario",
    add_btn: "Agregar",
    pending_btn: "Pendiente",
    already_friend: "Ya son amigos ✅",
    no_results: "No se encontró ningún prouteador.",
    request_sent: "¡Solicitud de amistad enviada!",
    already_linked: "Ya estás vinculado con esta persona.",
    
    // Profil
    edit_profile: "Editar perfil",
    pseudo: "Nombre de usuario",
    email: "Correo electrónico",
    phone: "Teléfono",
    update_btn: "Guardar",
    logout: "Cerrar sesión",
    logout_title: "Cerrar sesión",
    logout_confirm: "¿Realmente quieres cerrar sesión?\n\n¡Ya no recibirás prouts!",
    delete_account: "Eliminar cuenta",
    delete_account_confirm_title: "Confirmar",
    delete_account_confirm_body: "¿Estás seguro de que quieres eliminar tu cuenta? Esta acción es irreversible.",
    contact_support: "Contactar soporte",
    privacy_policy: "Política de privacidad",
    no_change: "No se detectaron cambios",
    update_success: "Éxito",
    update_success_msg: "¡%{fields} actualizado con éxito!",
    
    // Zen Mode
    zen_mode: "Modo Zen",
    zen_description: "Activa el modo Zen para dejar de recibir notificaciones (y poder enviarlas). ¡Ideal para dormir! 😴",
    zen_confirm_title: "Modo Zen 🌙",
    zen_confirm_body: "Ya no recibirás prouts y no podrás enviar ninguno.",
    activate: "Activar",
    
    // Identity Reveal
    who_are_you: "¿Quién eres? 👀",
    who_are_you_subtitle: "%{requester} quiere saber tu identidad.",
    reveal_placeholder: "Ej: Juan Pérez",
    reveal_success_title: "¡Gracias!",
    reveal_success_body: "Tu identidad ha sido compartida con tu amigo.",
    reveal_error: "No se pudo compartir tu identidad.",
    reveal_missing_id: "Falta el ID del solicitante.",
    reveal_missing_name: "Por favor indica tu nombre o un alias.",
    
    // Tuto
    tuto_header: "¿Cómo funciona?",
    tuto_notif_title: "¿No hay notificaciones?",
    tuto_notif_desc: "Verifica que las notificaciones de la app estén permitidas en la configuración de tu teléfono.",
    tuto_sound_title: "¿No hay sonido?",
    tuto_sound_desc: "Verifica el modo silencioso y el volumen de las notificaciones.",
    tuto_1_title: "Enviar un Prout",
    tuto_1_desc: "¡Para enviar un prout, desliza hacia la derecha sobre el nombre de tu amigo! Como en la vida real, nunca sabes qué va a pasar. ¡Será una sorpresa cada vez!",
    tuto_2_title: "Agregar un mensaje",
    tuto_2_desc: "Toca el nombre de tu amigo para escribir un mensaje, luego desliza para enviar.",
    tuto_3_title: "Modo Zen",
    tuto_3_desc: "¿Necesitas tranquilidad? Activa el modo Zen para dejar de recibir (y enviar) prouts.",
    tuto_4_title: "Silenciar",
    tuto_4_desc: "Deslizando hacia la izquierda el nombre de un contacto, puedes silenciarlo.",
    
    // Network
    connection_error_title: "No se pudo conectar",
    connection_error_body: "Verifica tu red.",
    connection_slow_title: "Conexión lenta",
    connection_slow_body: "No se pudo cargar la lista de amigos. Verifica tu red.",
  }
});

// Configuration
i18n.enableFallback = true;
// Récupérer la langue de l'appareil
const deviceLanguage = getLocales()[0]?.languageCode ?? 'fr';
i18n.locale = deviceLanguage;

export default i18n;




