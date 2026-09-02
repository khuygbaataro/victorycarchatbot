// AI агент — OpenAI (GPT) + function calling.
// Чөлөөт бичвэрийг ойлгож, шаардвал search_vehicles tool-оор өгөгдлийн
// сангаас машин хайж, монголоор хариу бичнэ.
import { systemPrompt } from './knowledge.js';
import { findVehicles } from './vehicles.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const API_URL = 'https://api.openai.com/v1/chat/completions';

const tools = [
  {
    type: 'function',
    function: {
      name: 'search_vehicles',
      description:
        'Агуулахаас (өгөгдлийн сан) зарагдаж буй машин хайх. Хэрэглэгч тодорхой ' +
        'загвар, брэнд, үнэ, түлш/хурдны хайрцгийн төрлийн машин асуувал дуудна.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Брэнд эсвэл загварын нэр, ж: Prius, Alphard, Estima',
          },
          minPrice: { type: 'number', description: 'Доод үнэ (төгрөгөөр)' },
          maxPrice: { type: 'number', description: 'Дээд үнэ (төгрөгөөр)' },
          fuel: {
            type: 'string',
            description: 'Түлшний төрөл: Бензин, Дизель, Хайбрид, Цахилгаан, Хий',
          },
          transmission: { type: 'string', description: 'Автомат эсвэл Механик' },
        },
      },
    },
  },
];

// Машиныг AI-д өгөх компакт хэлбэр (токен хэмнэнэ)
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

// Reasoning модель (gpt-5*, o1/o3, luna) tool ашиглахад reasoning_effort:'none'
// шаардана, temperature дэмждэггүй. Энгийн модель (gpt-4o*) эсрэгээрээ.
const IS_REASONING = /^(o[13]|gpt-5)/i.test(MODEL) || /luna/i.test(MODEL);

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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err}`);
  }
  return res.json();
}

// Гол функц: хэрэглэгчийн бичвэрийг боловсруулж { text, vehicles } буцаана.
// vehicles байвал handler нь carousel болгож харуулна.
export async function runAgent(userText) {
  if (!OPENAI_API_KEY) {
    return { text: '', vehicles: [], error: 'no_openai_key' };
  }

  const messages = [
    { role: 'system', content: systemPrompt() },
    { role: 'user', content: userText },
  ];

  let foundVehicles = [];

  for (let step = 0; step < 3; step++) {
    const data = await callOpenAI(messages);
    const msg = data.choices?.[0]?.message;
    if (!msg) break;
    messages.push(msg);

    if (msg.tool_calls?.length) {
      for (const tc of msg.tool_calls) {
        let result;
        try {
          const args = JSON.parse(tc.function.arguments || '{}');
          const vehicles = await findVehicles({ ...args, limit: 10 });
          foundVehicles = vehicles;
          result = vehicles.map(compact);
        } catch (err) {
          console.error('search_vehicles алдаа:', err.message);
          result = { error: 'Агуулахтай холбогдож чадсангүй.' };
        }
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
      continue; // модель үр дүнг үзээд эцсийн хариу бичнэ
    }

    // Tool дуудаагүй → эцсийн текст хариу
    return { text: msg.content || '', vehicles: foundVehicles };
  }

  return { text: 'Уучлаарай, дахин оролдоно уу.', vehicles: foundVehicles };
}
