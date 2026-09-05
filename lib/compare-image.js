// 2 машиныг зэрэгцүүлж харьцуулсан зураг үүсгэнэ (зураг + он + гүйлт + үнэ).
// Хамгийн боломжийн (бага гүйлттэй) машиныг "Онцлох" гэж тодотгоно.
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
try {
  GlobalFonts.registerFromPath(path.join(__dirname, '../assets/NotoSans-Regular.ttf'), 'NotoSans');
  GlobalFonts.registerFromPath(path.join(__dirname, '../assets/NotoSans-Bold.ttf'), 'NotoSansB');
} catch (e) {
  console.error('Фонт ачаалахад алдаа:', e.message);
}

const W = 1000;
const H = 660;

function fmtPrice(n) {
  const v = Number(n);
  return v ? `${Math.round(v).toLocaleString('en-US')}₮` : '—';
}
function fmtKm(n) {
  const v = Number(n);
  return v ? `${Math.round(v).toLocaleString('en-US')} км` : '—';
}

async function loadRemote(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return await loadImage(buf);
  } catch {
    return null;
  }
}

// Зургийг хайрцагт багтаж (crop-fill) зурна
function drawCover(ctx, img, x, y, w, h) {
  const ir = img.width / img.height;
  const r = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (ir > r) {
    sw = img.height * r;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / r;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function roundRect(ctx, x, y, w, h, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// vehicles: яг 2 машины docs. Буцаана: PNG Buffer.
export async function buildCompareImage(vehicles, title = 'Харьцуулалт') {
  const cars = vehicles.slice(0, 2);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Дэвсгэр
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, H);

  // Толгой
  ctx.fillStyle = '#ffffff';
  ctx.font = '28px NotoSansB';
  ctx.textBaseline = 'top';
  ctx.fillText('VICTORY CAR', 30, 26);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '22px NotoSans';
  ctx.fillText(title, 30, 62);

  // Онцлох (бага гүйлттэй) машиныг тодорхойлно
  const recIdx =
    cars.length === 2
      ? (Number(cars[0].mileage) || Infinity) <= (Number(cars[1].mileage) || Infinity)
        ? 0
        : 1
      : -1;

  const imgs = await Promise.all(cars.map((c) => loadRemote(c.images?.[0])));

  const panelY = 110;
  const panelW = 460;
  const panelH = 510;
  const photoH = 300;
  const gap = 20;
  const startX = 30;

  cars.forEach((c, i) => {
    const x = startX + i * (panelW + gap);
    const isRec = i === recIdx;

    // Панел
    ctx.fillStyle = '#1e293b';
    roundRect(ctx, x, panelY, panelW, panelH, 16);
    ctx.fill();
    if (isRec) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 4;
      roundRect(ctx, x, panelY, panelW, panelH, 16);
      ctx.stroke();
    }

    // Зураг
    ctx.save();
    roundRect(ctx, x + 12, panelY + 12, panelW - 24, photoH, 10);
    ctx.clip();
    if (imgs[i]) {
      drawCover(ctx, imgs[i], x + 12, panelY + 12, panelW - 24, photoH);
    } else {
      ctx.fillStyle = '#334155';
      ctx.fillRect(x + 12, panelY + 12, panelW - 24, photoH);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '20px NotoSans';
      ctx.fillText('Зураг байхгүй', x + 30, panelY + 150);
    }
    ctx.restore();

    // Онцлох тэмдэг
    if (isRec) {
      ctx.fillStyle = '#22c55e';
      roundRect(ctx, x + 12, panelY + 12, 150, 34, 8);
      ctx.fill();
      ctx.fillStyle = '#052e16';
      ctx.font = '18px NotoSansB';
      ctx.fillText('Онцлох сонголт', x + 24, panelY + 19);
    }

    // Нэр
    let ty = panelY + photoH + 28;
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px NotoSansB';
    ctx.fillText(`${c.brand || ''} ${c.model || ''}`.trim().slice(0, 26), x + 16, ty);

    // Мэдээлэл мөрүүд
    ty += 42;
    const rows = [
      ['Он', String(c.year || '—')],
      ['Гүйлт', fmtKm(c.mileage)],
      ['Үнэ', fmtPrice(c.price)],
    ];
    rows.forEach(([label, val]) => {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '20px NotoSans';
      ctx.fillText(label, x + 16, ty);
      ctx.fillStyle = '#ffffff';
      ctx.font = '22px NotoSansB';
      ctx.fillText(val, x + 130, ty);
      ty += 40;
    });
  });

  return canvas.encode('png');
}
