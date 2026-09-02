// AI агент — OpenAI + function calling. Яриаг санаж (history), шаардвал
// search_vehicles / calc_loan tool дуудаж, товч найрсаг монголоор хариулна.
import { systemPrompt } from './knowledge.js';
import { findVehicles } from './vehicles.js';
import { calcLoanAmount, calcEqualPrincipal } from './loan.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const API_URL = 'https://api.openai.com/v1/chat/completions';

// Reasoning модель (gpt-5*, o1/o3, luna) tool-д reasoning_effort:'none' шаардана.
const IS_REASONING = /^(o[13]|gpt-5)/i.test(MODEL) || /luna/i.test(MODEL);

// Лизингийн тогтмол нөхцөл
const DOWN_DEFAULT = 5_000_000; // ойролцоо урьдчилгаа (4-5 сая)
const RATE = 2.9; // сарын хүү %
const TERM_DEFAULT = 24; // сар

const tools = [
  {
    type: 'function',
    function: {
      name: 'search_vehicles',
      description:
        'Агуулахаас зарагдаж буй машин хайх. Хэрэглэгч загвар, брэнд, үнэ, ' +
        'түлш/хурдны хайрцгийн төрлийн машин асуувал дуудна.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Брэнд/загвар, ж: Prius, Sai, Camry' },
          minPrice: { type: 'number', description: 'Доод үнэ (₮)' },
          maxPrice: { type: 'number', description: 'Дээд үнэ (₮)' },
          fuel: { type: 'string', description: 'Бензин/Дизель/Хайбрид/Цахилгаан/Хий' },
          transmission: { type: 'string', description: 'Автомат/Механик' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calc_loan',
      description:
        'Тодорхой машины лизингийн сарын төлбөрийг тооцох. Машины үнийг ₮-өөр өг.',
      parameters: {
        type: 'object',
        properties: {
          price: { type: 'number', description: 'Машины үнэ (₮)' },
          downPayment: { type: 'number', description: 'Урьдчилгаа (₮). Байхгүй бол 5 сая.' },
          termMonths: { type: 'number', description: 'Хугацаа сараар. Байхгүй бол 24.' },
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

function calcLoan({ price, downPayment, termMonths }) {
  const p = Number(price) || 0;
  const down = Math.min(Number(downPayment) || DOWN_DEFAULT, p);
  const term = Number(termMonths) || TERM_DEFAULT;
  const loan = calcLoanAmount(p, p ? (down / p) * 100 : 0);
  const s = calcEqualPrincipal(loan, RATE, term);
  return {
    price: p,
    downPayment: down,
    loanAmount: Math.round(loan),
    termMonths: term,
    years: +(term / 12).toFixed(1),
    monthlyRate: `${RATE}%`,
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

// history: [{role,content}] өмнөх яриа. Буцаана: { text, vehicles(≤3) }
export async function runAgent(history, userText) {
  if (!OPENAI_API_KEY) return { text: '', vehicles: [], error: 'no_openai_key' };

  const messages = [
    { role: 'system', content: systemPrompt() },
    ...history,
    { role: 'user', content: userText },
  ];

  let foundVehicles = [];

  for (let step = 0; step < 5; step++) {
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
            const vehicles = await findVehicles({ ...args, limit: 6 });
            foundVehicles = vehicles;
            result = vehicles.map(compact);
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

    return { text: msg.content || '', vehicles: foundVehicles.slice(0, 3) };
  }

  return { text: 'Уучлаарай, дахин оролдоно уу.', vehicles: foundVehicles.slice(0, 3) };
}
