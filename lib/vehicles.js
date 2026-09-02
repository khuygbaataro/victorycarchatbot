// Машины хайлт — MongoDB. AI-ийн tool болон дүрэмд суурилсан хайлт хоёул
// энэ функцийг ашиглана.
import { connectDB } from './db.js';
import { Vehicle } from './models.js';

function esc(s = '') {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function findVehicles({
  query,
  minPrice,
  maxPrice,
  fuel,
  transmission,
  limit = 10,
} = {}) {
  await connectDB();

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

    // Үсэгтэй үг (prius, alphard...) ЗААВАЛ таарна; цэвэр тоо (40, 41...)
    // болон "сая"/"үнэ" зэрэг нь заавал биш — DB-д "Prius 41" гэж хадгалсан
    // байхад хэрэглэгч "Prius 40" гэж бичсэн ч олдоно.
    const stop = new Set(['сая', 'саяын', 'үнэ', 'унэ', 'машин', 'авто', 'toyota']);
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

  return Vehicle.find(filter).sort('-createdAt').limit(limit).lean();
}
