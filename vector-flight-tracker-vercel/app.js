const state = {
  mode: "flight",
  flights: [],
  lastParams: "mode=flight&flight=BA286",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const form = $("#search-form");
const results = $("#results");
const resultsMeta = $("#results-meta");
const refreshButton = $("#refresh-results");
const setupDialog = $("#setup-dialog");

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function timeLabel(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function statusLabel(status) {
  const map = {
    active: "In air",
    scheduled: "Scheduled",
    landed: "Landed",
    delayed: "Delayed",
    cancelled: "Cancelled",
    diverted: "Diverted",
    incident: "Incident",
  };
  return map[status] || status || "Unknown";
}

function planeIcon() {
  return '<svg aria-hidden="true" viewBox="0 0 20 20"><path d="m2 12 6-2 3-7 2 1-1 6 5 3-1.5 1.5-4.5-1-3 4-1.5-.5 1-4-4.5.5L2 12Z"/></svg>';
}

function flightCard(flight) {
  const dep = flight.departure || {};
  const arr = flight.arrival || {};
  const status = flight.status || "unknown";
  const delay = Number(dep.delay || arr.delay || 0);
  const gate = dep.gate || "TBD";
  const terminal = dep.terminal ? `T${dep.terminal}` : "Terminal TBD";
  return `
    <article class="flight-card">
      <div class="flight-identity">
        <div>
          <p class="flight-code">${escapeHTML(flight.flight_iata)}</p>
          <p class="airline">${escapeHTML(flight.airline)}</p>
        </div>
        <span class="status-badge ${escapeHTML(status)}">${escapeHTML(statusLabel(status))}</span>
      </div>
      <div class="route-line">
        <div>
          <strong class="airport-code">${escapeHTML(dep.iata || "—")}</strong>
          <span class="airport-name" title="${escapeHTML(dep.airport)}">${escapeHTML(dep.airport || "Unknown airport")}</span>
          <span class="time">${escapeHTML(timeLabel(dep.estimated || dep.scheduled))}</span>
          ${delay ? `<span class="delay-note">+${delay} min</span>` : ""}
        </div>
        <div class="route-dash">${planeIcon()}</div>
        <div>
          <strong class="airport-code">${escapeHTML(arr.iata || "—")}</strong>
          <span class="airport-name" title="${escapeHTML(arr.airport)}">${escapeHTML(arr.airport || "Unknown airport")}</span>
          <span class="time">${escapeHTML(timeLabel(arr.estimated || arr.scheduled))}</span>
        </div>
      </div>
      <div class="gate">
        <span>${escapeHTML(terminal)} / Gate</span>
        <strong>${escapeHTML(gate)}</strong>
      </div>
    </article>`;
}

function setLoading() {
  results.innerHTML = '<div class="skeleton-card"><span></span><span></span><span></span></div>';
  resultsMeta.textContent = "Updating flight board…";
  refreshButton.classList.add("spinning");
}

function renderFlights(payload) {
  state.flights = payload.flights || [];
  if (!state.flights.length) {
    results.innerHTML = '<div class="empty-state"><h3>No matching flights</h3><p>Check the flight number or airport codes and try again.</p></div>';
  } else {
    results.innerHTML = state.flights.map(flightCard).join("");
  }
  const modeLabel = payload.demo ? "Demo board" : "Live board";
  resultsMeta.textContent = `${modeLabel} · ${state.flights.length} flight${state.flights.length === 1 ? "" : "s"} · Updated ${timeLabel(payload.updated_at)}`;
  refreshButton.classList.remove("spinning");
}

function renderError(message) {
  results.innerHTML = `<div class="error-state"><h3>Flight data unavailable</h3><p>${escapeHTML(message)}</p></div>`;
  resultsMeta.textContent = "The board could not be updated";
  refreshButton.classList.remove("spinning");
}

async function searchFlights(params = state.lastParams) {
  setLoading();
  state.lastParams = params;
  try {
    const response = await fetch(`/api/flights?${params}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load flights.");
    renderFlights(payload);
  } catch (error) {
    renderError(error.message);
  }
}

function switchMode(mode) {
  state.mode = mode;
  $$(".tab").forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  $$(".search-fields").forEach((group) => group.classList.add("hidden"));
  $(`#${mode}-fields`).classList.remove("hidden");
}

$$(".tab").forEach((tab) => tab.addEventListener("click", () => switchMode(tab.dataset.mode)));

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const params = new URLSearchParams({ mode: state.mode });
  if (state.mode === "flight") params.set("flight", $("#flight-input").value.trim());
  if (state.mode === "route") {
    params.set("from", $("#from-input").value.trim());
    params.set("to", $("#to-input").value.trim());
  }
  if (state.mode === "airport") {
    params.set("airport", $("#airport-input").value.trim());
    params.set("direction", $("#direction-input").value);
  }
  searchFlights(params.toString());
});

refreshButton.addEventListener("click", () => searchFlights());

async function checkStatus() {
  const status = $("#api-status");
  const readiness = $("#setup-readiness");
  try {
    const response = await fetch("/api/status");
    const payload = await response.json();
    status.classList.toggle("live", payload.aviationstack);
    status.querySelector("span:last-child").textContent = payload.aviationstack ? "Live data" : "Demo mode";
    readiness.textContent = payload.aviationstack ? "Aviationstack is connected." : "Add the private key in Vercel, then redeploy.";
  } catch {
    status.querySelector("span:last-child").textContent = "Status unavailable";
    readiness.textContent = "Could not check the server configuration.";
  }
}

$("#open-setup").addEventListener("click", () => setupDialog.showModal());
$("#close-setup").addEventListener("click", () => setupDialog.close());
$("#check-again").addEventListener("click", checkStatus);
setupDialog.addEventListener("click", (event) => {
  if (event.target === setupDialog) setupDialog.close();
});
$("#copy-env").addEventListener("click", async (event) => {
  const text = "AVIATIONSTACK_API_KEY=your_key_here";
  await navigator.clipboard.writeText(text);
  event.currentTarget.textContent = "Copied";
  setTimeout(() => { event.currentTarget.textContent = "Copy"; }, 1600);
});

$("#today-stamp").textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "short", month: "short", day: "2-digit", year: "numeric",
}).format(new Date());

checkStatus();
searchFlights();
