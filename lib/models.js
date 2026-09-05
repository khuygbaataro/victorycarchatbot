// CarNumber1-ийн өгөгдлийн сангийн загваруудыг ЗӨВХӨН УНШИХ зорилгоор
// хөнгөн хувилбараар тодорхойлно. strict:false → CarNumber1-д байгаа бүх
// талбарыг хэвээр нь уншина (энд бүх талбарыг давтах шаардлагагүй).
import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema(
  {
    brand: String,
    model: String,
    year: Number,
    price: Number,
    mileage: Number,
    images: [String],
    video: String,
    status: String,
    description: String,
    downPercent: Number,
  },
  { timestamps: true, strict: false, collection: 'vehicles' }
);

const settingsSchema = new mongoose.Schema({}, { strict: false, collection: 'settings' });

// CarNumber1-ийн Lead цуглуулга — цаг захиалгыг энд хадгалж, admin панелаас
// (/admin/leads) харна. Талбарууд CarNumber1-ийн Lead-тэй нийцнэ.
const leadSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    message: String,
    vehicleId: String,
    vehicleName: String,
    status: { type: String, default: 'new' },
  },
  { timestamps: true, collection: 'leads' }
);

// Serverless-д модель дахин compile хийхээс сэргийлнэ (mongoose.models кэш).
export const Vehicle =
  mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema);
export const Settings =
  mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
export const Lead = mongoose.models.Lead || mongoose.model('Lead', leadSchema);
