// Судалгаа: Victory car хуудасны сүүлийн X өдрийн Messenger чатыг
// Graph API-аар татаж, JSON файл болгож хадгална.
//
// Ажиллуулах:
//   1) .env дотор PAGE_ACCESS_TOKEN тавина
//   2) npm run fetch:chats
//
// Гаралт:
//   data/conversations.json — бүх чат (бүтэн)
//   data/questions.json     — зөвхөн ХЭРЭГЛЭГЧИЙН мессежүүд (FAQ шинжлэхэд)

import { writeFileSync, mkdirSync } from 'node:fs';

const GRAPH = 'https://graph.facebook.com/v21.0';
const TOKEN = process.env.PAGE_ACCESS_TOKEN;
const DAYS = Number(process.env.DAYS || 7);

if (!TOKEN) {
  console.error('❌ PAGE_ACCESS_TOKEN алга. .env файлдаа нэмнэ үү.');
  process.exit(1);
}

const sinceMs = Date.now() - DAYS * 24 * 60 * 60 * 1000;

// Хуудасны id-г авах (хэрэглэгч vs хуудсыг ялгахад хэрэгтэй)
const meRes = await fetch(`${GRAPH}/me?fields=id,name&access_token=${TOKEN}`);
const me = await meRes.json();
if (me.error) {
  console.error('❌ Токен алдаа:', me.error.message);
  process.exit(1);
}
console.log(`📄 Хуудас: ${me.name} (${me.id})`);
console.log(`⏳ Сүүлийн ${DAYS} өдрийн чат татаж байна...\n`);

const conversations = [];
let url =
  `${GRAPH}/me/conversations` +
  `?fields=participants,updated_time,messages.limit(100){message,from,created_time}` +
  `&limit=25&access_token=${TOKEN}`;
let page = 0;

while (url) {
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) {
    console.error('❌ Graph API алдаа:', json.error.message);
    process.exit(1);
  }

  let reachedOld = false;
  for (const conv of json.data || []) {
    if (new Date(conv.updated_time).getTime() < sinceMs) {
      // conversations нь updated_time буурахаар эрэмблэгддэг → эндээс хуучин, зогсоно
      reachedOld = true;
      break;
    }
    conversations.push(conv);
  }

  page++;
  console.log(`  хуудас ${page} — нийт ${conversations.length} чат`);

  url = reachedOld ? null : json.paging?.next || null;
}

// Зөвхөн хэрэглэгчийн (хуудас биш) мессежийг цуглуулж, FAQ шинжлэхэд бэлдэнэ
const questions = [];
for (const conv of conversations) {
  for (const m of conv.messages?.data || []) {
    if (!m.message) continue;
    if (m.from?.id === me.id) continue; // хуудсаны хариуг алгасна
    questions.push({ from: m.from?.name, text: m.message, time: m.created_time });
  }
}

mkdirSync('data', { recursive: true });
writeFileSync('data/conversations.json', JSON.stringify(conversations, null, 2), 'utf8');
writeFileSync('data/questions.json', JSON.stringify(questions, null, 2), 'utf8');

console.log(`\n✅ Дууслаа`);
console.log(`   ${conversations.length} чат → data/conversations.json`);
console.log(`   ${questions.length} хэрэглэгчийн мессеж → data/questions.json`);
