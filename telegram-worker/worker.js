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

const buildCorsHeaders = (origin, allowOrigin) => ({
  "Access-Control-Allow-Origin": allowOrigin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

    if (url.pathname !== "/notify") {
      return json(404, { ok: false, error: "Not found" }, corsHeaders);
    }

    if (!allowed) {
      return json(403, { ok: false, error: "Origin not allowed" }, corsHeaders);
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
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true
        })
      }
    );

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
