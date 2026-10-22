/**
 * The `pages.admin` strings, in Arabic.
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
    title: "التنبيهات والإجراءات",
    subtitle: "الأدلّة والأثر والمالك وسجلّ المعالجة.",
    queue: "قائمة الإجراءات",
    severity: "الخطورة",
    observed: "المرصود",
    baseline: "خط الأساس",
    confidence: "الثقة",
    owner: "المالك",
    due: "الاستحقاق",
    status: "الحالة",
    resolve: "معالجة",
    snooze: "تأجيل",
    acknowledge: "استلام",
    rules: "قواعد التنبيه",
    newRule: "قاعدة جديدة",
    threshold: "العتبة",
    minVolume: "الحد الأدنى للحجم",
    quietPeriod: "فترة السكون",
    hysteresis: "التخلّف",

    whyQuietTitle: "لماذا تبقى التنبيهات صامتة",
    whyQuietBody:
      "تحتاج القاعدة إلى حدّ أدنى للحجم، وإلى مهلة سماحٍ ريثما تتعلّم خطّ الأساس، وإلى نافذة تخلّفٍ قبل أن تُغلق تلقائيًا، وإلى فاصل تكرارٍ قبل أن تنطلق من جديد. لذلك لا تملأ المؤشرات منخفضة الحجم وهوامش نهاية الأسبوع قائمة الإجراءات بضجيج.",

    openAlertsOne: "تنبيه واحد مفتوح",
    openAlertsOther: "{count} تنبيهات مفتوحة",
    emptyTitle: "لا توجد تنبيهات",
    emptyBody:
      "تظهر التنبيهات عندما تتجاوز قاعدةٌ عتبتها. أنشئ القواعد من تبويب «قواعد التنبيه» بعد توصيل مصدر.",
    alertsTable: "التنبيهات",
    columnAlert: "التنبيه",
    columnReason: "السبب",
    columnOpened: "فُتح في",

    tasksTitle: "المهام",
    tasksSubtitle: "عناصر عمل نشأت عن القواعد أو عن المحلّل الذكي أو عن شخص",
    tasksEmptyTitle: "لا توجد مهام",
    tasksEmptyBody:
      "تُنشأ المهام من تنبيه، أو يقترحها المحلّل الذكي لتوافق عليها.",
    tasksTable: "عناصر الإجراءات",
    columnTask: "المهمة",
    columnPriority: "الأولوية",

    rulesSubtitle: "العتبات والحدّ الأدنى للحجم والتخلّف وفترات السكون",
    rulesEmptyTitle: "لا توجد قواعد مهيّأة",
    rulesEmptyBody:
      "تحتاج القاعدة إلى مؤشّر واتجاه وعتبة وحدّ أدنى للحجم قبل أن تنطلق.",
    rulesTable: "قواعد التنبيه",
    columnDirection: "الاتجاه",
    columnEnabled: "مُفعّلة",
    hysteresisWindows: "{count} نوافذ",

    on: "مُفعّل",
    off: "مُعطّل",
    severityInfo: "معلومة",
    severityWarning: "تحذير",
    severityCritical: "حرِج",
    statusOpen: "مفتوح",
    statusAcknowledged: "تمّ الاستلام",
    statusSnoozed: "مُؤجَّل",
    statusResolved: "مُعالَج",
    taskStatusInProgress: "قيد التنفيذ",
    taskStatusDone: "منجزة",
    taskStatusCancelled: "ملغاة",
    priorityHigh: "مرتفعة",
    priorityNormal: "عادية",
    priorityLow: "منخفضة",
    sourceManual: "يدوي",
    sourceRule: "قاعدة",
    sourceAnalyst: "المحلّل الذكي",
    directionIncrease: "ارتفاع",
    directionDecrease: "انخفاض",
  },
  reports: {
    title: "التقارير والمحلّل الذكي",
    subtitle: "ملخّصات مجدولة وشروحات مستندة إلى البيانات.",
    daily: "يومي",
    weekly: "أسبوعي",
    monthly: "شهري",
    siteReport: "تقرير الموقع",
    adsReport: "تقرير الإعلانات",
    seoReport: "تقرير تحسين محركات البحث",
    socialReport: "تقرير التواصل الاجتماعي",
    connectionReport: "حالة الاتصالات",
    emailDigest: "ملخّص عمليات البريد",
    exportCsv: "تصدير CSV",
    exportPdf: "تصدير / طباعة",
    safeMode: "مشاركة آمنة (وضع الخصوصية)",
    safeModeBody:
      "يخفي معرّفات العملاء وصناديق البريد والحسابات الحسّاسة في العرض المُصدَّر.",
    ask: "اسأل المحلّل الذكي",
    askPlaceholder: "اسأل عن تغيّر في بياناتك…",
    sources: "المصادر المستخدمة",
    caveats: "القيود",
    notGrounded:
      "يحتاج هذا الجواب إلى بيانات لم تُزامَن بعد في CCM. لم يُستنتج شيء.",

    exportContainsTitle: "ما الذي يحتويه التصدير",
    exportContainsBody:
      "يحمل كل تصدير القيم نفسها التي روجعت على الشاشة، إضافةً إلى حداثة البيانات وتعريفات المؤشّرات والقيود المنطبقة. ويقنّع وضع «المشاركة الآمنة» معرّفات العملاء وصناديق البريد والحسابات الحسّاسة قبل أن يغادر أيّ شيء CCM.",
    generateDigest: "أنشئ الملخّص اليومي",

    scheduledDigestsTitle: "الملخّصات المجدولة",
    scheduledDigestsSubtitle: "يبنيها العامل من السجلّات التي تزامنت",
    noDigestScheduledTitle: "لا يوجد ملخّص مجدول",
    noDigestScheduledBody:
      "الملخّص هو الإحاطة المجدولة التي تلخّص ما تغيّر في قنواتك وحملاتك وحساباتك الاجتماعية خلال فترة. اطلب من مسؤول النشر تفعيل الملخّصات لمساحة العمل هذه.",
    lastRun: "آخر تشغيل",
    nextRun: "التشغيل التالي",
    notScheduled: "غير مجدول",
    buildNow: "أنشئ الآن",
    recentDigests: "الملخّصات الأخيرة",
    digestQueuedTitle: "الملخّص في الطابور",
    digestFailedTitle: "تعذّر وضع الملخّص في الطابور",
    digestQueued: "تمّ وضع الملخّص في الطابور.",
    digestFallback: "ملخّص",
    noDataAvailable: "لم تتوفّر أيّ بيانات لهذه الفترة.",
    periodTo: "من {start} إلى {end}",

    reportCatalogueTitle: "دليل التقارير",
    reportCatalogueSubtitle: "ملخّصات يومية وأسبوعية وشهرية",
    noDefinitionsTitle: "لا توجد تعريفات تقارير",
    noDefinitionsBody:
      "تصف تعريفات التقارير الأقسام التي يتضمّنها الملخّص ومن يستلمه. تُنشأ في الإعدادات.",
    reportDefinitionsTable: "تعريفات التقارير",
    columnReport: "التقرير",
    columnCadence: "الوتيرة",
    columnFormats: "الصيغ",
    columnLastRun: "آخر تشغيل",

    recentRunsTitle: "التشغيلات الأخيرة",
    recentRunsSubtitle: "الملخّصات المُولَّدة",
    noRunsTitle: "لم يُولَّد أي تقرير بعد",
    noRunsBody: "تظهر هنا عملية التشغيل بمجرّد توليد ملخّص.",
    reportRunsTable: "تشغيلات التقارير",
    columnPeriod: "الفترة",
    columnSafeMode: "مشاركة آمنة",
    columnGenerated: "وُلّد في",
    onDemand: "عند الطلب",
    runStatusPending: "قيد الانتظار",
    runStatusReady: "جاهز",
    runStatusFailed: "فشل",

    analystCardTitle: "المحلّل الذكي",
    analystCardSubtitle: "إجابات مستندة إلى البيانات مع أثر مصادر قابل للتدقيق",
    analystUnavailableBody:
      "المحلّل الذكي غير متاح في هذا النشر. اطلب من مسؤول النشر تفعيله. تأتي الأرقام في هذه التقارير من تطبيقات المزوّدين التي تربطها في {link}.",

    on: "مُفعّل",
    off: "مُعطّل",
    done: "تمّ.",
    serverUnreachable: "تعذّر على CCM الوصول إلى الخادم.",
    requestFailed: "فشل الطلب (HTTP {status}).",
  },
  integrations: {
    title: "التكاملات",
    subtitle: "الاتصالات والنطاقات والحصص وحداثة البيانات.",
    catalogue: "دليل الاتصالات",
    scopes: "النطاقات",
    apiVersion: "إصدار الواجهة",
    lastSuccess: "آخر نجاح",
    lastFailure: "آخر فشل",
    quota: "الحصة",
    nextRefresh: "التحديث التالي",
    setupChecklist: "قائمة الإعداد",
    capabilityMatrix: "مصفوفة القدرات",
    changelog: "مراقبة إصدارات الواجهات",

    honestStatusTitle: "حالة صادقة",
    honestStatusBody:
      "لا تعرض البطاقة «متّصل» إلا إذا كان CCM يملك رمز واجهة برمجية صالحًا لذلك الحساب. ويعرض كل ما عدا ذلك ما هو ناقص، كما تسرد قائمة الإعداد أدناه الموافقات التي ما زالت معلّقة.",

    connectionsTitle: "الاتصالات",
    connectionsSubtitleOne: "اتصال واحد مهيّأ",
    connectionsSubtitleOther: "{count} اتصالات مهيّأة",
    noConnectionsTitle: "لا يوجد مزوّد متّصل",
    noConnectionsBody:
      "وصّل إعلانات Google أو GA4 أو Search Console أو GTM أو Gmail أو حسابًا على وسائل التواصل لتبدأ التقارير.",
    connectionsTable: "الاتصالات",
    columnConnection: "الاتصال",
    columnAccessLevel: "مستوى الوصول",

    providerCatalogueTitle: "دليل المزوّدين",
    providerCatalogueSubtitle: "كل مزوّد يعرفه CCM وما زال ينقصه",
    noProviderCatalogueTitle: "لا يوجد مزوّدون في الدليل",
    noProviderCatalogueBody:
      "سجلّ المزوّدين في CCM فارغ. اطلب من مسؤول النشر تثبيت دليل المزوّدين.",
    providerCatalogueTable: "دليل المزوّدين",
    columnCategory: "الفئة",
    columnStillNeeded: "ما زال مطلوبًا",
    columnDocs: "التوثيق",

    watchlistSubtitle: "أين يؤثّر إهمال إصدار، وكيف تعرف ذلك",
    watchlistGoogleAds:
      "أُلغي رموز المطورين في 9 سبتمبر 2026. صارت مستويات الوصول تعيش في مشروع Google Cloud (Test وExplorer وBasic وStandard). ويتطلب Basic وStandard التحقّق من العلامة التجارية.",
    watchlistLinkedIn:
      "إصدارات Marketing API مرتبطة بالزمن ويجب ترحيلها وفق جدولها. أما الإصدار المثبَّت فيسكن سجلّ المزوّدين، لا متناثرًا في الشيفرة.",
    watchlistGoogleApis:
      "تُصدَّر إصدارات Analytics Data API وSearch Console API وTag Manager API v2 وGmail API مركزيًا في سجلّ المزوّدين.",

    connectProvider: "وصّل مزوّدًا",
    close: "إغلاق",
    noAppConfiguredTitle: "لم يُهيّأ أي تطبيق مزوّد بعد",
    noAppConfiguredBody:
      "يحتاج كل مزوّد إلى معرّف عميل وسر عميل خاصين به قبل أن يمكن وصله. أضِفهما في {link}، ثم عُد إلى هنا.",
    providerAppsLink: "الإعدادات — تطبيقات المزوّدين",
    appNotConfigured: "التطبيق غير مهيّأ",
    setItUp: "هيّئه",

    categoryAdvertising: "إعلانات",
    categoryAnalytics: "تحليلات",
    categorySearch: "بحث",
    categoryTagging: "وسوم",
    categorySocial: "تواصل اجتماعي",
    categoryEmail: "بريد إلكتروني",
    categorySeo: "تحسين محركات البحث",
    categoryUx: "تجربة المستخدم",
    categorySite: "موقع",

    serverUnreachable: "تعذّر على CCM الوصول إلى الخادم.",
    requestFailed: "فشل الطلب (HTTP {status}).",
  },
  audit: {
    title: "التدقيق والأمان",
    subtitle: "الأدوار والصلاحيات والاحتفاظ بالبيانات والنشاط.",
    users: "المستخدمون",
    roles: "الأدوار",
    permissions: "الصلاحيات",
    invite: "دعوة مستخدم",
    activity: "سجلّ النشاط",
    retention: "الاحتفاظ بالبيانات",
    backups: "النسخ الاحتياطية",
    sessions: "الجلسات النشطة",
    mfa: "المصادقة متعددة العوامل / مفاتيح المرور",

    leastPrivilegeTitle: "أقلّ الامتيازات افتراضيًا",
    leastPrivilegeBody:
      "يُمنح الوصول بالدور على مستوى مساحة العمل، وحيثما يكون الدور محصورًا في حساب واحد — مثل {mailboxUser} — بمنح صريح على حساب بعينه. ويفرض ذلك أمان الصفوف في قاعدة البيانات، فإخفاء عنصر من التنقّل ميزةٌ لا وسيلةُ ضبط.",

    membersTitle: "الأعضاء",
    membersSubtitle: "كل من لديه وصول إلى مساحة العمل هذه",
    noMembersTitle: "لا يوجد أعضاء",
    noMembersBody: "يظهر الأعضاء هنا بمجرّد دعوتهم.",
    membersTable: "أعضاء مساحة العمل",
    columnUser: "المستخدم",
    columnRole: "الدور",
    columnInvited: "دُعِي في",

    rolesAndPermissionsTitle: "الأدوار والصلاحيات",
    rolesAndPermissionsSubtitle: "المصفوفة التي تفرضها قاعدة البيانات",
    noRolesTitle: "لا توجد أدوار مهيّأة",
    noRolesBody:
      "تظهر الأدوار التي تطبّقها مساحة العمل هذه هنا بعد تثبيتها. اطلب من مسؤول النشر تثبيتها.",
    rolesTable: "الأدوار",
    severity: "الخطورة",
    columnAccountScoped: "محصور بالحساب",
    perAccount: "لكل حساب",
    workspaceWide: "لكل مساحة العمل",
    columnDescription: "الوصف",

    activitySubtitle: "سجلّ لا يُعدَّل للجراءات الحسّاسة",
    noActivityTitle: "لم يُسجَّل أي نشاط بعد",
    noActivityBody:
      "تُسجَّل هنا عمليات فتح الحسابات وتغييرات الاتصالات وتغييرات الصلاحيات.",
    activityTable: "أحداث التدقيق",
    columnAction: "الإجراء",
    columnActor: "الفاعل",
    columnEntity: "الكيان",
    columnTarget: "الهدف",
    columnWhen: "متى",

    statusActive: "نشط",
    statusInvited: "مُدعى",
    statusSuspended: "موقوف",
    severityInfo: "معلومة",
    severityWarning: "تحذير",
    severityCritical: "حرِج",
  },
  settings: {
    title: "الإعدادات",
    subtitle: "الأشخاص والصلاحيات والاحتفاظ بالبيانات وسجلّ التدقيق.",

    leastPrivilegeTitle: "أقلّ الامتيازات افتراضيًا",
    leastPrivilegeBody:
      "يمنح الدور صلاحيات على مستوى الميزات في كل مساحة العمل. ويحتاج مستخدم صندوق البريد إلى منح صريح على صندوق البريد نفسه، بحيث يقرأ شخص واحد صندوقًا واحدًا دون رؤية البقية.",

    membersTitle: "الأعضاء",
    membersSubtitle: "{count} في مساحة العمل هذه",
    noMembersTitle: "لا يوجد أعضاء بعد",
    noMembersBody:
      "يظهر الأعضاء هنا بعد دعوتهم. ادعُ أشخاصاً من قسم الأشخاص والأدوار.",
    membersTable: "أعضاء مساحة العمل",
    columnUser: "المستخدم",
    columnRole: "الدور",
    columnInvited: "دُعِي في",

    accountGrantsTitle: "منح الحسابات",
    accountGrantsSubtitle: "من يقرأ أيّ حساب على حدة",
    noAccountGrantsTitle: "لا توجد منح لحسابات",
    noAccountGrants:
      "الأعضاء الذين يمتدّ دورهم إلى مساحة العمل بأكملها يصلون إلى كل الحسابات أصلاً، فلا حاجة إلى منح لكل حساب.",
    accountGrantsTable: "منح الحسابات",
    columnAccount: "الحساب",
    columnPermission: "الصلاحية",

    retentionTitle: "الاحتفاظ بالبيانات",
    retentionSubtitle: "المدة التي يُحتفظ فيها بكل نوع من السجلّات",
    retentionFactsLabel: "حقائق المؤشّرات اليومية",
    retentionFactsValue: "25 شهرًا",
    retentionFactsNote: "يُضبط في إعدادات الاحتفاظ.",
    retentionSyncLabel: "عمليات المزامنة والأخطاء",
    retentionSyncValue: "90 يومًا",
    retentionSyncNote: "تُنظَّف بمهمة الاحتفاظ.",
    retentionLaunchLabel: "أحداث فتح الحسابات",
    retentionLaunchValue: "12 شهرًا",
    retentionLaunchNote: "دليل على عمليات فتح الحسابات.",
    retentionAuditLabel: "أحداث التدقيق",
    retentionAuditValue: "24 شهرًا",
    retentionAuditNote: "قرار امتثال — راجعه قبل تقصيره.",
    retentionMailboxLabel: "بيانات صندوق البريد الوصفية",
    retentionMailboxValue: "12 شهرًا",
    retentionMailboxNote:
      "لكل صندوق بريد. ولا تُخزَّن نصوص الرسائل ولا مرفقاتها أبدًا.",
    retentionTicketLabel: "تذاكر فتح الحسابات",
    retentionTicketValue: "60 ثانية",
    retentionTicketNote:
      "مثبَّت بالتصميم: التذكرة إذنٌ لحظي.",
    retentionCredentialsLabel: "بيانات اعتماد المزوّد",
    retentionCredentialsValue: "حتى فصل الاتصال",
    retentionCredentialsNote: "تُحذف عند فصل الحساب.",

    preferencesTitle: "تفضيلاتك",
    preferencesSubtitle: "لغة الواجهة والمنطقة الزمنية وإخفاء البيانات عند التصدير",
    noPreferencesTitle: "لا توجد تفضيلات محفوظة",
    noPreferencesBody:
      "تظهر لغة كل شخص ومنطقةه الزمنية وإعدادات التصدير الخاصة به هنا بمجرد حفظه لتفضيلاته.",
    preferencesTable: "التفضيلات",
    columnLanguage: "اللغة",
    columnDefaultPeriod: "الفترة الافتراضية",
    columnShareSafe: "مشاركة آمنة",

    on: "مُفعّل",
    off: "مُعطّل",
    statusActive: "نشط",
    statusInvited: "مُدعى",
    statusSuspended: "موقوف",

    integrations: {
      secretNote:
        "يتم تشفير السر قبل تخزينه ولا يظهر مرة أخرى. اترك الحقل فارغًا للإبقاء على السر المخزن.",
      setUpApp: "إعداد التطبيق",
      check: "تحقق",
      title: "تطبيقات المزوّدين",
      subtitle:
        "أضِف معرّف العميل وسرّ كل تطبيق مزوّد، ثم وصّله.",
      replacesTitle: "ما الذي يحلّ محلّه",
      replacesBody:
        "كانت هذه القيم تعيش في بيئة النشر، ما يعني أن وصل مزوّد كان يستلزم تحرير ملف وإعادة نشر. وهي مخزَّنة هنا بدلًا من ذلك، مُعمَّاة، ويعمل زرّ «وصّل» فور حفظ النموذج.",
      appsTitle: "التطبيقات",
      appsSubtitle:
        "تطبيق واحد لكل مزوّد. وتغطّي Google التحليلات وSearch Console وTag Manager والإعلانات وYouTube وGmail.",
    },

    database: {
      title: "قاعدة البيانات",
      checking: "التحقّق من طبقة التفويض",
      checkingRls: "التحقّق ممّا إذا كان أمان الصفوف مُثبَّتًا…",
      authorisationLayer: "طبقة التفويض",
      layerReady:
        "أمان الصفوف مُثبَّت ومصفوفة الصلاحيات في مكانها. وكل استعلام محصور بقاعدة البيانات.",
      layerMissing:
        "دوالّ مساعدي RLS غير مرئية لـ PostgREST. إمّا أن تُوقفت عملية ترحيل قبل إنشائها، وإمّا أن ذاكرة المخطّط لم تُعَد تحميلها.",
      layerNotFound: "تعذّر العثور على طبقة التفويض.",
      notConfigured:
        "Supabase غير مُهيّأ، لذا تعذّر التحقّق من قاعدة البيانات.",
      checkFailed: "تعذّر تشغيل فحص قاعدة البيانات.",
      checkFailedWithDetail: "تعذّر تشغيل فحص التفويض: {detail}",
      checkReturned: "أعاد فحص التفويض {status}.",
      repairTitle: "إصلاح قاعدة البيانات مطلوب",
      repairSubtitle:
        "أمان الصفوف غير مُثبَّت، فيرى كل مستخدم منتجًا فارغًا",
      applyRepair: "طبِّق الإصلاح",
      repairBody:
        "يعيد ملفّ الإصلاح بناء دوالّ المساعدين وكل السياسات وبيانات البذر، ويطلب من PostgREST إعادة تحميل ذاكرة مخطّطه. ولا يغيّر النتيجة عند تكراره.",
      stepOne: "افتح {editor} الخاص بالمشروع في لوحة تحكم Supabase.",
      stepTwo: "افتح {file} في هذا المستودع والصق محتواه.",
      stepThree: "نفّذه، ثم أعد تحميل هذه الصفحة.",
      terminalLead:
        "من طرفية يكون فيها المشروع مرتبطًا، الإصلاح نفسه هو:",
      recheck: "إعادة الفحص",
    },
  },
  people: {
    title: "الأشخاص والأدوار",
    subtitle: "من في مساحة العمل، وإلى أيّ حدّ في كل تبويب يمكنه الوصول.",
    howAccessWorksTitle: "كيف يعمل الوصول",
    howAccessWorksBody:
      "يحدّد الدور إلى أيّ حدّ في التبويب يُسمح له بالوصول: {view} لقراءته، و{use} لاستخدام إجراءاته، و{edit} لتغيير إعداداته. وتُشتقّ هذه المستويات إلى صلاحيات الميزات التي تفرضها قاعدة البيانات، فما تراه هنا هو ما تسمح به سياسات أمان الصفوف فعليًا.",

    peopleTitle: "الأشخاص",
    peopleSubtitle: "كل من في مساحة العمل هذه وما يستطيع فعله",
    addPerson: "أضف شخصًا",
    workEmail: "البريد الإلكتروني للعمل",
    role: "الدور",
    create: "إنشاء",
    passwordHint:
      "تُولَّد كلمة مرور وتُعرض مرة واحدة. يتسجّل الشخص بها، ويمكن منحه كلمة مرور جديدة في أيّ وقت.",
    emptyTitle: "لا أحد هنا بعد",
    emptyBody: "أضِف أول شخص وامنحه دورًا.",
    you: "(أنت)",
    joined: "انضم في",
    restore: "إعادة التفعيل",
    suspend: "إيقاف",
    statusActive: "نشط",
    statusInvited: "مُدعى",
    statusSuspended: "موقوف",
    roleOf: "دور {name}",
    thisPerson: "هذا الشخص",

    rolesTitle: "الأدوار",
    rolesSubtitle: "ما يستطيع كل دور رؤيته واستخدامه وتغييره",
    ownerAccessTitle: "وصول المالك ثابت",
    ownerAccessBody:
      "يحتفظ المالك بكل الصلاحيات ولا يمكن تقليصها. ومساحة العمل التي لا تملك مديرًا لا يمكن إدارتها.",
    matrixCaption: "مستوى وصول دور {role} في كل تبويب",
    tabColumn: "التبويب",
    levelNone: "لا وصول",
    levelView: "عرض",
    levelUse: "استخدام",
    levelEdit: "تعديل",
    ownerOnly: "للمالك فقط",
    saveRole: "احفظ دور {role}",
    noChangesToSave: "لا توجد تغييرات للحفظ بعد.",
    discard: "تجاهل التغييرات",
    derivedPermissions:
      "{count} صلاحية مشتقّة من هذه المستويات: {permissions}.",
    noPermissions: "لا شيء",

    doneTitle: "تمّ",
    errorTitle: "لم ينجح ذلك",
    passwordTitle: "احفظ كلمة المرور هذه الآن",
    passwordBody:
      "يستطيع تسجيل الدخول بكلمة المرور أدناه، بصفته {role}. وتُعرض مرة واحدة فقط ولا تُخزَّن في أيّ مكان.",

    membersReadFailed: "تعذّرت قراءة الأشخاص.",
    rolesReadFailed: "تعذّرت قراءة الأدوار.",
    tabMapMissing:
      "لم تُثبَّت خريطة التبويبات بعد. طبِّق supabase/repair.sql — فهو ينشئ جدول role_tab_access ويبذر المستويات لكل دور.",
    repairRequired:
      "تنقص قاعدة البيانات جدولًا يحتاجه هذه الشاشة. طبِّق supabase/repair.sql.",
    serverUnreachable: "تعذّر على CCM الوصول إلى الخادم.",
    requestFailed: "فشل الطلب (HTTP {status}).",
    roleSaved: "يحمل دور {role} الآن {count} صلاحية.",
    updated: "تمّ التحديث.",

    roleLabels: {
      owner: "المالك",
      admin: "المشرف",
      marketing_analyst: "محلّل التسويق",
      seo: "تحسين محركات البحث",
      ads_manager: "مدير الإعلانات",
      social_manager: "مدير التواصل الاجتماعي",
      mailbox_user: "مستخدم صندوق البريد",
      read_only: "قراءة فقط",
    },
  },
  search: {
    title: "البحث",
    subtitleAll: "كل ما تتيحه أدوارك الوصول إليه",
    resultsFor: "نتائج البحث عن «{query}»",

    accountsTitle: "الحسابات",
    resultsOne: "نتيجة واحدة",
    resultsOther: "{count} نتائج",
    noAccountsTitle: "لا يوجد حساب مطابق",
    noAccountsBody:
      "جرّب عبارة أخرى، أو تصفّح مُشغّل الحسابات.",
    accountsTable: "نتائج البحث عن الحسابات",

    websitesTitle: "المواقع الإلكترونية",
    noWebsitesTitle: "لا يوجد موقع مطابق",
    noWebsitesBody: "جرّب عبارة أخرى.",
    websitesTable: "نتائج البحث عن المواقع",
    columnSite: "الموقع",
    columnDomain: "النطاق",
    columnServices: "الخدمات",
  },
} as const;
