// Яриаг санах ой — хэрэглэгч (PSID) тус бүрийн сүүлийн мессежүүдийг
// MongoDB-д хадгална. Ингэснээр AI өмнөх яриаг санаж, олон шат явна.
// DB байхгүй/унавал графекейр — түүхгүйгээр (stateless) ажиллана.
import mongoose from 'mongoose';
import { connectDB } from './db.js';

const schema = new mongoose.Schema(
  {
    psid: { type: String, index: true, unique: true },
    messages: { type: Array, default: [] }, // [{ role, content }]
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'botsessions' }
);

const Session = mongoose.models.BotSession || mongoose.model('BotSession', schema);

const MAX_TURNS = 12; // сүүлийн ~12 мессеж (6 солилцоо) хадгална

export async function loadHistory(psid) {
  try {
    await connectDB();
    const s = await Session.findOne({ psid }).lean();
    return s?.messages || [];
  } catch {
    return [];
  }
}

export async function saveHistory(psid, messages) {
  try {
    await connectDB();
    await Session.updateOne(
      { psid },
      { $set: { messages: messages.slice(-MAX_TURNS), updatedAt: new Date() } },
      { upsert: true }
    );
  } catch {
    /* DB байхгүй бол зүгээр орхино */
  }
}
