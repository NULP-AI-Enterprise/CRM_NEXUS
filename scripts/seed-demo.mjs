/**
 * Demo dataset for Nexus CRM.
 *
 * Every record here exists to exercise a specific code path — the shapes real
 * data takes that a happy-path fixture never produces: chains that run several
 * people deep without you, events that come back to you, events nobody has
 * linked, a link that points backwards in time, a day dense enough to force the
 * history graph to bundle events, names and notes long enough to hit every
 * truncation rule, and entities with nothing attached at all.
 *
 * Each block below names the case it covers, so a failing screen can be traced
 * straight back to the row that produced it.
 *
 * Destructive: wipes the target account's CRM rows first. Auth rows (User,
 * ApiKey, tokens) are never touched.
 *
 *   node scripts/seed-demo.mjs                 # both demo accounts
 *   node scripts/seed-demo.mjs a@b.com         # one account
 */
import pg from "pg";

const CONNECTION_STRING =
  process.env.DATABASE_URL ?? "postgresql://crm:crm_dev_password@localhost:5432/personal_crm?schema=public";
const DEFAULT_ACCOUNTS = ["yorza+test1@thesis-i.com", "zormen4@gmail.com"];

/** Deterministic ids, namespaced per account, so re-running replaces cleanly. */
const idFor = (slot, kind, key) => `demo_${slot}_${kind}_${key}`;

const COMPANIES = [
  { key: "horizon", name: "Horizon Ventures", industry: "Venture capital", description: "Seed-stage fund, CEE focus." },
  { key: "northwind", name: "Northwind Labs", industry: "AI tooling", description: "Infra for retrieval pipelines." },
  { key: "logiflow", name: "LogiFlow", industry: "Logistics", description: "Freight routing for mid-size carriers." },
  { key: "vercel", name: "Vercel", industry: "Developer platform", description: null },
  // Edge case: a company with no contacts attached — the list must not assume ≥1.
  { key: "kolo", name: "Kolo Partners", industry: "Legal", description: "Corporate counsel." },
];

const COMMUNITIES = [
  { key: "kpc", name: "Kyiv Product Circle", description: "Продуктова спільнота, офлайн-зустрічі раз на місяць." },
  { key: "founders", name: "Founders Breakfast", description: "Закритий сніданок засновників." },
  // Edge case: a community with no members.
  { key: "aib", name: "AI Builders CEE", description: null },
];

