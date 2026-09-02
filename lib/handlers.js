// Ботын логик:
//  • Цэсийн товч / түлхүүр үг (лизинг, хаяг, утас, мэнд) → knowledge base-аас
//    шууд хариу (AI-гүй, DB-гүй, хурдан, үнэгүй).
//  • Чөлөөт бичвэр → AI агент (GPT), шаардвал өгөгдлийн сангаас машин хайна.
import { sendText, sendCarousel } from './messenger.js';
import { runAgent } from './ai.js';
import { findVehicles } from './vehicles.js';
import { DEALER, lizingText, locationText, contactText } from './knowledge.js';
import { calcLoanAmount, calcEqualPrincipal } from './loan.js';

const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');

const MENU = [
  { content_type: 'text', title: '💵 Үнэ / машин', payload: 'MENU_PRICE' },
  { content_type: 'text', title: '🏦 Лизинг', payload: 'MENU_LIZING' },
  { content_type: 'text', title: '📍 Байршил', payload: 'MENU_LOCATION' },
  { content_type: 'text', title: '📲 Холбоо барих', payload: 'MENU_CONTACT' },
];

// ── Гол цэг ──────────────────────────────────────────────────────
export async function handleEvent(senderId, { text, payload }) {
  if (payload) {
    if (payload === 'MENU_PRICE') return askModel(senderId);
    if (payload === 'MENU_LIZING') return sendText(senderId, lizingText(), MENU);
    if (payload === 'MENU_LOCATION') return sendText(senderId, locationText(), MENU);
    if (payload === 'MENU_CONTACT') return sendText(senderId, contactText(), MENU);
    if (payload === 'GET_STARTED') return greet(senderId);
    if (payload.startsWith('SEARCH_')) return aiReply(senderId, payload.slice(7));
    if (payload.startsWith('LIZING_')) return sendVehicleLoan(senderId, payload.slice(7));
  }

  const intent = detectIntent(text);
  switch (intent) {
    case 'GREETING':
      return greet(senderId);
    case 'LIZING':
      return sendText(senderId, lizingText(), MENU);
    case 'LOCATION':
      return sendText(senderId, locationText(), MENU);
    case 'CONTACT':
      return sendText(senderId, contactText(), MENU);
    default:
      return aiReply(senderId, text); // AI агент
  }
}

// ── Санаа таних (хямд шүүлт — цэсийн товчнуудад л) ───────────────
function detectIntent(text = '') {
  const t = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!t) return 'GREETING';
  if (/^(сайн байна|сайн уу|hi|hello|start|эхлэх|get started|мэнд)/.test(t)) return 'GREETING';
  if (/(лизинг|лизнг|урьдчил|урьч)/.test(t)) return 'LIZING';
  if (/(байршил|хаяг|хаана байр|байрлал)/.test(t)) return 'LOCATION';
  if (/(утас|дугаар|холбоо бари|залга)/.test(t)) return 'CONTACT';
  return 'AI';
}

// ── AI хариу ─────────────────────────────────────────────────────
async function aiReply(senderId, text) {
  let result;
  try {
    result = await runAgent(text);
  } catch (err) {
    console.error('AI алдаа:', err.message);
    return searchFallback(senderId, text); // AI унавал энгийн хайлтад шилжинэ
  }

  // AI тохируулаагүй бол энгийн хайлт хийнэ
  if (result.error === 'no_openai_key') return searchFallback(senderId, text);

  if (result.vehicles?.length) {
    await sendCarousel(senderId, result.vehicles.map(toElement));
  }
  const reply = result.text?.trim() || 'Танд юугаар туслах вэ? Доороос сонгоно уу.';
  return sendText(senderId, reply, MENU);
}

// AI байхгүй/унасан үеийн нөөц хайлт (шууд DB)
async function searchFallback(senderId, text) {
  let vehicles = [];
  try {
    vehicles = await findVehicles({ query: text, limit: 10 });
  } catch {
    vehicles = [];
  }
  if (vehicles.length) {
    await sendCarousel(senderId, vehicles.map(toElement));
    return sendText(senderId, `${vehicles.length} машин олдлоо 👆`, MENU);
  }
  return sendText(
    senderId,
    `"${text}" гэсэн машин одоогоор бэлэн байхгүй байна. Доороос сонгоно уу.`,
    MENU
  );
}

// ── Мэндчилгээ / загвар асуух ───────────────────────────────────
function greet(senderId) {
  return sendText(
    senderId,
    `Сайн байна уу! 🚗 ${DEALER.name}-т тавтай морил.\n\n` +
      'Юу сонирхож байгаагаа доороос сонгох, эсвэл асуултаа шууд бичээрэй (ж: "3000-аас доош хайбрид байна уу?").',
    MENU
  );
}

function askModel(senderId) {
  return sendText(
    senderId,
    'Ямар машин сонирхож байна вэ? Загвар эсвэл нөхцлөө бичээрэй 🚗\n(ж: Prius, Sai, эсвэл "25 саяас доош хайбрид")',
    [
      { content_type: 'text', title: 'Prius', payload: 'SEARCH_Prius' },
      { content_type: 'text', title: 'Sai', payload: 'SEARCH_Sai' },
      { content_type: 'text', title: 'Lexus RX', payload: 'SEARCH_RX' },
      ...MENU.slice(1),
    ]
  );
}

// ── Carousel карт ────────────────────────────────────────────────
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

// ── Тодорхой машины лизингийн ойролцоо тооцоо ────────────────────
async function sendVehicleLoan(senderId, vehicleId) {
  let v = null;
  try {
    const { connectDB } = await import('./db.js');
    const { Vehicle } = await import('./models.js');
    await connectDB();
    v = await Vehicle.findById(vehicleId).lean();
  } catch {
    v = null;
  }
  if (!v) return sendText(senderId, 'Уучлаарай, тухайн машин олдсонгүй.', MENU);

  const DOWN = 5_000_000; // ойролцоо урьдчилгаа (4-5 сая)
  const RATE = 2.9;
  const TERM = 24;
  const down = Math.min(DOWN, v.price || 0);
  const loan = calcLoanAmount(v.price, (down / (v.price || 1)) * 100);
  const s = calcEqualPrincipal(loan, RATE, TERM);

  return sendText(
    senderId,
    `🏦 ${v.brand || ''} ${v.model || ''} — лизингийн ойролцоо тооцоо\n\n` +
      `• Үнэ: ${fmtPrice(v.price)}\n` +
      `• Урьдчилгаа (~5 сая): ${fmtPrice(down)}\n` +
      `• Сарын хүү: ${RATE}%\n` +
      `• ${TERM} сарын хувьд эхний сар: ~${fmtPrice(s.first)}\n\n` +
      'Энэ бол ойролцоо тооцоо. Тодорхой нөхцлийг ажилтнаас лавлаарай.',
    MENU
  );
}

// ── Туслах ──────────────────────────────────────────────────────
function fmtPrice(n) {
  const num = Number(n);
  if (!num || Number.isNaN(num)) return 'Үнэ тодорхойгүй';
  return `${Math.round(num).toLocaleString('en-US')}₮`;
}
