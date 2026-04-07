const json = (status, payload, corsHeaders = {}) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders
    }
  });

const cleanText = (value, max = 220) => {
  const text = String(value ?? "").trim();
  if (!text) {
    return "-";
  }
  return text.slice(0, max);
};

const locationStore = new Map();
const maxStoredLocationKeys = 120;

const buildCorsHeaders = (origin, allowOrigin) => ({
  "Access-Control-Allow-Origin": allowOrigin,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin"
});

const resolveOrigin = (request, env) => {
  const requestOrigin = request.headers.get("Origin") || "";
  const configured = String(env.ALLOWED_ORIGIN || "").trim();
  if (!configured) {
    return { allowed: true, allowOrigin: "*" };
  }
  if (requestOrigin === configured) {
    return { allowed: true, allowOrigin: configured };
  }
  return { allowed: false, allowOrigin: configured };
};

const formatReviewMessage = (data) => {
  const review = data?.review || {};
  const source = cleanText(data?.source, 80);
  const submittedAt = cleanText(data?.submittedAt, 80);
  const rating = cleanText(review.rating, 80);
  const favorite = cleanText(review.favorite, 500);
  const date = cleanText(review.date, 80);
  const time = cleanText(review.time, 80);
  const vibe = cleanText(review.vibe, 120);
  const location = cleanText(review.location, 220);
  const improve = cleanText(review.improve, 500);

  return [
    "New Tsum Review",
    `Source: ${source}`,
    `Time: ${submittedAt}`,
    "",
    `Rating: ${rating}`,
    `Favorite: ${favorite}`,
    `Next Date: ${date}`,
    `Next Time: ${time}`,
    `Vibe: ${vibe}`,
    `Location: ${location}`,
    `Improve: ${improve}`
  ].join("\n");
};

const formatOrderMessage = (data) => {
  const order = data?.order || {};
  const source = cleanText(data?.source, 80);
  const submittedAt = cleanText(data?.submittedAt, 80);
  const style = cleanText(order.style, 120);
  const delivery = cleanText(order.delivery, 80);
  const dueDate = cleanText(order.dueDate, 80);
  const referencePhotoName = cleanText(order.referencePhotoName, 220);
  const notes = cleanText(order.notes, 500);

  return [
    "New Drawing Order",
    `Source: ${source}`,
    `Time: ${submittedAt}`,
    "",
    `Style: ${style}`,
    `Delivery: ${delivery}`,
    `Due Date: ${dueDate}`,
    `Reference Photo: ${referencePhotoName}`,
    `Notes: ${notes}`
  ].join("\n");
};

const formatMessage = (data) => {
  if (data?.order) {
    return formatOrderMessage(data);
  }
  return formatReviewMessage(data);
};

const parseFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const pruneLocationStore = () => {
  if (locationStore.size <= maxStoredLocationKeys) {
    return;
  }
  const firstKey = locationStore.keys().next().value;
  if (firstKey !== undefined) {
    locationStore.delete(firstKey);
  }
};

const handleLocationUpdate = async (request, corsHeaders) => {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" }, corsHeaders);
  }

  let payload = null;
  try {
    payload = await request.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" }, corsHeaders);
  }

  const key = String(payload?.key || "").trim().slice(0, 80);
  if (key.length < 4) {
    return json(400, { ok: false, error: "Missing or invalid key" }, corsHeaders);
  }

  const lat = parseFiniteNumber(payload?.lat);
  const lng = parseFiniteNumber(payload?.lng);
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return json(400, { ok: false, error: "Invalid coordinates" }, corsHeaders);
  }

  const timestampRaw = String(payload?.timestamp || "").trim();
  const timestamp =
    timestampRaw && !Number.isNaN(new Date(timestampRaw).getTime())
      ? new Date(timestampRaw).toISOString()
      : new Date().toISOString();

  const record = {
    key,
    lat,
    lng,
    accuracy: parseFiniteNumber(payload?.accuracy),
    speed: parseFiniteNumber(payload?.speed),
    heading: parseFiniteNumber(payload?.heading),
    timestamp,
    source: cleanText(payload?.source, 120)
  };

  locationStore.delete(key);
  locationStore.set(key, record);
  pruneLocationStore();

  return json(200, { ok: true }, corsHeaders);
};

