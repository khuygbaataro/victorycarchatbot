// Facebook Send API туслахууд — текст, quick reply, зургийн carousel илгээх.
const GRAPH_URL = 'https://graph.facebook.com/v21.0';
const TOKEN = process.env.PAGE_ACCESS_TOKEN;

async function callSend(payload) {
  const res = await fetch(`${GRAPH_URL}/me/messages?access_token=${TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error('FB send error:', res.status, await res.text());
  }
}

// Энгийн текст (+ доор нь quick reply товчнууд)
export function sendText(to, text, quickReplies) {
  const message = { text };
  if (quickReplies?.length) message.quick_replies = quickReplies;
  return callSend({ recipient: { id: to }, messaging_type: 'RESPONSE', message });
}

// Зурагтай машинуудын carousel (Generic Template, дээд тал нь 10 картан)
export function sendCarousel(to, elements) {
  return callSend({
    recipient: { id: to },
    messaging_type: 'RESPONSE',
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          image_aspect_ratio: 'square',
          elements: elements.slice(0, 10),
        },
      },
    },
  });
}

// Үүсгэсэн зургийг (PNG buffer) шууд илгээх (multipart upload)
export async function sendImage(to, buffer, filename = 'image.png') {
  try {
    const form = new FormData();
    form.append('recipient', JSON.stringify({ id: to }));
    form.append(
      'message',
      JSON.stringify({ attachment: { type: 'image', payload: { is_reusable: false } } })
    );
    form.append('filedata', new Blob([buffer], { type: 'image/png' }), filename);
    const res = await fetch(`${GRAPH_URL}/me/messages?access_token=${TOKEN}`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      console.error('sendImage алдаа:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('sendImage exception:', err.message);
    return false;
  }
}

// "Бичиж байна…" индикатор (сонголт)
export function sendTyping(to) {
  return callSend({ recipient: { id: to }, sender_action: 'typing_on' });
}

// Хэрэглэгчийн Facebook нэрийг авах (цаг захиалгад)
export async function getUserProfile(psid) {
  try {
    const res = await fetch(
      `${GRAPH_URL}/${psid}?fields=first_name,last_name&access_token=${TOKEN}`
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
