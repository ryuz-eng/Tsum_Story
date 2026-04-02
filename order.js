(() => {
  const form = document.getElementById("drawOrderForm");
  const preview = document.getElementById("orderPreview");
  const dueDate = document.getElementById("orderDueDate");
  const notifyStatus = document.getElementById("orderNotifyStatus");
  const thanksModal = document.getElementById("orderThanksModal");
  const thanksClose = document.getElementById("orderThanksClose");
  const storageKey = "tsum_story_drawing_order";

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
    preview.innerHTML = `
      Character: ${escapeHtml(saved.character)}<br>
      Style: ${escapeHtml(saved.style)}<br>
      Pose: ${escapeHtml(saved.pose)}<br>
      Format: ${escapeHtml(saved.format)}<br>
      Due date: ${escapeHtml(saved.dueDate)}<br>
      Reference: ${escapeHtml(saved.reference || "-")}<br>
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

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const payload = {
      character: (data.get("character") || "").toString().trim(),
      style: (data.get("style") || "").toString().trim(),
      pose: (data.get("pose") || "").toString().trim(),
      format: (data.get("format") || "").toString().trim(),
      dueDate: (data.get("dueDate") || "").toString().trim(),
      reference: (data.get("reference") || "").toString().trim(),
      notes: (data.get("notes") || "").toString().trim()
    };

    localStorage.setItem(storageKey, JSON.stringify(payload));
    renderSavedOrder();
    form.reset();
    setStatus("Drawing request saved.");
    openThanks();
  });

  renderSavedOrder();
})();
