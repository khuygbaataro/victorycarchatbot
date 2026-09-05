// Chatbot admin dashboard — analytics-ийг HTML болгож харуулна.
//   URL: https://<project>.vercel.app/api/admin?key=<ADMIN_KEY>
// ADMIN_KEY орчны хувьсагчийг Vercel-д тавина.
import { buildStats } from '../lib/stats.js';

const ADMIN_KEY = process.env.ADMIN_KEY;

function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleString('en-CA', { hour12: false }).replace(',', '');
  } catch {
    return '';
  }
}

export default async function handler(req, res) {
  const key = req.query?.key || '';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!ADMIN_KEY) {
    return res.status(500).send('<h2>ADMIN_KEY тохируулаагүй байна (Vercel env).</h2>');
  }
  if (key !== ADMIN_KEY) {
    return res.status(401).send(`<!doctype html><meta charset="utf-8">
      <div style="font-family:system-ui;max-width:360px;margin:15vh auto;text-align:center">
        <h2>🔒 Victory Car — Bot Admin</h2>
        <form method="get"><input name="key" type="password" placeholder="Нэвтрэх түлхүүр"
          style="padding:10px;width:100%;border:1px solid #ccc;border-radius:8px;font-size:16px">
          <button style="margin-top:10px;padding:10px 20px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-size:16px">Нэвтрэх</button>
        </form>
      </div>`);
  }

  let s;
  try {
    s = await buildStats();
  } catch (e) {
    return res.status(500).send(`<h2>Алдаа: ${esc(e.message)}</h2>`);
  }

  const maxTopic = Math.max(1, ...s.topics.map((t) => t.count));
  const maxDay = Math.max(1, ...s.days.map((d) => d.count));

  const topicBars = s.topics
    .map(
      (t) => `<div class="row">
        <span class="lbl">${esc(t.name)}</span>
        <span class="bar"><span style="width:${(t.count / maxTopic) * 100}%"></span></span>
        <span class="num">${t.count}</span></div>`
    )
    .join('');

  const dayBars = s.days
    .map(
      (d) => `<div class="col" title="${esc(d.day)}: ${d.count}">
        <span class="dbar" style="height:${Math.max(3, (d.count / maxDay) * 90)}px"></span>
        <span class="dlbl">${esc(d.day)}</span></div>`
    )
    .join('');

  const unknownRows =
    s.unknowns.length === 0
      ? '<tr><td colspan="2" class="empty">Одоохондоо байхгүй</td></tr>'
      : s.unknowns
          .map(
            (u) => `<tr><td>${esc(u.question)}</td><td class="date">${esc(fmtDate(u.date))}</td></tr>`
          )
          .join('');

  const apptRows =
    s.appointments.length === 0
      ? '<tr><td colspan="4" class="empty">Одоохондоо байхгүй</td></tr>'
      : s.appointments
          .map(
            (a) => `<tr><td>${esc(a.name)}</td><td>${esc(a.phone)}</td><td>${esc(
              a.info
            )}</td><td class="date">${esc(fmtDate(a.date))}</td></tr>`
          )
          .join('');

  return res.status(200).send(`<!doctype html>
<html lang="mn"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Victory Car — Bot Admin</title>
<style>
  *{box-sizing:border-box} body{margin:0;background:#0f172a;color:#e2e8f0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
  .wrap{max-width:1000px;margin:0 auto;padding:24px 18px 60px}
  h1{font-size:1.4rem;margin:0 0 2px} .sub{color:#94a3b8;font-size:.85rem;margin-bottom:20px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px}
  .card{background:#1e293b;border-radius:14px;padding:16px 18px}
  .card .v{font-size:1.9rem;font-weight:800} .card .k{color:#94a3b8;font-size:.8rem;margin-top:2px}
  h2{font-size:1.05rem;margin:26px 0 12px;border-bottom:1px solid #334155;padding-bottom:8px}
  .row{display:flex;align-items:center;gap:10px;margin:7px 0}
  .row .lbl{width:130px;font-size:.85rem;color:#cbd5e1;flex-shrink:0}
  .row .bar{flex:1;background:#334155;border-radius:6px;height:16px;overflow:hidden}
  .row .bar span{display:block;height:100%;background:linear-gradient(90deg,#3b82f6,#22c55e)}
  .row .num{width:34px;text-align:right;font-weight:700;font-size:.85rem}
  .days{display:flex;align-items:flex-end;gap:6px;height:120px;padding:8px 0;overflow-x:auto}
  .col{display:flex;flex-direction:column;align-items:center;gap:5px;flex:1;min-width:34px}
  .dbar{width:60%;background:linear-gradient(#3b82f6,#22c55e);border-radius:4px 4px 0 0}
  .dlbl{font-size:.65rem;color:#94a3b8;white-space:nowrap}
  table{width:100%;border-collapse:collapse;background:#1e293b;border-radius:12px;overflow:hidden;font-size:.85rem}
  th,td{text-align:left;padding:9px 12px;border-bottom:1px solid #334155;vertical-align:top}
  th{background:#243349;color:#94a3b8;font-size:.75rem;text-transform:uppercase;letter-spacing:.03em}
  td.date{color:#94a3b8;white-space:nowrap;font-size:.78rem} td.empty{text-align:center;color:#64748b;padding:18px}
  .scroll{overflow-x:auto}
</style></head>
<body><div class="wrap">
  <h1>🚗 Victory Car — Bot Admin</h1>
  <div class="sub">Чатботын статистик · шинэчилсэн: ${esc(fmtDate(Date.now()))}</div>

  <div class="cards">
    <div class="card"><div class="v">${s.totals.conversations}</div><div class="k">Яриа (хэрэглэгч)</div></div>
    <div class="card"><div class="v">${s.totals.userMessages}</div><div class="k">Нийт мессеж</div></div>
    <div class="card"><div class="v">${s.totals.appointments}</div><div class="k">Цаг захиалга</div></div>
    <div class="card"><div class="v">${s.totals.unknowns}</div><div class="k">Мэдэхгүй асуулт</div></div>
  </div>

  <h2>📊 Хамгийн их асуудаг</h2>
  ${topicBars}

  <h2>📈 Сүүлийн 14 хоногийн яриа</h2>
  <div class="days">${dayBars}</div>

  <h2>❓ Бот мэдэхгүй байсан асуултууд</h2>
  <div class="scroll"><table><thead><tr><th>Асуулт</th><th>Огноо</th></tr></thead><tbody>${unknownRows}</tbody></table></div>

  <h2>📅 Цаг захиалгууд</h2>
  <div class="scroll"><table><thead><tr><th>Нэр</th><th>Утас</th><th>Мэдээлэл</th><th>Огноо</th></tr></thead><tbody>${apptRows}</tbody></table></div>
</div></body></html>`);
}
