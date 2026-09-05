// Chatbot analytics — botsessions (customer bot) болон leads-ээс статистик гаргана.
import mongoose from 'mongoose';
import { connectDB } from './db.js';

// Хэрэглэгчийн мессежээс хайх сэдвүүд
const TOPICS = [
  ['Prius', /prius|приус/i],
  ['Sai', /\bsai\b|сай/i],
  ['Aqua', /aqua|аква/i],
  ['Lexus RX', /\brx\b|rx450/i],
  ['Lexus HS', /\bhs\b|hs250/i],
  ['Alphard', /alphard|альфард/i],
  ['Crown', /crown|краун/i],
  ['CHR', /\bc-?hr\b/i],
  ['Camry', /camry|камри/i],
  ['Лизинг / зээл', /лизинг|лизнг|зээл/i],
  ['Урьдчилгаа', /урьдчил|урьч|uridch/i],
  ['Үнэ', /үнэ|унэ|үнийн|hed|хэд вэ/i],
  ['Хаяг / байршил', /хаяг|байршил|hayg|байрлал|хаана/i],
  ['Утас / холбоо', /утас|дугаар|холбо|залга/i],
];

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

export async function buildStats() {
  await connectDB();
  const db = mongoose.connection.db;

  const sessions = await db
    .collection('botsessions')
    .find({ psid: { $exists: true } })
    .toArray();
  const leads = await db.collection('leads').find().sort({ createdAt: -1 }).toArray();

  // Хэрэглэгчийн бүх мессеж
  const userMsgs = [];
  for (const s of sessions) {
    for (const m of s.messages || []) {
      if (m.role === 'user' && m.content) userMsgs.push(String(m.content));
    }
  }

  // Сэдвийн давтамж
  const topics = TOPICS.map(([name, rx]) => ({
    name,
    count: userMsgs.filter((t) => rx.test(t)).length,
  })).sort((a, b) => b.count - a.count);

  // Цаг захиалга ба мэдэхгүй асуултууд (leads доторх тэмдэглэгээгээр)
  const appointments = leads.filter((l) => /цаг захиалга/i.test(l.message || ''));
  const unknowns = leads.filter((l) => /Бот мэдээгүй/i.test(l.name || ''));

  // Сүүлийн 14 өдрийн яриа
  const byDay = {};
  for (const s of sessions) {
    const t = s.updatedAt || s.createdAt;
    if (t) byDay[dayKey(t)] = (byDay[dayKey(t)] || 0) + 1;
  }
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = dayKey(d);
    days.push({ day: k.slice(5), count: byDay[k] || 0 });
  }

  return {
    totals: {
      conversations: sessions.length,
      userMessages: userMsgs.length,
      appointments: appointments.length,
      unknowns: unknowns.length,
    },
    topics,
    unknowns: unknowns.slice(0, 50).map((l) => ({
      question: (l.message || '').replace(/^❓[^:]*:\s*/, ''),
      date: l.createdAt,
    })),
    appointments: appointments.slice(0, 50).map((l) => ({
      name: (l.name || '').replace(/^🤖\s*/, ''),
      phone: l.phone || '',
      info: (l.message || '').replace(/^🤖[^:]*:\s*/, ''),
      date: l.createdAt,
    })),
    days,
  };
}