const CONTACTS = [
  {
    key: "olena", fullName: "Олена Гнатюк", role: "Partner", company: "horizon", category: "INVESTOR",
    score: 9, temperament: "Стримана, аналітична, цінує цифри", city: "Київ", country: "Україна",
    phone: "+380671234567", linkedin: "linkedin.com/in/olena-hnatiuk", telegram: "@olena_h",
    instagram: null, whatsapp: null,
    needs: "Шукає команди з реальним retention, а не з обіцянками",
    valuePotential: "Доступ до фонду й до її портфельних CEO",
    summary: "Перша серйозна інвесторка в пайплайні. Знайомство через Product Tank; далі вела сама.",
  },
  {
    // Edge case: every optional channel filled — the Fields table at its widest.
    key: "sarah", fullName: "Sarah Johnson", role: "CTO", company: "vercel", category: "VIP",
    score: 10, temperament: "Direct, technical, decides fast", city: "San Francisco", country: "USA",
    phone: "+14155550137", linkedin: "linkedin.com/in/sarahjohnson", telegram: "@sarahj",
    instagram: "sarah.builds", whatsapp: "+14155550137",
    needs: "Wants a design partner for the edge runtime beta",
    valuePotential: "Technical credibility plus intros across the platform ecosystem",
    summary: "Reached us through a chain that started with Олена. Highest-leverage contact in the account.",
  },
  {
    key: "maksym", fullName: "Максим Петренко", role: "Засновник", company: "logiflow", category: "COLLEAGUE",
    score: 6, temperament: "Амбітний, орієнтований на швидкий ріст", city: "Київ", country: "Україна",
    phone: null, linkedin: "linkedin.com/in/maksym-petrenko", telegram: "@maksym_p",
    instagram: null, whatsapp: null,
    needs: "Шукає інвестора для seed-раунду", valuePotential: "Знає логістичний ринок і його гравців",
    summary: "Познайомила Олена. Сам активно з'єднує людей — через нього пішов найдовший ланцюг.",
  },
  {
    key: "iryna", fullName: "Ірина Коваленко", role: "Керівниця відділу продажів", company: "northwind",
    category: "LEAD", score: 7, temperament: "Комунікабельна, енергійна", city: "Львів", country: "Україна",
    phone: "+380509876543", linkedin: null, telegram: "@iryna_k", instagram: null, whatsapp: null,
    needs: "Потребує партнера для інтеграції API", valuePotential: "Вихід на ринок Польщі",
    summary: "Ланка посередині ланцюга: сама зі мною майже не перетинається, але через неї пройшло головне.",
  },
  {
    key: "emily", fullName: "Emily Chen", role: "Head of Partnerships", company: "northwind", category: "LEAD",
    score: 7, temperament: "Warm, process-oriented", city: "Singapore", country: "Singapore",
    phone: null, linkedin: "linkedin.com/in/emilychen", telegram: null, instagram: null, whatsapp: null,
    needs: "Needs a co-marketing story before committing", valuePotential: "APAC distribution",
    summary: "Four hops away from where this started, and still ended up in a call with me.",
  },
  {
    key: "dmytro", fullName: "Дмитро Шевченко", role: "Recruiting lead", company: null, category: "HR",
    score: 5, temperament: "Методичний", city: "Київ", country: "Україна",
    phone: "+380631112233", linkedin: null, telegram: null, instagram: null, whatsapp: null,
    needs: "Шукає senior-інженерів для клієнтів", valuePotential: "Пайплайн кандидатів",
    summary: "Окрема гілка історії — наймання, не інвестиції.",
  },
  {
    key: "bohdan", fullName: "Богдан Мельник", role: "Senior Engineer", company: null, category: "FRIEND",
    score: 4, temperament: "Спокійний, дуже прямий", city: "Одеса", country: "Україна",
    phone: null, linkedin: null, telegram: "@bmelnyk", instagram: null, whatsapp: null,
    needs: "Хоче проєкт із реальним впливом", valuePotential: "Сильний бекенд",
    summary: "Прийшов за рекомендацією Дмитра.",
  },
  {
    key: "sophie", fullName: "Sophie Laurent", role: "Design Lead", company: null, category: "COLLEAGUE",
    score: 6, temperament: "Visual thinker", city: "Paris", country: "France",
    phone: null, linkedin: "linkedin.com/in/sophielaurent", telegram: null, instagram: "sophie.designs",
    whatsapp: null, needs: "Looking for a long-term product partner", valuePotential: "Design system expertise",
    summary: "Її гілка існує без мене — я лише записав, що вони з Ігорем домовились.",
  },
  {
    key: "ihor", fullName: "Ігор Ткаченко", role: "Product Manager", company: "logiflow", category: "LEAD",
    score: 5, temperament: "Обережний", city: "Харків", country: "Україна",
    phone: null, linkedin: null, telegram: "@ihor_t", instagram: null, whatsapp: null,
    needs: "Хоче зрозуміти roadmap перед рішенням", valuePotential: "Внутрішній адвокат у LogiFlow",
    summary: null,
  },
  {
    // Edge case: the longest name in the set — truncation in nodes, cards, picker, breadcrumbs.
    key: "anastasiia", fullName: "Анастасія Бондаренко-Левицька", role: "Head of Strategic Partnerships",
    company: "horizon", category: "VIP", score: 9, temperament: "Дуже структурована, готується до кожної розмови",
    city: "Київ", country: "Україна", phone: "+380442223344",
    linkedin: "linkedin.com/in/anastasiia-bondarenko-levytska", telegram: null, instagram: null, whatsapp: null,
    needs: "Шукає партнерства з продуктовими командами на етапі масштабування",
    valuePotential: "Може відкрити двері в усі портфельні компанії фонду одразу",
    summary: "Приєдналась пізно, але одразу з високим потенціалом.",
  },
  {
    // Edge case: a contact with nothing — no company, no channels, no interactions,
    // no connections. Every panel must degrade gracefully instead of rendering blanks.
    key: "tom", fullName: "Tom Richards", role: null, company: null, category: "OTHER",
    score: null, temperament: null, city: null, country: null,
    phone: null, linkedin: null, telegram: null, instagram: null, whatsapp: null,
    needs: null, valuePotential: null, summary: null,
  },
  {
    // Edge case: score at the bottom of the scale, so sorting has a real floor.
    key: "viktor", fullName: "Віктор Савченко", role: "Freelancer", company: null, category: "OTHER",
    score: 1, temperament: null, city: "Дніпро", country: "Україна",
    phone: null, linkedin: null, telegram: null, instagram: null, whatsapp: null,
    needs: null, valuePotential: null, summary: "Разова розмова, поки без продовження.",
  },
];

