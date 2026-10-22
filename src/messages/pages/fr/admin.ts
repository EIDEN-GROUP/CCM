/**
 * The `pages.admin` strings, in French.
 *
 * Hand-written; never machine-translated at render time. Typed against the
 * English shape, so a missing key fails the build.
 */
import type { DeepStringify } from "../../en";
import type { admin as english } from "../en/admin";

/** The shape this file must satisfy. */
export type ChannelsShape = DeepStringify<typeof english>;

export const admin: ChannelsShape = {
  alerts: {
    title: "Alertes & Actions",
    subtitle: "Preuves, impact, responsable et historique de résolution.",
    queue: "File d'actions",
    severity: "Gravité",
    observed: "Observé",
    baseline: "Référence",
    confidence: "Confiance",
    owner: "Responsable",
    due: "Échéance",
    status: "État",
    resolve: "Résoudre",
    snooze: "Reporter",
    acknowledge: "Prendre en charge",
    rules: "Règles d'alerte",
    newRule: "Nouvelle règle",
    threshold: "Seuil",
    minVolume: "Volume minimal",
    quietPeriod: "Période de silence",
    hysteresis: "Hystérésis",

    whyQuietTitle: "Pourquoi les alertes restent silencieuses",
    whyQuietBody:
      "Une règle a besoin d'un volume minimal, d'un délai de grâce le temps qu'elle apprenne sa référence, d'une fenêtre d'hystérésis avant de se résoudre automatiquement, et d'un intervalle de répétition avant de se déclencher à nouveau. Les indicateurs à faible volume et les creux du week-end n'encombrent donc pas la file de bruit.",

    openAlertsOne: "1 alerte ouverte",
    openAlertsOther: "{count} alertes ouvertes",
    emptyTitle: "Aucune alerte",
    emptyBody:
      "Les alertes apparaissent lorsqu'une règle dépasse son seuil. Créez les règles depuis l'onglet Règles une fois une source connectée.",
    alertsTable: "Alertes",
    columnAlert: "Alerte",
    columnReason: "Motif",
    columnOpened: "Ouverte le",

    tasksTitle: "Tâches",
    tasksSubtitle:
      "Éléments de travail soulevés par les règles, par l'analyste IA ou par une personne",
    tasksEmptyTitle: "Aucune tâche",
    tasksEmptyBody:
      "Les tâches sont créées à partir d'une alerte, ou proposées par l'analyste IA pour votre validation.",
    tasksTable: "Éléments d'action",
    columnTask: "Tâche",
    columnPriority: "Priorité",

    rulesSubtitle: "Seuils, volume minimal, hystérésis et périodes de silence",
    rulesEmptyTitle: "Aucune règle configurée",
    rulesEmptyBody:
      "Une règle a besoin d'un indicateur, d'un sens, d'un seuil et d'un volume minimal avant de pouvoir se déclencher.",
    rulesTable: "Règles d'alerte",
    columnDirection: "Sens",
    columnEnabled: "Activée",
    hysteresisWindows: "{count} fenêtres",

    on: "Activé",
    off: "Désactivé",
    severityInfo: "Info",
    severityWarning: "Avertissement",
    severityCritical: "Critique",
    statusOpen: "Ouverte",
    statusAcknowledged: "Prise en charge",
    statusSnoozed: "Reportée",
    statusResolved: "Résolue",
    taskStatusInProgress: "En cours",
    taskStatusDone: "Terminée",
    taskStatusCancelled: "Annulée",
    priorityHigh: "Haute",
    priorityNormal: "Normale",
    priorityLow: "Basse",
    sourceManual: "Manuelle",
    sourceRule: "Règle",
    sourceAnalyst: "Analyste IA",
    directionIncrease: "Hausse",
    directionDecrease: "Baisse",
  },
  reports: {
    title: "Rapports & Analyste IA",
    subtitle: "Bulletins planifiés et explications fondées sur les données.",
    daily: "Quotidien",
    weekly: "Hebdomadaire",
    monthly: "Mensuel",
    siteReport: "Rapport de site",
    adsReport: "Rapport publicitaire",
    seoReport: "Rapport SEO",
    socialReport: "Rapport social",
    connectionReport: "État des connexions",
    emailDigest: "Bulletin des opérations e-mail",
    exportCsv: "Exporter en CSV",
    exportPdf: "Exporter / imprimer",
    safeMode: "Partage sûr (mode confidentiel)",
    safeModeBody:
      "Masque les identifiants clients, boîtes aux lettres et comptes sensibles dans la vue exportée.",
    ask: "Interroger l'analyste IA",
    askPlaceholder: "Posez une question sur l'évolution de vos données…",
    sources: "Sources utilisées",
    caveats: "Réserves",
    notGrounded:
      "Cette réponse nécessite des données que CCM n'a pas encore synchronisées. Rien n'a été déduit.",

    exportContainsTitle: "Ce que contient un export",
    exportContainsBody:
      "Chaque export porte les mêmes valeurs vérifiées que l'écran, ainsi que la fraîcheur des données, les définitions des indicateurs et les réserves applicables. Le mode « Partage sûr » masque les identifiants clients, boîtes aux lettres et comptes sensibles avant que quoi que ce soit ne quitte CCM.",
    generateDigest: "Générer le bulletin quotidien",

    scheduledDigestsTitle: "Bulletins planifiés",
    scheduledDigestsSubtitle:
      "Construits par le worker à partir des enregistrements qui ont été synchronisés",
    noDigestScheduledTitle: "Aucun bulletin n'est planifié",
    noDigestScheduledBody:
      "Un bulletin est l briefing planifié qui résume ce qui a changé sur vos chaînes, campagnes et comptes sociaux sur une période. Demandez au responsable du déploiement d'activer les bulletins de cet espace de travail.",
    lastRun: "Dernière exécution",
    nextRun: "Prochaine exécution",
    notScheduled: "Non planifié",
    buildNow: "Générer maintenant",
    recentDigests: "Bulletins récents",
    digestQueuedTitle: "Bulletin mis en file",
    digestFailedTitle: "Le bulletin n'a pas pu être mis en file",
    digestQueued: "Le bulletin a été mis en file.",
    digestFallback: "Bulletin",
    noDataAvailable: "Aucune donnée n'était disponible pour cette période.",
    periodTo: "du {start} au {end}",

    reportCatalogueTitle: "Catalogue des rapports",
    reportCatalogueSubtitle: "Bulletins quotidiens, hebdomadaires et mensuels",
    noDefinitionsTitle: "Aucune définition de rapport",
    noDefinitionsBody:
      "Les définitions de rapport décrivent les sections d'un bulletin et ses destinataires. Elles sont créées dans Paramètres.",
    reportDefinitionsTable: "Définitions de rapport",
    columnReport: "Rapport",
    columnCadence: "Fréquence",
    columnFormats: "Formats",
    columnLastRun: "Dernière exécution",

    recentRunsTitle: "Exécutions récentes",
    recentRunsSubtitle: "Bulletins générés",
    noRunsTitle: "Aucun rapport généré pour l'instant",
    noRunsBody: "Une exécution apparaît ici dès qu'un bulletin a été généré.",
    reportRunsTable: "Exécutions de rapport",
    columnPeriod: "Période",
    columnSafeMode: "Partage sûr",
    columnGenerated: "Généré le",
    onDemand: "À la demande",
    runStatusPending: "En attente",
    runStatusReady: "Prêt",
    runStatusFailed: "Échec",

    analystCardTitle: "Analyste IA",
    analystCardSubtitle:
      "Réponses fondées sur les données, avec une piste de sources inspectable",
    analystUnavailableBody:
      "L'analyste IA n'est pas disponible dans ce déploiement. Demandez au responsable du déploiement de l'activer. Les chiffres de ces rapports proviennent des applications fournisseurs que vous connectez dans {link}.",

    on: "Activé",
    off: "Désactivé",
    done: "Terminé.",
    serverUnreachable: "CCM n'a pas pu joindre le serveur.",
    requestFailed: "La requête a échoué (HTTP {status}).",
  },
  integrations: {
    title: "Intégrations",
    subtitle: "Connexions, portées, quotas et fraîcheur.",
    catalogue: "Catalogue des connexions",
    scopes: "Portées",
    apiVersion: "Version de l'API",
    lastSuccess: "Dernier succès",
    lastFailure: "Dernier échec",
    quota: "Quota",
    nextRefresh: "Prochaine actualisation",
    setupChecklist: "Liste de configuration",
    capabilityMatrix: "Matrice des capacités",
    changelog: "Veille des versions d'API",

    honestStatusTitle: "Un état honnête",
    honestStatusBody:
      "Une vignette n'affiche « Connecté » que si CCM détient un jeton d'API fonctionnel pour ce compte. Tout le reste montre ce qui manque, et la liste de configuration ci-dessous énumère les autorisations encore en attente.",

    connectionsTitle: "Connexions",
    connectionsSubtitleOne: "1 connexion configurée",
    connectionsSubtitleOther: "{count} connexions configurées",
    noConnectionsTitle: "Aucun fournisseur connecté",
    noConnectionsBody:
      "Connectez Google Ads, GA4, Search Console, GTM, Gmail ou un compte social pour commencer à établir des rapports.",
    connectionsTable: "Connexions",
    columnConnection: "Connexion",
    columnAccessLevel: "Niveau d'accès",

    providerCatalogueTitle: "Catalogue des fournisseurs",
    providerCatalogueSubtitle:
      "Tous les fournisseurs que CCM connaît, et ce qu'il leur manque encore",
    noProviderCatalogueTitle: "Aucun fournisseur au catalogue",
    noProviderCatalogueBody:
      "Le registre des fournisseurs de CCM est vide. Demandez au responsable du déploiement d'installer le catalogue des fournisseurs.",
    providerCatalogueTable: "Catalogue des fournisseurs",
    columnCategory: "Catégorie",
    columnStillNeeded: "Encore requis",
    columnDocs: "Documentation",

    watchlistSubtitle: "Où une dépréciation ferait mal, et comment le savoir",
    watchlistGoogleAds:
      "les jetons de développeur ont été retirés le 9 septembre 2026. Les niveaux d'accès résident désormais sur le projet Google Cloud (Test, Explorer, Basic, Standard). Basic et Standard exigent la vérification de la marque.",
    watchlistLinkedIn:
      "Les versions de la Marketing API sont temporelles et doivent être migrées selon le calendrier. La version épinglée vit dans le registre des fournisseurs, et non dispersée dans le code.",
    watchlistGoogleApis:
      "l'API Analytics Data, l'API Search Console, l'API Tag Manager v2 et l'API Gmail sont versionnées de façon centralisée dans le registre des fournisseurs.",

    connectProvider: "Connecter un fournisseur",
    close: "Fermer",
    noAppConfiguredTitle: "Aucune application fournisseur n'est configurée",
    noAppConfiguredBody:
      "Un fournisseur a besoin de son propre client id et de son propre client secret avant de pouvoir être connecté. Ajoutez-les dans {link}, puis revenez ici.",
    providerAppsLink: "Paramètres — Applications fournisseurs",
    appNotConfigured: "Application non configurée",
    setItUp: "Configurer",

    categoryAdvertising: "Publicité",
    categoryAnalytics: "Analytique",
    categorySearch: "Recherche",
    categoryTagging: "Balisage",
    categorySocial: "Social",
    categoryEmail: "E-mail",
    categorySeo: "SEO",
    categoryUx: "UX",
    categorySite: "Site",

    serverUnreachable: "CCM n'a pas pu joindre le serveur.",
    requestFailed: "La requête a échoué (HTTP {status}).",
  },
  audit: {
    title: "Audit & Sécurité",
    subtitle: "Rôles, permissions, conservation et activité.",
    users: "Utilisateurs",
    roles: "Rôles",
    permissions: "Permissions",
    invite: "Inviter un utilisateur",
    activity: "Journal d'activité",
    retention: "Conservation des données",
    backups: "Sauvegardes",
    sessions: "Sessions actives",
    mfa: "MFA / clés d'accès",

    leastPrivilegeTitle: "Le moindre privilège par défaut",
    leastPrivilegeBody:
      "L'accès est accordé par rôle au niveau de l'espace de travail et, lorsqu'un rôle est limité à un compte — comme {mailboxUser} —, par une attribution explicite sur un compte unique. La sécurité au niveau des lignes l'impose dans la base de données : un élément de navigation masqué est une commodité, pas le contrôle.",

    membersTitle: "Membres",
    membersSubtitle: "Toutes les personnes qui ont accès à cet espace de travail",
    noMembersTitle: "Aucun membre",
    noMembersBody: "Les membres apparaissent ici une fois qu'ils sont invités.",
    membersTable: "Membres de l'espace de travail",
    columnUser: "Utilisateur",
    columnRole: "Rôle",
    columnInvited: "Invité le",

    rolesAndPermissionsTitle: "Rôles & permissions",
    rolesAndPermissionsSubtitle: "La matrice que la base de données impose",
    noRolesTitle: "Aucun rôle configuré",
    noRolesBody:
      "Les rôles que cet espace de travail applique apparaissent ici une fois installés. Demandez au responsable du déploiement de les installer.",
    rolesTable: "Rôles",
    severity: "Gravité",
    columnAccountScoped: "Limité au compte",
    perAccount: "Par compte",
    workspaceWide: "Tout l'espace de travail",
    columnDescription: "Description",

    activitySubtitle: "Journal inaltérable des actions sensibles",
    noActivityTitle: "Aucune activité enregistrée pour l'instant",
    noActivityBody:
      "Les ouvertures de comptes, les changements de connexion et les changements de permission sont enregistrés ici.",
    activityTable: "Événements d'audit",
    columnAction: "Action",
    columnActor: "Auteur",
    columnEntity: "Entité",
    columnTarget: "Cible",
    columnWhen: "Quand",

    statusActive: "Actif",
    statusInvited: "Invité",
    statusSuspended: "Suspendu",
    severityInfo: "Info",
    severityWarning: "Avertissement",
    severityCritical: "Critique",
  },
  settings: {
    title: "Paramètres",
    subtitle: "Personnes, permissions, conservation des données et journal d'audit.",

    leastPrivilegeTitle: "Le moindre privilège par défaut",
    leastPrivilegeBody:
      "Un rôle accorde des permissions au niveau des fonctionnalités sur tout l'espace de travail. Un utilisateur de boîte aux lettres a en outre besoin d'une attribution explicite sur la boîte aux lettres concernée, afin qu'une personne puisse lire une seule boîte sans voir les autres.",

    membersTitle: "Membres",
    membersSubtitle: "{count} dans cet espace de travail",
    noMembersTitle: "Aucun membre pour l'instant",
    noMembersBody:
      "Les membres apparaissent ici une fois qu'ils ont été invités. Invitez des personnes depuis Personnes & rôles.",
    membersTable: "Membres de l'espace de travail",
    columnUser: "Utilisateur",
    columnRole: "Rôle",
    columnInvited: "Invité le",

    accountGrantsTitle: "Attributions de compte",
    accountGrantsSubtitle: "Qui peut lire quel compte individuel",
    noAccountGrantsTitle: "Aucune attribution de compte",
    noAccountGrants:
      "Les membres dont le rôle s'étend à tout l'espace de travail accèdent déjà à tous les comptes : aucune attribution par compte n'est nécessaire.",
    accountGrantsTable: "Attributions de compte",
    columnAccount: "Compte",
    columnPermission: "Permission",

    retentionTitle: "Conservation des données",
    retentionSubtitle: "Durée de conservation de chaque type d'enregistrement",
    retentionFactsLabel: "Faits d'indicateurs quotidiens",
    retentionFactsValue: "25 mois",
    retentionFactsNote: "Défini dans les paramètres de conservation.",
    retentionSyncLabel: "Exécutions de synchronisation et erreurs",
    retentionSyncValue: "90 jours",
    retentionSyncNote: "Élagués par la tâche de conservation.",
    retentionLaunchLabel: "Événements d'ouverture de compte",
    retentionLaunchValue: "12 mois",
    retentionLaunchNote: "Preuve des ouvertures de comptes.",
    retentionAuditLabel: "Événements d'audit",
    retentionAuditValue: "24 mois",
    retentionAuditNote:
      "Une décision de conformité — à examiner avant de la raccourcir.",
    retentionMailboxLabel: "Métadonnées de boîte aux lettres",
    retentionMailboxValue: "12 mois",
    retentionMailboxNote:
      "Par boîte aux lettres. Les corps de message et les pièces jointes ne sont jamais stockés.",
    retentionTicketLabel: "Tickets d'ouverture de compte",
    retentionTicketValue: "60 secondes",
    retentionTicketNote:
      "Fixe par conception : un ticket est une permission passagère.",
    retentionCredentialsLabel: "Identifiants fournisseur",
    retentionCredentialsValue: "Jusqu'à la déconnexion",
    retentionCredentialsNote:
      "Supprimés dès que le compte est déconnecté.",

    preferencesTitle: "Vos préférences",
    preferencesSubtitle:
      "Langue de l'interface, fuseau horaire et masquage des exports",
    noPreferencesTitle: "Aucune préférence enregistrée",
    noPreferencesBody:
      "La langue, le fuseau horaire et les valeurs d'export de chacun apparaissent ici dès qu'il enregistre ses propres préférences.",
    preferencesTable: "Préférences",
    columnLanguage: "Langue",
    columnDefaultPeriod: "Période par défaut",
    columnShareSafe: "Partage sûr",

    on: "Activé",
    off: "Désactivé",
    statusActive: "Actif",
    statusInvited: "Invité",
    statusSuspended: "Suspendu",

    integrations: {
      secretNote:
        "Le secret est chiffre avant son stockage et n'est plus jamais affiche. Laissez le champ vide pour conserver celui qui est enregistre.",
      setUpApp: "Configurer l'application",
      check: "Vérifier",
      title: "Applications fournisseurs",
      subtitle:
        "Ajoutez l'identifiant client et le secret de chaque application fournisseur, puis connectez-la.",
      replacesTitle: "Ce que cela remplace",
      replacesBody:
        "Ces valeurs vivaient auparavant dans l'environnement de déploiement, si bien que connecter un fournisseur revenait à modifier un fichier puis à redéployer. Elles sont stockées ici, chiffrées, et le bouton Connecter fonctionne dès que le formulaire est enregistré.",
      appsTitle: "Applications",
      appsSubtitle:
        "Une application par fournisseur. Google couvre Analytics, Search Console, Tag Manager, Ads, YouTube et Gmail.",
    },

    database: {
      title: "Base de données",
      checking: "Vérification de la couche d'autorisation",
      checkingRls:
        "Vérification de l'installation de la sécurité au niveau des lignes…",
      authorisationLayer: "Couche d'autorisation",
      layerReady:
        "La sécurité au niveau des lignes est installée et la matrice des permissions est en place. Chaque requête est délimitée par la base de données.",
      layerMissing:
        "Les fonctions utilitaires RLS ne sont pas visibles par PostgREST. Soit une migration s'est interrompue avant de les créer, soit le cache de schéma n'a pas été rechargé.",
      layerNotFound: "La couche d'autorisation est introuvable.",
      notConfigured:
        "Supabase n'est pas configuré : la base de données n'a pas pu être vérifiée.",
      checkFailed:
        "La vérification de la base de données n'a pas pu s'exécuter.",
      checkFailedWithDetail:
        "La vérification de l'autorisation n'a pas pu s'exécuter : {detail}",
      checkReturned:
        "La vérification de l'autorisation a renvoyé {status}.",
      repairTitle: "Réparation de la base de données requise",
      repairSubtitle:
        "La sécurité au niveau des lignes n'est pas installée : chaque utilisateur voit un produit vide",
      applyRepair: "Appliquer la réparation",
      repairBody:
        "Le fichier de réparation reconstruit les fonctions utilitaires, toutes les politiques et les données de référence, et indique à PostgREST de recharger son cache de schéma. Il est idempotent.",
      stepOne: "Ouvrez le {editor} du projet dans le tableau de bord Supabase.",
      stepTwo: "Ouvrez {file} dans ce dépôt et collez son contenu.",
      stepThree: "Exécutez-le, puis rechargez cette page.",
      terminalLead:
        "Depuis un terminal où le projet est lié, la même réparation est :",
      recheck: "Revérifier",
    },
  },
  people: {
    title: "Personnes & rôles",
    subtitle:
      "Qui se trouve dans l'espace de travail, et jusqu'où dans chaque onglet il peut aller.",
    howAccessWorksTitle: "Comment fonctionne l'accès",
    howAccessWorksBody:
      "Un rôle dit jusqu'où dans un onglet il peut aller : {view} pour le lire, {use} pour ses actions, et {edit} pour modifier sa configuration. Ces niveaux sont convertis en permissions de fonctionnalités que la base de données impose : ce que vous voyez ici est ce que les politiques de sécurité au niveau des lignes autoriseront réellement.",

    peopleTitle: "Personnes",
    peopleSubtitle:
      "Tout le monde dans cet espace de travail, et ce qu'il peut faire",
    addPerson: "Ajouter une personne",
    workEmail: "E-mail professionnel",
    role: "Rôle",
    create: "Créer",
    passwordHint:
      "Un mot de passe est généré et affiché une seule fois. La personne se connecte avec, et peut en recevoir un nouveau à tout moment.",
    emptyTitle: "Personne pour l'instant",
    emptyBody: "Ajoutez la première personne et donnez-lui un rôle.",
    you: "(vous)",
    joined: "Inscrit le",
    restore: "Réactiver",
    suspend: "Suspendre",
    statusActive: "Actif",
    statusInvited: "Invité",
    statusSuspended: "Suspendu",
    roleOf: "Le rôle de {name}",
    thisPerson: "cette personne",

    rolesTitle: "Rôles",
    rolesSubtitle: "Ce que chaque rôle peut voir, utiliser et modifier",
    ownerAccessTitle: "L'accès du propriétaire est fixe",
    ownerAccessBody:
      "Le propriétaire détient toutes les permissions et ne peut pas être réduit. Un espace de travail sans administrateur ne peut pas être administré.",
    matrixCaption: "Le niveau d'accès du rôle {role} sur chaque onglet",
    tabColumn: "Onglet",
    levelNone: "Aucun accès",
    levelView: "Consulter",
    levelUse: "Utiliser",
    levelEdit: "Modifier",
    ownerOnly: "Propriétaire uniquement",
    saveRole: "Enregistrer le rôle {role}",
    noChangesToSave: "Aucune modification à enregistrer pour l'instant.",
    discard: "Abandonner les modifications",
    derivedPermissions:
      "{count} permission(s) sont dérivées de ces niveaux : {permissions}.",
    noPermissions: "aucune",

    doneTitle: "Terminé",
    errorTitle: "Cela n'a pas fonctionné",
    passwordTitle: "Enregistrez ce mot de passe maintenant",
    passwordBody:
      "peut se connecter avec le mot de passe ci-dessous, en tant que {role}. Il n'est affiché qu'une seule fois et n'est stocké nulle part.",

    membersReadFailed: "Les personnes n'ont pas pu être lues.",
    rolesReadFailed: "Les rôles n'ont pas pu être lus.",
    tabMapMissing:
      "La table des onglets n'est pas encore installée. Appliquez supabase/repair.sql — il crée la table role_tab_access et initialise les niveaux pour chaque rôle.",
    repairRequired:
      "La base de données ne contient pas une table dont cet écran a besoin. Appliquez supabase/repair.sql.",
    serverUnreachable: "CCM n'a pas pu joindre le serveur.",
    requestFailed: "La requête a échoué (HTTP {status}).",
    roleSaved: "Le rôle {role} détient désormais {count} permission(s).",
    updated: "Mis à jour.",

    roleLabels: {
      owner: "Propriétaire",
      admin: "Administrateur",
      marketing_analyst: "Analyste marketing",
      seo: "SEO",
      ads_manager: "Responsable des annonces",
      social_manager: "Responsable des réseaux sociaux",
      mailbox_user: "Utilisateur de boîte aux lettres",
      read_only: "Lecture seule",
    },
  },
  search: {
    title: "Recherche",
    subtitleAll: "Tout ce à quoi vos rôles vous donnent accès",
    resultsFor: "Résultats pour « {query} »",

    accountsTitle: "Comptes",
    resultsOne: "1 résultat",
    resultsOther: "{count} résultats",
    noAccountsTitle: "Aucun compte ne correspond",
    noAccountsBody:
      "Essayez un autre terme, ou parcourez le Lanceur de comptes.",
    accountsTable: "Résultats de recherche de comptes",

    websitesTitle: "Sites web",
    noWebsitesTitle: "Aucun site web ne correspond",
    noWebsitesBody: "Essayez un autre terme.",
    websitesTable: "Résultats de recherche de sites web",
    columnSite: "Site",
    columnDomain: "Domaine",
    columnServices: "Services",
  },
} as const;
