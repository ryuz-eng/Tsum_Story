(() => {
  const shareForm = document.getElementById("shareLocationForm");
  const trackForm = document.getElementById("trackLocationForm");
  const shareKeyInput = document.getElementById("shareKey");
  const trackKeyInput = document.getElementById("trackKey");
  const startShareBtn = document.getElementById("startShareBtn");
  const stopShareBtn = document.getElementById("stopShareBtn");
  const startTrackBtn = document.getElementById("startTrackBtn");
  const stopTrackBtn = document.getElementById("stopTrackBtn");
  const refreshTrackBtn = document.getElementById("refreshTrackBtn");
  const shareStatus = document.getElementById("shareStatus");
  const trackStatus = document.getElementById("trackStatus");
  const sharePreview = document.getElementById("sharePreview");
  const trackDetails = document.getElementById("trackDetails");
  const mapContainer = document.getElementById("locationMap");

  if (
    !shareForm ||
    !trackForm ||
    !shareKeyInput ||
    !trackKeyInput ||
    !startShareBtn ||
    !stopShareBtn ||
    !startTrackBtn ||
    !stopTrackBtn ||
    !refreshTrackBtn ||
    !sharePreview ||
    !trackDetails ||
    !mapContainer
  ) {
    return;
  }

  const storageKey = "tsum_story_live_location_key";
  const sharePushIntervalMs = 6000;
  const trackPollIntervalMs = 7000;
  const requestTimeoutMs = 10000;

  const endpointBase = String(document.body?.dataset.locationEndpoint || "")
    .trim()
    .replace(/\/+$/, "");
  const updateEndpoint = endpointBase ? `${endpointBase}/update` : "";
  const latestEndpoint = endpointBase ? `${endpointBase}/latest` : "";

  let shareWatchId = null;
  let trackTimerId = null;
  let lastPushAt = 0;
  let sendingShareUpdate = false;
  let map = null;
  let marker = null;
  let accuracyCircle = null;

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const toFixed = (value, digits) => {
    if (!Number.isFinite(value)) {
      return "-";
    }
    return value.toFixed(digits);
  };

  const formatDateTime = (iso) => {
    if (!iso) {
      return "-";
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }
    return date.toLocaleString();
  };

  const buildMapLink = (lat, lng) =>
    `https://maps.google.com/?q=${encodeURIComponent(`${lat},${lng}`)}`;

  const setShareStatus = (message, state = "idle") => {
    if (!shareStatus) {
      return;
    }
    shareStatus.textContent = message;
    shareStatus.dataset.state = state;
  };

  const setTrackStatus = (message, state = "idle") => {
    if (!trackStatus) {
      return;
    }
    trackStatus.textContent = message;
    trackStatus.dataset.state = state;
  };

  const readKey = (input) => String(input.value || "").trim();

  const writeSavedKey = (value) => {
    if (!value) {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(storageKey, value);
  };

  const loadSavedKey = () => String(localStorage.getItem(storageKey) || "").trim();

  const initMap = () => {
    if (!window.L) {
      mapContainer.textContent = "Map failed to load. Tracking details still work below.";
      return;
    }

    map = window.L.map(mapContainer, {
      zoomControl: true
    }).setView([1.3521, 103.8198], 12);

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);
  };

  const updateMap = (lat, lng, accuracy) => {
    if (!map || !window.L) {
      return;
    }

    const point = [lat, lng];
    if (!marker) {
      marker = window.L.marker(point).addTo(map);
    } else {
      marker.setLatLng(point);
    }

    const safeRadius = Number.isFinite(accuracy) ? Math.max(10, accuracy) : 20;
    if (!accuracyCircle) {
      accuracyCircle = window.L.circle(point, {
        radius: safeRadius,
        color: "#ff9f45",
        fillColor: "#ffcf9f",
        fillOpacity: 0.3,
        weight: 1
      }).addTo(map);
    } else {
      accuracyCircle.setLatLng(point);
      accuracyCircle.setRadius(safeRadius);
    }

    map.setView(point, 16);
  };

  const renderSharePreview = (record) => {
    const lat = Number(record.lat);
    const lng = Number(record.lng);
    const accuracy = Number(record.accuracy);
    const speed = Number(record.speed);

    sharePreview.classList.remove("empty");
    sharePreview.innerHTML = `
      Lat: ${escapeHtml(toFixed(lat, 6))}<br>
      Lng: ${escapeHtml(toFixed(lng, 6))}<br>
      Accuracy: ${escapeHtml(toFixed(accuracy, 1))} m<br>
      Speed: ${escapeHtml(toFixed(speed, 1))} m/s<br>
      Last Sent: ${escapeHtml(formatDateTime(record.timestamp))}
    `;
  };

  const renderTrackDetails = (record) => {
    const lat = Number(record.lat);
    const lng = Number(record.lng);
    const accuracy = Number(record.accuracy);
    const speed = Number(record.speed);
    const heading = Number(record.heading);
    const link = buildMapLink(lat, lng);

    trackDetails.classList.remove("empty");
    trackDetails.innerHTML = `
      Lat: ${escapeHtml(toFixed(lat, 6))}<br>
      Lng: ${escapeHtml(toFixed(lng, 6))}<br>
      Accuracy: ${escapeHtml(toFixed(accuracy, 1))} m<br>
      Speed: ${escapeHtml(toFixed(speed, 1))} m/s<br>
      Heading: ${escapeHtml(toFixed(heading, 0))}&deg;<br>
      Last Updated: ${escapeHtml(formatDateTime(record.timestamp))}<br>
      <a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Open in Maps</a>
    `;

    updateMap(lat, lng, accuracy);
  };

  const requestJson = async (url, options = {}) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      return response;
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const pushLocation = async (record) => {
    if (!updateEndpoint) {
      return { ok: false, message: "Location endpoint is not configured." };
    }

    try {
      const response = await requestJson(updateEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record)
      });
      if (!response.ok) {
        return { ok: false, message: `Share failed (${response.status}).` };
      }
      return { ok: true };
    } catch {
      return { ok: false, message: "Share failed. Check network and endpoint." };
    }
  };

  const fetchLatestLocation = async (key) => {
    if (!latestEndpoint) {
      return { ok: false, message: "Location endpoint is not configured." };
    }

    const url = `${latestEndpoint}?key=${encodeURIComponent(key)}`;
    try {
      const response = await requestJson(url, { method: "GET" });
      if (response.status === 404) {
        return { ok: false, message: "No location shared yet for this key." };
      }
      if (!response.ok) {
        return { ok: false, message: `Tracking failed (${response.status}).` };
      }
      const payload = await response.json();
      return { ok: true, location: payload.location };
    } catch {
      return { ok: false, message: "Tracking failed. Check network and endpoint." };
    }
  };

  const geolocationErrorMessage = (error) => {
    if (!error) {
      return "Could not read location.";
    }
    if (error.code === 1) {
      return "Location permission denied.";
    }
    if (error.code === 2) {
      return "Location unavailable right now.";
    }
    if (error.code === 3) {
      return "Location request timed out.";
    }
    return "Could not read location.";
  };

  const sendCurrentPosition = async (position, forceSend = false) => {
    const key = readKey(shareKeyInput);
    if (!key) {
      setShareStatus("Enter your Secret Key first.", "warn");
      return;
    }

    const now = Date.now();
    if (!forceSend && now - lastPushAt < sharePushIntervalMs) {
      return;
    }
    if (sendingShareUpdate) {
      return;
    }

    const coords = position.coords || {};
    const record = {
      key,
      lat: Number(coords.latitude),
      lng: Number(coords.longitude),
      accuracy: Number(coords.accuracy),
      speed: Number(coords.speed),
      heading: Number(coords.heading),
      timestamp: new Date().toISOString(),
      source: "tsum-story-location-share"
    };

    lastPushAt = now;
    sendingShareUpdate = true;
    setShareStatus("Sharing location...", "idle");
    const result = await pushLocation(record);
    sendingShareUpdate = false;

    if (!result.ok) {
      setShareStatus(result.message, "warn");
      return;
    }

    renderSharePreview(record);
    setShareStatus("Live location shared.", "ok");
  };

  const stopSharing = () => {
    if (shareWatchId !== null) {
      navigator.geolocation.clearWatch(shareWatchId);
      shareWatchId = null;
    }
    startShareBtn.disabled = false;
    stopShareBtn.disabled = true;
    setShareStatus("Sharing stopped.", "warn");
  };

  const startSharing = () => {
    if (!navigator.geolocation) {
      setShareStatus("This browser does not support geolocation.", "warn");
      return;
    }

    const key = readKey(shareKeyInput);
    if (!key) {
      setShareStatus("Enter your Secret Key first.", "warn");
      shareKeyInput.focus();
      return;
    }

    writeSavedKey(key);
    trackKeyInput.value = key;
    lastPushAt = 0;
    setShareStatus("Starting GPS...", "idle");
    startShareBtn.disabled = true;
    stopShareBtn.disabled = false;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void sendCurrentPosition(position, true);
      },
      (error) => {
        setShareStatus(geolocationErrorMessage(error), "warn");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
    );

    shareWatchId = navigator.geolocation.watchPosition(
      (position) => {
        void sendCurrentPosition(position);
      },
      (error) => {
        setShareStatus(geolocationErrorMessage(error), "warn");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  };

  const setTrackingState = (isTracking) => {
    startTrackBtn.disabled = isTracking;
    stopTrackBtn.disabled = !isTracking;
  };

  const pollLatest = async (isManual = false) => {
    const key = readKey(trackKeyInput);
    if (!key) {
      setTrackStatus("Enter the Secret Key to track.", "warn");
      return;
    }

    if (isManual) {
      setTrackStatus("Refreshing location...", "idle");
    }

    const result = await fetchLatestLocation(key);
    if (!result.ok) {
      setTrackStatus(result.message, "warn");
      if (result.message.startsWith("No location")) {
        trackDetails.classList.add("empty");
        trackDetails.textContent = "No live location yet.";
      }
      return;
    }

    renderTrackDetails(result.location);
    setTrackStatus("Tracking active.", "ok");
  };

  const startTracking = () => {
    const key = readKey(trackKeyInput);
    if (!key) {
      setTrackStatus("Enter the Secret Key to track.", "warn");
      trackKeyInput.focus();
      return;
    }

    writeSavedKey(key);
    if (trackTimerId !== null) {
      window.clearInterval(trackTimerId);
    }

    setTrackingState(true);
    setTrackStatus("Starting tracker...", "idle");
    void pollLatest(true);
    trackTimerId = window.setInterval(() => {
      void pollLatest(false);
    }, trackPollIntervalMs);
  };

  const stopTracking = () => {
    if (trackTimerId !== null) {
      window.clearInterval(trackTimerId);
      trackTimerId = null;
    }
    setTrackingState(false);
    setTrackStatus("Tracking stopped.", "warn");
  };

  shareForm.addEventListener("submit", (event) => {
    event.preventDefault();
    startSharing();
  });

  stopShareBtn.addEventListener("click", () => {
    stopSharing();
  });

  trackForm.addEventListener("submit", (event) => {
    event.preventDefault();
    startTracking();
  });

  stopTrackBtn.addEventListener("click", () => {
    stopTracking();
  });

  refreshTrackBtn.addEventListener("click", () => {
    void pollLatest(true);
  });

  shareKeyInput.addEventListener("change", () => {
    const key = readKey(shareKeyInput);
    writeSavedKey(key);
    if (key && !readKey(trackKeyInput)) {
      trackKeyInput.value = key;
    }
  });

  trackKeyInput.addEventListener("change", () => {
    const key = readKey(trackKeyInput);
    writeSavedKey(key);
  });

  const savedKey = loadSavedKey();
  if (savedKey) {
    shareKeyInput.value = savedKey;
    trackKeyInput.value = savedKey;
  }

  initMap();
})();