const handleLocationLatest = (url, request, corsHeaders) => {
  if (request.method !== "GET") {
    return json(405, { ok: false, error: "Method not allowed" }, corsHeaders);
  }

  const key = String(url.searchParams.get("key") || "").trim().slice(0, 80);
  if (key.length < 4) {
    return json(400, { ok: false, error: "Missing or invalid key" }, corsHeaders);
  }

  const location = locationStore.get(key);
  if (!location) {
    return json(404, { ok: false, error: "No location for this key yet" }, corsHeaders);
  }

  return json(200, { ok: true, location }, corsHeaders);
};

const postTelegramText = async (botToken, chatId, text) =>
  fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });

const parseImageDataUrl = (dataUrl) => {
  const text = String(dataUrl || "").trim();
  const match = text.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  const mimeType = match[1];
  const base64 = match[2];
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { mimeType, bytes };
  } catch {
    return null;
  }
};

const postTelegramPhoto = async (botToken, chatId, fileName, dataUrl) => {
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed) {
    return null;
  }

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append(
    "photo",
    new Blob([parsed.bytes], { type: parsed.mimeType }),
    cleanText(fileName, 80) || "reference.jpg"
  );
  form.append("caption", "Reference photo attached.");

  return fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: "POST",
    body: form
  });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { allowed, allowOrigin } = resolveOrigin(request, env);
    const corsHeaders = buildCorsHeaders(
      request.headers.get("Origin") || "",
      allowOrigin
    );

    if (request.method === "OPTIONS") {
      if (!allowed) {
        return json(403, { ok: false, error: "Origin not allowed" }, corsHeaders);
      }
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (!allowed) {
      return json(403, { ok: false, error: "Origin not allowed" }, corsHeaders);
    }

    if (url.pathname === "/location/update") {
      return handleLocationUpdate(request, corsHeaders);
    }

    if (url.pathname === "/location/latest") {
      return handleLocationLatest(url, request, corsHeaders);
    }

    if (url.pathname !== "/notify") {
      return json(404, { ok: false, error: "Not found" }, corsHeaders);
    }

    if (request.method !== "POST") {
      return json(405, { ok: false, error: "Method not allowed" }, corsHeaders);
    }

    const botToken = String(env.TELEGRAM_BOT_TOKEN || "").trim();
    const chatId = String(env.TELEGRAM_CHAT_ID || "").trim();
    if (!botToken || !chatId) {
      return json(500, { ok: false, error: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID" }, corsHeaders);
    }

    let payload = null;
    try {
      payload = await request.json();
    } catch {
      return json(400, { ok: false, error: "Invalid JSON body" }, corsHeaders);
    }

    const text = formatMessage(payload);
    if (payload?.order?.referencePhotoDataUrl) {
      const photoResponse = await postTelegramPhoto(
        botToken,
        chatId,
        payload?.order?.referencePhotoName || "reference.jpg",
        payload?.order?.referencePhotoDataUrl
      );
      if (photoResponse && !photoResponse.ok) {
        const photoDetails = await photoResponse.text();
        return json(
          502,
          { ok: false, error: "Telegram photo upload error", details: photoDetails.slice(0, 300) },
          corsHeaders
        );
      }
    }

    const telegramResponse = await postTelegramText(botToken, chatId, text);

    if (!telegramResponse.ok) {
      const details = await telegramResponse.text();
      return json(
        502,
        { ok: false, error: "Telegram API error", details: details.slice(0, 300) },
        corsHeaders
      );
    }

    return json(200, { ok: true }, corsHeaders);
  }
};
