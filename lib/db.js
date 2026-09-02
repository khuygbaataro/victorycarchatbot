// CarNumber1-ийн MongoDB (Atlas) руу холбогдоно.
// Serverless (Vercel) орчинд холболтыг кэшлэж, дуудлага бүрт дахин нээхээс сэргийлнэ.
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

let cached = global._mongoose;
if (!cached) cached = global._mongoose = { conn: null, promise: null };

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!MONGODB_URI) throw new Error('MONGODB_URI тохируулаагүй байна');

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, { bufferCommands: false })
      .then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
