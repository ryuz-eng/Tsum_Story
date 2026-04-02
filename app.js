(() => {
  const form = document.getElementById("reviewForm");
  const preview = document.getElementById("planPreview");
  const meetingDate = document.getElementById("meetingDate");
  const improveField = document.getElementById("improveField");
  const improveModal = document.getElementById("improveModal");
  const improveTextarea = document.getElementById("improveTextarea");
  const improveSaveButton = document.getElementById("improveSave");
  const improveCancelButton = document.getElementById("improveCancel");
  const notifyStatus = document.getElementById("notifyStatus");
  const storageKey = "tsum_story_review";

  const escapeHtml = (value) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const rand = (min, max) => Math.random() * (max - min) + min;
  const isLowRatingValue = (value) =>
    value.startsWith("1/5") || value.startsWith("2/5");
  const telegramNotifyTimeoutMs = 9000;

  let showImproveModal = null;

  const tsumBackgroundAssets = [
    { src: "assets/minnie.png", h: 102, label: "Minnie" },
    { src: "assets/tigger.png", h: 96, label: "Tigger" },
    { src: "assets/pattern/stitch.png", h: 98, label: "Stitch" },
    { src: "assets/pattern/pooh.png", h: 94, label: "Pooh" },
    { src: "assets/pattern/eeyore.png", h: 96, label: "Eeyore" },
    { src: "assets/pattern/piglet.png", h: 96, label: "Piglet" }
  ];

  const buildBand = (element, isTop) => {
    const width = window.innerWidth;
    const mobileScale = width < 900 ? 0.74 : 1;
    const order = isTop
      ? [0, 3, 1, 4, 2, 5, 1, 0, 4, 2, 5, 3]
      : [2, 5, 0, 4, 1, 3, 2, 4, 0, 5, 1, 3];

    let html = "";
    let x = -14;
    let index = 0;

    while (x < width + 140) {
      const character = tsumBackgroundAssets[order[index % order.length]];
      const scale = rand(0.75, 1.08) * mobileScale;
      const height = Math.round(character.h * scale);
      const rotation = rand(-10, 10).toFixed(2);
      const duration = rand(3.2, 6.2).toFixed(2);
      const delay = rand(0, 4).toFixed(2);
      const dy = isTop ? `-${rand(4, 8).toFixed(1)}px` : `${rand(4, 8).toFixed(1)}px`;
      const overlap = Math.round(rand(-14, 9));
      const opacity = rand(0.78, 0.98).toFixed(2);
      const alignSelf = isTop ? "flex-start" : "flex-end";

      html += `<span class="tsum-item" style="height:${height}px;margin-left:${overlap}px;--r:${rotation}deg;--dy:${dy};animation-duration:${duration}s;animation-delay:-${delay}s;align-self:${alignSelf};opacity:${opacity};"><img src="${character.src}" style="height:${height}px" alt="${character.label}"></span>`;

      x += height * 0.8;
      index += 1;
    }

    element.innerHTML = html;
  };

  const buildSparks = (element) => {
    const icons = ["&#10026;", "&#10024;", "&#9825;", "&#10047;", "&#9733;", "&#10084;"];
    const colors = ["#f2b7c3", "#cfd8ee", "#f2d7a0", "#c5e0c2", "#ead2ef", "#f3cbbb"];
    const count = Math.floor((window.innerWidth * window.innerHeight) / 22000);

    let html = "";
    for (let i = 0; i < count; i += 1) {
      const icon = icons[Math.floor(rand(0, icons.length))];
      const color = colors[Math.floor(rand(0, colors.length))];
      const x = rand(2, 98).toFixed(2);
      const y = rand(12, 88).toFixed(2);
      const size = rand(10, 19).toFixed(2);
      const duration = rand(1.8, 4.2).toFixed(2);
      const delay = rand(0, 5).toFixed(2);
      const opacity = rand(0.45, 0.85).toFixed(2);

      html += `<span class="spark" style="left:${x}%;top:${y}%;color:${color};font-size:${size}px;animation-duration:${duration}s;animation-delay:-${delay}s;opacity:${opacity};">${icon}</span>`;
    }

    element.innerHTML = html;
  };

  const initTsumBackground = () => {
    const bandTop = document.getElementById("bandTop");
    const bandBottom = document.getElementById("bandBottom");
    const sparks = document.getElementById("tsumSparks");
    if (!bandTop || !bandBottom || !sparks) {
      return;
    }

    const render = () => {
      buildBand(bandTop, true);
      buildBand(bandBottom, false);
      buildSparks(sparks);
    };

    render();
    window.addEventListener("resize", render);
  };

  const initBlurPhrases = () => {
    const blurPhrases = document.querySelectorAll(".blur-phrase");
    if (!blurPhrases.length) {
      return;
    }

    blurPhrases.forEach((phraseButton) => {
      phraseButton.addEventListener("click", () => {
        const revealed = !phraseButton.classList.contains("revealed");
        phraseButton.classList.toggle("revealed", revealed);
        phraseButton.setAttribute("aria-expanded", String(revealed));
      });
    });
  };

  const initReasonsStack = () => {
    const trigger = document.getElementById("seeReasonsBtn");
    const reasonsSection = document.getElementById("reasons");
    if (!trigger || !reasonsSection) {
      return;
    }

    const reasonCards = Array.from(reasonsSection.querySelectorAll(".reason-card"));
    if (!reasonCards.length) {
      return;
    }

    const setCollapsed = (collapsed) => {
      reasonsSection.classList.toggle("collapsed", collapsed);
      trigger.textContent = collapsed ? "See My Reasons" : "Hide My Reasons";
      trigger.setAttribute("aria-expanded", String(!collapsed));
      if (collapsed) {
        reasonCards.forEach((card) => card.classList.remove("stack-in"));
      }
    };

    const playStackAnimation = () => {
      reasonCards.forEach((card, index) => {
        card.classList.remove("stack-in");
        card.style.setProperty("--stack-delay", `${index * 130}ms`);
      });

      window.requestAnimationFrame(() => {
        reasonCards.forEach((card) => card.classList.add("stack-in"));
      });
    };

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      const shouldExpand = reasonsSection.classList.contains("collapsed");
      setCollapsed(!shouldExpand);
      reasonsSection.scrollIntoView({ behavior: "smooth", block: "start" });
      if (shouldExpand) {
        window.setTimeout(playStackAnimation, 220);
      }
    });

    setCollapsed(reasonsSection.classList.contains("collapsed"));
  };

  const initCardSounds = () => {
    const soundButtons = document.querySelectorAll(".sound-btn");
    if (!soundButtons.length) {
      return;
    }

    let currentAudio = null;

    const stopCurrentAudio = () => {
      if (!currentAudio) {
        return;
      }
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    };

    const clearPlayingState = () => {
      soundButtons.forEach((button) => button.classList.remove("playing"));
    };

    soundButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const src = button.getAttribute("data-sound");
        if (!src) {
          return;
        }

        const speed = Number.parseFloat(button.getAttribute("data-speed") || "1");
        const playbackRate = Number.isFinite(speed) ? speed : 1;

        stopCurrentAudio();
        clearPlayingState();

        const audio = new Audio(src);
        audio.playbackRate = playbackRate;
        currentAudio = audio;
        button.classList.add("playing");

        audio.addEventListener("ended", () => {
          button.classList.remove("playing");
          if (currentAudio === audio) {
            currentAudio = null;
          }
        });

        audio.addEventListener("error", () => {
          button.classList.remove("playing");
          if (currentAudio === audio) {
            currentAudio = null;
          }
        });

        audio.play().catch(() => {
          button.classList.remove("playing");
          if (currentAudio === audio) {
            currentAudio = null;
          }
        });
      });
    });
  };

  if (meetingDate) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    meetingDate.min = `${year}-${month}-${day}`;
  }

  const renderSavedPlan = () => {
    if (!preview) {
      return;
    }

    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      preview.classList.add("empty");
      preview.textContent = "No review saved yet.";
      return;
    }

    let saved;
    try {
      saved = JSON.parse(raw);
    } catch {
      preview.classList.add("empty");
      preview.textContent = "Saved data is invalid. Please submit again.";
      return;
    }
    preview.classList.remove("empty");
    const improveNote = (saved.improve || "").toString().trim();
    preview.innerHTML = `
      Rating: ${escapeHtml(saved.rating)}<br>
      Favorite part: ${escapeHtml(saved.favorite)}<br>
      Next meeting: ${escapeHtml(saved.date)} at ${escapeHtml(saved.time)}<br>
      Vibe: ${escapeHtml(saved.vibe)}<br>
      Location: ${escapeHtml(saved.location)}
      ${improveNote ? `<br>What to improve: ${escapeHtml(improveNote)}` : ""}
    `;
  };

  const readTelegramEndpoint = () => {
    const endpoint = (document.body?.dataset.telegramEndpoint || "").trim();
    return endpoint;
  };

  const setNotifyStatus = (message, state = "idle") => {
    if (!notifyStatus) {
      return;
    }
    notifyStatus.textContent = message;
    notifyStatus.dataset.state = state;
  };

  const sendTelegramNotification = async (payload) => {
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
          source: "tsum-story-web",
          submittedAt: new Date().toISOString(),
          review: payload
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

  const initLowRatingFeedback = () => {
    if (
      !form ||
      !improveField ||
      !improveModal ||
      !improveTextarea ||
      !improveSaveButton ||
      !improveCancelButton
    ) {
      return;
    }

    const openModal = (initialText = "") => {
      improveTextarea.value = initialText;
      improveModal.classList.add("open");
      improveModal.setAttribute("aria-hidden", "false");
      window.setTimeout(() => improveTextarea.focus(), 0);
    };

    const closeModal = () => {
      improveModal.classList.remove("open");
      improveModal.setAttribute("aria-hidden", "true");
    };

    showImproveModal = openModal;

    improveSaveButton.addEventListener("click", () => {
      improveField.value = improveTextarea.value.trim();
      closeModal();
    });

    improveCancelButton.addEventListener("click", () => {
      closeModal();
    });

    improveModal.addEventListener("click", (event) => {
      if (event.target === improveModal) {
        closeModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && improveModal.classList.contains("open")) {
        closeModal();
      }
    });

    const ratingInputs = form.querySelectorAll('input[name="rating"]');
    ratingInputs.forEach((input) => {
      input.addEventListener("change", () => {
        const ratingValue = input.value || "";
        if (!isLowRatingValue(ratingValue)) {
          improveField.value = "";
          closeModal();
          return;
        }
        openModal(improveField.value.trim());
      });
    });
  };

  const initRatingTheme = () => {
    const ratingRoot = document.getElementById("totoroRating");
    if (!ratingRoot) {
      return;
    }

    const ratingInputs = Array.from(
      ratingRoot.querySelectorAll('input[name="rating"][data-score]')
    );
    const selectedText = document.getElementById("ratingSelected");

    const render = (score) => {
      const safeScore = Math.max(0, Math.min(5, score));

      ratingInputs.forEach((input) => {
        const inputScore = Number.parseInt(input.getAttribute("data-score") || "0", 10);
        const icon = input.nextElementSibling;
        if (!icon) {
          return;
        }
        const isOn = Number.isFinite(inputScore) && inputScore <= safeScore;
        icon.classList.toggle("on", isOn);
        icon.classList.toggle("off", !isOn);
      });

      if (selectedText) {
        if (!safeScore) {
          selectedText.textContent = "Tap a Totoro to choose your vibe.";
          return;
        }

        const selectedInput = ratingInputs.find((input) => {
          const inputScore = Number.parseInt(input.getAttribute("data-score") || "0", 10);
          return Number.isFinite(inputScore) && inputScore === safeScore;
        });

        selectedText.textContent = selectedInput
          ? selectedInput.value
          : `${safeScore}/5`;
      }
    };

    const renderFromSelection = () => {
      const checked = ratingInputs.find((input) => input.checked);
      if (!checked) {
        render(0);
        return;
      }
      const checkedScore = Number.parseInt(checked.getAttribute("data-score") || "0", 10);
      render(Number.isFinite(checkedScore) ? checkedScore : 0);
    };

    ratingInputs.forEach((input) => {
      input.addEventListener("change", renderFromSelection);
    });

    if (form) {
      form.addEventListener("reset", () => {
        window.setTimeout(() => render(0), 0);
      });
    }

    renderFromSelection();
  };
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const data = new FormData(form);
      const selectedRating = (data.get("rating") || "").toString().trim();
      if (
        isLowRatingValue(selectedRating) &&
        improveField &&
        !improveField.value.trim()
      ) {
        if (showImproveModal) {
          showImproveModal("");
        }
        return;
      }

      const payload = {
        rating: selectedRating,
        favorite: (data.get("favorite") || "").toString().trim(),
        date: (data.get("date") || "").toString().trim(),
        time: (data.get("time") || "").toString().trim(),
        vibe: (data.get("vibe") || "").toString().trim(),
        location: (data.get("location") || "").toString().trim(),
        improve: (data.get("improve") || "").toString().trim()
      };

      localStorage.setItem(storageKey, JSON.stringify(payload));
      renderSavedPlan();
      form.reset();

      setNotifyStatus("Saved locally. Sending Telegram notification...", "idle");
      const notifyResult = await sendTelegramNotification(payload);
      if (notifyResult.status === "sent") {
        setNotifyStatus("Saved and sent to Telegram.", "ok");
      } else if (notifyResult.status === "skipped") {
        setNotifyStatus("Saved locally. Telegram is not connected yet.", "warn");
      } else {
        setNotifyStatus(
          "Saved locally. Telegram send failed (you can reconnect endpoint).",
          "warn"
        );
      }
    });
  }

  renderSavedPlan();
  initTsumBackground();
  initBlurPhrases();
  initReasonsStack();
  initCardSounds();
  initRatingTheme();
  initLowRatingFeedback();
})();

