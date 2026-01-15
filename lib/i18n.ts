import { getLocales, getCalendars } from 'expo-localization';
import { I18n } from 'i18n-js';
import { Platform } from 'react-native';

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
    
    // Prout Names
    prout_names: {
      prout1: "La Petite Bourrasque",
      prout2: "Le Crépitant",
      prout3: "Le Rebond du Tonnerre",
      prout4: "Le Faux Départ",
      prout5: "Le Frelon Trébuchant",
      prout6: "Le Kraken Douillet",
      prout7: "La Farandole",
      prout8: "Le Question Réponse",
      prout9: "Le Oulala… Problème",
      prout10: "Kebab Party !",
      prout11: "La Mitraille Molle",
      prout12: "La Rafale Infernale",
      prout13: "Le Lâché Prise",
      prout14: "Le Basson Dubitatif",
      prout15: "La Fantaisie de Minuit",
      prout16: "Le Marmiton Furieux",
      prout17: "L'Éclair Fromager",
      prout18: "L'Impromptu",
      prout19: "Le Tuba Chaotique",
      prout20: "L'Eternel",
      'identity-request': "Demande d'identité",
      'identity-response': "Réponse d'identité",
    },
    
    // Auth & Onboarding
    welcome: "Bienvenue !",
    continue_with_social: "Continuer avec Google ou Apple",
    signup_with_email: "S'inscrire avec un Email",
    or: "OU",
    login: "Se connecter",
    login_title: "Connexion",
    logging_in: "Connexion...",
    register: "S'inscrire",
    no_account_signup: "Pas de compte ? S'inscrire",
    forgot_password: "Mot de passe oublié ?",
    password_label: "Mot de passe",
    
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
    identity_request_sent: "Demande d'identité envoyée",
    friend_deleted_toast: "%{pseudo} a été supprimé de votre liste",
    
    // Actions Prout
    zen_mode_active_me_title: "Mode Zen Actif 🧘‍♂️",
    zen_mode_active_me_body: "Vous ne pouvez pas prouter en mode Zen. Désactivez-le dans votre profil pour reprendre les hostilités.",
    zen_mode_active_friend_title: "Chut ! 🤫",
    zen_mode_active_friend_body: "%{pseudo} est en mode Zen. Impossible de le déranger.",
    mute_mode_active_title: "Mode sourdine actif",
    mute_mode_active_body: "%{pseudo} vous a mis en sourdine. Vous ne pouvez pas lui envoyer de message.",
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
    privacy_policy_title: "Politique de Confidentialité",
    privacy_policy_app_title: "Politique de Confidentialité de l'application Prout",
    privacy_policy_last_update: "Dernière mise à jour : 8 Décembre 2025",
    privacy_policy_intro: "Bienvenue sur Prout (ci-après \"l'Application\"). Nous prenons la confidentialité de vos données très au sérieux. Cette politique décrit quelles données nous collectons, comment nous les utilisons et quels sont vos droits, en conformité avec le Règlement Général sur la Protection des Données (RGPD).",
    privacy_policy_section1_title: "1. Responsable du traitement",
    privacy_policy_section1_content: "L'Application est éditée par The Prout Corporation (ci-après \"Nous\"). Pour toute question relative à vos données, vous pouvez nous contacter à : hello@theproutapp.com",
    privacy_policy_section2_title: "2. Les données que nous collectons",
    privacy_policy_section2_intro: "Nous collectons uniquement les données strictement nécessaires au fonctionnement du service d'envoi de notifications sonores entre amis.",
    privacy_policy_section2a_title: "A. Données que vous nous fournissez",
    privacy_policy_section2a_content: "- Pseudo (Obligatoire) : Votre nom d'utilisateur public visible par vos amis.\n- Adresse Email (Obligatoire) : Utilisée uniquement pour l'authentification (création de compte, connexion) et la récupération de mot de passe.\n- Numéro de téléphone (Optionnel) : Utilisé pour vous permettre d'être retrouvé par vos amis présents dans votre carnet de contacts.\n- Nom complet (Optionnel) : Si vous choisissez de le renseigner, il peut être partagé avec vos amis pour confirmer votre identité.",
    privacy_policy_section2b_title: "B. Données collectées automatiquement",
    privacy_policy_section2b_content: "- Identifiant de l'appareil (Device ID) et Token de Notification (Push Token) : Nécessaires pour acheminer les notifications sonores (\"Prouts\") sur votre téléphone via les services d'Apple (APNs) et Google (FCM).\n- Données techniques : Modèle de téléphone, version du système d'exploitation (iOS/Android) pour le débogage technique.",
    privacy_policy_section2c_title: "C. Accès aux Contacts (Carnet d'adresses)",
    privacy_policy_section2c_content: "L'Application vous demande l'autorisation d'accéder à vos contacts téléphoniques.\n- But : Cet accès sert uniquement à vérifier si vos contacts utilisent déjà l'Application \"Prout\" afin de les ajouter automatiquement à votre liste d'amis.\n- Confidentialité : Nous ne stockons pas votre carnet d'adresses complet sur nos serveurs. Nous envoyons les numéros de téléphone de manière sécurisée (hashée ou chiffrée lors du transit) pour effectuer une comparaison (\"matching\") avec notre base d'utilisateurs, puis le résultat est renvoyé. Les contacts qui n'utilisent pas l'application ne sont ni contactés, ni enregistrés.",
    privacy_policy_section3_title: "3. Comment nous utilisons vos données",
    privacy_policy_section3_content: "Vos données sont utilisées exclusivement pour :\n- Vous connecter : Gestion de votre compte sécurisé via Supabase.\n- Le service \"Prout\" : Envoyer et recevoir des notifications sonores instantanées.\n- La mise en relation : Vous permettre de trouver vos amis et d'être trouvé.\n- Le support : Répondre à vos demandes via email.\nNous ne vendons, ne louons et ne partageons jamais vos données personnelles à des tiers à des fins commerciales ou publicitaires.",
    privacy_policy_section4_title: "4. Partage et Sous-traitants",
    privacy_policy_section4_content: "Pour faire fonctionner l'Application, nous utilisons des services tiers de confiance. Vos données peuvent transiter par leurs serveurs :\n- Supabase (Base de données & Auth) : Hébergement sécurisé des comptes utilisateurs.\n- Expo (Infrastructure mobile) : Service technique pour l'envoi des notifications Push.\n- Google Firebase (FCM) : Acheminement des notifications sur Android.\n- Apple (APNs) : Acheminement des notifications sur iOS.\n- Render : Hébergement de notre serveur backend.\nCes prestataires sont soumis à des obligations strictes de sécurité et de confidentialité.",
    privacy_policy_section5_title: "5. Suppression des données et Vos Droits",
    privacy_policy_section5_intro: "Conformément au RGPD, vous disposez d'un droit d'accès, de modification et de suppression de vos données.",
    privacy_policy_section5_how_to_delete: "Comment supprimer votre compte ?",
    privacy_policy_section5_delete_content: "Vous pouvez demander la suppression complète de votre compte et de toutes vos données associées à tout moment :\n- En nous envoyant un email simple à hello@theproutapp.com.\n- Via le bouton \"Supprimer mon compte\" dans les paramètres de l'Application.\nUne fois la demande traitée, toutes vos données (pseudo, téléphone, email, amis, historique) sont définitivement effacées de nos serveurs.",
    privacy_policy_section6_title: "6. Sécurité",
    privacy_policy_section6_content: "Toutes les communications entre l'Application et nos serveurs sont chiffrées (HTTPS/SSL). Vos mots de passe ne sont jamais stockés en clair, ils sont hachés et sécurisés par notre fournisseur d'authentification.",
    privacy_policy_section7_title: "7. Modifications",
    privacy_policy_section7_content: "Nous pouvons mettre à jour cette politique de temps à autre. La version la plus récente sera toujours disponible via l'Application ou sur notre site web.",
    privacy_policy_contact: "Contact : hello@theproutapp.com",
    no_change: "Aucun changement détecté",
    update_success: "Succès",
    update_success_msg: "%{fields} mis à jour avec succès !",
    
    // Zen Mode
    zen_mode: "Mode Zen",
    zen_description: "Activez le mode Zen pour ne plus recevoir de notifications (ni pouvoir en envoyer). Idéal pour dormir ! 😴",
    zen_confirm_title: "Mode Zen 🌙",
    zen_confirm_body: "Vous ne recevrez plus de prouts, et ne pourrez plus en envoyer.",
    activate: "Activer",
    
    // Silent Mode
    silent_mode: "Envois silencieux",
    silent_mode_title: "Envois silencieux 🤫",
    silent_mode_description: "Pour envoyer vos prouts en toute discrétion !",
    
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
    tuto_2_desc: "Cliquer sur le nom de votre ami pour ajouter un message, puis swiper le nom.",
    tuto_3_title: "Mode Zen",
    tuto_3_desc: "Besoin de calme ? Activez le mode Zen pour ne plus recevoir (ni envoyer) de prouts.",
    tuto_silent_title: "Envois silencieux",
    tuto_silent_desc: "Vous pouvez activer ce mode pour envoyer vos prouts en toute discrétion !",
    tuto_4_title: "Sourdine",
    tuto_4_desc: "En swipant à gauche le nom d'un contact, vous pouvez le mettre en sourdine.",
    
    // Onboarding
    onboarding_welcome_title: "Bienvenue sur Prout !",
    onboarding_welcome_subtitle: "",
    onboarding_welcome_desc: "L'appli de notification de prout.",
    onboarding_notifications_title: "Le cœur du Prout",
    onboarding_notifications_desc: "Tout l'intérêt réside dans la surprise ! Acceptez les notifications pour recevoir les prouts de vos amis.",
    onboarding_sound_title: "Montez le volume",
    onboarding_sound_desc: "Pensez à vérifier que vous avez le son activé (et pas en silencieux) pour profiter de la mélodie.",
    onboarding_gesture_title: "À vous de jouer",
    onboarding_gesture_desc: "Dès que vous avez un ami, swipez simplement sur son nom vers la droite pour lui envoyer un prout. Surprise garantie !",
    onboarding_message_title: "Message éphémère",
    onboarding_message_desc: "Vous pouvez ajouter un message éphémère en cliquant sur le nom de votre ami avant d'envoyer le prout !",
    onboarding_skip: "Passer",
    onboarding_start: "C'est parti !",
    
    // Common UI
    greeting: "Bonjour",
    profile_title: "Profil",
    not_defined: "Non défini",
    delete_or_mute: "Supprimer / Sourdine",
    settings: "Réglages",
    add_message_placeholder: "Ajoutez un message ?",
    pseudo_placeholder: "Ex: CaptainProut",
    email_placeholder: "exemple@email.com",
    phone_format_placeholder: "06 12 34 56 78",
    
    // Footer & Help
    footer_help_text: "Swipez vers la droite pour envoyer un prout, cliquez avant de swiper pour ajouter un message !",
    
    // Notifications & Errors
    notifications_not_enabled: "%{pseudo} n'a pas activé les notifications. Le token n'est pas disponible dans la base de données.",
    app_uninstalled: "%{pseudo} n'a plus l'application installée !",
    silent_notifications_warning: "Vos notifications sont silencieuses !",
    
    // Identity Reveal
    identity_revealed_title: "Identité révélée",
    identity_revealed_body: "Ton ami a partagé son identité.",
    
    // Zen Mode Options
    choose_duration: "Choisissez une durée",
    zen_job_label: "Save my job ! (9h-19h, lun-ven)",
    zen_night_label: "Save my night ! (22h-8h)",
    zen_job_short: "Save my job !",
    zen_night_short: "Save my night !",
    
    // Menu Items
    search_friend: "Rechercher un ami",
    manage_profile: "Gérer votre profil",
    invite_friend: "Inviter un ami",
    review_app_functions: "Revoir les fonctions de l'appli",
    who_is_who: "Qui est qui ? Vérifiez les pseudos",
    privacy_policy_menu: "Politique de confidentialité",

    // Logout & Account
    logout_success_title: "Déconnexion réussie",
    logout_success_body: "Vous ne recevrez plus de prout !",
    logout_disconnect: "Se déconnecter",
    cannot_logout: "Impossible de se déconnecter",
    logout_error: "Une erreur est survenue lors de la déconnexion",
    cannot_retrieve_account: "Impossible de récupérer votre compte",
    cannot_load_profile: "Impossible de charger votre profil",
    not_defined_phone: "Non renseigné",
    
    // Password Reset
    reset_link_invalid: "Ce lien de réinitialisation est invalide ou a expiré. Veuillez demander un nouveau lien.",
    cannot_verify_session: "Impossible de vérifier votre session. Veuillez réessayer.",
    password_min_length: "Le mot de passe doit contenir au moins 6 caractères",
    passwords_do_not_match: "Les mots de passe ne correspondent pas",
    password_reset_success_title: "Succès ✅",
    password_reset_success_body: "Votre mot de passe a été réinitialisé avec succès !",
    reset_error: "Impossible de réinitialiser le mot de passe",
    resetting: "Réinitialisation...",
    reset_password: "Réinitialiser le mot de passe",
    password_placeholder: "6 caractères minimum",
    repeat_password_placeholder: "Répétez le mot de passe",
    verifying_link: "Vérification du lien...",
    choose_secure_password: "Choisissez un nouveau mot de passe sécurisé",
    new_password: "Nouveau mot de passe",
    confirm_password: "Confirmer le mot de passe",
    back_to_login: "Retour à la connexion",
    invalid_email_format: "Veuillez entrer un email valide",
    reset_email_error: "Une erreur est survenue lors de l'envoi de l'email",
    
    // Email Confirmation
    verifying_profile: "Vérification du profil...",
    finalizing_connection: "Finalisation de la connexion...",
    
    // Registration
    account_created_title: "Compte créé ! 📬",
    account_created_body: "Un email de confirmation vient d'être envoyé.\nCliquez sur le lien reçu pour activer votre compte.",
    creating_account: "Création en cours...",
    sign_up: "S'inscrire",
    security: "Sécurité",
    
    // Search & Invitations
    already_linked_info: "Vous êtes déjà en lien avec cette personne.",
    request_sent_success: "Demande d'ami envoyée !",
    invitation_already_accepted: "Cette invitation a déjà été acceptée",
    invitation_accepted: "Invitation acceptée !",
    invitation_rejected: "Invitation rejetée",
    invitation_sent: "Invitation envoyée !",
    already_friend_info: "Cette personne est déjà votre ami",
    invitation_pending_info: "Une invitation est déjà en attente",
    cannot_verify_relation: "Impossible de vérifier la relation existante",
    cannot_create_invitation: "Impossible de créer l'invitation",
    cannot_reject_invitation: "Impossible de rejeter l'invitation",
    relation_exists: "Une relation existe déjà avec cette personne",
    invalid_phone: "Numéro de téléphone invalide",
    friendship_created: "Amitié créée avec succès ! La relation est maintenant mutuelle.",
    cannot_create_friendship: "Impossible de créer l'amitié",
    unknown_error: "Erreur inconnue",
    friend_or_invitation_exists: "Cette personne est déjà votre ami ou une invitation est en cours",
    unknown_user: "Utilisateur inconnu",
    invited_you: "vous a invité",
    reject_invitation_confirm: "Êtes-vous sûr de vouloir rejeter cette invitation ?",
    reject: "Rejeter",
    accept: "Accepter",
    contacts_access_required: "L'accès aux contacts est nécessaire pour inviter vos amis.",
    contacts_access_required_later: "L'accès aux contacts est nécessaire pour que l'application fonctionne. Vous pourrez l'activer plus tard dans les paramètres.",
    pending_invitations_title: "Invitations en attente de validation",
    loading_invitations: "Chargement des invitations...",
    no_pending_invitations: "Aucune invitation en attente",
    invite_from_contacts: "Inviter depuis les contacts",
    select_contact: "Sélectionnez un contact",
    no_contact_found: "Aucun contact trouvé",
    search_contact_placeholder: "Rechercher un contact...",
    no_farter_found: "Aucun prouteur trouvé.",
    already_friend_status: "Déjà ami ✅",
    create_account_title: "Créer un compte",
    join_community: "Rejoignez la communauté du bruit !",
    pseudo_label: "Pseudo",
    email_label: "Email",
    phone_label: "Téléphone",
    password_label_form: "Mot de passe",
    required: "*",
    optional: "(Facultatif)",
    validation_link_sent: "Un lien de validation vous sera envoyé.",
    phone_helper: "Permet à vos amis de vous retrouver plus facilement.",
    cancel_and_logout: "Annuler et se déconnecter",
    cancel_and_return: "Annuler et Retour",
    update_button: "Mise à jour",
    no_friends_identity: "Aucun ami encore. Ajoutez des amis pour demander leur identité.",
    
    // Profile Edit
    change_pseudo_confirm: "Voulez-vous changer votre pseudo de \"%{current}\" à \"%{new}\" ?",
    set_email_confirm: "Voulez-vous définir votre email à \"%{email}\" ?\n\nActuellement, vous utilisez un email temporaire.",
    change_email_confirm: "Voulez-vous changer votre email de \"%{current}\" à \"%{new}\" ?",
    change_phone_confirm: "Voulez-vous changer votre numéro de téléphone de \"%{current}\" à \"%{new}\" ?",
    phone_placeholder: "Téléphone",
    cannot_be_empty: "Le pseudo ne peut pas être vide",
    invalid_email: "Veuillez entrer un email réel valide (pas un email temporaire)",
    phone_min_digits: "Le numéro de téléphone doit contenir au moins 8 chiffres",
    cannot_check_pseudo: "Impossible de vérifier la disponibilité du pseudo",
    pseudo_already_used: "Ce pseudo est déjà utilisé par un autre utilisateur",
    email_already_used: "Cet email est déjà utilisé par un autre compte",
    fields_updated_success: "%{fields} mis à jour avec succès",
    email_confirmation_sent: "Un email de confirmation a été envoyé.",
    account_deleted_success: "Votre compte a été supprimé avec succès.",
    cannot_update_profile: "Impossible de mettre à jour le profil",
    cannot_activate_mute: "Impossible d'activer la sourdine.",
    cannot_disable_mute: "Impossible de désactiver la sourdine.",
    exit_mute_mode_title: "Quitter le mode sourdine ?",
    exit_mute_mode_body: "Voulez-vous quitter le mode sourdine pour %{pseudo} ?",
    cannot_delete_friend: "Impossible de supprimer cet ami",
    cannot_send_request: "Impossible d'envoyer la demande.",
    cannot_retrieve_pseudo: "Impossible de récupérer votre pseudo. Veuillez réessayer.",
    pseudo_not_defined: "Votre pseudo n'est pas défini. Veuillez compléter votre profil.",
    backend_error_ios: "Erreur serveur. Le backend ne peut pas traiter ce type de token.\n\nVérifiez que le backend est configuré pour iOS (Expo Push).",
    pseudo_updated_success: "Pseudo mis à jour avec succès !",
    phone_updated_success: "Numéro de téléphone mis à jour avec succès !",
    pseudo_identical: "Le pseudo est identique à l'actuel",
    email_identical: "L'email est identique à l'actuel",
    phone_identical: "Le numéro de téléphone est identique à l'actuel",
    enter_new_phone: "Veuillez entrer un nouveau numéro de téléphone",
    enter_new_pseudo: "Veuillez entrer un nouveau pseudo",
    enter_new_email: "Veuillez entrer un nouvel email",
    verification_error: "Une erreur est survenue lors de la vérification",
    account_deleted_title: "Compte supprimé",
    cannot_identify_account: "Impossible d'identifier votre compte",
    error_occurred: "Une erreur est survenue",
    error_occurred_deletion: "Une erreur est survenue lors de la suppression du compte",
    cannot_delete_account_support: "Impossible de supprimer le compte. Veuillez contacter le support.",
    cannot_find_invitation: "Impossible de trouver l'invitation",
    cannot_accept_invitation: "Impossible d'accepter l'invitation",
    cannot_accept_request: "Impossible d'accepter la demande",
    cannot_load_contacts: "Impossible de charger les contacts",
    enter_value: "Veuillez entrer une valeur",
    invalid_email_simple: "Email invalide",
    cannot_add_friend: "Impossible d'ajouter cet ami",
    choose_pseudo: "Choisis un pseudo !",
    cannot_open_email_app: "Impossible d'ouvrir l'application email. Email: %{email}",
    cannot_connect_apple: "Impossible de se connecter avec Apple",
    apple_error: "Erreur Apple",
    google_error: "Erreur Google",
    web_notifications_unavailable: "Les notifications push ne sont pas disponibles sur le web.",
    create_profile_info: "Pour créer un profil, utilisez la page d'inscription qui crée automatiquement le compte auth et le profil.",
    
    // Auth Choice
    already_have_account: "J'ai déjà un compte (Email)",
    
    // Invitation Share
    invite_message_with_pseudo: "Rejoins-moi sur l'appli \"Prout !\", mon pseudo est %{pseudo}\n\nTéléchargez l'appli : http://www.theproutapp.com",
    invite_message: "Rejoins-moi sur l'appli \"Prout !\"\n\nTéléchargez l'appli : http://www.theproutapp.com",
    
    // Login
    session_invalid: "Session invalide après connexion",
    connection_error: "Une erreur est survenue lors de la connexion",
    cannot_reset_temp_email: "Impossible de réinitialiser le mot de passe avec un email temporaire.\n\nVeuillez contacter le support.",
    email_required_title: "Email requis",
    email_required_body: "Veuillez d'abord entrer votre email dans le champ ci-dessus.",
    email_not_found_title: "Email non trouvé",
    email_not_found_body: "Aucun compte n'est associé à cet email. Vérifiez votre adresse email.",
    too_many_requests: "Vous avez fait trop de demandes. Veuillez patienter quelques minutes avant de réessayer.",
    cannot_send_reset_email: "Impossible d'envoyer l'email de réinitialisation",
    reset_email_sent_title: "Email envoyé 📧",
    reset_email_sent_body: "Un email de réinitialisation a été envoyé à votre adresse.\n\nVérifiez votre boîte de réception (et vos spams) et suivez les instructions pour réinitialiser votre mot de passe.",
    
    // Notifications Permission
    push_not_available_web: "Les notifications push ne sont pas disponibles sur le web.",
    push_requires_device: "Les notifications push nécessitent un appareil réel. Les simulateurs ne peuvent pas obtenir de token.",
    push_requires_dev_build: "Les notifications push nécessitent un development build. Expo Go ne les supporte pas.",
    permission_denied_title: "Permission refusée",
    permission_denied_body: "Les notifications push nécessitent la permission de notifications. Vous pourrez l'activer plus tard dans les paramètres.",
    notification_permission_title: "Autorisation de notifications",
    notification_permission_message: "Prout est une application de notifications. Pour recevoir et envoyer des prouts à vos amis, vous devez autoriser les notifications.",
    accept_notifications_message: "Acceptez les notifications pour jouer le jeu ! 😊",
    authorize_notifications: "Autoriser les notifications",
    
    // Contact Permission
    contact_permission_title: "Ça reste en nous !",
    contact_permission_message: "Cette appli synchronise vos contacts (noms et numéros) vers nos serveurs Supabase (utfwujyymaikraaigvuv.supabase.co) pour trouver vos amis et créer les liens. Aucune autre utilisation ni partage externe. Acceptez-vous cette synchronisation ?",
    contact_consent_title: "Contacts : utilisation et partage",
    contact_consent_message: "Cette appli synchronise vos contacts (numéros et noms) vers nos serveurs Supabase (https://utfwujyymaikraaigvuv.supabase.co) pour trouver vos amis et créer les liens d'amitié. Aucune autre utilisation ni partage externe.\n\nAcceptez-vous cette synchronisation ?",
    refuse: "Refuser",
    next: "Suivant",
    
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
    
    // Prout Names
    prout_names: {
      prout1: "The Little Gust",
      prout2: "The Crackling",
      prout3: "The Thunder Bounce",
      prout4: "The False Start",
      prout5: "The Stumbling Hornet",
      prout6: "The Cuddly Kraken",
      prout7: "The Farandole",
      prout8: "The Question Answer",
      prout9: "The Oops... Problem",
      prout10: "Kebab Party!",
      prout11: "The Soft Machine Gun",
      prout12: "The Infernal Burst",
      prout13: "The Let Go",
      prout14: "The Doubtful Bassoon",
      prout15: "The Midnight Fantasy",
      prout16: "The Furious Cook",
      prout17: "The Cheesy Lightning",
      prout18: "The Impromptu",
      prout19: "The Chaotic Tuba",
      prout20: "The Eternal",
      'identity-request': "Identity request",
      'identity-response': "Identity answer",
    },
    
    // Auth & Onboarding
    welcome: "Welcome!",
    continue_with_social: "Continue with Google or Apple",
    signup_with_email: "Sign up with Email",
    or: "OR",
    login: "Log In",
    login_title: "Login",
    logging_in: "Logging in...",
    register: "Sign Up",
    no_account_signup: "No account? Sign Up",
    forgot_password: "Forgot password?",
    password_label: "Password",
    
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
    identity_request_sent: "Identity request sent",
    friend_deleted_toast: "%{pseudo} has been removed from your list",
    
    // Actions Prout
    zen_mode_active_me_title: "Zen Mode Active 🧘‍♂️",
    zen_mode_active_me_body: "You cannot fart in Zen mode. Disable it in your profile to resume hostilities.",
    zen_mode_active_friend_title: "Hush! 🤫",
    zen_mode_active_friend_body: "%{pseudo} is in Zen mode. Cannot disturb them.",
    mute_mode_active_title: "Mute mode active",
    mute_mode_active_body: "%{pseudo} has muted you. You cannot send them a message.",
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
    cannot_identify_account: "Unable to identify your account",
    error_occurred: "An error occurred",
    error_occurred_deletion: "An error occurred while deleting the account",
    cannot_delete_account_support: "Unable to delete account. Please contact support.",
    cannot_find_invitation: "Unable to find the invitation",
    cannot_accept_invitation: "Unable to accept the invitation",
    cannot_accept_request: "Unable to accept the request",
    cannot_load_contacts: "Unable to load contacts",
    enter_value: "Please enter a value",
    invalid_email_simple: "Invalid email",
    cannot_add_friend: "Unable to add this friend",
    choose_pseudo: "Choose a pseudo!",
    cannot_open_email_app: "Unable to open email app. Email: %{email}",
    cannot_connect_apple: "Unable to sign in with Apple",
    apple_error: "Apple Error",
    web_notifications_unavailable: "Push notifications are not available on the web.",
    create_profile_info: "To create a profile, use the registration page which automatically creates the auth account and profile.",
    contact_support: "Contact Support",
    privacy_policy: "Privacy Policy",
    privacy_policy_title: "Privacy Policy",
    privacy_policy_app_title: "Privacy Policy of the Prout application",
    privacy_policy_last_update: "Last updated: December 8, 2025",
    privacy_policy_intro: "Welcome to Prout (hereinafter \"the Application\"). We take the privacy of your data very seriously. This policy describes what data we collect, how we use it, and what your rights are, in compliance with the General Data Protection Regulation (GDPR).",
    privacy_policy_section1_title: "1. Data Controller",
    privacy_policy_section1_content: "The Application is published by The Prout Corporation (hereinafter \"We\"). For any questions regarding your data, you can contact us at: hello@theproutapp.com",
    privacy_policy_section2_title: "2. Data We Collect",
    privacy_policy_section2_intro: "We collect only the data strictly necessary for the operation of the sound notification service between friends.",
    privacy_policy_section2a_title: "A. Data You Provide",
    privacy_policy_section2a_content: "- Username (Required): Your public username visible to your friends.\n- Email Address (Required): Used only for authentication (account creation, login) and password recovery.\n- Phone Number (Optional): Used to allow you to be found by your friends in your contact list.\n- Full Name (Optional): If you choose to provide it, it may be shared with your friends to confirm your identity.",
    privacy_policy_section2b_title: "B. Automatically Collected Data",
    privacy_policy_section2b_content: "- Device ID and Push Notification Token: Necessary to route sound notifications (\"Farts\") to your phone via Apple (APNs) and Google (FCM) services.\n- Technical Data: Phone model, operating system version (iOS/Android) for technical debugging.",
    privacy_policy_section2c_title: "C. Contact Access (Address Book)",
    privacy_policy_section2c_content: "The Application requests permission to access your phone contacts.\n- Purpose: This access is used solely to check if your contacts already use the \"Prout\" Application to automatically add them to your friends list.\n- Privacy: We do not store your complete address book on our servers. We send phone numbers securely (hashed or encrypted in transit) to perform a comparison (\"matching\") with our user database, then the result is returned. Contacts who do not use the application are neither contacted nor recorded.",
    privacy_policy_section3_title: "3. How We Use Your Data",
    privacy_policy_section3_content: "Your data is used exclusively for:\n- Logging in: Management of your secure account via Supabase.\n- The \"Prout\" service: Sending and receiving instant sound notifications.\n- Matching: Allowing you to find your friends and be found.\n- Support: Responding to your requests via email.\nWe never sell, rent, or share your personal data with third parties for commercial or advertising purposes.",
    privacy_policy_section4_title: "4. Sharing and Subcontractors",
    privacy_policy_section4_content: "To operate the Application, we use trusted third-party services. Your data may transit through their servers:\n- Supabase (Database & Auth): Secure hosting of user accounts.\n- Expo (Mobile Infrastructure): Technical service for sending Push notifications.\n- Google Firebase (FCM): Routing notifications on Android.\n- Apple (APNs): Routing notifications on iOS.\n- Render: Hosting of our backend server.\nThese providers are subject to strict security and confidentiality obligations.",
    privacy_policy_section5_title: "5. Data Deletion and Your Rights",
    privacy_policy_section5_intro: "In accordance with GDPR, you have the right to access, modify, and delete your data.",
    privacy_policy_section5_how_to_delete: "How to delete your account?",
    privacy_policy_section5_delete_content: "You can request the complete deletion of your account and all associated data at any time:\n- By sending us a simple email to hello@theproutapp.com.\n- Via the \"Delete my account\" button in the Application settings.\nOnce the request is processed, all your data (username, phone, email, friends, history) is permanently erased from our servers.",
    privacy_policy_section6_title: "6. Security",
    privacy_policy_section6_content: "All communications between the Application and our servers are encrypted (HTTPS/SSL). Your passwords are never stored in plain text, they are hashed and secured by our authentication provider.",
    privacy_policy_section7_title: "7. Modifications",
    privacy_policy_section7_content: "We may update this policy from time to time. The most recent version will always be available via the Application or on our website.",
    privacy_policy_contact: "Contact: hello@theproutapp.com",
    no_change: "No changes detected",
    update_success: "Success",
    update_success_msg: "%{fields} updated successfully!",
    
    // Zen Mode
    zen_mode: "Zen Mode",
    zen_description: "Enable Zen Mode to stop receiving notifications (and sending them). Ideal for sleeping! 😴",
    zen_confirm_title: "Zen Mode 🌙",
    zen_confirm_body: "You will no longer receive farts, and won't be able to send any.",
    activate: "Activate",
    
    // Silent Mode
    silent_mode: "Silent sends",
    silent_mode_title: "Silent sends 🤫",
    silent_mode_description: "To send your farts discreetly!",
    
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
    tuto_2_desc: "Tap your friend's name to add a message, then swipe the name, or long-press the gas!",
    tuto_3_title: "Zen Mode",
    tuto_3_desc: "Need some quiet? Enable Zen Mode to stop receiving (and sending) farts.",
    tuto_silent_title: "Silent sends",
    tuto_silent_desc: "You can enable this mode to send your farts discreetly!",
    tuto_4_title: "Mute",
    tuto_4_desc: "By swiping left on a contact's name, you can mute them.",
    
    // Onboarding
    onboarding_welcome_title: "Welcome",
    onboarding_welcome_subtitle: "Prout ! The Art of French Fart",
    onboarding_welcome_desc: "The fart notification app.",
    onboarding_notifications_title: "The Heart of Prout",
    onboarding_notifications_desc: "The whole point is the surprise! Accept notifications to receive farts from your friends.",
    onboarding_sound_title: "Turn up the volume",
    onboarding_sound_desc: "Make sure you have sound enabled (and not on silent) to enjoy the melody.",
    onboarding_gesture_title: "Your turn",
    onboarding_gesture_desc: "Once you have a friend, simply swipe right on their name to send them a fart. Guaranteed surprise!",
    onboarding_message_title: "Ephemeral message",
    onboarding_message_desc: "You can add an ephemeral message by clicking on your friend's name before sending the fart!",
    onboarding_skip: "Skip",
    onboarding_start: "Let's go!",
    
    // Common UI
    greeting: "Hello",
    profile_title: "Profile",
    not_defined: "Not defined",
    delete_or_mute: "Delete / Mute",
    settings: "Settings",
    add_message_placeholder: "Add a message?",
    pseudo_placeholder: "Ex: CaptainProut",
    email_placeholder: "example@email.com",
    phone_format_placeholder: "+1 234 567 8900",
    
    // Footer & Help
    footer_help_text: "Swipe right to send a fart, tap before swiping to add a message!",
    
    // Notifications & Errors
    notifications_not_enabled: "%{pseudo} has not enabled notifications. The token is not available in the database.",
    app_uninstalled: "%{pseudo} no longer has the app installed!",
    silent_notifications_warning: "Your notifications are silent!",
    
    // Identity Reveal
    identity_revealed_title: "Identity revealed",
    identity_revealed_body: "Your friend has shared their identity.",
    
    // Zen Mode Options
    choose_duration: "Choose a duration",
    zen_job_label: "Save my job ! (9am-7pm, Mon-Fri)",
    zen_night_label: "Save my night ! (10pm-8am)",
    zen_job_short: "Save my job !",
    zen_night_short: "Save my night !",
    
    // Menu Items
    search_friend: "Find a friend",
    manage_profile: "Manage your profile",
    invite_friend: "Invite a friend",
    review_app_functions: "Review app features",
    who_is_who: "Who is who? Check usernames",
    privacy_policy_menu: "Privacy Policy",

    // Logout & Account
    logout_success_title: "Logout successful",
    logout_success_body: "You won't receive farts anymore!",
    logout_disconnect: "Log Out",
    cannot_logout: "Unable to log out",
    logout_error: "An error occurred during logout",
    cannot_retrieve_account: "Unable to retrieve your account",
    cannot_load_profile: "Unable to load your profile",
    not_defined_phone: "Not provided",
    
    // Password Reset
    reset_link_invalid: "This reset link is invalid or has expired. Please request a new link.",
    cannot_verify_session: "Unable to verify your session. Please try again.",
    password_min_length: "Password must be at least 6 characters",
    passwords_do_not_match: "Passwords do not match",
    password_reset_success_title: "Success ✅",
    password_reset_success_body: "Your password has been reset successfully!",
    reset_error: "Unable to reset password",
    resetting: "Resetting...",
    reset_password: "Reset Password",
    password_placeholder: "6 characters minimum",
    repeat_password_placeholder: "Repeat password",
    verifying_link: "Verifying link...",
    choose_secure_password: "Choose a new secure password",
    new_password: "New password",
    confirm_password: "Confirm password",
    back_to_login: "Back to login",
    invalid_email_format: "Please enter a valid email",
    reset_email_error: "An error occurred while sending the email",
    
    // Email Confirmation
    verifying_profile: "Verifying profile...",
    finalizing_connection: "Finalizing connection...",
    
    // Registration
    account_created_title: "Account created! 📬",
    account_created_body: "A confirmation email has been sent.\nClick on the link received to activate your account.",
    creating_account: "Creating...",
    sign_up: "Sign Up",
    security: "Security",
    
    // Search & Invitations
    already_linked_info: "You are already linked with this person.",
    request_sent_success: "Friend request sent!",
    invitation_already_accepted: "This invitation has already been accepted",
    invitation_accepted: "Invitation accepted!",
    invitation_rejected: "Invitation rejected",
    invitation_sent: "Invitation sent!",
    already_friend_info: "This person is already your friend",
    invitation_pending_info: "An invitation is already pending",
    cannot_verify_relation: "Unable to verify existing relation",
    cannot_create_invitation: "Unable to create invitation",
    cannot_reject_invitation: "Unable to reject invitation",
    relation_exists: "A relation already exists with this person",
    invalid_phone: "Invalid phone number",
    friendship_created: "Friendship created successfully! The relation is now mutual.",
    cannot_create_friendship: "Unable to create friendship",
    unknown_error: "Unknown error",
    friend_or_invitation_exists: "This person is already your friend or an invitation is pending",
    unknown_user: "Unknown user",
    invited_you: "invited you",
    reject_invitation_confirm: "Are you sure you want to reject this invitation?",
    reject: "Reject",
    accept: "Accept",
    contacts_access_required: "Contacts access is required to invite your friends.",
    contacts_access_required_later: "Contacts access is required for the app to work. You can enable it later in settings.",
    pending_invitations_title: "Pending invitations",
    loading_invitations: "Loading invitations...",
    no_pending_invitations: "No pending invitations",
    invite_from_contacts: "Invite from contacts",
    select_contact: "Select a contact",
    no_contact_found: "No contact found",
    search_contact_placeholder: "Search a contact...",
    no_farter_found: "No farter found.",
    already_friend_status: "Already friends ✅",
    create_account_title: "Create Account",
    join_community: "Join the noise community!",
    pseudo_label: "Username",
    email_label: "Email",
    phone_label: "Phone",
    password_label_form: "Password",
    required: "*",
    optional: "(Optional)",
    validation_link_sent: "A validation link will be sent to you.",
    phone_helper: "Allows your friends to find you more easily.",
    cancel_and_logout: "Cancel and log out",
    cancel_and_return: "Cancel and Return",
    update_button: "Update",
    no_friends_identity: "No friends yet. Add friends to request their identity.",
    
    // Profile Edit
    change_pseudo_confirm: "Do you want to change your username from \"%{current}\" to \"%{new}\"?",
    set_email_confirm: "Do you want to set your email to \"%{email}\"?\n\nCurrently, you are using a temporary email.",
    change_email_confirm: "Do you want to change your email from \"%{current}\" to \"%{new}\"?",
    change_phone_confirm: "Do you want to change your phone number from \"%{current}\" to \"%{new}\"?",
    phone_placeholder: "Phone",
    cannot_be_empty: "Username cannot be empty",
    invalid_email: "Please enter a valid real email (not a temporary email)",
    phone_min_digits: "Phone number must contain at least 8 digits",
    cannot_check_pseudo: "Unable to check username availability",
    pseudo_already_used: "This username is already used by another user",
    email_already_used: "This email is already used by another account",
    fields_updated_success: "%{fields} updated successfully",
    email_confirmation_sent: "A confirmation email has been sent.",
    account_deleted_success: "Your account has been deleted successfully.",
    cannot_update_profile: "Unable to update profile",
    cannot_activate_mute: "Unable to activate mute.",
    cannot_disable_mute: "Unable to disable mute.",
    exit_mute_mode_title: "Exit mute mode?",
    exit_mute_mode_body: "Do you want to exit mute mode for %{pseudo}?",
    cannot_delete_friend: "Unable to delete this friend",
    cannot_send_request: "Unable to send the request.",
    cannot_retrieve_pseudo: "Unable to retrieve your username. Please try again.",
    pseudo_not_defined: "Your username is not defined. Please complete your profile.",
    backend_error_ios: "Server error. The backend cannot process this type of token.\n\nCheck that the backend is configured for iOS (Expo Push).",
    pseudo_updated_success: "Username updated successfully!",
    phone_updated_success: "Phone number updated successfully!",
    pseudo_identical: "Username is identical to current",
    email_identical: "Email is identical to current",
    phone_identical: "Phone number is identical to current",
    enter_new_phone: "Please enter a new phone number",
    verification_error: "An error occurred during verification",
    account_deleted_title: "Account deleted",
    
    // Auth Choice
    already_have_account: "I already have an account (Email)",
    
    // Invitation Share
    invite_message_with_pseudo: "Join me on the \"Prout!\" app, my username is %{pseudo}\n\nDownload the app: http://www.theproutapp.com",
    invite_message: "Join me on the \"Prout!\" app\n\nDownload the app: http://www.theproutapp.com",
    
    // Login
    session_invalid: "Invalid session after login",
    connection_error: "An error occurred during login",
    cannot_reset_temp_email: "Cannot reset password with a temporary email.\n\nPlease contact support.",
    email_required_title: "Email required",
    email_required_body: "Please enter your email in the field above first.",
    email_not_found_title: "Email not found",
    email_not_found_body: "No account is associated with this email. Check your email address.",
    too_many_requests: "You have made too many requests. Please wait a few minutes before trying again.",
    cannot_send_reset_email: "Unable to send reset email",
    reset_email_sent_title: "Email sent 📧",
    reset_email_sent_body: "A reset email has been sent to your address.\n\nCheck your inbox (and spam) and follow the instructions to reset your password.",
    
    // Notifications Permission
    push_not_available_web: "Push notifications are not available on the web.",
    push_requires_device: "Push notifications require a real device. Simulators cannot get a token.",
    push_requires_dev_build: "Push notifications require a development build. Expo Go does not support them.",
    permission_denied_title: "Permission denied",
    permission_denied_body: "Push notifications require notification permission. You can enable it later in settings.",
    notification_permission_title: "Notification Authorization",
    notification_permission_message: "Prout is a notification app. To receive and send farts to your friends, you must authorize notifications.",
    accept_notifications_message: "Accept notifications to play the game! 😊",
    authorize_notifications: "Authorize notifications",
    
    // Contact Permission
    contact_permission_title: "It stays with us!",
    contact_permission_message: "This app syncs your contacts (names and numbers) to our Supabase servers (utfwujyymaikraaigvuv.supabase.co) to find your friends and create links. No other use or external sharing. Do you accept this sync?",
    contact_consent_title: "Contacts: use and sharing",
    contact_consent_message: "This app syncs your contacts (numbers and names) to our Supabase servers (https://utfwujyymaikraaigvuv.supabase.co) to find your friends and create friendship links. No other use or external sharing.\n\nDo you accept this sync?",
    refuse: "Refuse",
    next: "Next",
    
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
    
    // Prout Names
    prout_names: {
      prout1: "La Pequeña Ráfaga",
      prout2: "El Crepitante",
      prout3: "El Rebote del Trueno",
      prout4: "La Falsa Salida",
      prout5: "El Avispón Tropezón",
      prout6: "El Kraken Tierno",
      prout7: "La Farándula",
      prout8: "La Pregunta Respuesta",
      prout9: "El Oops... Problema",
      prout10: "Fiesta Kebab",
      prout11: "La Ametralladora Blanda",
      prout12: "La Ráfaga Infernal",
      prout13: "El Dejar Ir",
      prout14: "El Fagot Dudoso",
      prout15: "La Fantasía de Medianoche",
      prout16: "El Cocinero Furioso",
      prout17: "El Relámpago Quesoso",
      prout18: "El Improvisado",
      prout19: "La Tuba Caótica",
      prout20: "El Eterno",
      'identity-request': "Solicitud de identidad",
      'identity-response': "Respuesta de identidad",
    },
    
    // Auth & Onboarding
    welcome: "¡Bienvenido!",
    continue_with_social: "Continuar con Google o Apple",
    signup_with_email: "Registrarse con Email",
    or: "O",
    login: "Iniciar sesión",
    login_title: "Iniciar sesión",
    logging_in: "Iniciando sesión...",
    register: "Registrarse",
    no_account_signup: "¿No tienes cuenta? Regístrate",
    forgot_password: "¿Olvidaste tu contraseña?",
    password_label: "Contraseña",
    
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
    identity_request_sent: "Solicitud de identidad enviada",
    friend_deleted_toast: "%{pseudo} ha sido eliminado de tu lista",
    
    // Actions Prout
    zen_mode_active_me_title: "Modo Zen Activo 🧘‍♂️",
    zen_mode_active_me_body: "No puedes hacer prout en modo Zen. Desactívalo en tu perfil para reanudar las hostilidades.",
    zen_mode_active_friend_title: "¡Chis! 🤫",
    zen_mode_active_friend_body: "%{pseudo} está en modo Zen. No se puede molestar.",
    mute_mode_active_title: "Modo silencioso activo",
    mute_mode_active_body: "%{pseudo} te ha silenciado. No puedes enviarle un mensaje.",
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
    cannot_identify_account: "No se puede identificar tu cuenta",
    error_occurred: "Ocurrió un error",
    error_occurred_deletion: "Ocurrió un error al eliminar la cuenta",
    cannot_delete_account_support: "No se puede eliminar la cuenta. Por favor contacta al soporte.",
    cannot_find_invitation: "No se puede encontrar la invitación",
    cannot_accept_invitation: "No se puede aceptar la invitación",
    cannot_accept_request: "No se puede aceptar la solicitud",
    cannot_load_contacts: "No se pueden cargar los contactos",
    enter_value: "Por favor ingresa un valor",
    invalid_email_simple: "Email inválido",
    cannot_add_friend: "No se puede agregar este amigo",
    choose_pseudo: "¡Elige un pseudo!",
    cannot_open_email_app: "No se puede abrir la aplicación de email. Email: %{email}",
    cannot_connect_apple: "No se puede conectar con Apple",
    apple_error: "Error de Apple",
    google_error: "Error de Google",
    web_notifications_unavailable: "Las notificaciones push no están disponibles en la web.",
    create_profile_info: "Para crear un perfil, usa la página de registro que crea automáticamente la cuenta de autenticación y el perfil.",
    contact_support: "Contactar soporte",
    privacy_policy: "Política de privacidad",
    privacy_policy_title: "Política de Privacidad",
    privacy_policy_app_title: "Política de Privacidad de la aplicación Prout",
    privacy_policy_last_update: "Última actualización: 8 de Diciembre de 2025",
    privacy_policy_intro: "Bienvenido a Prout (en adelante \"la Aplicación\"). Nos tomamos muy en serio la privacidad de tus datos. Esta política describe qué datos recopilamos, cómo los utilizamos y cuáles son tus derechos, en cumplimiento del Reglamento General de Protección de Datos (RGPD).",
    privacy_policy_section1_title: "1. Responsable del tratamiento",
    privacy_policy_section1_content: "La Aplicación es editada por The Prout Corporation (en adelante \"Nosotros\"). Para cualquier pregunta relacionada con tus datos, puedes contactarnos en: hello@theproutapp.com",
    privacy_policy_section2_title: "2. Los datos que recopilamos",
    privacy_policy_section2_intro: "Recopilamos únicamente los datos estrictamente necesarios para el funcionamiento del servicio de envío de notificaciones sonoras entre amigos.",
    privacy_policy_section2a_title: "A. Datos que nos proporcionas",
    privacy_policy_section2a_content: "- Nombre de usuario (Obligatorio): Tu nombre de usuario público visible para tus amigos.\n- Dirección de correo electrónico (Obligatorio): Utilizada únicamente para la autenticación (creación de cuenta, inicio de sesión) y la recuperación de contraseña.\n- Número de teléfono (Opcional): Utilizado para permitir que tus amigos te encuentren en tu libreta de contactos.\n- Nombre completo (Opcional): Si decides proporcionarlo, puede ser compartido con tus amigos para confirmar tu identidad.",
    privacy_policy_section2b_title: "B. Datos recopilados automáticamente",
    privacy_policy_section2b_content: "- Identificador del dispositivo (Device ID) y Token de Notificación (Push Token): Necesarios para enrutar las notificaciones sonoras (\"Prouts\") a tu teléfono a través de los servicios de Apple (APNs) y Google (FCM).\n- Datos técnicos: Modelo de teléfono, versión del sistema operativo (iOS/Android) para depuración técnica.",
    privacy_policy_section2c_title: "C. Acceso a Contactos (Libreta de direcciones)",
    privacy_policy_section2c_content: "La Aplicación solicita permiso para acceder a tus contactos telefónicos.\n- Propósito: Este acceso se utiliza únicamente para verificar si tus contactos ya utilizan la Aplicación \"Prout\" para agregarlos automáticamente a tu lista de amigos.\n- Privacidad: No almacenamos tu libreta de direcciones completa en nuestros servidores. Enviamos los números de teléfono de forma segura (hasheados o cifrados durante el tránsito) para realizar una comparación (\"matching\") con nuestra base de datos de usuarios, luego se devuelve el resultado. Los contactos que no utilizan la aplicación no son contactados ni registrados.",
    privacy_policy_section3_title: "3. Cómo utilizamos tus datos",
    privacy_policy_section3_content: "Tus datos se utilizan exclusivamente para:\n- Iniciar sesión: Gestión de tu cuenta segura a través de Supabase.\n- El servicio \"Prout\": Enviar y recibir notificaciones sonoras instantáneas.\n- La conexión: Permitirte encontrar a tus amigos y ser encontrado.\n- El soporte: Responder a tus solicitudes por correo electrónico.\nNunca vendemos, alquilamos ni compartimos tus datos personales con terceros con fines comerciales o publicitarios.",
    privacy_policy_section4_title: "4. Compartir y Subcontratistas",
    privacy_policy_section4_content: "Para hacer funcionar la Aplicación, utilizamos servicios de terceros de confianza. Tus datos pueden transitar por sus servidores:\n- Supabase (Base de datos y Auth): Alojamiento seguro de cuentas de usuario.\n- Expo (Infraestructura móvil): Servicio técnico para el envío de notificaciones Push.\n- Google Firebase (FCM): Enrutamiento de notificaciones en Android.\n- Apple (APNs): Enrutamiento de notificaciones en iOS.\n- Render: Alojamiento de nuestro servidor backend.\nEstos proveedores están sujetos a obligaciones estrictas de seguridad y confidencialidad.",
    privacy_policy_section5_title: "5. Eliminación de datos y Tus Derechos",
    privacy_policy_section5_intro: "De acuerdo con el RGPD, tienes derecho a acceder, modificar y eliminar tus datos.",
    privacy_policy_section5_how_to_delete: "¿Cómo eliminar tu cuenta?",
    privacy_policy_section5_delete_content: "Puedes solicitar la eliminación completa de tu cuenta y todos los datos asociados en cualquier momento:\n- Enviándonos un correo electrónico simple a hello@theproutapp.com.\n- A través del botón \"Eliminar mi cuenta\" en la configuración de la Aplicación.\nUna vez procesada la solicitud, todos tus datos (nombre de usuario, teléfono, correo electrónico, amigos, historial) se eliminan permanentemente de nuestros servidores.",
    privacy_policy_section6_title: "6. Seguridad",
    privacy_policy_section6_content: "Todas las comunicaciones entre la Aplicación y nuestros servidores están cifradas (HTTPS/SSL). Tus contraseñas nunca se almacenan en texto plano, están hasheadas y aseguradas por nuestro proveedor de autenticación.",
    privacy_policy_section7_title: "7. Modificaciones",
    privacy_policy_section7_content: "Podemos actualizar esta política de vez en cuando. La versión más reciente estará siempre disponible a través de la Aplicación o en nuestro sitio web.",
    privacy_policy_contact: "Contacto: hello@theproutapp.com",
    no_change: "No se detectaron cambios",
    update_success: "Éxito",
    update_success_msg: "¡%{fields} actualizado con éxito!",
    
    // Zen Mode
    zen_mode: "Modo Zen",
    zen_description: "Activa el modo Zen para dejar de recibir notificaciones (y poder enviarlas). ¡Ideal para dormir! 😴",
    zen_confirm_title: "Modo Zen 🌙",
    zen_confirm_body: "Ya no recibirás prouts y no podrás enviar ninguno.",
    activate: "Activar",
    
    // Silent Mode
    silent_mode: "Envíos silenciosos",
    silent_mode_title: "Envíos silenciosos 🤫",
    silent_mode_description: "¡Para enviar tus prouts con total discreción!",
    
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
    tuto_2_desc: "Toca el nombre de tu amigo para agregar un mensaje, luego desliza el nombre o mantén pulsado el gas.",
    tuto_3_title: "Modo Zen",
    tuto_3_desc: "¿Necesitas tranquilidad? Activa el modo Zen para dejar de recibir (y enviar) prouts.",
    tuto_silent_title: "Envíos silenciosos",
    tuto_silent_desc: "¡Puedes activar este modo para enviar tus prouts con total discreción!",
    tuto_4_title: "Silenciar",
    tuto_4_desc: "Deslizando hacia la izquierda el nombre de un contacto, puedes silenciarlo.",
    
    // Onboarding
    onboarding_welcome_title: "Bienvenido",
    onboarding_welcome_subtitle: "Prout ! El arte del pedo a la francesa",
    onboarding_welcome_desc: "La app de notificaciones de prout.",
    onboarding_notifications_title: "El corazón del Prout",
    onboarding_notifications_desc: "¡Todo el interés está en la sorpresa! Acepta las notificaciones para recibir prouts de tus amigos.",
    onboarding_sound_title: "Sube el volumen",
    onboarding_sound_desc: "Asegúrate de tener el sonido activado (y no en silencioso) para disfrutar de la melodía.",
    onboarding_gesture_title: "A ti te toca",
    onboarding_gesture_desc: "Una vez que tengas un amigo, simplemente desliza hacia la derecha sobre su nombre para enviarle un prout. ¡Sorpresa garantizada!",
    onboarding_message_title: "Mensaje efímero",
    onboarding_message_desc: "¡Puedes agregar un mensaje efímero haciendo clic en el nombre de tu amigo antes de enviar el prout!",
    onboarding_skip: "Omitir",
    onboarding_start: "¡Vamos!",
    
    // Common UI
    greeting: "Hola",
    profile_title: "Perfil",
    not_defined: "No definido",
    delete_or_mute: "Eliminar / Silenciar",
    settings: "Configuración",
    add_message_placeholder: "¿Agregar un mensaje?",
    pseudo_placeholder: "Ej: CaptainProut",
    email_placeholder: "ejemplo@email.com",
    phone_format_placeholder: "+34 612 34 56 78",
    
    // Footer & Help
    footer_help_text: "Desliza hacia la derecha para enviar un prout, toca antes de deslizar para agregar un mensaje!",
    
    // Notifications & Errors
    notifications_not_enabled: "%{pseudo} no ha activado las notificaciones. El token no está disponible en la base de datos.",
    app_uninstalled: "%{pseudo} ya no tiene la aplicación instalada!",
    silent_notifications_warning: "¡Tus notificaciones están silenciosas!",
    
    // Identity Reveal
    identity_revealed_title: "Identidad revelada",
    identity_revealed_body: "Tu amigo ha compartido su identidad.",
    
    // Zen Mode Options
    choose_duration: "Elige una duración",
    zen_job_label: "¡Salva mi trabajo! (9h-19h, lun-vie)",
    zen_night_label: "¡Salva mi noche! (22h-8h)",
    zen_job_short: "¡Salva mi trabajo!",
    zen_night_short: "¡Salva mi noche!",
    
    // Menu Items
    search_friend: "Buscar un amigo",
    manage_profile: "Gestiona tu perfil",
    invite_friend: "Invitar un amigo",
    review_app_functions: "Revisar funciones de la app",
    who_is_who: "¿Quién es quién? Verifica los nombres de usuario",
    privacy_policy_menu: "Política de privacidad",
    
    // Logout & Account
    logout_success_title: "Desconexión exitosa",
    logout_success_body: "¡Ya no recibirás prouts!",
    logout_disconnect: "Cerrar sesión",
    cannot_logout: "No se puede cerrar sesión",
    logout_error: "Ocurrió un error durante la desconexión",
    cannot_retrieve_account: "No se puede recuperar tu cuenta",
    cannot_load_profile: "No se puede cargar tu perfil",
    not_defined_phone: "No proporcionado",
    
    // Password Reset
    reset_link_invalid: "Este enlace de restablecimiento es inválido o ha expirado. Por favor solicita un nuevo enlace.",
    cannot_verify_session: "No se puede verificar tu sesión. Por favor intenta de nuevo.",
    password_min_length: "La contraseña debe tener al menos 6 caracteres",
    passwords_do_not_match: "Las contraseñas no coinciden",
    password_reset_success_title: "Éxito ✅",
    password_reset_success_body: "¡Tu contraseña ha sido restablecida con éxito!",
    reset_error: "No se puede restablecer la contraseña",
    resetting: "Restableciendo...",
    reset_password: "Restablecer contraseña",
    password_placeholder: "6 caracteres mínimo",
    repeat_password_placeholder: "Repite la contraseña",
    verifying_link: "Verificando enlace...",
    choose_secure_password: "Elige una nueva contraseña segura",
    new_password: "Nueva contraseña",
    confirm_password: "Confirmar contraseña",
    back_to_login: "Volver al inicio de sesión",
    invalid_email_format: "Por favor ingresa un email válido",
    reset_email_error: "Ocurrió un error al enviar el email",
    
    // Email Confirmation
    verifying_profile: "Verificando perfil...",
    finalizing_connection: "Finalizando conexión...",
    
    // Registration
    account_created_title: "¡Cuenta creada! 📬",
    account_created_body: "Se ha enviado un email de confirmación.\nHaz clic en el enlace recibido para activar tu cuenta.",
    creating_account: "Creando...",
    sign_up: "Registrarse",
    security: "Seguridad",
    
    // Search & Invitations
    already_linked_info: "Ya estás vinculado con esta persona.",
    request_sent_success: "¡Solicitud de amistad enviada!",
    invitation_already_accepted: "Esta invitación ya ha sido aceptada",
    invitation_accepted: "¡Invitación aceptada!",
    invitation_rejected: "Invitación rechazada",
    invitation_sent: "¡Invitación enviada!",
    already_friend_info: "Esta persona ya es tu amigo",
    invitation_pending_info: "Ya hay una invitación pendiente",
    cannot_verify_relation: "No se puede verificar la relación existente",
    cannot_create_invitation: "No se puede crear la invitación",
    cannot_reject_invitation: "No se puede rechazar la invitación",
    relation_exists: "Ya existe una relación con esta persona",
    invalid_phone: "Número de teléfono inválido",
    friendship_created: "¡Amistad creada con éxito! La relación ahora es mutua.",
    cannot_create_friendship: "No se puede crear la amistad",
    unknown_error: "Error desconocido",
    friend_or_invitation_exists: "Esta persona ya es tu amigo o hay una invitación pendiente",
    unknown_user: "Usuario desconocido",
    invited_you: "te invitó",
    reject_invitation_confirm: "¿Estás seguro de que quieres rechazar esta invitación?",
    reject: "Rechazar",
    accept: "Aceptar",
    contacts_access_required: "Se requiere acceso a contactos para invitar a tus amigos.",
    contacts_access_required_later: "Se requiere acceso a contactos para que la aplicación funcione. Puedes activarlo más tarde en la configuración.",
    pending_invitations_title: "Invitaciones pendientes de validación",
    loading_invitations: "Cargando invitaciones...",
    no_pending_invitations: "No hay invitaciones pendientes",
    invite_from_contacts: "Invitar desde contactos",
    select_contact: "Selecciona un contacto",
    no_contact_found: "No se encontró ningún contacto",
    search_contact_placeholder: "Buscar un contacto...",
    no_farter_found: "No se encontró ningún prouteador.",
    already_friend_status: "Ya son amigos ✅",
    create_account_title: "Crear cuenta",
    join_community: "¡Únete a la comunidad del ruido!",
    pseudo_label: "Nombre de usuario",
    email_label: "Correo electrónico",
    phone_label: "Teléfono",
    password_label_form: "Contraseña",
    required: "*",
    optional: "(Opcional)",
    validation_link_sent: "Se te enviará un enlace de validación.",
    phone_helper: "Permite que tus amigos te encuentren más fácilmente.",
    cancel_and_logout: "Cancelar y cerrar sesión",
    cancel_and_return: "Cancelar y Volver",
    update_button: "Actualizar",
    no_friends_identity: "Aún no hay amigos. Agrega amigos para solicitar su identidad.",
    
    // Profile Edit
    change_pseudo_confirm: "¿Quieres cambiar tu nombre de usuario de \"%{current}\" a \"%{new}\"?",
    set_email_confirm: "¿Quieres establecer tu email a \"%{email}\"?\n\nActualmente estás usando un email temporal.",
    change_email_confirm: "¿Quieres cambiar tu email de \"%{current}\" a \"%{new}\"?",
    change_phone_confirm: "¿Quieres cambiar tu número de teléfono de \"%{current}\" a \"%{new}\"?",
    phone_placeholder: "Teléfono",
    cannot_be_empty: "El nombre de usuario no puede estar vacío",
    invalid_email: "Por favor ingresa un email real válido (no un email temporal)",
    phone_min_digits: "El número de teléfono debe contener al menos 8 dígitos",
    cannot_check_pseudo: "No se puede verificar la disponibilidad del nombre de usuario",
    pseudo_already_used: "Este nombre de usuario ya está siendo usado por otro usuario",
    email_already_used: "Este email ya está siendo usado por otra cuenta",
    fields_updated_success: "%{fields} actualizado con éxito",
    email_confirmation_sent: "Se ha enviado un email de confirmación.",
    account_deleted_success: "Tu cuenta ha sido eliminada con éxito.",
    cannot_update_profile: "No se puede actualizar el perfil",
    cannot_activate_mute: "No se puede activar el silencio.",
    cannot_disable_mute: "No se puede desactivar el silencio.",
    exit_mute_mode_title: "¿Salir del modo silencioso?",
    exit_mute_mode_body: "¿Quieres salir del modo silencioso para %{pseudo}?",
    cannot_delete_friend: "No se puede eliminar este amigo",
    cannot_send_request: "No se puede enviar la solicitud.",
    cannot_retrieve_pseudo: "No se puede recuperar tu nombre de usuario. Por favor intenta de nuevo.",
    pseudo_not_defined: "Tu nombre de usuario no está definido. Por favor completa tu perfil.",
    backend_error_ios: "Error del servidor. El backend no puede procesar este tipo de token.\n\nVerifica que el backend esté configurado para iOS (Expo Push).",
    pseudo_updated_success: "¡Nombre de usuario actualizado con éxito!",
    phone_updated_success: "¡Número de teléfono actualizado con éxito!",
    pseudo_identical: "El nombre de usuario es idéntico al actual",
    email_identical: "El email es idéntico al actual",
    phone_identical: "El número de teléfono es idéntico al actual",
    enter_new_phone: "Por favor ingresa un nuevo número de teléfono",
    enter_new_pseudo: "Por favor ingresa un nuevo pseudo",
    enter_new_email: "Por favor ingresa un nuevo email",
    verification_error: "Ocurrió un error durante la verificación",
    account_deleted_title: "Cuenta eliminada",
    
    // Auth Choice
    already_have_account: "Ya tengo una cuenta (Email)",
    
    // Invitation Share
    invite_message_with_pseudo: "Únete a mí en la app \"Prout!\", mi nombre de usuario es %{pseudo}\n\nDescarga la app: http://www.theproutapp.com",
    invite_message: "Únete a mí en la app \"Prout!\"\n\nDescarga la app: http://www.theproutapp.com",
    
    // Login
    session_invalid: "Sesión inválida después del inicio de sesión",
    connection_error: "Ocurrió un error durante el inicio de sesión",
    cannot_reset_temp_email: "No se puede restablecer la contraseña con un email temporal.\n\nPor favor contacta al soporte.",
    email_required_title: "Email requerido",
    email_required_body: "Por favor ingresa tu email en el campo de arriba primero.",
    email_not_found_title: "Email no encontrado",
    email_not_found_body: "No hay cuenta asociada con este email. Verifica tu dirección de email.",
    too_many_requests: "Has hecho demasiadas solicitudes. Por favor espera unos minutos antes de intentar de nuevo.",
    cannot_send_reset_email: "No se puede enviar el email de restablecimiento",
    reset_email_sent_title: "Email enviado 📧",
    reset_email_sent_body: "Se ha enviado un email de restablecimiento a tu dirección.\n\nVerifica tu bandeja de entrada (y spam) y sigue las instrucciones para restablecer tu contraseña.",
    
    // Notifications Permission
    push_not_available_web: "Las notificaciones push no están disponibles en la web.",
    push_requires_device: "Las notificaciones push requieren un dispositivo real. Los simuladores no pueden obtener un token.",
    push_requires_dev_build: "Las notificaciones push requieren un development build. Expo Go no las soporta.",
    permission_denied_title: "Permiso denegado",
    permission_denied_body: "Las notificaciones push requieren permiso de notificaciones. Puedes activarlo más tarde en la configuración.",
    notification_permission_title: "Autorización de notificaciones",
    notification_permission_message: "Prout es una aplicación de notificaciones. Para recibir y enviar prouts a tus amigos, debes autorizar las notificaciones.",
    accept_notifications_message: "¡Acepta las notificaciones para jugar! 😊",
    authorize_notifications: "Autorizar notificaciones",
    
    // Contact Permission
    contact_permission_title: "¡Se queda con nosotros!",
    contact_permission_message: "Esta app sincroniza tus contactos (nombres y números) a nuestros servidores Supabase (utfwujyymaikraaigvuv.supabase.co) para encontrar tus amigos y crear enlaces. Ningún otro uso ni compartir externo. ¿Aceptas esta sincronización?",
    contact_consent_title: "Contactos: uso y compartir",
    contact_consent_message: "Esta app sincroniza tus contactos (números y nombres) a nuestros servidores Supabase (https://utfwujyymaikraaigvuv.supabase.co) para encontrar tus amigos y crear enlaces de amistad. Ningún otro uso ni compartir externo.\n\n¿Aceptas esta sincronización?",
    refuse: "Rechazar",
    next: "Siguiente",
    
    // Network
    connection_error_title: "No se pudo conectar",
    connection_error_body: "Verifica tu red.",
    connection_slow_title: "Conexión lenta",
    connection_slow_body: "No se pudo cargar la lista de amigos. Verifica tu red.",
  }
});

