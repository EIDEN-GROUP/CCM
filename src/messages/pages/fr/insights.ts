/**
 * The `pages.insights` strings, in French.
 *
 * Hand-written; never machine-translated at render time. Typed against the
 * English shape, so a missing key fails the build.
 */
import type { DeepStringify } from "../../en";
import type { insights as english } from "../en/insights";

/** The shape this file must satisfy. */
export type ChannelsShape = DeepStringify<typeof english>;

export const insights: ChannelsShape = {
  ux: {
    title: "Cartes de chaleur & UX",
    subtitle: "Signaux de comportement et points de friction.",
    recordings: "Enregistrements",
    heatmaps: "Cartes de chaleur",
    scrollDepth: "Profondeur de défilement",
    rageClicks: "Clics de frustration",
    deadClicks: "Clics morts",
    errors: "Erreurs de page",
    notice:
      "CCM renvoie vers le projet Clarity natif pour la relecture et les cartes de chaleur. Il ne stocke ni enregistrements de session, ni champs de formulaire, ni texte de page.",
    storageNoticeTitle: "Ce que CCM stocke",
    storageNoticeBody:
      "CCM conserve la connexion Clarity et renvoie vers le projet natif pour la relecture et les cartes de chaleur. Aucune métrique de comportement n'a été lue depuis Clarity : il n'existe aucune synchronisation Clarity dans cette version, et aucun enregistrement de session, carte de chaleur, champ de formulaire, texte de page ou identifiant privé n'est stocké. La relecture a lieu dans Clarity, sous les propres contrôles de confidentialité et de masquage du fournisseur.",
    connectionsReadError:
      "Les connexions Clarity n'ont pas pu être lues : {message}",
    projectsReadError:
      "Les projets Clarity n'ont pas pu être lus : {message}",
    connectionTile: "Connexion",
    lastSyncTile: "Dernière synchronisation",
    syncStateTile: "État de synchronisation",
    projectsTile: "Projets",
    notConnected: "Non connecté",
    connectionStatusDetail:
      "Statut de la connexion Clarity « {label} » : {status}.",
    noConnectionDetail:
      "CCM ne conserve aucune connexion Clarity pour cet espace de travail.",
    connectionsNotVisibleDetail:
      "La lecture des connexions fournisseur exige la permission Integrations ; ce rôle ne peut donc pas voir si Clarity est connecté.",
    unknownAgeDetail:
      "L'heure de synchronisation enregistrée n'a pas pu être lue ; son âge est donc inconnu.",
    neverSyncedDetail:
      "Aucune synchronisation Clarity n'a jamais abouti ; il n'y a donc pas de dernière synchronisation à afficher.",
    lastSyncDetail:
      "La dernière synchronisation Clarity réussie. L'objectif est d'une par jour.",
    freshnessFresh: "À jour",
    freshnessAging: "Rafraîchissement en retard",
    freshnessStale: "Les données sont périmées",
    freshnessFailing: "Échec de la synchronisation",
    neverSynced: "Jamais synchronisé",
    freshnessDetailNever: "Non connecté — aucune donnée pour l'instant",
    freshnessDetailFailingNoRun:
      "Échec de la synchronisation — aucune exécution réussie",
    freshnessDetailLastGood:
      "La dernière synchronisation a échoué — affichage des dernières bonnes données",
    projectsDetail:
      "Projets Clarity liés dans le catalogue des comptes. Les enregistrements et les cartes de chaleur restent dans Clarity.",
    projectsUnknownDetail:
      "La lecture du catalogue des comptes exige la permission Integrations ; le nombre de projets Clarity est donc inconnu.",
    connectionsCardTitle: "Connexions Clarity",
    connectionsCardSubtitle:
      "L'état de la connexion et le lien vers le projet natif",
    notVisibleTitle:
      "Les connexions Clarity ne sont pas visibles pour ce rôle",
    notVisibleDescription:
      "La lecture des connexions fournisseur exige la permission Integrations. Demandez-la à un administrateur pour voir si Clarity est connecté.",
    noConnectionTitle: "Aucune connexion Clarity",
    noConnectionDescription:
      "Connectez un projet Microsoft Clarity pour lier la relecture native et les cartes de chaleur. CCM conserve la connexion et son état de synchronisation ; il ne stocke aucun enregistrement et ne lit encore aucune métrique de comportement.",
    lastSyncOn: "Dernière synchronisation {date}",
    clarityProject: "Projet Clarity {ids}",
    noClarityProject: "Aucun projet Clarity lié",
    openClarity: "Ouvrir Clarity",
  },
  social: {
    title: "Réseaux sociaux",
    subtitle: "Comptes, performance du contenu et publication.",
    accounts: "Comptes",
    followers: "Abonnés",
    reach: "Portée",
    impressions: "Impressions",
    engagements: "Interactions",
    engagementRate: "Taux d'engagement",
    posts: "Publications",
    topContent: "Meilleur contenu",
    decliningContent: "Contenu en baisse",
    organic: "Organique",
    paid: "Payant",
    notice:
      "L'analytique organique des profils et les publicités sociales payantes sont des catégories distinctes, issues de sources distinctes. Elles ne sont jamais combinées.",
    organicPaidNoticeTitle: "L'organique et le payant sont séparés",
    organicPaidNoticeBody:
      "L'analytique organique des profils et les résultats des campagnes sociales payantes proviennent de surfaces différentes, avec des permissions différentes. Ils sont affichés comme des catégories distinctes et ne sont jamais fusionnés en un seul chiffre.",
    connectedAccountsTitle: "Comptes connectés",
    connectedAccountsSubtitle:
      "Identités, permissions et fraîcheur des données",
    noAccountsTitle: "Aucun compte social connecté",
    noAccountsDescription:
      "Connectez Instagram, Meta, LinkedIn ou YouTube. Le site public de Medical Bay référence Instagram (medicalbay.maroc), Facebook, LinkedIn (medical-bay-agadir) et TikTok.",
    accountsTableLabel: "Comptes sociaux",
    accountsReadError: "Les comptes connectés n'ont pas pu être lus.",
    metricsReadError:
      "Impossible de lire les métriques des comptes sociaux : {message}",
    postsReadError:
      "Impossible de lire les métriques des publications sociales : {message}",
    engagementRateOfReach: "Taux d'engagement {rate} de la portée",
    acrossConnectedAccounts: "Sur l'ensemble des comptes connectés",
    noSocialDataYet: "Aucune donnée sociale synchronisée pour l'instant",
    contentPerformanceTitle: "Publications récentes",
    contentPerformanceSubtitle:
      "Publications parues sur la période sélectionnée, de la plus récente à la plus ancienne.",
    noPostMetricsTitle: "Aucune métrique de publication",
    noPostMetricsDescription:
      "La performance par publication apparaît dès qu'un compte social fait un rapport.",
    postsTableLabel: "Publications sociales",
    platformColumn: "Plateforme",
    formatColumn: "Format",
    postedColumn: "Publié le",
    linkColumn: "Lien",
  },
  inbox: {
    title: "Messagerie unifiée",
    subtitle: "Boîtes aux lettres autorisées, fils de discussion et relances.",
    inbox: "Boîte de réception",
    unread: "Non lus",
    sent: "Envoyés",
    drafts: "Brouillons",
    archive: "Archives",
    threads: "Fils",
    attachments: "Pièces jointes",
    reply: "Répondre",
    replyAll: "Répondre à tous",
    forward: "Transférer",
    compose: "Rédiger",
    send: "Envoyer",
    markRead: "Marquer comme lu",
    markUnread: "Marquer comme non lu",
    star: "Suivre",
    mailbox: "Boîte aux lettres",
    sendingAs: "Envoyer en tant que",
    confirmSendTitle: "Envoyer ce message ?",
    confirmSendBody:
      "Confirmez le destinataire et l'identité d'expéditeur. Cette action est consignée dans le journal d'audit.",
    aiNotice:
      "Les résumés IA et l'extraction de tâches sont désactivés pour cette boîte aux lettres. Le corps des messages et les pièces jointes ne sont jamais transmis à un modèle externe sans approbation explicite.",
    starred: "Suivis",
    mailboxPrivacyNoticeTitle: "Confidentialité des boîtes aux lettres",
    mailboxPrivacyNoticeBody:
      "Le contenu des boîtes aux lettres est isolé du reste de CCM et protégé par son propre jeu de permissions et ses politiques au niveau des lignes. Les corps de messages et les pièces jointes sont lus chez le fournisseur à l'ouverture d'un message et ne sont jamais stockés ici. La synthèse IA est activable par boîte aux lettres — elle reste désactivée tant que personne ne l'active explicitement. L'envoi demande toujours une confirmation qui affiche le destinataire et l'identité d'expéditeur, et chaque envoi est consigné dans le journal d'audit.",
    mailboxesCardTitle: "Boîtes aux lettres",
    mailboxesCardSubtitle:
      "Tous les comptes que vous êtes autorisé à lire",
    noMailboxTitle: "Aucune boîte aux lettres connectée",
    noMailboxDescription:
      "medicalbay.ma fonctionne sur Google Workspace. Connectez une boîte aux lettres avec l'API Gmail pour faire entrer la messagerie dans CCM.",
    mailboxesTableLabel: "Boîtes aux lettres",
    addressColumn: "Adresse",
    aiProcessingColumn: "Traitement IA",
    enabled: "Activé",
    off: "Désactivé",
    messagesCardTitle: "Messages",
    messagesCardSubtitle:
      "Cherchez, paginez et lisez. Les corps sont récupérés à la demande et jamais stockés.",
    noConnectedMailboxTitle: "Aucune boîte aux lettres connectée à lire",
    noConnectedMailboxDescription:
      "Le navigateur de messagerie s'ouvre dès qu'une boîte aux lettres Gmail est connectée. La liste ci-dessus indique ce qui est connecté et ce qui reste à configurer.",
    messageSentTitle: "Message envoyé",
    sentNotice: "Envoyé à {to} — « {subject} ».",
    requestFailedTitle: "La requête de messagerie a échoué",
    requestFailed: "La requête a échoué (HTTP {status}).",
    sendFailed: "L'envoi a échoué (HTTP {status}).",
    serverUnreachable: "CCM n'a pas pu joindre le serveur.",
    noMailboxClientDescription:
      "Connectez une boîte aux lettres avec l'API Gmail dans Intégrations pour faire entrer la messagerie dans CCM.",
    searchPlaceholder: "from:, subject:, is:unread, ou un terme",
    sectionsLabel: "Sections de la boîte aux lettres",
    noSubject: "(sans objet)",
    nothingHereTitle: "Rien ici",
    noSearchMatchDescription: "Aucun message ne correspond à cette recherche.",
    sectionEmptyDescription:
      "Cette section de la boîte aux lettres est vide.",
    pageNumber: "Page {page}",
    totalEstimate: "· environ {count} au total",
    newMessage: "Nouveau message",
    confirmBeforeSendingTitle: "Confirmez avant l'envoi",
    confirmSendSummary:
      "Ce message sera envoyé depuis {from} ({label}) à {to}{cc}, avec l'objet {subject}.",
    confirmSendCc: ", en copie {cc}",
    draftExpiry:
      "Un brouillon a été enregistré dans la boîte aux lettres. Il expire dans {seconds} secondes s'il n'est pas confirmé.",
    confirmAndSend: "Confirmer et envoyer",
    editInstead: "Modifier plutôt",
    to: "À",
    cc: "Cc",
    optional: "Facultatif",
    subject: "Objet",
    message: "Message",
    prepareToSend: "Préparer l'envoi",
    closeThread: "Fermer le fil de discussion",
    nothingToReadTitle: "Rien à lire",
    nothingToReadDescription:
      "Le fournisseur n'a renvoyé aucun message pour ce fil de discussion.",
    unknownSender: "Expéditeur inconnu",
    removeStar: "Retirer le suivi",
    starMessage: "Suivre ce message",
    starFailed:
      "Le suivi n'a pas pu être enregistré (HTTP {status}). Le message est resté inchangé.",
    bodyUnreadable:
      "Le corps du message n'a pas pu être lu chez le fournisseur.",
    hasAttachments: "Contient des pièces jointes",
    selectConversationTitle: "Sélectionnez une conversation",
    selectConversationDescription:
      "Choisissez un message à gauche pour le lire, ou cherchez dans la boîte aux lettres.",
  },
  launcher: {
    accountSummary: "Résumé des comptes à ouvrir",
    totalAccounts: "Comptes disponibles",
    readyAccounts: "Profil navigateur prêt",
    attentionAccounts: "À vérifier",
    accountsLoadErrorTitle: "Les comptes n'ont pas pu être chargés",
    accountsLoadErrorBody:
      "La liste des comptes est temporairement indisponible. Rechargez cette page pour réessayer.",
    reloadAccounts: "Recharger les comptes",
    clearFilters: "Effacer les filtres",
    connectAccount: "Connecter un compte",
    launcherEmptyTitle: "Aucun compte pour le moment",
    launcherEmptyBody:
      "Ajoutez ci-dessus une connexion fournisseur enregistrée, ou connectez un fournisseur pour créer un compte relié à l’API.",
    howItWorksTitle: "Comment ça marche",
    howItWorksBody:
      "Une connexion API valide ne prouve pas qu'une session de navigateur existe. CCM ouvre la destination exacte de chaque compte ; le fournisseur décide si votre session est valide et peut demander un MFA ou un CAPTCHA. Les identifiants enregistrés sont chiffrés. Après avoir choisi Ouvrir et se connecter, l'extension associée les envoie uniquement au formulaire de connexion autorisé du fournisseur.",
    connectedAccountsTitle: "Comptes connectés",
    connectedAccountsSubtitle:
      "Chaque compte que CCM peut ouvrir, avec son état API et son état navigateur.",
    setupSubtitle:
      "Associez chaque compte au profil de navigateur qui contient sa session fournisseur.",
    boundariesTitle: "Ce que cela fait et ne fait pas",
    boundariesBody:
      "Une page hébergée ne peut pas lire les cookies d'un autre site ni forcer l'ouverture d'un autre profil de navigateur. Ce qu'elle peut faire — et ce que cet assistant configure — c'est ouvrir la destination exacte du compte dans le navigateur que vous utilisez et, lorsque l'extension passerelle est installée, l'ouvrir dans le profil où vit l'extension. Une session fournisseur peut néanmoins avoir expiré ; CCM le montre clairement et vous laisse vous connecter normalement.",
    step1Title: "Étape 1 — installer la passerelle navigateur",
    step1Subtitle:
      "Facultatif, mais cela ajoute les lancements vérifiés et l'association de profils",
    checkingExtension: "Recherche de l'extension…",
    downloadBridgeExtension: "Télécharger CCM Browser Bridge",
    extensionInstalled:
      "La passerelle navigateur est installée dans ce profil de navigateur.",
    extensionNotDetectedTitle: "Extension non détectée",
    loadExtensionBody:
      "Téléchargez et extrayez la passerelle ci-dessous, puis choisissez Load unpacked dans {extensionsUrl} et sélectionnez le dossier extrait. Vous pouvez aussi charger le dossier source {bridgePath}. Ouvrez les options et saisissez cette origine CCM.",
    instanceIdLabel: "L'identifiant d'instance de ce profil",
    step2Title: "Étape 2 — associer un profil de navigateur",
    step2Subtitle:
      "Reliez un compte au profil qui contient sa session fournisseur",
    noAccountsTitle: "Aucun compte pour l'instant",
    noAccountsBody:
      "Ajoutez une connexion enregistrée depuis Account Launcher, ou connectez un fournisseur dans Intégrations, puis associez le compte à un profil de navigateur.",
    accountLabel: "Compte",
    noManagementConsole:
      "Ce fournisseur n'a pas de console de gestion à ouvrir.",
    multiProfileTitle: "Plusieurs profils de navigateur",
    multiProfileSubtitle: "Ce qui est possible et ce qui ne l'est pas",
    multiProfileBody:
      "Une page web ordinaire ne peut pas forcer Chrome, Edge ou Firefox à ouvrir un autre profil. L'extension passerelle le peut, parce qu'elle ouvre l'onglet dans le profil où elle est installée — le workflow fiable pour une seconde identité est donc d'installer l'extension dans ce profil et d'y associer le compte.",
    multiProfileHelperBody:
      "L'assistant local facultatif existe pour le cas où le compte vit dans un profil où vous ne pouvez pas installer l'extension. Il est installé et apparié explicitement par vous, il n'accepte que des hôtes sur liste blanche et des répertoires de profils configurés, et il ne lit, n'exporte et ne modifie jamais les cookies ni les mots de passe.",
    helperTitle: "L'assistant local",
    helperSubtitle:
      "Pour un profil où l'extension ne peut pas être installée",
    helperIntro:
      "L'assistant est un petit programme qui s'exécute sur votre propre machine. Il ouvre le compte dans un profil de navigateur nommé — le seul cas qu'une page web et l'extension ne couvrent pas toutes les deux.",
    helperRunCommand: "Exécutez-le depuis le dépôt : {command}",
    pairingCode: "code d'appairage",
    helperPairBody:
      "Appairez-le avec ce déploiement. L'assistant affiche un {code} sur sa propre console au démarrage ; ce code est obligatoire, afin qu'aucune autre page ne puisse rediriger l'assistant vers un site de son choix : {command}",
    helperChooseBody:
      "Choisissez {mode} comme mode d'ouverture ci-dessus et nommez le répertoire du profil de navigateur — celui indiqué dans {version}, par exemple {example} ou {fallback}.",
    helperWarning:
      "L'assistant n'accepte qu'un ticket d'ouverture signé, vérifie la destination par rapport à la liste blanche du fournisseur et ouvre le navigateur avec son propre magasin de cookies. Il ne lit jamais un cookie, un mot de passe ou un code MFA.",
    instanceIdLabelField: "Identifiant d'instance de l'extension",
    instanceIdHint:
      "Collez l'identifiant depuis la page d'options de l'extension, ou utilisez le bouton ci-dessus.",
    useDetectedInstance:
      "Utiliser l'identifiant d'instance de ce profil de navigateur",
    profileLabelLabel: "Libellé du profil",
    profileLabelHint:
      "Comment ce profil apparaît à votre équipe, par exemple « Chrome — Work ».",
    profileDirectoryLabel: "Répertoire du profil",
    profileDirectoryHint:
      "Le répertoire de profil Chrome/Edge (par exemple « Profile 1 »). Utilisé uniquement par l'assistant local facultatif ; laissez vide pour une ouverture directe.",
    launchModeLabel: "Mode d'ouverture",
    launchModeHint: "Comment le compte doit être ouvert.",
    modeDirect: "Direct — ouvrir un onglet dans ce navigateur",
    modeExtension:
      "Extension — ouvrir dans le profil où la passerelle est installée",
    modeHelper:
      "Assistant local — ouvrir dans un profil de navigateur précis",
    modeHelperShort: "Assistant local",
    saveMapping: "Enregistrer l'association",
    mappingSaved:
      "Association enregistrée. La tuile du compte affiche désormais ce profil.",
    mappingSaveFailed:
      "L'association n'a pas pu être enregistrée (HTTP {status}).",
    serverUnreachable:
      "CCM n'a pas pu joindre le serveur pour enregistrer l'association.",
    credentialsAddLabel: "Ajouter une connexion sécurisée",
    credentialsSavedLabel: "Connexion sécurisée enregistrée",
    credentialsPrivacy:
      "Chiffrés avant stockage. L'extension associée les envoie uniquement au formulaire autorisé du fournisseur après votre choix. Le MFA et le CAPTCHA restent gérés par le fournisseur.",
    credentialsChecking: "Vérification de la connexion enregistrée…",
    credentialsCheckFailed: "Impossible de vérifier la connexion enregistrée.",
    credentialsSaveFailed: "Impossible d'enregistrer les identifiants.",
    loginUsername: "Nom d'utilisateur ou e-mail",
    loginPassword: "Mot de passe",
    passwordReplaceHint: "Saisissez un nouveau mot de passe pour remplacer l'ancien.",
    saveLogin: "Enregistrer la connexion",
    removeLogin: "Supprimer la connexion enregistrée",
    credentialsSaved: "Connexion enregistrée de façon sécurisée.",
    credentialsRemoved: "Connexion enregistrée supprimée.",
    credentialsManagedByAdmin: "Demandez à un gestionnaire des intégrations de modifier ces identifiants.",
    credentialsAskAdmin: "Demandez à un gestionnaire des intégrations d'ajouter des identifiants.",
    openAndFill: "Ouvrir le compte et se connecter",
    credentialsExtensionRequired:
      "Installez et associez l'extension CCM dans ce navigateur pour remplir les identifiants. Vous pouvez toujours ouvrir le compte et vous connecter normalement.",
    credentialsHelperProfile:
      "Le remplissage fonctionne dans le profil associé à l'extension. Associez ce compte au profil de la passerelle navigateur pour l'utiliser.",
    addLoginAccount: "Ajouter une connexion enregistrée",
    addLoginAccountTitle: "Ajouter une connexion fournisseur",
    addLoginAccountSubtitle:
      "Créez un compte réservé au navigateur. Les intégrations API et les données de reporting restent séparées.",
    loginProvider: "Fournisseur",
    loginAccountLabel: "Nom du compte",
    loginAccountPrivacy:
      "Votre mot de passe est chiffré avant stockage. Le remplissage ne démarre qu’à votre demande dans l’extension. Le fournisseur peut toujours demander une MFA ou un CAPTCHA.",
    saveLoginAccount: "Enregistrer et ajouter le compte",
    savingLoginAccount: "Enregistrement sécurisé…",
    loginAccountCreated: "Connexion enregistrée. Vous pouvez ouvrir le compte dans la liste ci-dessous.",
    loginAccountCreateFailed: "Impossible d’ajouter cette connexion enregistrée.",
    browserOnly: "Connexion navigateur uniquement",
    launchPermissionRequired: "Vous pouvez voir ce compte, mais votre rôle ne permet pas de l’ouvrir.",
  },
} as const;
