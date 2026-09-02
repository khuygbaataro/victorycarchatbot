# 🚗 Victory Car — Messenger Chatbot

Victory car хуудасны Facebook Messenger чатбот. Vercel дээр (serverless) ажиллана.

## Бүтэц

```
victorycarchatbot/
├── api/
│   └── webhook.js              # Vercel serverless — мессеж/товч хүлээн авах
├── lib/
│   ├── handlers.js             # Ботын логик (үнэ, лизинг, байршил, утас)
│   ├── db.js                   # MongoDB холболт (кэштэй)
│   ├── models.js               # Vehicle, Settings (CarNumber1-ийн өгөгдөл)
│   ├── messenger.js            # Facebook Send API туслахууд
│   └── loan.js                 # Лизингийн тооцоо (сайттай ижил томьёо)
├── scripts/
│   └── fetch-conversations.js  # Судалгаа: сүүлийн X өдрийн чат → JSON
├── .env.example
└── package.json
```

## Бот юу хийдэг вэ

FAQ дүн шинжилгээгээр (3,791 мессеж) хамгийн их асуудаг 4 зүйлд хариулна:

| Хэрэглэгч | Бот |
| --- | --- |
| Загварын нэр бичих (ж: "Prius 40") | CarNumber1 DB-ээс хайж **зураг + үнэ carousel** |
| "🏦 Лизинг" / хүү, урьдчилгаа | Settings-ийн лизингийн нөхцөл; машин тус бүрийн сарын төлбөр |
| "📍 Байршил" / хаяг | Settings-ийн хаяг + газрын зураг |
| "📲 Холбоо барих" / утас | Settings-ийн утас/имэйл |

Доор нь байнга харагдах **quick reply цэс** байна. AI ашиглаагүй — хурдан, найдвартай, төлбөргүй.

## Хийх ажлын дараалал

### 1. Судалгаа — өмнөх чат татах (кодыг deploy хийхээс өмнө болно)

1. [developers.facebook.com](https://developers.facebook.com) → App үүсгэх → **Messenger** нэмэх.
2. Victory car хуудсаа холбож **Page Access Token** авах (`pages_messaging` эрхтэй).
3. Токеноо тавина:
   ```bash
   cp .env.example .env
   # .env дотор PAGE_ACCESS_TOKEN-оо буулгана
   ```
4. Сүүлийн 7 өдрийн чатыг татах:
   ```bash
   npm run fetch:chats
   ```
   → `data/questions.json` дотор хэрэглэгчдийн асуултууд гарна. Үүнийг уншаад
   хамгийн их асуудаг зүйлсийг тэмдэглэ (энэ нь ботын логикийг тодорхойлно).

   > Node 20.6+ хэрэгтэй (`--env-file` дэмжлэгтэй). Хуучин бол `.env`-ээ гараар export хий.
   > Өөрийн хуудас тул development mode-д app review шаардахгүй.

### 2. Webhook-ийг Vercel дээр байршуулах

1. Энэ репог GitHub-д push хийнэ.
2. [vercel.com](https://vercel.com) → Add New → Project → `victorycarchatbot` import.
3. **Environment Variables** нэмэх:
   - `PAGE_ACCESS_TOKEN` — Facebook токен
   - `VERIFY_TOKEN` — webhook нууц үг
   - `MONGODB_URI` — **CarNumber1-ийн MongoDB-тэй ижил**
   - `SITE_URL` — CarNumber1 сайтын хаяг (сонголт)
4. Deploy → webhook URL: `https://<project>.vercel.app/api/webhook`.

### 3. Webhook-ийг Facebook-д холбох

1. Meta App → Messenger → **Webhooks → Add Callback URL**:
   - Callback URL: `https://<project>.vercel.app/api/webhook`
   - Verify Token: `.env`-ийн `VERIFY_TOKEN`-той **яг ижил**.
2. **messages**, `messaging_postbacks` талбарт subscribe хийх.
3. Victory car хуудсаа сонгож subscribe.

Одоо өөрийн аккаунтаас Victory car хуудсанд бичихэд бот хариулна (test mode).

### 4. (Дараагийн алхам, сонголт) AI

Одоогийн бот түлхүүр үг + цэсээр ~90%-ийг шийднэ. Хожим хэрэглэгч
"3000-аас доош автомат жийп" гэх мэт чөлөөт өгүүлбэр бичих нь ихсвэл
`lib/handlers.js`-ийн `searchVehicles`-ийн өмнө AI-аар санаа/шүүлтүүр
гаргаж болно.

## Анхаар

- `data/` фолдер нь хэрэглэгчийн хувийн мэдээлэл агуулдаг тул `.gitignore`-т орсон — GitHub-д бүү push.
- Бодит гадны хэрэглэгчдэд ажиллуулахын тулд Facebook **app review** (`pages_messaging`) шаардана.