// Configuration
i18n.enableFallback = true;

// Fonction pour détecter la langue de l'appareil de manière robuste
function getDeviceLanguage(): string {
  try {
    const locales = getLocales();
    if (!locales || locales.length === 0) {
      console.log('🌍 Aucune locale détectée, utilisation de l\'anglais par défaut');
      return 'en';
    }

    const firstLocale = locales[0];
    
    // Sur iOS, utiliser 'locale' si disponible, sinon 'languageCode'
    let languageCode = firstLocale.languageCode;
    
    // Si on a une locale complète (ex: "en-US"), extraire le code de langue de base
    if (firstLocale.languageTag) {
      const baseLanguage = firstLocale.languageTag.split('-')[0];
      languageCode = baseLanguage;
    } else if (firstLocale.languageCode) {
      // Si languageCode contient un tiret (ex: "en-US"), extraire la partie avant le tiret
      languageCode = firstLocale.languageCode.split('-')[0];
    }

    // Mapper les langues supportées
    const supportedLanguages = ['fr', 'en', 'es'];
    const detectedLanguage = languageCode?.toLowerCase() || 'en';
    
    // Si la langue détectée est supportée, l'utiliser
    if (supportedLanguages.includes(detectedLanguage)) {
      console.log(`🌍 Langue détectée: ${detectedLanguage} (depuis ${firstLocale.languageTag || firstLocale.languageCode})`);
      return detectedLanguage;
    }
    
    // Si la langue commence par "en" (en-US, en-GB, etc.), utiliser "en"
    if (detectedLanguage.startsWith('en')) {
      console.log(`🌍 Langue détectée: en (depuis ${firstLocale.languageTag || firstLocale.languageCode})`);
      return 'en';
    }
    
    // Si la langue commence par "es" (es-ES, es-MX, etc.), utiliser "es"
    if (detectedLanguage.startsWith('es')) {
      console.log(`🌍 Langue détectée: es (depuis ${firstLocale.languageTag || firstLocale.languageCode})`);
      return 'es';
    }
    
    // Fallback sur anglais
    console.log(`🌍 Langue non supportée (${detectedLanguage}), utilisation de l'anglais par défaut`);
    return 'en';
  } catch (error) {
    console.error('❌ Erreur détection langue:', error);
    return 'en';
  }
}