const COMMUNITY_MEMBERS = {
  kpc: ["olena", "maksym", "iryna", "anastasiia"],
  founders: ["maksym", "bohdan"],
  aib: [], // deliberately empty
};

const CONNECTIONS = [
  // Cluster A — the long chain, plus a leaf hanging off it.
  { key: "olena_maksym", from: "olena", to: "maksym", relationship: "Познайомила", strength: 4 },
  { key: "maksym_iryna", from: "maksym", to: "iryna", relationship: "Колеги", strength: 3 },
  { key: "iryna_sarah", from: "iryna", to: "sarah", relationship: "Партнерство", strength: 3 },
  { key: "sarah_emily", from: "sarah", to: "emily", relationship: "Колеги", strength: 4 },
  { key: "olena_anastasiia", from: "olena", to: "anastasiia", relationship: "Колеги", strength: 5 },
  // Cluster B — hiring, entirely separate component.
  { key: "dmytro_bohdan", from: "dmytro", to: "bohdan", relationship: "Рекомендація", strength: 3 },
  // Cluster C — a pair whose history I only observe.
  { key: "sophie_ihor", from: "sophie", to: "ihor", relationship: "Спільний проєкт", strength: 2 },
  // Edge case: a connection that exists but has no interactions logged on it.
  { key: "maksym_ihor", from: "maksym", to: "ihor", relationship: "Колеги", strength: 2 },
];

const LONG_TEXT =
  "Довга нотатка, яка навмисно перевищує будь-яку межу обрізання в інтерфейсі: перевіряємо, що вузол діаграми, картка в сайдбарі, підпис на канві, випадайка вибору батьківської події та панель деталей поводяться однаково передбачувано і жоден із них не розповзається за свої межі та не ховає текст без трьох крапок.";

/**
 * `d` is days before now. Ordering matters: the diagram lays events out by
 * chronological index, so these values are what put a link before or after
 * its parent.
 */
