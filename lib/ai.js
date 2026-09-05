// AI агент — OpenAI + function calling. Яриаг санаж, процессын дагуу
// хайж, машин зурагтай харуулж (show_cars), лизинг тооцоод (calc_loan)
// товч найрсаг монголоор хариулна.
import { systemPrompt, DEALER } from './knowledge.js';
import { findVehicles, findByIds, vehicleStats } from './vehicles.js';
import { calcLoanAmount, calcEqualPrincipal } from './loan.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const API_URL = 'https://api.openai.com/v1/chat/completions';
const IS_REASONING = /^(o[13]|gpt-5)/i.test(MODEL) || /luna/i.test(MODEL);

// Лизингийн нөхцөл
const DOWN_PCT = DEALER.lizing.downPercent; // 15%
const RATE = 2.9; // тооцоонд ашиглах хүү (2.5-2.9%-ийн дээд, болгоомжтой)
const TERM_DEFAULT = 24;

const tools = [
  {
    type: 'function',
    function: {
      name: 'search_vehicles',
      description:
        'Агуулахаас машин хайж, тухайн маркийн нэгдсэн статистик (үнэ/он/гүйлтийн ' +
        'муж, тоо) БОЛОН тохирох машинуудын жагсаалтыг авах.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Брэнд/загвар, ж: Prius, Sai, Camry' },
          minPrice: { type: 'number' },
          maxPrice: { type: 'number' },
          fuel: { type: 'string', description: 'Бензин/Дизель/Хайбрид/Цахилгаан/Хий' },
          transmission: { type: 'string', description: 'Автомат/Механик' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_cars',
      description:
        'Сонгосон машинуудыг хэрэглэгчид ЗУРАГТАЙ карт болгож харуулна. Контраст ' +
        'маркетингийн дагуу яг 2 машины id-г ДАРААЛЛААР нь дамжуул (1 дэх нь ' +
        'тохиромж багатай, 2 дах нь хамгийн боломжтой).',
      parameters: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'search_vehicles-ээс авсан машины id-ууд, харуулах дарааллаар',
          },
        },
        required: ['ids'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calc_loan',
      description: 'Тодорхой машины лизингийн сарын төлбөрийг тооцох.',
      parameters: {
        type: 'object',
        properties: {
          price: { type: 'number', description: 'Машины үнэ (₮)' },
          downPercent: { type: 'number', description: 'Урьдчилгаа %. Байхгүй бол 15.' },
          termMonths: { type: 'number', description: 'Хугацаа сар (12-60). Байхгүй бол 24.' },
        },
        required: ['price'],
      },
    },
  },
];

function compact(v) {
  return {
    id: String(v._id),
    brand: v.brand,
    model: v.model,
    year: v.year,
    price: v.price,
    mileage: v.mileage,
    fuel: v.fuel,
    transmission: v.transmission,
  };
}

function calcLoan({ price, downPercent, termMonths }) {
  const p = Number(price) || 0;
  const pct = downPercent == null ? DOWN_PCT : Number(downPercent);
  let term = Number(termMonths) || TERM_DEFAULT;
  term = Math.max(12, Math.min(60, term));
  const loan = calcLoanAmount(p, pct);
  const s = calcEqualPrincipal(loan, RATE, term);
  return {
    price: p,
    downPercent: pct,
    downAmount: Math.round((p * pct) / 100),
    loanAmount: Math.round(loan),
    termMonths: term,
    years: +(term / 12).toFixed(1),
    rateRange: DEALER.lizing.rateRange,
    monthlyFirst: Math.round(s.first),
    monthlyLast: Math.round(s.last),
  };
}

async function callOpenAI(messages) {
  const body = { model: MODEL, messages, tools };
  if (IS_REASONING) body.reasoning_effort = 'none';
  else body.temperature = 0.3;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  return res.json();
}

// history: [{role,content}]. Буцаана: { text, vehicles(харуулах картууд) }
export async function runAgent(history, userText) {
  if (!OPENAI_API_KEY) return { text: '', vehicles: [], error: 'no_openai_key' };

  const messages = [
    { role: 'system', content: systemPrompt() },
    ...history,
    { role: 'user', content: userText },
  ];

  // Зөвхөн AI-ийн show_cars-аар сонгосон машинуудыг карт болгож харуулна
  // (эс бөгөөс лизинг/бусад турнд хамаагүй машин гарч болзошгүй).
  let displayVehicles = [];

  for (let step = 0; step < 6; step++) {
    const data = await callOpenAI(messages);
    const msg = data.choices?.[0]?.message;
    if (!msg) break;
    messages.push(msg);

    if (msg.tool_calls?.length) {
      for (const tc of msg.tool_calls) {
        let result;
        try {
          const args = JSON.parse(tc.function.arguments || '{}');
          if (tc.function.name === 'search_vehicles') {
            const [stats, list] = await Promise.all([
              vehicleStats(args),
              findVehicles({ ...args, limit: 8 }),
            ]);
            result = { stats, vehicles: list.map(compact) };
          } else if (tc.function.name === 'show_cars') {
            const cars = await findByIds(args.ids || []);
            if (cars.length) displayVehicles = cars;
            result = { shown: cars.length };
          } else if (tc.function.name === 'calc_loan') {
            result = calcLoan(args);
          } else {
            result = { error: 'unknown_tool' };
          }
        } catch (err) {
          console.error(`${tc.function.name} алдаа:`, err.message);
          result = { error: 'tool_failed' };
        }
        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      }
      continue;
    }

    return { text: msg.content || '', vehicles: displayVehicles };
  }

  return { text: 'Уучлаарай, дахин оролдоно уу.', vehicles: displayVehicles };
}