// Récupérer la langue de l'appareil
const deviceLanguage = getDeviceLanguage();
i18n.locale = deviceLanguage;

// Fonction pour mettre à jour la locale (utile pour iOS)
export function updateLocale() {
  const newLanguage = getDeviceLanguage();
  if (i18n.locale !== newLanguage) {
    console.log(`🌍 Mise à jour locale i18n: ${i18n.locale} → ${newLanguage}`);
    i18n.locale = newLanguage;
    // Forcer un re-render en déclenchant un événement personnalisé si nécessaire
    if (Platform.OS === 'ios') {
      // Sur iOS, s'assurer que la locale est bien appliquée
      console.log(`🌍 Locale iOS mise à jour vers: ${newLanguage}`);
    }
  }
  return newLanguage;
}

// Sur iOS, forcer une mise à jour supplémentaire après un court délai
// pour s'assurer que la locale est correctement détectée
if (Platform.OS === 'ios') {
  setTimeout(() => {
    const currentLocale = i18n.locale;
    const updatedLocale = updateLocale();
    if (currentLocale !== updatedLocale) {
      console.log(`🌍 Locale iOS corrigée: ${currentLocale} → ${updatedLocale}`);
    }
  }, 100);
}

// Log pour debug
if (__DEV__) {
  console.log(`🌍 Configuration i18n - Langue sélectionnée: ${i18n.locale}`);
  console.log(`🌍 Locales disponibles:`, getLocales().map(l => ({
    languageCode: l.languageCode,
    languageTag: l.languageTag,
    regionCode: l.regionCode,
  })));
  console.log(`🌍 Platform: ${Platform.OS}`);
  console.log(`🌍 Traductions disponibles pour ${i18n.locale}:`, Object.keys(i18n.translations[i18n.locale] || {}).length, 'clés');
}

export default i18n;















