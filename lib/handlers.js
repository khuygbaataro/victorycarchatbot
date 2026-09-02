// Ботын логик. FAQ дүн шинжилгээгээр хамгийн их асуудаг 4 зүйл:
//   1. Үнэ / загвар   → өгөгдлийн сангаас хайж зураг+үнэ carousel
//   2. Хүү / урьдчилгаа → лизингийн нөхцөл (+ тодорхой машины тооцоо)
//   3. Байршил / хаяг
//   4. Холбоо барих утас
import { connectDB } from './db.js';
import { Vehicle, Settings } from './models.js';
import { sendText, sendCarousel } from './messenger.js';
import { calcLoanAmount, calcEqualPrincipal } from './loan.js';

const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, ''); // CarNumber1 сайт (сонголт)

// Доор байнга харагдах quick reply цэс
const MENU = [
  { content_type: 'text', title: '💵 Үнэ / машин', payload: 'MENU_PRICE' },
  { content_type: 'text', title: '🏦 Лизинг', payload: 'MENU_LIZING' },
  { content_type: 'text', title: '📍 Байршил', payload: 'MENU_LOCATION' },
  { content_type: 'text', title: '📲 Холбоо барих', payload: 'MENU_CONTACT' },
];

// ── Мессеж/товч хүлээн авах гол цэг ─────────────────────────────
export async function handleEvent(senderId, { text, payload }) {
  // Товч (postback / quick reply payload) эхэнд шалгана
  if (payload) {
    if (payload === 'MENU_PRICE') return askModel(senderId);
    if (payload === 'MENU_LIZING') return sendLizingTerms(senderId);
    if (payload === 'MENU_LOCATION') return sendLocation(senderId);
    if (payload === 'MENU_CONTACT') return sendContact(senderId);
    if (payload === 'GET_STARTED') return greet(senderId);
    if (payload.startsWith('SEARCH_')) return searchVehicles(senderId, payload.slice(7));
    if (payload.startsWith('LIZING_')) return sendVehicleLoan(senderId, payload.slice(7));
    // бусад payload → доорх текст логикт шилжинэ
  }

  const intent = detectIntent(text);
  switch (intent) {
    case 'GREETING':
      return greet(senderId);
    case 'LIZING':
      return sendLizingTerms(senderId);
    case 'LOCATION':
      return sendLocation(senderId);
    case 'CONTACT':
      return sendContact(senderId);
    default:
      return searchVehicles(senderId, text); // үнэ/загварын хайлт
  }
}

// ── Санаа таних (энгийн түлхүүр үг) ─────────────────────────────
function detectIntent(text = '') {
  const t = normalize(text);
  if (!t) return 'GREETING';
  if (/(сайн байна|сайн уу|hi|hello|start|эхлэх|get started|мэнд)/.test(t)) return 'GREETING';
  if (/(лизинг|лизнг|хүү|урьд|урьч|зээл|хуваа)/.test(t)) return 'LIZING';
  if (/(байршил|хаяг|хаана|байрлал|газар|hayg|bairshil)/.test(t)) return 'LOCATION';
  if (/(утас|дугаар|холбо|залга|дуга|phone|holboo)/.test(t)) return 'CONTACT';
  return 'SEARCH';
}

