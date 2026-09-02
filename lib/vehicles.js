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
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4);
    if (tokens.length) {
      filter.$and = tokens.map((t) => ({
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
