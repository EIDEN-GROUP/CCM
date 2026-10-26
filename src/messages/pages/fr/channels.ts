/**
 * The `pages.channels` strings, in French.
 *
 * Hand-written; never machine-translated at render time. Typed against the
 * English shape, so a missing key fails the build.
 */
import type { DeepStringify } from "../../en";
import type { channels as english } from "../en/channels";

/** The shape this file must satisfy. */
export type ChannelsShape = DeepStringify<typeof english>;

export const channels: ChannelsShape = {
  overview: {
    accountLauncher: "Lanceur de comptes",
    accountLauncherSubtitle: "Ouvrez les comptes navigateur disponibles dans cet espace.",
    openLauncher: "Ouvrir le lanceur",
    launcherLoadError: "Les raccourcis de comptes n'ont pas pu Ãªtre chargÃ©s. Vous pouvez toujours ouvrir le lanceur.",
    openProvider: "Ouvrir les comptes {provider}",
    providerAccountCount: "{count} comptes",
    noProviderAccounts: "Aucun compte pour le moment",
    noLauncherProviders: "Aucun fournisseur disponible.",
    noConnectedLauncherAccounts: "Aucun compte connecté pour le moment",
    noConnectedLauncherAccountsHint: "Ajoutez un compte dans le lanceur de comptes pour le retrouver ici avec un bouton de lancement rapide.",
    quickLaunch: "Lancement rapide",
    launchingAccount: "Ouverture…",
    quickLaunchAccount: "Lancer rapidement {account}",
    launchPermissionRequired: "Vous n’avez pas l’autorisation de lancer des comptes.",
    title: "Bienvenue dans CCM",
    subtitle: "Votre hub central pour le marketing, la croissance et les opérations numériques.",
    portfolioKpis: "Performance du portefeuille",
    channelTrends: "Tendance des canaux",
    topCampaigns: "Meilleures campagnes",
    topKeywords: "Classements de mots-clés",
    alerts: "Alertes & Actions",
    connections: "Fraîcheur des données & Connexions",
    viewAllCampaigns: "Voir toutes les campagnes",
    viewAllKeywords: "Voir tous les mots-clés",
    flow: "Le flux CCM",
    flowBody: "Des plateformes externes aux insights exploitables.",
    adSpend: "Dépenses publicitaires",
    conversions: "Conversions",
    organicClicks: "Clics organiques",
    socialEngagement: "Engagement social",
    siteHealth: "Santé du site",
    sessions: "Sessions GA4",
    costPerConversion: "Coût par conversion",
    roas: "ROAS",
    impressions: "Impressions",
    ctr: "CTR",
    averagePosition: "Position moyenne",
    connectSource: "Connecter une source",
    noLiveDataTitle: "Aucune donnée en direct",
    noLiveDataBody:
      "CCM est connecté à votre espace de travail mais aucun fournisseur n'a encore remonté de données. Les chiffres ci-dessous restent vides jusqu'à la synchronisation d'une source — CCM ne remplace jamais des données manquantes par des zéros. Connectez un fournisseur depuis",
    ga4KeyEvents: "Événements clés GA4",
    clicks: "Clics",
    channelTrendsSubtitle: "Performance sur tous les canaux",
    noTrendDataTitle: "Aucune donnée de tendance",
    noTrendDataBody:
      "Le graphique se remplit dès la première synchronisation.",
    organicSearch: "Recherche organique",
    paidSearch: "Recherche payante",
    chartSummarySeries:
      "{value} par jour — {series} — du {firstDay} au {lastDay}.",
    chartDataTableCaption:
      "Les valeurs quotidiennes tracées dans le graphique des tendances par canal.",
    topCampaignsSubtitle: "Par dépenses sur la période sélectionnée",
    noCampaignsTitle: "Aucune campagne",
    noCampaignsBody:
      "Connectez Google Ads pour voir les performances des campagnes.",
    noConversionValue: "Aucune valeur de conversion signalée",
    conversionValueOverSpend: "Valeur des conversions ÷ dépenses",
    impressionWeighted: "Pondéré par les impressions, Search Console",
    connectionsSubtitle:
      "Chaque source, son état et l'ancienneté de ses données",
    manageConnections: "Gérer",
    connectionsError:
      "Impossible de lire les connexions fournisseurs : {message}",
    noProvidersTitle: "Aucun fournisseur connecté",
    noProvidersBody:
      "Connectez Google Ads, GA4, Search Console, GTM ou une boîte aux lettres pour commencer à remonter des données.",
    goToIntegrations: "Aller aux intégrations",
    metricsError: "Les indicateurs n'ont pas pu être lus.",
    freshnessUpToDate: "À jour",
    freshnessRefreshOverdue: "Actualisation en retard",
    freshnessStale: "Les données sont périmées",
    freshnessSyncFailing:
      "Synchronisation en échec — aucune exécution réussie pour l'instant",
    freshnessNotConnected: "Non connecté — aucune donnée pour l'instant",
    freshnessLastSyncFailed:
      "Dernière synchronisation en échec — affichage des dernières données bonnes",
  },
  websites: {
    title: "Sites web",
    subtitle: "Portefeuille de sites, pages, trafic et santé.",
    register: "Enregistrer un site web",
    domain: "Domaine",
    owner: "Responsable",
    services: "Services",
    languages: "Langues",
    health: "Santé",
    pages: "Pages",
    lastSync: "Dernière synchronisation",
    addingSiteTitle: "Ajouter un site",
    addingSiteBody:
      "L'enregistrement d'un site le relie à une propriété Google Search Console, à une propriété GA4 et, le cas échéant, à un conteneur GTM. Le registre ne conserve que le domaine et les identifiants des fournisseurs — jamais une copie de la page du site.",
    portfolio: "Portefeuille",
    portfolioCountOne: "{count} site",
    portfolioCountMany: "{count} sites",
    noSitesTitle: "Aucun site enregistré",
    noSitesBody:
      "Enregistrez medicalbay.ma pour commencer à suivre le trafic, la recherche et la santé du site.",
    site: "Site",
    hostnames: "Noms d'hôte",
    lastCheck: "Dernière vérification",
    pagesLandingTitle: "Pages & pages de destination",
    pagesLandingSubtitle:
      "Inventaire regroupé par langue, service et classe de page",
    noPagesTitle: "Aucune page inventoriée",
    noPagesBody:
      "L'exploration technique remplit ce tableau. CCM enregistre l'URL, la locale, la classe de page et les métadonnées — pas une copie de la page.",
    websitePages: "Pages du site",
    locale: "Locale",
    pageClass: "Classe",
    service: "Service",
  },
  googleAds: {
    title: "Google Ads",
    subtitle: "Dépenses, campagnes, conversions et rythme de dépense.",
    account: "Compte",
    campaigns: "Campagnes",
    adGroups: "Groupes d'annonces",
    keywords: "Mots-clés",
    searchTerms: "Termes de recherche",
    spend: "Dépenses",
    impressions: "Impressions",
    clicks: "Clics",
    ctr: "CTR",
    avgCpc: "CPC moyen",
    conversions: "Conversions",
    convValue: "Valeur des conversions",
    cpa: "CPA",
    roas: "ROAS",
    budget: "Budget",
    pacing: "Rythme de dépense",
    readOnlyNotice:
      "Lecture seule. Les modifications de campagne, de budget et les pauses sont désactivées et exigent une approbation explicite, un aperçu et un journal d'audit.",
    readOnlyTitle: "Lecture seule",
    readOnlyBody:
      "Les modifications de campagne, de budget, les pauses et les opérations groupées sont désactivées dans cette version. Elles exigent un aperçu, une approbation explicite, une trace d'audit et une référence de version réversible avant de pouvoir être proposées.",
    campaignsSubtitle:
      "Performance du compte sur la période sélectionnée",
    noCampaignsTitle: "Aucune donnée de campagne",
    noCampaignsBody:
      "Connectez un compte Google Ads. Le niveau d'accès à l'API Google Ads est accordé sur le projet Google Cloud — voir Intégrations pour les étapes de configuration.",
    metricsError: "Les indicateurs Google Ads n'ont pas pu être lus.",
  },
  analytics: {
    title: "GA4 & Attribution",
    subtitle: "Sources de trafic, événements, entonnoirs et événements clés.",
    property: "Propriété",
    sessions: "Sessions",
    activeUsers: "Utilisateurs actifs",
    newUsers: "Nouveaux utilisateurs",
    keyEvents: "Événements clés",
    revenue: "Revenu",
    landingPages: "Pages de destination",
    sources: "Sources de trafic",
    funnel: "Entonnoir",
    engagement: "Engagement",
    content: "Performance du contenu",
    discrepancyNotice:
      "Les conversions Google Ads et les événements clés GA4 utilisent des fenêtres et définitions d'attribution différentes. Ils sont affichés côte à côte, jamais fusionnés.",
    comparabilityTitle: "Comparabilité",
    comparabilityBody:
      "Les conversions Google Ads et les événements clés GA4 utilisent des fenêtres d'attribution et des définitions de conversion différentes. CCM les affiche côte à côte et signale la différence ; il ne les réconcilie jamais silencieusement.",
    keyEventRate: "Taux d'événements clés",
    pageViews: "Pages vues",
    landingPagesSubtitle: "Sessions par page de destination",
    noLandingDataTitle: "Aucune donnée de page de destination",
    noLandingDataBody:
      "Connectez une propriété GA4 pour voir quelles pages génèrent des sessions.",
    sourcesSubtitle: "Sessions par source / support",
    noSourceDataTitle: "Aucune donnée de source",
    noSourceDataBody:
      "Les données de sources de trafic apparaissent dès que GA4 a remonté de données.",
    funnelSubtitle: "Sessions → sessions engagées → événements clés",
    noFunnelDataTitle: "Aucune donnée d'entonnoir",
    noFunnelDataBody:
      "L'entonnoir est construit à partir des données de sessions et d'événements clés GA4.",
    engagedSessions: "Sessions engagées",
    metricsError: "Les indicateurs GA4 n'ont pas pu être lus.",
  },
  gtm: {
    title: "GTM & Tracking",
    subtitle: "Inventaire des conteneurs, balises, déclencheurs et validation.",
    container: "Conteneur",
    workspace: "Espace de travail",
    tags: "Balises",
    triggers: "Déclencheurs",
    variables: "Variables",
    versions: "Versions",
    environments: "Environnements",
    expectedMeasurementId: "ID de mesure GA4 attendu",
    verification: "Vérification",
    publishNotice:
      "Publier une version de conteneur exige un aperçu, un approbateur autorisé, une référence de version avant/après et une trace d'audit.",
    publishingUnavailableTitle: "La publication n'est pas disponible",
    publishingUnavailableBody:
      "CCM inventorie le conteneur et vérifie l'identifiant de mesure GA4 attendu. Publier une version exige un aperçu, un approbateur autorisé, une référence de version avant/après et une trace d'audit : l'action de publication est donc absente, et pas seulement désactivée.",
    inventoryError:
      "L'inventaire des conteneurs n'a pas pu être lu : {message}",
    containerVersions: "Versions des conteneurs",
    containerVersionsSubtitle: "Inventaire le plus récent par conteneur",
    noInventoryTitle: "Aucun inventaire de conteneur",
    noInventoryBody:
      "Connectez un conteneur Tag Manager. Le site Medical Bay utilise actuellement GTM-WF77DFJD.",
    version: "Version",
    expectedGa4Id: "ID GA4 attendu",
    captured: "Capturé",
    trackingChecklist: "Liste de contrôle du suivi",
    trackingChecklistSubtitle:
      "Chaque ligne est tranchée à partir de la capture lue ; un contrôle impossible à calculer le dit",
    containerLabel: "Conteneur {container}",
    capturedSuffix: "· capturé {age}",
    captureCounted: "La capture a dénombré {tags} et {triggers}.",
    unknownCountOf: "un nombre inconnu de",
    tagSingular: "balise",
    tagsPlural: "balises",
    triggerSingular: "déclencheur",
    triggersPlural: "déclencheurs",
    notChecked: "Non vérifié",
    pass: "Conforme",
    fail: "Échec",
    stale: "Périmé",
    captureNoDate:
      "La capture ne porte aucune date de capture lisible, elle ne peut donc pas être comparée à la version publiée.",
    captureNoPublishedVersion:
      "La capture n'enregistre aucune version publiée, il n'y a donc aucune date à laquelle comparer la capture.",
    capturePredatesPublished:
      "La capture ({captured}) précède la version publiée ({published}).",
    captureNewerThanPublished:
      "La capture ({captured}) est plus récente que la version publiée ({published}).",
    measurementNoDefinitions:
      "La capture a enregistré un nombre de balises plutôt que les définitions, CCM ne peut donc pas dire quel identifiant de mesure elles référencent.",
    measurementNoExpectedId:
      "L'instantané n'enregistre aucun identifiant de mesure GA4 attendu, il n'y a donc rien auquel comparer les balises.",
    measurementMissingIds:
      "Aucune balise de la capture ne référence {ids}.",
    measurementAllIds:
      "Une balise de la capture référence chaque identifiant de mesure attendu ({ids}).",
    duplicateNoDefinitions:
      "La capture a enregistré un nombre de balises plutôt que les définitions, les doublons ne peuvent donc pas être exclus.",
    duplicateNoTags:
      "La capture ne contient aucune balise GA4, il n'y a donc aucun doublon à exclure.",
    duplicateSharedIdOne:
      "{ids} est référencé par plus d'une balise dans la capture.",
    duplicateSharedIdMany:
      "{ids} sont référencés par plus d'une balise dans la capture.",
    duplicateSharedTriggerOne:
      "{count} déclencheur déclenche plus d'une balise GA4 dans la capture.",
    duplicateSharedTriggerMany:
      "{count} déclencheurs déclenchent plus d'une balise GA4 dans la capture.",
    duplicateCleanOne:
      "Aucun identifiant de mesure ni déclencheur n'est partagé par la balise GA4 ({count}) dans la capture.",
    duplicateCleanMany:
      "Aucun identifiant de mesure ni déclencheur n'est partagé par les {count} balises GA4 dans la capture.",
    trackingPlanMissing:
      "CCM ne détient aucun plan de suivi d'événements approuvé, il n'y a donc aucune liste d'événements à comparer au conteneur.",
    noCaptureNoDate:
      "Aucune capture de conteneur n'a été enregistrée, il n'y a donc aucune date de capture à comparer à une version publiée.",
    noCaptureNoMeasurement:
      "Aucune capture de conteneur n'a été enregistrée, CCM ne peut donc pas dire si une balise GA4 référence l'identifiant de mesure attendu.",
    noCaptureNoDuplicates:
      "Aucune capture de conteneur n'a été enregistrée, les balises GA4 en doublon ne peuvent donc pas être exclues.",
  },
  seo: {
    title: "SEO & Classements",
    subtitle: "Search Console, contrôles techniques et classements suivis.",
    clicks: "Clics",
    impressions: "Impressions",
    ctr: "CTR",
    position: "Position moyenne",
    queries: "Requêtes",
    pages: "Pages",
    countries: "Pays",
    devices: "Appareils",
    technical: "SEO technique",
    backlinks: "Liens entrants",
    content: "Opportunités de contenu",
    sourceNotice:
      "Les chiffres Search Console proviennent de Google. Les observations de classement tierces sont présentées séparément et ne sont jamais mélangées.",
    twoMeasurementsTitle: "Deux mesures différentes",
    twoMeasurementsBody:
      "Les clics, les impressions et la position moyenne de Search Console sont rapportés par Google. Les observations de classement proviennent d'un fournisseur tiers et sont affichées dans leur propre tableau. CCM ne les mélange jamais, car elles ne mesurent pas la même chose.",
    organicImpressions: "Impressions organiques",
    topQueries: "Principales requêtes",
    topQueriesSubtitle: "Par clics, d'après Search Console",
    noQueryDataTitle: "Aucune donnée de requête",
    noQueryDataBody:
      "Connectez une propriété Search Console vérifiée pour voir les performances réelles des requêtes.",
    query: "Requête",
    rankPosition: "Position",
    trackedRankings: "Classements suivis",
    trackedRankingsSubtitle:
      "Observations tierces, tenues séparées de Search Console",
    rankError:
      "Impossible de lire les instantanés de classement : {message}",
    noRankSnapshotsTitle: "Aucun instantané de classement",
    noRankSnapshotsBody:
      "Les observations de classement apparaissent dès qu'un fournisseur de suivi est connecté et qu'un projet est configuré.",
    rankSnapshots: "Instantanés de classement",
    observed: "Observé",
    metricsError: "Les indicateurs Search Console n'ont pas pu être lus.",
  },
} as const;
