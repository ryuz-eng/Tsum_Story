(() => {
  const form = document.getElementById("drawOrderForm");
  const preview = document.getElementById("orderPreview");
  const dueDate = document.getElementById("orderDueDate");
  const notifyStatus = document.getElementById("orderNotifyStatus");
  const thanksModal = document.getElementById("orderThanksModal");
  const thanksClose = document.getElementById("orderThanksClose");
  const storageKey = "tsum_story_drawing_order";
  const maxStoredPhotoBytes = 1400000;
  const maxTelegramPhotoBytes = 8000000;
  const telegramNotifyTimeoutMs = 9000;

  if (!form || !preview) {
    return;
  }

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const setStatus = (message) => {
    if (!notifyStatus) {
      return;
    }
    notifyStatus.textContent = message;
  };

  const readTelegramEndpoint = () =>
    String(document.body?.dataset.telegramEndpoint || "").trim();

  const sendTelegramNotification = async (orderPayload) => {
    const endpoint = readTelegramEndpoint();
    if (!endpoint) {
      return { status: "skipped" };
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), telegramNotifyTimeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "tsum-story-order",
          submittedAt: new Date().toISOString(),
          order: {
            style: orderPayload.style,
            delivery: orderPayload.delivery,
            dueDate: orderPayload.dueDate,
            referencePhotoName: orderPayload.referencePhotoName,
            referencePhotoDataUrl: orderPayload.referencePhotoDataUrl,
            notes: orderPayload.notes
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        return { status: "failed", code: response.status };
      }
      return { status: "sent" };
    } catch {
      return { status: "failed", code: "network" };
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const openThanks = () => {
    if (!thanksModal) {
      return;
    }
    thanksModal.classList.add("open");
    thanksModal.setAttribute("aria-hidden", "false");
  };

  const closeThanks = () => {
    if (!thanksModal) {
      return;
    }
    thanksModal.classList.remove("open");
    thanksModal.setAttribute("aria-hidden", "true");
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  const renderSavedOrder = () => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      preview.classList.add("empty");
      preview.textContent = "No drawing request saved yet.";
      return;
    }

    let saved;
    try {
      saved = JSON.parse(raw);
    } catch {
      preview.classList.add("empty");
      preview.textContent = "Saved request is invalid. Please submit again.";
      return;
    }

    preview.classList.remove("empty");
    const hasPhoto =
      typeof saved.referencePhotoDataUrl === "string" &&
      saved.referencePhotoDataUrl.startsWith("data:image/");
    const photoHtml = hasPhoto
      ? `<br>Reference Photo:<br><img class="order-photo-preview" src="${saved.referencePhotoDataUrl}" alt="${escapeHtml(saved.referencePhotoName || "Reference photo")}">`
      : `<br>Reference Photo: ${escapeHtml(saved.referencePhotoName || "-")}`;

    preview.innerHTML = `
      Style: ${escapeHtml(saved.style)}<br>
      Delivery: ${escapeHtml(saved.delivery)}<br>
      Due date: ${escapeHtml(saved.dueDate)}<br>
      ${photoHtml}<br>
      Notes: ${escapeHtml(saved.notes)}
    `;
  };

  if (dueDate) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    dueDate.min = `${year}-${month}-${day}`;
  }

  if (thanksClose) {
    thanksClose.addEventListener("click", closeThanks);
  }

  if (thanksModal) {
    thanksModal.addEventListener("click", (event) => {
      if (event.target === thanksModal) {
        closeThanks();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && thanksModal?.classList.contains("open")) {
      closeThanks();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const referencePhoto = data.get("referencePhoto");
    const file =
      referencePhoto instanceof File && referencePhoto.size > 0 ? referencePhoto : null;

    let referencePhotoDataUrl = "";
    let referencePhotoName = file ? file.name : "";
    let storageMessage = "Drawing request saved.";
    let telegramPhotoDataUrl = "";
    let telegramPhotoMissingNote = "";

    if (file && file.type.startsWith("image/")) {
      if (file.size <= maxTelegramPhotoBytes) {
        try {
          telegramPhotoDataUrl = await readFileAsDataUrl(file);
        } catch {
          telegramPhotoDataUrl = "";
          telegramPhotoMissingNote = " Photo could not be read for Telegram.";
        }
      } else {
        telegramPhotoMissingNote =
          " Photo not sent to Telegram because file is too large.";
      }

      if (file.size <= maxStoredPhotoBytes && telegramPhotoDataUrl) {
        referencePhotoDataUrl = telegramPhotoDataUrl;
      } else {
        storageMessage =
          "Drawing request saved. Photo preview not stored because file is too large.";
      }
    }

    const payload = {
      style: (data.get("style") || "").toString().trim(),
      delivery: (data.get("delivery") || "").toString().trim(),
      dueDate: (data.get("dueDate") || "").toString().trim(),
      referencePhotoName,
      referencePhotoDataUrl,
      notes: (data.get("notes") || "").toString().trim()
    };
    const notifyPayload = {
      ...payload,
      referencePhotoDataUrl: telegramPhotoDataUrl
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      payload.referencePhotoDataUrl = "";
      localStorage.setItem(storageKey, JSON.stringify(payload));
      storageMessage =
        "Drawing request saved. Photo preview not stored because browser storage is full.";
    }

    renderSavedOrder();
    form.reset();
    openThanks();

    setStatus(`${storageMessage} Sending Telegram notification...`);
    const notifyResult = await sendTelegramNotification(notifyPayload);
    if (notifyResult.status === "sent") {
      setStatus(`${storageMessage}${telegramPhotoMissingNote} Sent to Telegram.`);
    } else if (notifyResult.status === "skipped") {
      setStatus(`${storageMessage}${telegramPhotoMissingNote} Telegram is not connected yet.`);
    } else {
      setStatus(`${storageMessage}${telegramPhotoMissingNote} Telegram send failed.`);
    }
  });

  renderSavedOrder();
})();
