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

// Serverless-д модель дахин compile хийхээс сэргийлнэ (mongoose.models кэш).
export const Vehicle =
  mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema);
export const Settings =
  mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