const INTERACTIONS = [
  // ---- Thread 1: investor chain that runs four people deep and comes back twice.
  { key: "i1", on: { contact: "olena" }, type: "MEET", d: 120, parent: null,
    text: "Познайомились на Product Tank — Олена веде seed-напрямок у Horizon." },
  // depth 0 -> depth 0: a "continues" link, not a merge.
  { key: "i2", on: { contact: "olena" }, type: "ZOOM", d: 104, parent: "i1",
    text: "Дзвінок з Оленою щодо метрик: retention їй цікавий, просить когорти." },
  { key: "i3", on: { conn: "olena_maksym" }, type: "NOTE", d: 96, parent: "i2",
    text: "Олена пообіцяла познайомити з Максимом — він робить логістику й шукає той самий раунд." },
  { key: "i4", on: { conn: "maksym_iryna" }, type: "NOTE", d: 88, parent: "i3",
    text: "Максим передав деталі Ірині у Northwind — там своя потреба в інтеграції." },
  { key: "i5", on: { conn: "iryna_sarah" }, type: "NOTE", d: 80, parent: "i4",
    text: "Ірина винесла питання на Sarah Johnson — рішення тепер за нею." },
  // depth 4 — past the depth palette, which clamps on purpose.
  { key: "i6", on: { conn: "sarah_emily" }, type: "NOTE", d: 72, parent: "i5",
    text: "Sarah залучила Emily Chen з боку партнерств." },
  // merge from depth 3 back to me
  { key: "i7", on: { contact: "sarah" }, type: "MEET", d: 64, parent: "i5",
    text: "Спільний міт із Sarah — прийшло через Олену, хоча я з Іриною жодного разу не спілкувався." },
  // merge from depth 4 back to me
  { key: "i8", on: { contact: "emily" }, type: "CALL", d: 56, parent: "i6",
    text: "Emily погодилась розглянути co-marketing після демо." },

  // ---- Thread 2: hiring — its own root, its own shallow merge.
  { key: "i9", on: { contact: "dmytro" }, type: "MEET", d: 50, parent: null,
    text: "Зустріч з Дмитром щодо найму двох сеньйорів." },
  { key: "i10", on: { conn: "dmytro_bohdan" }, type: "NOTE", d: 44, parent: "i9",
    text: "Дмитро рекомендував Богдана — працювали разом три роки." },
  { key: "i11", on: { contact: "bohdan" }, type: "ZOOM", d: 38, parent: "i10",
    text: "Співбесіда з Богданом. Сильний бекенд, хоче проєкт із впливом." },

  // ---- Edge case: an event I was not part of and never linked to anything.
  // Renders with a root terminator instead of floating unattached.
  { key: "i12", on: { conn: "sophie_ihor" }, type: "NOTE", d: 30, parent: null,
    text: "Sophie та Ігор домовились про спільний проєкт — записав, бо результат мене стосується." },

  // ---- Edge case: a link that points BACKWARDS in time. i13 is older than its
  // parent i14, which only becomes possible once an event can be re-pointed.
  { key: "i13", on: { contact: "ihor" }, type: "NOTE", d: 26, parent: "i14",
    text: "Ігор попросив roadmap — уже після того, як Sophie про нього розповіла." },
  { key: "i14", on: { contact: "sophie" }, type: "MEET", d: 20, parent: null,
    text: "Зустріч із Sophie: показала макети, обговорили дизайн-систему." },

  // ---- Edge case: one dense day. More same-day events than the canvas has lanes,
  // which is what forces the history graph to bundle them into an "N events" pack.
  { key: "d1", on: { contact: "olena" }, type: "CALL", d: 9, parent: null, text: "Швидкий дзвінок Олені — уточнив дату демо." },
  { key: "d2", on: { contact: "maksym" }, type: "OFFLINE", d: 9, parent: null, text: "Каву з Максимом, обговорили його раунд." },
  { key: "d3", on: { contact: "iryna" }, type: "ZOOM", d: 9, parent: null, text: "Ірина показала їхній інтеграційний беклог." },
  { key: "d4", on: { contact: "bohdan" }, type: "NOTE", d: 9, parent: null, text: "Богдан надіслав тестове — зроблено акуратно." },
  { key: "d5", on: { contact: "anastasiia" }, type: "MEET", d: 9, parent: null, text: "Перша зустріч з Анастасією — партнерства фонду." },
  { key: "d6", on: { contact: "sophie" }, type: "CALL", d: 9, parent: null, text: "Sophie уточнила обсяг дизайн-роботи." },

  // ---- Edge case: the longest note in the set.
  { key: "long", on: { contact: "anastasiia" }, type: "NOTE", d: 6, parent: "d5", text: LONG_TEXT },

  // ---- Edge case: a contact whose only event is a bare one-liner.
  { key: "vik", on: { contact: "viktor" }, type: "NOTE", d: 4, parent: null, text: "Коротка розмова на конференції." },

  // ---- Follow-ups. Two land at the same depth in one cluster, which is exactly
  // the case where markers used to stack on identical coordinates.
  { key: "f1", on: { contact: "olena" }, type: "ZOOM", d: 3, parent: null,
    text: "Олена попросила фінмодель до наступної зустрічі.",
    followUp: "Надіслати фінмодель і когортний аналіз", followUpInDays: 5 },
  { key: "f2", on: { contact: "sarah" }, type: "CALL", d: 3, parent: null,
    text: "Sarah хоче технічне демо для своєї команди.",
    followUp: "Провести технічне демо для команди Sarah", followUpInDays: 9 },
  { key: "f3", on: { conn: "iryna_sarah" }, type: "NOTE", d: 2, parent: null,
    text: "Ірина і Sarah узгоджують формат пілоту.",
    followUp: "Дізнатись у Ірини про підсумок пілоту", followUpInDays: 14 },
  // Edge case: a follow-up already in the past — must NOT appear as upcoming.
  { key: "f4", on: { contact: "maksym" }, type: "NOTE", d: 40, parent: null,
    text: "Максим просив познайомити з юристом.",
    followUp: "Познайомити Максима з Kolo Partners", followUpInDays: -12 },
];