function normalize(s = '') {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

// ── Мэндчилгээ ба загвар асуух ──────────────────────────────────
function greet(senderId) {
  return sendText(
    senderId,
    'Сайн байна уу! 🚗 Victory car-т тавтай морил.\n\n' +
      'Юу сонирхож байгаагаа доороос сонгоно уу, эсвэл машины загвараа шууд бичээрэй (ж: Prius 40).',
    MENU
  );
}

function askModel(senderId) {
  return sendText(
    senderId,
    'Ямар машин сонирхож байна вэ? Загварын нэрээ бичнэ үү 🚗\n(ж: Prius 40, Prius 50, Alphard, Estima)',
    [
      { content_type: 'text', title: 'Prius 40', payload: 'SEARCH_Prius 40' },
      { content_type: 'text', title: 'Prius 50', payload: 'SEARCH_Prius 50' },
      { content_type: 'text', title: 'Alphard', payload: 'SEARCH_Alphard' },
      ...MENU.slice(1),
    ]
  );
}

// ── Үнэ / загварын хайлт → carousel ─────────────────────────────
async function searchVehicles(senderId, rawText) {
  const query = cleanQuery(rawText);
  if (!query) return askModel(senderId);

  await connectDB();
  const tokens = query.split(' ').filter(Boolean).slice(0, 4);
  const and = tokens.map((tok) => ({
    $or: [
      { brand: { $regex: escapeRegex(tok), $options: 'i' } },
      { model: { $regex: escapeRegex(tok), $options: 'i' } },
      { description: { $regex: escapeRegex(tok), $options: 'i' } },
    ],
  }));

  let vehicles = await Vehicle.find({ status: 'available', $and: and })
    .sort('-createdAt')
    .limit(10)
    .lean();

  // Олдохгүй бол зөвхөн эхний үгээр дахин оролдоно
  if (!vehicles.length && tokens.length > 1) {
    vehicles = await Vehicle.find({
      status: 'available',
      $or: [
        { brand: { $regex: escapeRegex(tokens[0]), $options: 'i' } },
        { model: { $regex: escapeRegex(tokens[0]), $options: 'i' } },
      ],
    })
      .sort('-createdAt')
      .limit(10)
      .lean();
  }

  if (!vehicles.length) {
    return sendText(
      senderId,
      `"${rawText}" гэсэн машин одоогоор бэлэн байхгүй байна 😔\nӨөр загвар бичих, эсвэл доороос сонгоно уу.`,
      MENU
    );
  }

  await sendCarousel(senderId, vehicles.map(toElement));
  return sendText(
    senderId,
    `Дээрх ${vehicles.length} машин олдлоо 👆 Лизингийн тооцоо, хаяг зэргийг доороос сонгоорой.`,
    MENU
  );
}

// Хайлтын текстээс илүүдэл үг (үнэ, хэд, вэ...) цэвэрлэнэ
function cleanQuery(text = '') {
  return normalize(text)
    .replace(/pruis|priuse|приус|приус/g, 'prius')
    .replace(/[?.!,]/g, ' ')
    .replace(/\b(үнэ|унэ|хэд|вэ|ямар|байна|уу|байгаа|бн|price)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toElement(v) {
  const parts = [fmtPrice(v.price)];
  if (v.year) parts.push(`${v.year} он`);
  if (v.mileage) parts.push(`${Number(v.mileage).toLocaleString('en-US')} км`);

  const el = {
    title: `${v.brand || ''} ${v.model || ''}`.trim() || 'Машин',
    subtitle: parts.join(' · '),
    buttons: [],
  };
  if (v.images && v.images[0]) el.image_url = v.images[0];
  if (SITE_URL) {
    el.buttons.push({ type: 'web_url', url: `${SITE_URL}/vehicles/${v._id}`, title: 'Дэлгэрэнгүй' });
  }
  el.buttons.push({ type: 'postback', title: '🏦 Лизинг тооцоо', payload: `LIZING_${v._id}` });
  return el;
}

// ── Лизингийн ерөнхий нөхцөл ─────────────────────────────────────
async function getLoanConfig() {
  await connectDB();
  const s = await Settings.findOne().lean();
  const loan = (s && s.loan) || {};
  return {
    settings: s,
    minDownPercent: loan.minDownPercent ?? 30,
    monthlyInterestRate: loan.monthlyInterestRate ?? 2.8,
    termOptions: loan.termOptions?.length ? loan.termOptions : [12, 24, 36],
  };
}

async function sendLizingTerms(senderId) {
  const { minDownPercent, monthlyInterestRate, termOptions } = await getLoanConfig();
  return sendText(
    senderId,
    '🏦 Лизингийн нөхцөл:\n\n' +
      `• Урьдчилгаа: ${minDownPercent}%-аас\n` +
      `• Хүү: сард ${monthlyInterestRate}%\n` +
      `• Хугацаа: ${termOptions.join(', ')} сар\n\n` +
      'Тодорхой машины сарын төлбөрийг харахыг хүсвэл загвараа бичээд, гарч ирэх картын "🏦 Лизинг тооцоо" товчийг дарна уу.',
    MENU
  );
}

// ── Тодорхой машины лизингийн тооцоо ────────────────────────────
async function sendVehicleLoan(senderId, vehicleId) {
  const { minDownPercent, monthlyInterestRate, termOptions } = await getLoanConfig();
  let v = null;
  try {
    v = await Vehicle.findById(vehicleId).lean();
  } catch {
    v = null;
  }
  if (!v) {
    return sendText(senderId, 'Уучлаарай, тухайн машин олдсонгүй.', MENU);
  }

  const down = v.downPercent ?? minDownPercent;
  const downAmount = (Math.max(0, v.price || 0) * down) / 100;
  const loanAmount = calcLoanAmount(v.price, down);
  const term = termOptions[0];
  const s = calcEqualPrincipal(loanAmount, monthlyInterestRate, term);

  return sendText(
    senderId,
    `🏦 ${v.brand || ''} ${v.model || ''} — лизингийн тооцоо\n\n` +
      `• Үнэ: ${fmtPrice(v.price)}\n` +
      `• Урьдчилгаа (${down}%): ${fmtPrice(downAmount)}\n` +
      `• Зээлийн дүн: ${fmtPrice(loanAmount)}\n` +
      `• Хүү: сард ${monthlyInterestRate}%\n\n` +
      `📅 ${term} сарын хувьд:\n` +
      `   1-р сар: ${fmtPrice(s.first)}\n` +
      `   Сүүлийн сар: ${fmtPrice(s.last)}\n\n` +
      'Бусад хугацаа, дэлгэрэнгүйг ажилтнаас лавлаарай.',
    MENU
  );
}

// ── Байршил ба холбоо барих ─────────────────────────────────────
async function sendLocation(senderId) {
  const { settings } = await getLoanConfig();
  const c = (settings && settings.contact) || {};
  let msg = '📍 Хаяг байршил:\n' + (c.address || 'Хаягийн мэдээлэл шинэчлэгдэж байна.');
  if (c.mapUrl) msg += `\n\n🗺 Газрын зураг:\n${c.mapUrl}`;
  if (settings?.workingHours) msg += `\n\n🕒 Цагийн хуваарь:\n${settings.workingHours}`;
  return sendText(senderId, msg, MENU);
}

async function sendContact(senderId) {
  const { settings } = await getLoanConfig();
  const c = (settings && settings.contact) || {};
  const lines = ['📲 Холбоо барих:'];
  if (c.phone) lines.push(`Утас: ${c.phone}`);
  if (c.email) lines.push(`Имэйл: ${c.email}`);
  if (SITE_URL) lines.push(`Вэб: ${SITE_URL}`);
  if (lines.length === 1) lines.push('Мэдээлэл шинэчлэгдэж байна.');
  return sendText(senderId, lines.join('\n'), MENU);
}

// ── Туслах ──────────────────────────────────────────────────────
function fmtPrice(n) {
  const num = Number(n);
  if (!num || Number.isNaN(num)) return 'Үнэ тодорхойгүй';
  return `${Math.round(num).toLocaleString('en-US')}₮`;
}

function escapeRegex(s = '') {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
