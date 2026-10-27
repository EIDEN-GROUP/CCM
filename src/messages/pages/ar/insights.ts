/**
 * The `pages.insights` strings, in Arabic.
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
    title: "خرائط الحرارة وتجربة المستخدم",
    subtitle: "إشارات السلوك ونقاط الاحتكاك.",
    recordings: "التسجيلات",
    heatmaps: "خرائط الحرارة",
    scrollDepth: "عمق التمرير",
    rageClicks: "نقرات الغضب",
    deadClicks: "نقرات ميتة",
    errors: "أخطاء الصفحة",
    notice:
      "يربط CCM بمشروع Clarity الأصلي لإعادة التشغيل وخرائط الحرارة. لا يخزّن تسجيلات الجلسات ولا حقول النماذج ولا نص الصفحات.",
    storageNoticeTitle: "ما يخزّنه CCM",
    storageNoticeBody:
      "يحتفظ CCM باتصال Clarity ويحيل إلى المشروع الأصلي لإعادة التشغيل وخرائط الحرارة. لم تُقرأ أي مقياس سلوكي من Clarity: لا توجد مزامنة Clarity في هذا الإصدار، ولا يُخزَّن أي تسجيل جلسة أو خريطة حرارة أو حقل نموذج أو نص صفحة أو مُعرِّف خاص. تتم إعادة التشغيل داخل Clarity، ضمن ضوابط الخصوصية وإخفاء البيانات الخاصة المزوّد.",
    connectionsReadError: "تعذّرت قراءة اتصالات Clarity: {message}",
    projectsReadError: "تعذّرت قراءة مشاريع Clarity: {message}",
    connectionTile: "الاتصال",
    lastSyncTile: "آخر مزامنة",
    syncStateTile: "حالة المزامنة",
    projectsTile: "المشاريع",
    notConnected: "غير متصل",
    connectionStatusDetail: "حالة اتصال Clarity «{label}»: {status}.",
    noConnectionDetail:
      "لا يحتفظ CCM بأي اتصال Clarity لمساحة العمل هذه.",
    connectionsNotVisibleDetail:
      "تتطلّب قراءة اتصالات المزوّدين صلاحية «Integrations»، لذلك لا يمكن لهذا الدور معرفة ما إذا كان Clarity متصلاً.",
    unknownAgeDetail:
      "تعذّرت قراءة وقت المزامنة المسجَّل، لذلك لا يُعرف عمره.",
    neverSyncedDetail:
      "لم تنجح أي مزامنة لـ Clarity قط، لذلك لا توجد آخر مزامنة لعرضها.",
    lastSyncDetail: "آخر مزامنة ناجحة لـ Clarity. الهدف واحدة يومياً.",
    freshnessFresh: "محدَّث",
    freshnessAging: "التحديث متأخّر",
    freshnessStale: "البيانات قديمة",
    freshnessFailing: "المزامنة تفشل",
    neverSynced: "لم تُزامَن قط",
    freshnessDetailNever: "غير متصل — لا توجد بيانات بعد",
    freshnessDetailFailingNoRun:
      "المزامنة تفشل — لم تنجح أي عملية تشغيل بعد",
    freshnessDetailLastGood:
      "فشلت آخر مزامنة — يُعرض آخر بيانات سليمة",
    projectsDetail:
      "مشاريع Clarity المرتبطة في دليل الحسابات. تبقى التسجيلات وخرائط الحرارة داخل Clarity.",
    projectsUnknownDetail:
      "تتطلّب قراءة دليل الحسابات صلاحية «Integrations»، لذلك عدد مشاريع Clarity غير معروف.",
    connectionsCardTitle: "اتصالات Clarity",
    connectionsCardSubtitle: "حالة الاتصال والرابط إلى المشروع الأصلي",
    notVisibleTitle: "اتصالات Clarity غير ظاهرة لهذا الدور",
    notVisibleDescription:
      "تتطلّب قراءة اتصالات المزوّدين صلاحية «Integrations». اطلبها من أحد المشرفين لمعرفة ما إذا كان Clarity متصلاً.",
    noConnectionTitle: "لا يوجد اتصال Clarity",
    noConnectionDescription:
      "وصّل مشروع Microsoft Clarity لربط إعادة التشغيل الأصلية وخرائط الحرارة. يحتفظ CCM بالاتصال وحالة المزامنة؛ فهو لا يخزّن أي تسجيلات ولا يقرأ أي مقاييس سلوكية بعد.",
    lastSyncOn: "آخر مزامنة {date}",
    clarityProject: "مشروع Clarity {ids}",
    noClarityProject: "لا يوجد مشروع Clarity مرتبط",
    openClarity: "فتح Clarity",
  },
  social: {
    title: "وسائل التواصل الاجتماعي",
    subtitle: "الحسابات وأداء المحتوى والنشر.",
    accounts: "الحسابات",
    followers: "المتابِعون",
    reach: "الوصول",
    impressions: "الظهورات",
    engagements: "التفاعلات",
    engagementRate: "معدل التفاعل",
    posts: "المنشورات",
    topContent: "أفضل المحتوى",
    decliningContent: "محتوى متراجع",
    organic: "عضوي",
    paid: "مدفوع",
    notice:
      "التحليلات العضوية للحسابات والإعلانات الاجتماعية المدفوعة فئتان منفصلتان بمصدرين منفصلين، ولا تُجمعان في رقم واحد أبداً.",
    organicPaidNoticeTitle: "العضوي والمدفوع منفصلان",
    organicPaidNoticeBody:
      "تأتي التحليلات العضوية للحسابات ونتائج الحملات الاجتماعية المدفوعة من واجهات مختلفة، بصلاحيات مختلفة. تُعرض كفئتين منفصلتين ولا تُدمجان أبداً في رقم واحد.",
    connectedAccountsTitle: "الحسابات المتصلة",
    connectedAccountsSubtitle: "الهويات والصلاحيات وحداثة البيانات",
    noAccountsTitle: "لا توجد حسابات اجتماعية متصلة",
    noAccountsDescription:
      "وصّل Instagram أو Meta أو LinkedIn أو YouTube. يربط الموقع العام لـ Medical Bay‏ Instagram (medicalbay.maroc) وFacebook وLinkedIn (medical-bay-agadir) وTikTok.",
    accountsTableLabel: "الحسابات الاجتماعية",
    accountsReadError: "تعذّرت قراءة الحسابات المتصلة.",
    metricsReadError: "تعذّرت قراءة مقاييس الحسابات الاجتماعية: {message}",
    postsReadError: "تعذّرت قراءة مقاييس المنشورات الاجتماعية: {message}",
    engagementRateOfReach: "معدل التفاعل {rate} من الوصول",
    acrossConnectedAccounts: "عبر الحسابات المتصلة",
    noSocialDataYet: "لم تُزامَن بيانات اجتماعية بعد",
    contentPerformanceTitle: "أحدث المنشورات",
    contentPerformanceSubtitle: "المنشورات المنشورة في الفترة المحدّدة، من الأحدث إلى الأقدم.",
    noPostMetricsTitle: "لا توجد مقاييس للمنشورات",
    noPostMetricsDescription:
      "يظهر الأداء على مستوى المنشور بمجرد أن يرسل حساب اجتماعي تقريره.",
    postsTableLabel: "المنشورات الاجتماعية",
    platformColumn: "المنصة",
    formatColumn: "الصيغة",
    postedColumn: "تاريخ النشر",
    linkColumn: "الرابط",
  },
  inbox: {
    title: "صندوق الوارد الموحّد",
    subtitle: "صناديق البريد المصرّح بها وسلاسل الرسائل والمتابعات.",
    inbox: "الوارد",
    unread: "غير المقروء",
    sent: "المرسَل",
    drafts: "المسودّات",
    archive: "الأرشيف",
    threads: "السلاسل",
    attachments: "المرفقات",
    reply: "رد",
    replyAll: "رد على الجميع",
    forward: "إعادة توجيه",
    compose: "إنشاء رسالة",
    send: "إرسال",
    markRead: "تعليم كمقروء",
    markUnread: "تعليم كغير مقروء",
    star: "تمييز",
    mailbox: "صندوق البريد",
    sendingAs: "الإرسال باسم",
    confirmSendTitle: "إرسال هذه الرسالة؟",
    confirmSendBody:
      "أكّد المستلِم وهوية المرسِل. يُسجَّل هذا الإجراء في سجلّ التدقيق.",
    aiNotice:
      "الملخّصات بالذكاء الاصطناعي واستخراج المهام معطّلة لهذا الصندوق. لا تُرسَل نصوص الرسائل ولا المرفقات إلى نموذج خارجي دون موافقة صريحة.",
    starred: "المميّزة",
    mailboxPrivacyNoticeTitle: "خصوصية صناديق البريد",
    mailboxPrivacyNoticeBody:
      "محتوى صناديق البريد معزول عن بقية CCM ومحمي بمجموعة صلاحيات خاصة به وبسياسات على مستوى الصفوف. تُقرأ نصوص الرسائل والمرفقات من المزوّد عند فتح الرسالة ولا تُخزَّن هنا أبداً. التلخيص بالذكاء الاصطناعي مُفعَّل لكل صندوق على حدة — وهو معطَّل حتى يفعّله أحدهم صراحةً. يتطلّب الإرسال دائماً تأكيداً يعرض المستلِم وهوية المرسِل، ويُسجَّل كل إرسال في سجلّ التدقيق.",
    mailboxesCardTitle: "صناديق البريد",
    mailboxesCardSubtitle: "كل حساب مُصرَّح لك بقراءته",
    noMailboxTitle: "لا يوجد صندوق بريد متصل",
    noMailboxDescription:
      "يعمل medicalbay.ma على Google Workspace. وصّل صندوق بريد عبر واجهة Gmail API لإحضار الوارد إلى CCM.",
    mailboxesTableLabel: "صناديق البريد",
    addressColumn: "العنوان",
    aiProcessingColumn: "معالجة الذكاء الاصطناعي",
    enabled: "مُفعَّل",
    off: "معطَّل",
    messagesCardTitle: "الرسائل",
    messagesCardSubtitle:
      "ابحث وتصفّح واقرأ. تُجلب النصوص عند الطلب ولا تُخزَّن أبداً.",
    noConnectedMailboxTitle: "لا يوجد صندوق متصل للقراءة",
    noConnectedMailboxDescription:
      "يفتح متصفّح صناديق البريد بمجرد 연결 صندوق Gmail. تُظهر القائمة أعلاه ما هو متصل وما يحتاج بعد إلى الإعداد.",
    messageSentTitle: "تم إرسال الرسالة",
    sentNotice: "أُرسلت إلى {to} — «{subject}».",
    requestFailedTitle: "فشل طلب صندوق البريد",
    requestFailed: "فشل الطلب (HTTP {status}).",
    sendFailed: "فشل الإرسال (HTTP {status}).",
    serverUnreachable: "تعذّر على CCM الوصول إلى الخادم.",
    noMailboxClientDescription:
      "وصّل صندوق بريد عبر واجهة Gmail API في قسم «Integrations» لإحضار الوارد إلى CCM.",
    searchPlaceholder: "from:, subject:, is:unread, أو كلمة",
    sectionsLabel: "أقسام صندوق البريد",
    noSubject: "(بدون موضوع)",
    nothingHereTitle: "لا شيء هنا",
    noSearchMatchDescription: "لم تطابق أي رسالة هذا البحث.",
    sectionEmptyDescription: "هذا القسم من صندوق البريد فارغ.",
    pageNumber: "صفحة {page}",
    totalEstimate: "· نحو {count} إجمالاً",
    newMessage: "رسالة جديدة",
    confirmBeforeSendingTitle: "أكّد قبل الإرسال",
    confirmSendSummary:
      "سيُرسل هذا من {from} ({label}) إلى {to}{cc}، بالموضوع {subject}.",
    confirmSendCc: "، نسخة إلى {cc}",
    draftExpiry:
      "حُفظت مسودة في صندوق البريد. تنتهي صلاحيتها خلال {seconds} ثانية إذا لم تُؤكَّد.",
    confirmAndSend: "أكّد وأرسل",
    editInstead: "عدّل بدلاً من ذلك",
    to: "إلى",
    cc: "نسخة",
    optional: "اختياري",
    subject: "الموضوع",
    message: "الرسالة",
    prepareToSend: "تحضير الإرسال",
    closeThread: "إغلاق سلسلة الرسائل",
    nothingToReadTitle: "لا شيء للقراءة",
    nothingToReadDescription:
      "لم يُرجع المزوّد أي رسائل لهذه السلسلة.",
    unknownSender: "مرسِل غير معروف",
    removeStar: "إزالة التمييز",
    starMessage: "تمييز هذه الرسالة",
    starFailed: "تعذّر حفظ التمييز (HTTP {status}). لم تتغيّر الرسالة.",
    bodyUnreadable: "تعذّرت قراءة نص الرسالة من المزوّد.",
    hasAttachments: "تحتوي على مرفقات",
    selectConversationTitle: "اختر محادثة",
    selectConversationDescription:
      "اختر رسالة على اليسار لقراءتها، أو ابحث في صندوق البريد.",
    addCustomMailbox: "إضافة بريد مخصص",
    customMailboxHelp: "استخدم بريد نطاقك. يستقبل IMAP الرسائل ويرسلها SMTP.",
    mailboxDetails: "تفاصيل البريد",
    emailAddress: "عنوان البريد الإلكتروني",
    mailboxName: "الاسم المعروض في CCM",
    receiveSettings: "استقبال البريد (IMAP)",
    sendSettings: "إرسال البريد (SMTP)",
    imapServer: "خادم IMAP",
    smtpServer: "خادم SMTP",
    serverPort: "منفذ آمن",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    mailPasswordsEncrypted: "تُشفّر كلمات المرور قبل التخزين. يختبر CCM الاتصالين الآمنين قبل إضافة البريد.",
    testingConnection: "جارٍ اختبار خوادم البريد…",
    testAndAddMailbox: "اختبار وإضافة البريد",
    customSetupFailed: "تعذرت إضافة البريد. تحقق من إعدادات الخادم وحاول مجددًا.",
    mailSource: "اختر خدمة البريد الإلكتروني",
    gmailMail: "Gmail",
    customMail: "بريد مخصص",
    noGmailMailbox: "لا يوجد بريد Gmail متصل",
    noGmailMailboxHint: "اربط Gmail من التكاملات لقراءته هنا.",
    noCustomMailbox: "لا يوجد بريد مخصص متصل",
    noCustomMailboxHint: "أضف بريد نطاقك أعلاه لقراءة الرسائل وإرسالها هنا.",
    customDraftExpiry: "تم تجهيز الرسالة بأمان ويجب تأكيدها خلال {seconds} ثانية.",
  },
  launcher: {
    accountSummary: "ملخص الحسابات",
    totalAccounts: "الحسابات المتاحة",
    readyAccounts: "ملف المتصفح جاهز",
    attentionAccounts: "تحتاج إلى مراجعة",
    accountsLoadErrorTitle: "تعذّر تحميل الحسابات",
    accountsLoadErrorBody:
      "قائمة الحسابات غير متاحة مؤقتاً. أعد تحميل الصفحة للمحاولة مرة أخرى.",
    reloadAccounts: "إعادة تحميل الحسابات",
    clearFilters: "مسح عوامل التصفية",
    connectAccount: "ربط حساب",
    launcherEmptyTitle: "لا توجد حسابات بعد",
    launcherEmptyBody:
      "أضف بيانات دخول محفوظة للمزوّد أعلاه، أو اربط مزوّداً لإنشاء حساب متصل بواجهة API.",
    howItWorksTitle: "كيف يعمل",
    howItWorksBody:
      "اتصال API سليم لا يُثبت وجود جلسة متصفح. يفتح CCM الوجهة الدقيقة لكل حساب؛ والمزوّد هو من يقرّر ما إذا كانت جلستك صالحة، وقد يطلب التحقّق بخطوتين أو حلّ CAPTCHA. تُشفّر بيانات الدخول المحفوظة. بعد اختيار فتح الحساب وتسجيل الدخول، ترسلها إضافة المتصفح المقترنة إلى نموذج الدخول المسموح به للمزوّد فقط.",
    connectedAccountsTitle: "الحسابات المتصلة",
    connectedAccountsSubtitle:
      "كل حساب يمكن لـ CCM فتحه، مع حالة الـ API وحالة المتصفح.",
    setupSubtitle:
      "اربط كل حساب بمتصفح الملف الشخصي الذي يحمل جلسته لدى المزوّد.",
    boundariesTitle: "ما يفعله هذا وما لا يفعله",
    boundariesBody:
      "لا يمكن لصفحة مستضافة قراءة ملفات تعريف الارتباط لموقع آخر أو إجبار متصفح آخر على فتح ملف شخصي مختلف. ما يمكنها فعله — وهو ما يهيّئه هذا المعالج — هو فتح وجهة الحساب الدقيقة في المتصفح الذي تستخدمه، وعند تثبيت إضافة الجسر، فتحها في الملف الشخصي التي توجد فيه الإضافة. وقد تكون جلسة المزوّد منتهية الصلاحية؛ يعرض CCM ذلك بوضوح ويتيح لك تسجيل الدخول بشكل طبيعي.",
    step1Title: "الخطوة 1 — تثبيت جسر المتصفح",
    step1Subtitle:
      "اختياري، لكنه يضيف عمليات تشغيل موثَّقة وربط الملفات الشخصية",
    checkingExtension: "جارٍ البحث عن الإضافة…",
    downloadBridgeExtension: "تنزيل إضافة CCM Browser Bridge",
    extensionInstalled:
      "جسر المتصفح مثبَّت في هذا الملف الشخصي للمتصفح.",
    extensionNotDetectedTitle: "لم يتم العثور على الإضافة",
    loadExtensionBody:
      "نزّل الجسر واستخرج ملفاته من الرابط أدناه، ثم اختر Load unpacked في {extensionsUrl} وحدد المجلد المستخرج. يمكنك أيضاً تحميل مجلد المصدر {bridgePath}. افتح صفحة الخيارات وأدخل عنوان CCM هذا.",
    instanceIdLabel: "مُعرِّف نسخة هذا الملف الشخصي",
    step2Title: "الخطوة 2 — ربط ملف شخصي للمتصفح",
    step2Subtitle:
      "اربط حساباً بالملف الشخصي الذي يحمل جلسته لدى المزوّد",
    noAccountsTitle: "لا توجد حسابات بعد",
    noAccountsBody:
      "أضف بيانات دخول محفوظة من Account Launcher، أو اربط مزوّداً من قسم Integrations، ثم اربط الحساب بملف المتصفح الشخصي.",
    accountLabel: "الحساب",
    noManagementConsole: "لا توجد لوحة إدارة لدى هذا المزوّد لفتحها.",
    multiProfileTitle: "ملفات متصفح متعددة",
    multiProfileSubtitle: "ما هو ممكن وما هو غير ممكن",
    multiProfileBody:
      "لا يمكن لصفحة ويب عادية إجبار Chrome أو Edge أو Firefox على فتح ملف شخصي مختلف. أما إضافة الجسر فيمكنها ذلك، لأنها تفتح التبويب في الملف الشخصي حيث ثُبِّتت — لذا فإن سير العمل الموثوق لهوية ثانية هو تثبيت الإضافة في ذلك الملف الشخصي وربط الحساب بمُعرِّف نسخته.",
    multiProfileHelperBody:
      "يوجد مساعد محلي اختياري للحالة التي يعيش فيها الحساب في ملف شخصي لا يمكنك تثبيت الإضافة فيه. يُثبَّت ويُقرَن بدواماً من طرفك، ولا يقبل سوى مضيفين ضمن قائمة السماح وأدلة ملفات شخصية مهيّأة، ولا يقرأ ملفات تعريف الارتباط ولا كلمات المرور ولا يصدّرها ولا يعدّلها أبداً.",
    helperTitle: "المساعد المحلي",
    helperSubtitle: "لملف شخصي لا يمكن تثبيت الإضافة فيه",
    helperIntro:
      "المساعد برنامج صغير يعمل على جهازك. يفتح الحساب في ملف شخصي للمتصفح باسم محدَّد — وهي الحالة الوحيدة التي لا يستطيع تغطيتها أيٌّ من صفحة الويب والإضافة معاً.",
    helperRunCommand: "شغّله من المستودع: {command}",
    pairingCode: "رمز إقران",
    helperPairBody:
      "اقرنه بهذا النشر. يطبع المساعد {code} على وحدة تحكمه الخاصة عند بدء التشغيل؛ وهذا الرمز إلزامي، حتى لا تمكّن أي صفحة أخرى من إعادة توجيه المساعد إلى موقع من اختيارها: {command}",
    helperChooseBody:
      "اختر {mode} كوضع التشغيل أعلاه وسمِّ دليل الملف الشخصي للمتصفح — الدليل المبيَّن في {version}، مثل {example} أو {fallback}.",
    helperWarning:
      "لا يقبل المساعد سوى تذكرة تشغيل موقَّعة، ويتحقّق من الوجهة مقابل قائمة سماح المزوّد، ويفتح المتصفح بمخزن ملفات تعريف الارتباط الخاص به. لا يقرأ ملف تعريف ارتباط أو كلمة مرور أو رمز تحقّق بخطوتين أبداً.",
    instanceIdLabelField: "مُعرِّف نسخة الإضافة",
    instanceIdHint:
      "الصق المُعرِّف من صفحة خيارات الإضافة، أو استخدم الزر أعلاه.",
    useDetectedInstance:
      "استخدام مُعرِّف نسخة هذا الملف الشخصي للمتصفح",
    profileLabelLabel: "وسم الملف الشخصي",
    profileLabelHint:
      "كيف يظهر هذا الملف الشخصي لفريقك، مثل «Chrome — Work».",
    profileDirectoryLabel: "دليل الملف الشخصي",
    profileDirectoryHint:
      "دليل الملف الشخصي في Chrome/Edge (مثل «Profile 1»). يُستخدم فقط مع المساعد المحلي الاختياري؛ اتركه فارغاً للتشغيل المباشر.",
    launchModeLabel: "وضع التشغيل",
    launchModeHint: "كيف يُفتح الحساب.",
    modeDirect: "مباشر — فتح تبويب في هذا المتصفح",
    modeExtension:
      "الإضافة — الفتح في الملف الشخصي الذي توجد فيه إضافة الجسر",
    modeHelper: "المساعد المحلي — الفتح في ملف شخصي محدَّد للمتصفح",
    modeHelperShort: "المساعد المحلي",
    saveMapping: "حفظ الربط",
    mappingSaved:
      "حُفظ الربط. الآن تعرض بطاقة الحساب هذا الملف الشخصي.",
    mappingSaveFailed: "تعذّر حفظ الربط (HTTP {status}).",
    serverUnreachable: "تعذّر على CCM الوصول إلى الخادم لحفظ الربط.",
    credentialsAddLabel: "إضافة بيانات دخول آمنة",
    credentialsSavedLabel: "تم حفظ بيانات الدخول بأمان",
    credentialsPrivacy:
      "تُشفّر البيانات قبل التخزين. ترسلها إضافة المتصفح المقترنة إلى نموذج دخول المزوّد المسموح به فقط بعد اختيارك. يظل التحقّق بخطوتين وCAPTCHA لدى المزوّد.",
    credentialsChecking: "جارٍ التحقق من بيانات الدخول المحفوظة…",
    credentialsCheckFailed: "تعذّر التحقق من بيانات الدخول المحفوظة.",
    credentialsSaveFailed: "تعذّر حفظ بيانات الدخول.",
    loginUsername: "اسم المستخدم أو البريد الإلكتروني",
    loginPassword: "كلمة المرور",
    passwordReplaceHint: "أدخل كلمة مرور جديدة لاستبدال المحفوظة.",
    saveLogin: "حفظ بيانات الدخول بأمان",
    removeLogin: "حذف بيانات الدخول المحفوظة",
    credentialsSaved: "تم حفظ بيانات الدخول بأمان.",
    credentialsRemoved: "تم حذف بيانات الدخول المحفوظة.",
    credentialsManagedByAdmin: "اطلب من مدير التكاملات تحديث هذه البيانات.",
    credentialsAskAdmin: "اطلب من مدير التكاملات إضافة بيانات الدخول.",
    openAndFill: "فتح الحساب وتسجيل الدخول",
    credentialsExtensionRequired:
      "ثبّت إضافة CCM للمتصفح واقرنها بهذا المتصفح لتعبئة البيانات. ما زال بإمكانك فتح الحساب وتسجيل الدخول بالطريقة المعتادة.",
    credentialsHelperProfile:
      "تعمل التعبئة في ملف المتصفح المقترن بالإضافة. اربط هذا الحساب بملف إضافة المتصفح لاستخدامها.",
    addLoginAccount: "إضافة بيانات دخول محفوظة",
    addLoginAccountTitle: "إضافة تسجيل دخول للمزوّد",
    addLoginAccountSubtitle:
      "أنشئ حساباً للمتصفح فقط. تظل تكاملات API وبيانات التقارير منفصلة.",
    loginProvider: "المزوّد",
    loginAccountLabel: "اسم الحساب",
    loginAccountPrivacy:
      "تُشفّر كلمة المرور قبل التخزين. لا تبدأ التعبئة إلا بعد اختيارك لها في إضافة المتصفح. وقد يطلب المزوّد التحقّق بخطوتين أو CAPTCHA.",
    saveLoginAccount: "حفظ الحساب وإضافته",
    savingLoginAccount: "جارٍ الحفظ بأمان…",
    loginAccountCreated: "تمت إضافة بيانات الدخول المحفوظة. يمكنك فتح الحساب من القائمة أدناه.",
    loginAccountCreateFailed: "تعذّرت إضافة بيانات الدخول المحفوظة.",
    browserOnly: "تسجيل دخول عبر المتصفح فقط",
    launchPermissionRequired: "يمكنك عرض هذا الحساب، لكن دورك لا يسمح بفتحه.",
  },
} as const;
