// Машины хайлт ба статистик — MongoDB.
import mongoose from 'mongoose';
import { connectDB } from './db.js';
import { Vehicle } from './models.js';

function esc(s = '') {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Хайлтын шүүлтүүр (findVehicles ба vehicleStats хоёул ашиглана)
function buildFilter({ query, minPrice, maxPrice, fuel, transmission } = {}) {
  const filter = { status: 'available' };
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }
  if (fuel) filter.fuel = { $regex: esc(fuel), $options: 'i' };
  if (transmission) filter.transmission = { $regex: esc(transmission), $options: 'i' };

  if (query) {
    const tokens = String(query)
      .toLowerCase()
      .replace(/pruis|priuse|приус/g, 'prius')
      .replace(/#/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5);
    const stop = new Set(['сая', 'саяын', 'үнэ', 'унэ', 'машин', 'авто', 'toyota', 'lexus']);
    const wordTokens = tokens.filter((t) => /[a-zа-яё]/i.test(t) && !stop.has(t));
    const useTokens = wordTokens.length ? wordTokens : tokens;
    if (useTokens.length) {
      filter.$and = useTokens.map((t) => ({
        $or: [
          { brand: { $regex: esc(t), $options: 'i' } },
          { model: { $regex: esc(t), $options: 'i' } },
          { description: { $regex: esc(t), $options: 'i' } },
        ],
      }));
    }
  }
  return filter;
}

export async function findVehicles(opts = {}) {
  await connectDB();
  const limit = opts.limit || 10;
  return Vehicle.find(buildFilter(opts)).sort('-createdAt').limit(limit).lean();
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
  const all = await Vehicle.find(buildFilter(opts))
    .select('price year mileage')
    .limit(300)
    .lean();
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
