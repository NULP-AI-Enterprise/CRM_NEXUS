export type Locale = "en" | "uk";

export const DEFAULT_LOCALE: Locale = "en";

// Lives here (a plain module, no "use client") rather than in context.tsx so
// that both the client provider and server-side helpers can import the exact
// same constant without crossing a client/server module boundary.
export const LOCALE_COOKIE = "locale";

type Entry = Record<Locale, string>;

export const dictionary = {
  // ---- app ----
  "app.description": {
    en: "A next-generation visual relationship graph and personal networking CRM.",
    uk: "Візуальний граф зв'язків та персональний CRM для нетворкінгу нового покоління.",
  },

  // ---- common ----
  "common.save": { en: "Save", uk: "Зберегти" },
  "common.cancel": { en: "Cancel", uk: "Скасувати" },
  "common.create": { en: "Create", uk: "Створити" },
  "common.edit": { en: "Edit", uk: "Редагувати" },
  "common.delete": { en: "Delete", uk: "Видалити" },
  "common.saving": { en: "Saving...", uk: "Збереження..." },
  "common.deleting": { en: "Deleting...", uk: "Видалення..." },
  "common.optional": { en: "Optional", uk: "Необов'язково" },
  "common.confirmDeleteTitle": { en: "Are you sure?", uk: "Ви впевнені?" },
  "common.unknownError": { en: "Something went wrong. Please try again.", uk: "Щось пішло не так. Спробуйте ще раз." },

  // ---- nav / app shell ----
  "nav.brand": { en: "Nexus", uk: "Nexus" },
  "nav.signOut": { en: "Sign out", uk: "Вийти" },

  // ---- auth: login ----
  "auth.login.title": { en: "Sign in", uk: "Вхід" },
  "auth.login.description": { en: "Sign in to your Personal CRM.", uk: "Увійдіть у свій Personal CRM." },
  "auth.login.registerLink": { en: "Register", uk: "Реєстрація" },
  "auth.login.email": { en: "Email", uk: "Email" },
  "auth.login.password": { en: "Password", uk: "Пароль" },
  "auth.login.submit": { en: "Sign in", uk: "Увійти" },
  "auth.login.submitPending": { en: "Signing in...", uk: "Вхід..." },
  "auth.login.invalidCredentials": { en: "Invalid email or password.", uk: "Невірний email або пароль." },
  "auth.login.validationError": { en: "Please check your input.", uk: "Помилка валідації." },
  "auth.login.unverified": {
    en: "Please verify your email before signing in. Check your inbox for the confirmation link.",
    uk: "Підтвердіть email перед входом. Перевірте пошту — там лист із посиланням.",
  },
  "auth.login.resendLink": { en: "Resend verification email", uk: "Надіслати лист повторно" },
  "auth.login.resendSent": { en: "Verification email sent — check your inbox.", uk: "Лист надіслано — перевірте пошту." },

  // ---- auth: register ----
  "auth.register.title": { en: "Create account", uk: "Реєстрація" },
  "auth.register.description": { en: "Create your Personal CRM account.", uk: "Створіть акаунт Personal CRM." },
  "auth.register.loginLink": { en: "Sign in", uk: "Вхід" },
  "auth.register.name": { en: "Name", uk: "Ім'я" },
  "auth.register.namePlaceholder": { en: "Your name", uk: "Ваше ім'я" },
  "auth.register.email": { en: "Email", uk: "Email" },
  "auth.register.password": { en: "Password", uk: "Пароль" },
  "auth.register.passwordHint": { en: "At least 8 characters.", uk: "Щонайменше 8 символів." },
  "auth.register.submit": { en: "Create account", uk: "Створити акаунт" },
  "auth.register.submitPending": { en: "Creating...", uk: "Створення..." },
  "auth.register.emailInvalid": { en: "Enter a valid email address.", uk: "Введіть правильну електронну адресу." },
  "auth.register.passwordTooShort": { en: "Password must be at least 8 characters.", uk: "Пароль має містити щонайменше 8 символів." },
  "auth.register.emailExists": { en: "An account with this email already exists.", uk: "Користувач з таким email вже існує." },
  "auth.register.validationError": { en: "Please check your input.", uk: "Помилка валідації." },

  // ---- auth: verify email ----
  "auth.verify.checkInboxTitle": { en: "Check your inbox", uk: "Перевірте пошту" },
  "auth.verify.checkInboxBody": {
    en: "We've sent a confirmation link to {email}. Click it to activate your account.",
    uk: "Ми надіслали лист із підтвердженням на {email}. Перейдіть за посиланням, щоб активувати акаунт.",
  },
  "auth.verify.backToLogin": { en: "Back to sign in", uk: "Повернутись до входу" },
  "auth.verify.successTitle": { en: "Email verified", uk: "Email підтверджено" },
  "auth.verify.successBody": { en: "Your email is confirmed. You can now sign in.", uk: "Ваш email підтверджено. Тепер ви можете увійти." },
  "auth.verify.goToLogin": { en: "Go to sign in", uk: "Перейти до входу" },
  "auth.verify.invalidTitle": { en: "Invalid or expired link", uk: "Недійсне або прострочене посилання" },
  "auth.verify.invalidBody": {
    en: "This verification link is invalid or has expired. Request a new one from the sign-in page.",
    uk: "Це посилання недійсне або застаріло. Запросіть нове зі сторінки входу.",
  },

  // ---- dashboard ----
  "dashboard.pageTitle": { en: "Network — Knowledge Graph CRM", uk: "Мережа Зв'язків — Knowledge Graph CRM" },
  "dashboard.metric.nodes": { en: "Nodes", uk: "Вузли" },
  "dashboard.metric.nodesUnit": { en: "total", uk: "усього" },
  "dashboard.metric.links": { en: "Links", uk: "Зв'язки" },
  "dashboard.metric.linksUnit": { en: "edges", uk: "ребер" },
  "dashboard.metric.companies": { en: "Companies", uk: "Компанії" },
  "dashboard.metric.companiesUnit": { en: "orgs", uk: "організацій" },
  "dashboard.metric.avgScore": { en: "Avg. score", uk: "Сер. оцінка" },
  "dashboard.tab.graph": { en: "Network graph", uk: "Граф зв'язків" },
  "dashboard.tab.companies": { en: "Companies", uk: "Компанії" },
  "dashboard.tab.contacts": { en: "Contacts", uk: "Контакти" },
  "dashboard.newContact": { en: "New contact", uk: "Новий контакт" },
  "dashboard.newCompany": { en: "New company", uk: "Нова компанія" },

  // ---- quick add ----
  "quickAdd.title": { en: "New entry", uk: "Новий запис" },
  "quickAdd.description": {
    en: "Type freely or dictate the conversation for automatic structuring.",
    uk: "Введіть вільний текст або продиктуйте розмову для автоматичної структуризації.",
  },
  "quickAdd.placeholder": {
    en: "E.g.: 'Met Andrew (VP Engineering at Grammarly). Knows Alex from Petcube. Looking for an ML lead...'",
    uk: "Наприклад: 'Зустріч з Андрієм (VP Engineering у Grammarly). Знайомий з Олексієм з Petcube. Шукає ML ліда...'",
  },
  "quickAdd.audioTextSupport": { en: "Supports audio & text", uk: "Підтримка аудіо та тексту" },
  "quickAdd.submit": { en: "Save", uk: "Зберегти" },
  "quickAdd.submitPending": { en: "Analyzing...", uk: "Аналіз..." },
  "quickAdd.emptyError": { en: "Type something or use the microphone.", uk: "Введіть текст або скористайтесь мікрофоном." },
  "quickAdd.processError": { en: "Failed to process the entry.", uk: "Помилка обробки запису." },
  "quickAdd.savedToast": { en: "Contact saved: {name}", uk: "Контакт збережено: {name}" },

  // ---- companies ----
  "company.empty": {
    en: "No contacts yet. Add your first entry above, or create a company manually.",
    uk: "Немає збережених контактів. Додайте перший запис у полі вище, або створіть компанію вручну.",
  },
  "company.noCompany": { en: "No company", uk: "Без компанії" },
  "company.contactsCount": { en: "contacts", uk: "контактів" },
  "company.form.createTitle": { en: "New company", uk: "Нова компанія" },
  "company.form.editTitle": { en: "Edit company", uk: "Редагувати компанію" },
  "company.form.name": { en: "Name", uk: "Назва" },
  "company.form.namePlaceholder": { en: "E.g. Grammarly", uk: "Напр. Grammarly" },
  "company.form.industry": { en: "Industry", uk: "Індустрія" },
  "company.form.industryPlaceholder": { en: "E.g. AI / SaaS", uk: "Напр. AI / SaaS" },
  "company.form.description": { en: "Description", uk: "Опис" },
  "company.form.descriptionPlaceholder": { en: "Short description of the company...", uk: "Короткий опис компанії..." },
  "company.form.nameRequired": { en: "Company name is required.", uk: "Назва компанії обов'язкова." },
  "company.form.createSuccess": { en: "Company created", uk: "Компанію створено" },
  "company.form.editSuccess": { en: "Company updated", uk: "Компанію оновлено" },
  "company.form.duplicateName": { en: "A company with this name already exists.", uk: "Компанія з такою назвою вже існує." },
  "company.delete.confirm": {
    en: "Delete {name}? Its contacts will keep their history but lose the company link.",
    uk: "Видалити {name}? Контакти збережуть історію, але втратять зв'язок із компанією.",
  },
  "company.delete.success": { en: "Company deleted", uk: "Компанію видалено" },

  // ---- contacts ----
  "contact.role.unknown": { en: "Role unknown", uk: "Роль невідома" },
  "contact.usefulness": { en: "Usefulness", uk: "Корисність" },
  "contact.backToNetwork": { en: "Back to network", uk: "Назад до мережі" },
  "contact.valueScore": { en: "Value score", uk: "Оцінка цінності" },
  "contact.temperament": { en: "Temperament / style", uk: "Характер / Стиль" },
  "contact.temperamentEmpty": { en: "Not set. Add a note for AI analysis.", uk: "Не зазначено. Додайте нотатку для аналізу." },
  "contact.needs": { en: "Needs & asks", uk: "Потреби та запити" },
  "contact.needsEmpty": { en: "No clear needs identified in prior notes.", uk: "Не виявлено чітких потреб у попередніх записах." },
  "contact.valuePotential": { en: "Collaboration potential", uk: "Потенціал співпраці" },
  "contact.valuePotentialEmpty": { en: "Strategic potential is derived from notes.", uk: "Стратегічний потенціал розраховується з нотаток." },
  "contact.fullSummary": { en: "Contact summary", uk: "Саммарі контакту" },
  "contact.connectionsTitle": { en: "Graph connections", uk: "Зв'язки у графі" },
  "contact.addConnection": { en: "Add connection", uk: "Додати зв'язок" },
  "contact.noConnections": {
    en: "No direct connections. Click \"Add connection\" to link them in the graph.",
    uk: "Немає прямих зв'язків. Натисніть \"Додати зв'язок\" для з'єднання у графі.",
  },
  "contact.viewProfile": { en: "Profile", uk: "Профіль" },
  "contact.removeConnection": { en: "Remove connection", uk: "Видалити зв'язок" },
  "contact.connectionRemoved": { en: "Connection removed from the graph", uk: "Зв'язок видалено з графу" },
  "contact.connectionRemoveError": { en: "Failed to remove the connection", uk: "Не вдалося видалити зв'язок" },
  "contact.defaultRelationship": { en: "Connection", uk: "Зв'язок" },
  "contact.defaultRole": { en: "Contact", uk: "Контакт" },
  "contact.form.createTitle": { en: "New contact", uk: "Новий контакт" },
  "contact.form.editTitle": { en: "Edit contact", uk: "Редагувати контакт" },
  "contact.form.fullName": { en: "Full name", uk: "Повне ім'я" },
  "contact.form.fullNamePlaceholder": { en: "E.g. Jane Smith", uk: "Напр. Іван Іванов" },
  "contact.form.role": { en: "Role", uk: "Посада" },
  "contact.form.rolePlaceholder": { en: "E.g. VP Engineering", uk: "Напр. VP Engineering" },
  "contact.form.company": { en: "Company", uk: "Компанія" },
  "contact.form.companyNone": { en: "No company", uk: "Без компанії" },
  "contact.form.category": { en: "Category", uk: "Категорія" },
  "contact.form.usefulnessScore": { en: "Usefulness score (1-10)", uk: "Оцінка корисності (1-10)" },
  "contact.form.temperament": { en: "Temperament", uk: "Характер" },
  "contact.form.needs": { en: "Needs", uk: "Потреби" },
  "contact.form.valuePotential": { en: "Value potential", uk: "Потенційна цінність" },
  "contact.form.fullSummary": { en: "Summary", uk: "Саммарі" },
  "contact.form.fullNameRequired": { en: "Full name is required.", uk: "Повне ім'я обов'язкове." },
  "contact.form.createSuccess": { en: "Contact created", uk: "Контакт створено" },
  "contact.form.editSuccess": { en: "Contact updated", uk: "Контакт оновлено" },
  "contact.delete.confirm": {
    en: "Delete {name}? This removes all their interactions and graph connections.",
    uk: "Видалити {name}? Це видалить усі взаємодії та зв'язки у графі.",
  },
  "contact.delete.success": { en: "Contact deleted", uk: "Контакт видалено" },

  // ---- add note ----
  "addNote.title": { en: "New entry", uk: "Новий запис" },
  "addNote.newNoteTitle": { en: "Add note", uk: "Додати нотатку" },
  "addNote.placeholder": {
    en: "What's new about this contact? AI will update the profile...",
    uk: "Що нового про цей контакт? AI оновить профіль...",
  },
  "addNote.submitPending": { en: "Analyzing...", uk: "Аналіз..." },
  "addNote.submit": { en: "Save note", uk: "Зберегти нотатку" },
  "addNote.emptyError": { en: "Type or dictate a note.", uk: "Введіть або продиктуйте нотатку." },
  "addNote.processError": { en: "Failed to process the note.", uk: "Помилка обробки." },
  "addNote.savedToast": { en: "Note saved", uk: "Нотатку збережено" },

  // ---- interaction timeline ----
  "timeline.title": { en: "Interaction history", uk: "Історія взаємодій" },
  "timeline.empty": { en: "No previous interactions with this contact.", uk: "Немає попередніх взаємодій з цим контактом." },
  "interactionType.CALL": { en: "Call", uk: "Дзвінок" },
  "interactionType.MEET": { en: "Meeting", uk: "Зустріч" },
  "interactionType.ZOOM": { en: "Zoom", uk: "Zoom" },
  "interactionType.OFFLINE": { en: "Offline", uk: "Офлайн" },
  "interactionType.NOTE": { en: "Note", uk: "Нотатка" },

  // ---- categories ----
  "category.VIP": { en: "VIP", uk: "VIP" },
  "category.HR": { en: "HR", uk: "HR" },
  "category.INVESTOR": { en: "Investor", uk: "Інвестор" },
  "category.LEAD": { en: "Lead", uk: "Лід" },
  "category.COLLEAGUE": { en: "Colleague", uk: "Колега" },
  "category.FRIEND": { en: "Friend", uk: "Друг" },
  "category.OTHER": { en: "Other", uk: "Інше" },

  // ---- relationship presets ----
  "relationship.colleague": { en: "Colleague", uk: "Колега" },
  "relationship.partner": { en: "Partner", uk: "Партнер" },
  "relationship.investor": { en: "Investor", uk: "Інвестор" },
  "relationship.cofounder": { en: "Co-founder", uk: "Співзасновник" },
  "relationship.referral": { en: "Referral", uk: "Рекомендація" },
  "relationship.client": { en: "Client", uk: "Клієнт" },
  "relationship.advisor": { en: "Advisor", uk: "Радник" },
  "relationship.friend": { en: "Friend", uk: "Друг" },
  "relationship.contractor": { en: "Contractor", uk: "Підрядник" },
  "relationship.jointProject": { en: "Joint project", uk: "Спільний проект" },

  // ---- voice input ----
  "voice.start": { en: "Voice input", uk: "Голосовий ввід" },
  "voice.stop": { en: "Stop recording", uk: "Зупинити запис" },
  "voice.unsupported": { en: "Voice input is not supported in this browser.", uk: "Голосовий ввід не підтримується у цьому браузері." },
  "voice.recognitionError": { en: "Speech recognition error.", uk: "Помилка розпізнавання мовлення." },

  // ---- network graph ----
  "graph.searchPlaceholder": { en: "Search the graph...", uk: "Пошук у графі..." },
  "graph.all": { en: "All", uk: "Всі" },
  "graph.filters": { en: "Filters", uk: "Фільтри" },
  "graph.parameters": { en: "Parameters", uk: "Параметри" },
  "graph.minScore": { en: "Min. score:", uk: "Мін. оцінка:" },
  "graph.companies": { en: "Companies", uk: "Компанії" },
  "graph.animation": { en: "Animation", uk: "Анімація" },
  "graph.physics": { en: "Physics", uk: "Фізика" },
  "graph.physicsResume": { en: "Resume", uk: "Відновити" },
  "graph.physicsFreeze": { en: "Freeze", uk: "Заморозити" },
  "graph.nodesUnit": { en: "nodes", uk: "вузлів" },
  "graph.linksUnit": { en: "links", uk: "зв'язків" },
  "graph.refresh": { en: "Refresh graph", uk: "Оновити граф" },
  "graph.zoomIn": { en: "Zoom in", uk: "Збільшити" },
  "graph.zoomOut": { en: "Zoom out", uk: "Зменшити" },
  "graph.center": { en: "Center", uk: "Центрувати" },
  "graph.fullscreen": { en: "Fullscreen", uk: "Повний екран" },
  "graph.contactsUnit": { en: "contacts", uk: "контактів" },
  "graph.localGraph": { en: "Local graph", uk: "Локальний граф" },
  "graph.add": { en: "Add", uk: "Додати" },
  "graph.noDirectConnections": { en: "No direct connections in the graph.", uk: "Немає прямих зв'язків у графі." },
  "graph.connect": { en: "Connect", uk: "З'єднати" },

  // ---- node inspector ----
  "inspector.contact": { en: "Contact", uk: "Контакт" },
  "inspector.company": { en: "Company", uk: "Компанія" },
  "inspector.connectionsCount": { en: "connections", uk: "зв'язків" },
  "inspector.context": { en: "Context", uk: "Контекст" },
  "inspector.style": { en: "Style:", uk: "Стиль:" },
  "inspector.needs": { en: "Needs:", uk: "Потреби:" },
  "inspector.potential": { en: "Potential:", uk: "Потенціал:" },
  "inspector.connections": { en: "Connections", uk: "Зв'язки" },
  "inspector.noConnections": { en: "No registered connections", uk: "Немає зареєстрованих зв'язків" },
  "inspector.organization": { en: "Organization", uk: "Організація" },
  "inspector.newEntry": { en: "New entry", uk: "Новий запис" },
  "inspector.notePlaceholder": { en: "Add an update about this contact...", uk: "Додайте оновлення про контакт..." },
  "inspector.saving": { en: "Saving...", uk: "Збереження..." },
  "inspector.save": { en: "Save", uk: "Зберегти" },
  "inspector.fullProfile": { en: "Full profile", uk: "Повний профіль" },
  "inspector.noteSaved": { en: "Note saved", uk: "Нотатку збережено" },
  "inspector.noteSaveError": { en: "Failed to save the note", uk: "Помилка збереження" },

  // ---- add connection dialog ----
  "connection.title": { en: "New graph connection", uk: "Новий зв'язок у графі" },
  "connection.description": { en: "Connect {name} with another contact in the system.", uk: "З'єднайте {name} з іншим контактом у системі." },
  "connection.selectContact": { en: "Select contact", uk: "Оберіть контакт" },
  "connection.selectPlaceholder": { en: "-- Select a contact --", uk: "-- Оберіть контакт --" },
  "connection.relationshipType": { en: "Relationship type", uk: "Тип відносин" },
  "connection.relationshipPlaceholder": { en: "Or type your own relationship...", uk: "Або введіть свій тип зв'язку..." },
  "connection.strength": { en: "Connection strength", uk: "Сила зв'язку" },
  "connection.notes": { en: "Notes", uk: "Нотатки" },
  "connection.notesPlaceholder": { en: "Context or details on how you met...", uk: "Контекст або деталі знайомства..." },
  "connection.selectError": { en: "Select a contact to connect.", uk: "Оберіть контакт для зв'язку." },
  "connection.createError": { en: "Failed to create the connection.", uk: "Помилка при створенні зв'язку." },
  "connection.createSuccess": { en: "Connection saved", uk: "Зв'язок збережено" },
  "connection.submit": { en: "Add connection", uk: "Додати зв'язок" },
  "connection.submitPending": { en: "Saving...", uk: "Збереження..." },
} as const satisfies Record<string, Entry>;

export type DictionaryKey = keyof typeof dictionary;

export function translate(key: DictionaryKey, locale: Locale, vars?: Record<string, string | number>): string {
  const entry = dictionary[key];
  let str: string = entry ? entry[locale] : key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      str = str.replaceAll(`{${name}}`, String(value));
    }
  }
  return str;
}
