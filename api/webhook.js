// Facebook Messenger webhook — Vercel serverless function.
//   GET  /api/webhook  → Facebook баталгаажуулна (setup үед нэг удаа)
//   POST /api/webhook  → хэрэглэгчийн мессеж / товч дарсныг хүлээн авна
//
// Webhook URL: https://<таны-project>.vercel.app/api/webhook
import { handleEvent } from '../lib/handlers.js';

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

export default async function handler(req, res) {
  // 1) Webhook баталгаажуулалт
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Баталгаажуулалт амжилтгүй');
  }

  // 2) Ирж буй үйл явдал
  if (req.method === 'POST') {
    const body = req.body;
    if (body?.object === 'page') {
      // Vercel serverless: 200 буцаахаас ӨМНӨ боловсруулж дуусгана
      // (эс бөгөөс instance зогсоод async ажил тасалдана). Үйлдлүүд хурдан
      // тул Facebook-ийн timeout-д багтана.
      for (const entry of body.entry || []) {
        for (const event of entry.messaging || []) {
          const senderId = event.sender?.id;
          if (!senderId) continue;
          if (event.message?.is_echo) continue; // хуудсаны өөрийн мессежийг алгасна

          // Товч (postback) эсвэл quick reply-ийн payload
          const payload =
            event.postback?.payload || event.message?.quick_reply?.payload || null;
          const text = event.message?.text || '';

          if (!payload && !text) continue; // delivery/read receipt г.м.

          try {
            await handleEvent(senderId, { text, payload });
          } catch (err) {
            console.error('handleEvent алдаа:', err);
          }
        }
      }
      return res.status(200).send('EVENT_RECEIVED');
    }
    return res.status(404).send('Not Found');
  }

  return res.status(405).send('Method Not Allowed');
}
