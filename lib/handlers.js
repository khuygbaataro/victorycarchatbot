// Ботын логик — БҮГД AI + knowledge base-аар (товчлуургүй, NL яриа).
// Яриаг санаж, тохирох машиныг зурагтай санал болгож, лизинг тооцоод,
// victorycar.mn руу чиглүүлнэ.
import { sendText, sendCarousel } from './messenger.js';
import { runAgent } from './ai.js';
import { loadHistory, saveHistory } from './session.js';

const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');

// Товч дарсныг (хуучин мессеж эсвэл Get Started) энгийн текст болгож хувиргана
function payloadToText(payload) {
  if (!payload) return '';
  if (payload === 'GET_STARTED') return 'Сайн байна уу';
  if (payload.startsWith('SEARCH_')) return payload.slice(7);
  if (payload.startsWith('LIZING_')) return 'Лизингийн тооцоо хийж өгөөч';
  if (payload.startsWith('MENU_')) {
    const m = { MENU_PRICE: 'Ямар машин байна вэ?', MENU_LIZING: 'Лизингийн нөхцөл', MENU_LOCATION: 'Хаяг байршил', MENU_CONTACT: 'Холбоо барих утас' };
    return m[payload] || '';
  }
  return '';
}

export async function handleEvent(senderId, { text, payload }) {
  const userText = (text || '').trim() || payloadToText(payload);
  if (!userText) return;

  const history = await loadHistory(senderId);

  let result;
  try {
    result = await runAgent(history, userText, senderId);
  } catch (err) {
    console.error('AI алдаа:', err.message);
    return sendText(
      senderId,
      'Уучлаарай, түр алдаа гарлаа. 8000-4020 дугаарт холбогдоно уу.'
    );
  }

  if (result.error === 'no_openai_key') {
    return sendText(senderId, 'Бот тохируулж байна. Түр хүлээнэ үү.');
  }

  // Санал болгож буй машинуудыг зурагтай харуулна (≤3)
  if (result.vehicles?.length) {
    await sendCarousel(senderId, result.vehicles.map(toElement));
  }

  const reply = stripMarkdown(result.text?.trim()) || 'Танд юугаар туслах вэ? 🚗';
  await sendText(senderId, reply);

  // Яриаг хадгална (дараагийн мессежид санана)
  await saveHistory(senderId, [
    ...history,
    { role: 'user', content: userText },
    { role: 'assistant', content: reply },
  ]);
}

// Carousel карт — зураг, нэр, үнэ, "Дэлгэрэнгүй" → victorycar.mn
function toElement(v) {
  const parts = [fmtPrice(v.price)];
  if (v.year) parts.push(`${v.year} он`);
  if (v.mileage) parts.push(`${Number(v.mileage).toLocaleString('en-US')} км`);

  const el = {
    title: `${v.brand || ''} ${v.model || ''}`.trim() || 'Машин',
    subtitle: parts.join(' · '),
  };
  if (v.images && v.images[0]) el.image_url = v.images[0];
  if (SITE_URL) {
    el.buttons = [
      { type: 'web_url', url: `${SITE_URL}/vehicles/${v._id}`, title: 'Дэлгэрэнгүй үзэх' },
    ];
  }
  return el;
}

function fmtPrice(n) {
  const num = Number(n);
  if (!num || Number.isNaN(num)) return 'Үнэ тодорхойгүй';
  return `${Math.round(num).toLocaleString('en-US')}₮`;
}

// Messenger markdown-г харуулдаггүй тул **bold**, #, ` зэргийг цэвэрлэнэ
function stripMarkdown(t = '') {
  return t
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/`/g, '')
    .trim();
}
