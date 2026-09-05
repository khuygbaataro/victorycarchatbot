// Машины хайлт ба статистик — MongoDB.
import mongoose from 'mongoose';
import { connectDB } from './db.js';
import { Vehicle } from './models.js';

function esc(s = '') {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Хайлтын үгсийг задлана: бүх утга + зөвхөн үсэгтэй (тоогүй) хувилбар.
function tokenize(query) {
  const tokens = String(query || '')
    .toLowerCase()
    .replace(/pruis|priuse|приус/g, 'prius')
    .replace(/#/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
  const stop = new Set(['сая', 'саяын', 'үнэ', 'унэ', 'машин', 'авто', 'toyota', 'lexus']);
  const all = tokens.filter((t) => !stop.has(t));
  const words = all.filter((t) => /[a-zа-яё]/i.test(t)); // тоогүй үгс
  return { all, words };
}

function tokensToFilter(tokens, base) {
  const filter = { ...base };
  if (tokens.length) {
    filter.$and = tokens.map((t) => {
      const isNum = /^\d+$/.test(t);
      // Цэвэр тоо (41, 7335)-г үг таслалын хязгаараар (арлын дугаар #4163
      // доторх санамсаргүй "41"-тэй мөргөлдөхгүй) БА зөвхөн марк+загвараар
      // (тайлбар доторх тоотой мөргөлдөхгүй). Үсэгтэй үг — тайлбарыг ч хамруулна.
      const rx = isNum ? `\\b${esc(t)}\\b` : esc(t);
      const or = [
        { brand: { $regex: rx, $options: 'i' } },
        { model: { $regex: rx, $options: 'i' } },
      ];
      if (!isNum) or.push({ description: { $regex: rx, $options: 'i' } });
      return { $or: or };
    });
  }
  return filter;
}

function baseFilter({ minPrice, maxPrice, fuel, transmission, color } = {}) {
  const base = { status: 'available' };
  if (minPrice || maxPrice) {
    base.price = {};
    if (minPrice) base.price.$gte = Number(minPrice);
    if (maxPrice) base.price.$lte = Number(maxPrice);
  }
  if (fuel) base.fuel = { $regex: esc(fuel), $options: 'i' };
  if (transmission) base.transmission = { $regex: esc(transmission), $options: 'i' };
  // Өнгө: "цагаан" → "Цагаан", "Сувдан цагаан" гэх мэтийг хамруулна
  if (color) base.exteriorColor = { $regex: esc(color), $options: 'i' };
  return base;
}

// Дугаартай нь ЭХЛЭЭД хайна (ж: "Prius 41" → зөвхөн Prius 41). Олдохгүй бол
// (ж: "Prius 40" гэхэд агуулахад байхгүй) зөвхөн үсгээр (бүх Prius) хайна.
// exec(filter) → Promise-г буцаадаг функц дамжуулна.
async function smartQuery(opts, exec) {
  const base = baseFilter(opts);
  if (!opts.query) return exec(tokensToFilter([], base));

  const { all, words } = tokenize(opts.query);
  const strict = await exec(tokensToFilter(all, base));
  const hasStrictResult = Array.isArray(strict) ? strict.length : strict;
  if (hasStrictResult) return strict;

  // Fallback: тоогүй үгсээр (эсвэл үг байхгүй бол бүх утгаар)
  const lenientTokens = words.length ? words : all;
  return exec(tokensToFilter(lenientTokens, base));
}

export async function findVehicles(opts = {}) {
  await connectDB();
  const limit = opts.limit || 10;
  return smartQuery(opts, (filter) =>
    Vehicle.find(filter).sort('-createdAt').limit(limit).lean()
  );
}

// Тодорхой id-уудаар (өгсөн дарааллаар нь) машин авах — show_cars-д
export async function findByIds(ids = []) {
  await connectDB();
  const valid = ids.filter((id) => mongoose.isValidObjectId(id));
  if (!valid.length) return [];
  const docs = await Vehicle.find({ _id: { $in: valid } }).lean();
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  return valid.map((id) => byId.get(String(id))).filter(Boolean);
}

// IQR-ээр гажуудал (алдаатай хэт хямд/хуучин) утгыг хасна
function iqrTrim(arr) {
  const nums = arr.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (nums.length < 4) return nums;
  const s = [...nums].sort((a, b) => a - b);
  const q = (p) => {
    const i = (s.length - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return s[lo] + (s[hi] - s[lo]) * (i - lo);
  };
  const q1 = q(0.25);
  const q3 = q(0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return s.filter((x) => x >= lo && x <= hi);
}

const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);

// Маркийн нэгдсэн статистик — алдаатай нэгжийг хассан бодит муж
export async function vehicleStats(opts = {}) {
  await connectDB();
  const all = await smartQuery(opts, (filter) =>
    Vehicle.find(filter).select('price year mileage').limit(300).lean()
  );
  if (!all.length) return { count: 0 };

  const prices = iqrTrim(all.map((v) => v.price));
  const years = iqrTrim(all.map((v) => v.year));
  const mileages = iqrTrim(all.map((v) => v.mileage));

  return {
    count: all.length,
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length ? Math.max(...prices) : null,
    priceAvg: avg(prices),
    yearMin: years.length ? Math.min(...years) : null,
    yearMax: years.length ? Math.max(...years) : null,
    mileageAvg: avg(mileages),
  };
}
