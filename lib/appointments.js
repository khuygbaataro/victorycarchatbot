// Цаг захиалгыг CarNumber1-ийн Lead цуглуулгад хадгална → admin панелаас
// (/admin/leads) харагдана. Нэрийг Facebook-оос авна.
import { connectDB } from './db.js';
import { Lead } from './models.js';
import { getUserProfile } from './messenger.js';

export async function saveAppointment(psid, { time, phone, carName } = {}) {
  await connectDB();

  let name = 'Messenger хэрэглэгч';
  const profile = await getUserProfile(psid);
  if (profile) {
    const full = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    if (full) name = full;
  }

  const lead = await Lead.create({
    name,
    phone: (phone && String(phone).trim()) || '(Messenger чат)',
    message: `🤖 Messenger цаг захиалга: ${time || 'тодорхойгүй'}`,
    vehicleName: carName || '',
    status: 'new',
  });

  return { id: String(lead._id), name, time: time || '' };
}