async function seedAccount(client, email, slot) {
  const { rows: users } = await client.query(`SELECT id FROM "User" WHERE email = $1`, [email]);
  if (!users[0]) {
    console.log(`  ! no user ${email} — skipped`);
    return;
  }
  const userId = users[0].id;
  const id = (kind, key) => idFor(slot, kind, key);

  // Wipe CRM rows only. Interactions and the community join table go via cascade
  // from their owning rows, so contacts/connections are the roots to remove.
  await client.query(
    `DELETE FROM "Interaction" WHERE "contactId" IN (SELECT id FROM "Contact" WHERE "userId"=$1)
        OR "connectionId" IN (SELECT id FROM "ContactConnection" WHERE "userId"=$1)`, [userId]);
  await client.query(`DELETE FROM "ContactConnection" WHERE "userId"=$1`, [userId]);
  await client.query(`DELETE FROM "Contact" WHERE "userId"=$1`, [userId]);
  await client.query(`DELETE FROM "Community" WHERE "userId"=$1`, [userId]);
  await client.query(`DELETE FROM "Company" WHERE "userId"=$1`, [userId]);

  for (const co of COMPANIES) {
    await client.query(
      `INSERT INTO "Company" (id,name,industry,description,"userId","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,now(),now())`,
      [id("company", co.key), co.name, co.industry, co.description, userId]);
  }
  for (const cm of COMMUNITIES) {
    await client.query(
      `INSERT INTO "Community" (id,name,description,"userId","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,now(),now())`,
      [id("community", cm.key), cm.name, cm.description, userId]);
  }
  for (const ct of CONTACTS) {
    const company = ct.company ? COMPANIES.find((c) => c.key === ct.company) : null;
    await client.query(
      `INSERT INTO "Contact"
        (id,"fullName",role,"companyId","companyName",phone,linkedin,telegram,instagram,whatsapp,city,country,
         "usefulnessScore",category,temperament,needs,"valuePotential","fullSummary","userId","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::"ContactCategory",$15,$16,$17,$18,$19,now(),now())`,
      [id("contact", ct.key), ct.fullName, ct.role, company ? id("company", company.key) : null,
       company ? company.name : null, ct.phone, ct.linkedin, ct.telegram, ct.instagram, ct.whatsapp,
       ct.city, ct.country, ct.score, ct.category, ct.temperament, ct.needs, ct.valuePotential, ct.summary, userId]);
  }
  for (const [cmKey, memberKeys] of Object.entries(COMMUNITY_MEMBERS)) {
    for (const m of memberKeys) {
      await client.query(`INSERT INTO "_ContactCommunities" ("A","B") VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [id("community", cmKey), id("contact", m)]);
    }
  }
  for (const cn of CONNECTIONS) {
    await client.query(
      `INSERT INTO "ContactConnection" (id,"userId","fromContactId","toContactId",relationship,strength,"createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,now(),now())`,
      [id("conn", cn.key), userId, id("contact", cn.from), id("contact", cn.to), cn.relationship, cn.strength]);
  }

  // Two passes: insert every interaction parentless, then wire parents. A single
  // pass cannot express the backward link (i13 -> i14), whose parent is created
  // after it.
  for (const it of INTERACTIONS) {
    await client.query(
      `INSERT INTO "Interaction" (id,type,"rawText","contactId","connectionId","followUp","followUpDate","createdAt")
       VALUES ($1,$2::"InteractionType",$3,$4,$5,$6,$7,now() - ($8 || ' days')::interval)`,
      [id("int", it.key), it.type, it.text,
       it.on.contact ? id("contact", it.on.contact) : null,
       it.on.conn ? id("conn", it.on.conn) : null,
       it.followUp ?? null,
       it.followUpInDays === undefined ? null : new Date(Date.now() + it.followUpInDays * 86400000),
       String(it.d)]);
  }
  for (const it of INTERACTIONS) {
    if (!it.parent) continue;
    await client.query(`UPDATE "Interaction" SET "parentInteractionId"=$1 WHERE id=$2`,
      [id("int", it.parent), id("int", it.key)]);
  }

  console.log(
    `  ${email}: ${CONTACTS.length} contacts, ${COMPANIES.length} companies, ${COMMUNITIES.length} communities, ` +
    `${CONNECTIONS.length} connections, ${INTERACTIONS.length} interactions`);
}

const targets = process.argv[2] ? [process.argv[2]] : DEFAULT_ACCOUNTS;
const client = new pg.Client({ connectionString: CONNECTION_STRING });
await client.connect();
console.log("seeding demo data:");
for (const [i, email] of targets.entries()) await seedAccount(client, email, `a${i}`);
await client.end();
console.log("done");
