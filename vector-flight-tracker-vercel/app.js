const state = {
  mode: "flight",
  flights: [],
  lastParams: "mode=flight&flight=BA286",
  selectedFlightCode: null,
  positionRequestId: 0,
  routeRequestId: 0,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const form = $("#search-form");
const results = $("#results");
const resultsMeta = $("#results-meta");
const refreshButton = $("#refresh-results");
const setupDialog = $("#setup-dialog");
const flightDialog = $("#flight-dialog");

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

function dateTimeLabel(value) {
  if (!value) return "Not reported";
  const timestamp = /^\d{10}$/.test(String(value)) ? Number(value) * 1000 : value;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Not reported";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
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

function isPosition(position) {
  return Number.isFinite(position?.latitude) && Number.isFinite(position?.longitude);
}

function positionForFlight(flight) {
  if (isPosition(flight.live)) return { position: flight.live, source: "Aviationstack" };
  if (isPosition(flight.adsb_live)) return { position: flight.adsb_live, source: "ADSB.lol" };
  return { position: null, source: null };
}

function hasLivePosition(flight) {
  return Boolean(positionForFlight(flight).position);
}

function canLocateAircraft(flight) {
  return Boolean(flight.aircraft?.icao24 || flight.aircraft?.registration || flight.flight_icao || (flight.airline_icao && flight.flight_number));
}

function flightCard(flight, index) {
  const dep = flight.departure || {};
  const arr = flight.arrival || {};
  const status = flight.status || "unknown";
  const delay = Number(dep.delay || arr.delay || 0);
  const gate = dep.gate || "TBD";
  const terminal = dep.terminal ? `T${dep.terminal}` : "Terminal TBD";
  return `
    <article class="flight-card ${hasLivePosition(flight) ? "has-live-position" : ""}" role="button" tabindex="0" data-flight-index="${index}" aria-label="Open ${escapeHTML(flight.flight_iata)} flight position">
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
        <span class="card-action">${hasLivePosition(flight) ? "Track live" : canLocateAircraft(flight) ? "Locate aircraft" : "View details"} <b aria-hidden="true">↗</b></span>
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

const WORLD_LINES = [
  [[-168, 66], [-150, 70], [-136, 59], [-124, 50], [-124, 42], [-117, 33], [-106, 23], [-97, 19], [-86, 21], [-81, 26], [-80, 32], [-75, 39], [-67, 45], [-59, 52], [-63, 60], [-79, 63], [-95, 72], [-120, 72], [-145, 70], [-168, 66]],
  [[-81, 12], [-74, 11], [-66, 9], [-60, 6], [-52, -1], [-47, -16], [-53, -34], [-61, -48], [-70, -55], [-75, -42], [-80, -20], [-81, 12]],
  [[-10, 36], [-6, 44], [2, 51], [13, 55], [24, 59], [32, 66], [42, 69], [56, 67], [68, 72], [91, 76], [122, 71], [145, 59], [161, 58], [178, 52], [165, 43], [145, 45], [132, 39], [121, 31], [111, 20], [105, 9], [98, 6], [91, 21], [79, 8], [69, 23], [58, 25], [50, 39], [39, 42], [29, 40], [20, 45], [8, 44], [-1, 39], [-10, 36]],
  [[-17, 35], [-5, 36], [10, 32], [25, 31], [34, 27], [43, 12], [51, 11], [44, -12], [35, -25], [27, -34], [17, -35], [9, -29], [1, -6], [-8, 5], [-16, 16], [-17, 35]],
  [[113, -22], [115, -34], [130, -38], [146, -39], [153, -28], [149, -17], [137, -12], [124, -14], [113, -22]],
  [[-53, 60], [-45, 59], [-28, 68], [-20, 78], [-37, 83], [-58, 80], [-70, 71], [-53, 60]],
  [[47, -13], [50, -16], [49, -25], [44, -25], [43, -18], [47, -13]],
  [[-180, -66], [-120, -70], [-60, -68], [0, -72], [60, -68], [120, -71], [180, -66]],
];

class FlightGlobe {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.centerLongitude = 0;
    this.centerLatitude = 18;
    this.zoom = 1;
    this.position = null;
    this.route = null;
    this.dragging = false;
    this.lastPointer = null;
    this.animationFrame = null;
    this.motionAllowed = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.draw());
    this.resizeObserver.observe(canvas);
  }

  bindEvents() {
    this.canvas.addEventListener("pointerdown", (event) => {
      this.dragging = true;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.canvas.setPointerCapture(event.pointerId);
      this.canvas.classList.add("is-dragging");
    });
    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.dragging) return;
      const dx = event.clientX - this.lastPointer.x;
      const dy = event.clientY - this.lastPointer.y;
      this.centerLongitude = this.wrapLongitude(this.centerLongitude - dx * 0.42 / this.zoom);
      this.centerLatitude = Math.max(-82, Math.min(82, this.centerLatitude + dy * 0.32 / this.zoom));
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.draw();
    });
    const endDrag = () => {
      this.dragging = false;
      this.lastPointer = null;
      this.canvas.classList.remove("is-dragging");
    };
    this.canvas.addEventListener("pointerup", endDrag);
    this.canvas.addEventListener("pointercancel", endDrag);
    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      this.zoom = Math.max(0.78, Math.min(1.34, this.zoom - event.deltaY * 0.001));
      this.draw();
    }, { passive: false });
    this.canvas.addEventListener("dblclick", () => this.centerOnPosition());
    this.canvas.addEventListener("keydown", (event) => {
      const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-"];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      if (event.key === "ArrowLeft") this.centerLongitude = this.wrapLongitude(this.centerLongitude - 8);
      if (event.key === "ArrowRight") this.centerLongitude = this.wrapLongitude(this.centerLongitude + 8);
      if (event.key === "ArrowUp") this.centerLatitude = Math.min(82, this.centerLatitude + 6);
      if (event.key === "ArrowDown") this.centerLatitude = Math.max(-82, this.centerLatitude - 6);
      if (event.key === "+" || event.key === "=") this.zoom = Math.min(1.34, this.zoom + 0.08);
      if (event.key === "-") this.zoom = Math.max(0.78, this.zoom - 0.08);
      this.draw();
    });
  }

  wrapLongitude(value) {
    return ((value + 540) % 360) - 180;
  }

  setFlight(position, route) {
    this.position = position && Number.isFinite(position.latitude) && Number.isFinite(position.longitude) ? position : null;
    this.route = route?.departure && route?.arrival ? route : null;
    this.zoom = 1;
    this.centerOnPosition();
  }

  setRoute(route) {
    this.route = route?.departure && route?.arrival ? route : null;
    if (!this.position) this.centerOnPosition();
    else this.draw();
  }

  greatCirclePoints(start, end, steps = 120) {
    const toVector = (point) => {
      const latitude = point.latitude * Math.PI / 180;
      const longitude = point.longitude * Math.PI / 180;
      return [Math.cos(latitude) * Math.cos(longitude), Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude)];
    };
    const a = toVector(start);
    const b = toVector(end);
    const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    const omega = Math.acos(dot);
    const sinOmega = Math.sin(omega);
    if (sinOmega < 0.000001) return [[start.longitude, start.latitude], [end.longitude, end.latitude]];
    return Array.from({ length: steps + 1 }, (_, index) => {
      const t = index / steps;
      const first = Math.sin((1 - t) * omega) / sinOmega;
      const second = Math.sin(t * omega) / sinOmega;
      const x = first * a[0] + second * b[0];
      const y = first * a[1] + second * b[1];
      const z = first * a[2] + second * b[2];
      return [Math.atan2(y, x) * 180 / Math.PI, Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI];
    });
  }

  centerOnPosition() {
    if (this.position) {
      this.centerLongitude = this.position.longitude;
      this.centerLatitude = Math.max(-65, Math.min(65, this.position.latitude));
    } else if (this.route) {
      const midpoint = this.greatCirclePoints(this.route.departure, this.route.arrival, 2)[1];
      this.centerLongitude = midpoint[0];
      this.centerLatitude = Math.max(-65, Math.min(65, midpoint[1]));
    } else {
      this.centerLongitude = 0;
      this.centerLatitude = 18;
    }
    this.draw();
  }

  project(latitude, longitude, radius, centerX, centerY) {
    const phi = latitude * Math.PI / 180;
    const lambda = (longitude - this.centerLongitude) * Math.PI / 180;
    const phi0 = this.centerLatitude * Math.PI / 180;
    const x = Math.cos(phi) * Math.sin(lambda);
    const y = Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lambda);
    const z = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lambda);
    return { x: centerX + radius * x, y: centerY - radius * y, visible: z >= -0.012, depth: z };
  }

  strokeGeoLine(points, radius, centerX, centerY, color, width) {
    const ctx = this.ctx;
    ctx.beginPath();
    let drawing = false;
    points.forEach(([longitude, latitude]) => {
      const point = this.project(latitude, longitude, radius, centerX, centerY);
      if (!point.visible) {
        drawing = false;
        return;
      }
      if (!drawing) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
      drawing = true;
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  drawRoute(radius, centerX, centerY) {
    if (!this.route) return;
    const points = this.greatCirclePoints(this.route.departure, this.route.arrival);
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = "rgba(255, 214, 107, .7)";
    ctx.shadowBlur = 8;
    ctx.setLineDash([7, 7]);
    this.strokeGeoLine(points, radius, centerX, centerY, "rgba(255, 220, 116, .98)", 2.6);
    ctx.restore();

    [this.route.departure, this.route.arrival].forEach((airport) => {
      const marker = this.project(airport.latitude, airport.longitude, radius, centerX, centerY);
      if (!marker.visible) return;
      ctx.save();
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#fff3b0";
      ctx.fill();
      ctx.strokeStyle = "#2c735d";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = "600 11px 'DM Mono', monospace";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0, 0, 0, .9)";
      ctx.shadowBlur = 5;
      ctx.fillText(airport.iata, marker.x + 9, marker.y);
      ctx.restore();
    });
  }

  draw(timestamp = 0) {
    const rect = this.canvas.getBoundingClientRect();
    const size = Math.max(280, Math.min(rect.width || 560, 720));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelSize = Math.round(size * dpr);
    if (this.canvas.width !== pixelSize || this.canvas.height !== pixelSize) {
      this.canvas.width = pixelSize;
      this.canvas.height = pixelSize;
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.405 * this.zoom;

    ctx.save();
    ctx.shadowColor = "rgba(28, 79, 72, .34)";
    ctx.shadowBlur = size * 0.055;
    ctx.shadowOffsetY = size * 0.025;
    const ocean = ctx.createRadialGradient(centerX - radius * .35, centerY - radius * .4, radius * .08, centerX, centerY, radius * 1.08);
    ocean.addColorStop(0, "#a9ebda");
    ocean.addColorStop(.52, "#65c4bb");
    ocean.addColorStop(1, "#2d7f7d");
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = ocean;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - .5, 0, Math.PI * 2);
    ctx.clip();

    for (let latitude = -60; latitude <= 60; latitude += 30) {
      const points = [];
      for (let longitude = -180; longitude <= 180; longitude += 3) points.push([longitude, latitude]);
      this.strokeGeoLine(points, radius, centerX, centerY, "rgba(255, 255, 235, .22)", 1);
    }
    for (let longitude = -180; longitude < 180; longitude += 30) {
      const points = [];
      for (let latitude = -88; latitude <= 88; latitude += 3) points.push([longitude, latitude]);
      this.strokeGeoLine(points, radius, centerX, centerY, "rgba(255, 255, 235, .19)", 1);
    }
    WORLD_LINES.forEach((line) => this.strokeGeoLine(line, radius, centerX, centerY, "rgba(255, 248, 204, .88)", 1.55));

    const shade = ctx.createLinearGradient(centerX - radius, centerY, centerX + radius, centerY);
    shade.addColorStop(0, "rgba(24, 78, 72, .22)");
    shade.addColorStop(.42, "rgba(0, 0, 0, 0)");
    shade.addColorStop(1, "rgba(24, 78, 72, .12)");
    ctx.fillStyle = shade;
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 248, 220, .8)";
    ctx.lineWidth = 2;
    ctx.stroke();

    this.drawRoute(radius, centerX, centerY);

    if (this.position) {
      const marker = this.project(this.position.latitude, this.position.longitude, radius, centerX, centerY);
      if (marker.visible) {
        const pulse = this.motionAllowed ? 8 + (Math.sin(timestamp / 430) + 1) * 5 : 11;
        ctx.beginPath();
        ctx.arc(marker.x, marker.y, pulse, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(243, 148, 114, .22)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(marker.x, marker.y, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = "#f39472";
        ctx.fill();
        ctx.strokeStyle = "#fff8dc";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(marker.x, marker.y - 13);
        ctx.lineTo(marker.x - 4, marker.y - 5);
        ctx.lineTo(marker.x + 4, marker.y - 5);
        ctx.closePath();
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
    }
  }

  start() {
    this.stop();
    if (!this.motionAllowed) {
      this.draw();
      return;
    }
    const tick = (timestamp) => {
      this.draw(timestamp);
      this.animationFrame = requestAnimationFrame(tick);
    };
    this.animationFrame = requestAnimationFrame(tick);
  }

  stop() {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }
}

const globe = new FlightGlobe($("#globe-canvas"));

function coordinateLabel(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "Not reported";
  const lat = `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? "E" : "W"}`;
  return `${lat}, ${lon}`;
}

function altitudeLabel(position) {
  if (position.is_ground) return "On ground";
  if (Number.isFinite(position.altitude_feet)) return `${Math.round(position.altitude_feet).toLocaleString()} ft`;
  if (Number.isFinite(position.altitude)) return `${Math.round(position.altitude * 3.28084).toLocaleString()} ft`;
  return "Not reported";
}

function speedLabel(position) {
  if (Number.isFinite(position.speed_knots)) return `${Math.round(position.speed_knots).toLocaleString()} kt`;
  if (Number.isFinite(position.speed_horizontal)) return `${Math.round(position.speed_horizontal).toLocaleString()} km/h`;
  return "Not reported";
}

function headingLabel(value) {
  if (!Number.isFinite(value)) return "Not reported";
  const compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return `${Math.round(value)}° ${compass[Math.round(value / 45) % 8]}`;
}

function setPositionSource(source) {
  const element = $("#position-source");
  if (source === "ADSB.lol") {
    element.innerHTML = 'Live aircraft data from <a href="https://www.adsb.lol/" target="_blank" rel="noreferrer">ADSB.lol</a> · ODbL 1.0.';
  } else {
    element.textContent = "Position data is supplied by Aviationstack and may not be available for every flight.";
  }
}

function updateRouteStatus(flight) {
  const from = flight.departure?.iata;
  const to = flight.arrival?.iata;
  const status = $("#route-status");
  if (flight.route) status.textContent = `${from} → ${to} flight path · Drag to rotate · Scroll to zoom`;
  else if (flight.routeLoading) status.textContent = `Loading ${from} → ${to} flight path…`;
  else if (flight.routeError) status.textContent = "Flight path unavailable · Drag to rotate · Scroll to zoom";
  else status.textContent = "Drag to rotate · Scroll to zoom";
}

function renderFlightDetails(flight, options = {}) {
  const located = positionForFlight(flight);
  const live = located.position || {};
  const positioned = Boolean(located.position);
  const loading = Boolean(options.loading);
  $("#flight-detail-title").textContent = `${flight.flight_iata} · ${positioned ? "Live position" : "Flight details"}`;
  $("#flight-detail-airline").textContent = flight.airline || "Unknown airline";
  $("#detail-departure").textContent = flight.departure?.iata || "—";
  $("#detail-arrival").textContent = flight.arrival?.iata || "—";
  $("#detail-coordinates").textContent = coordinateLabel(live.latitude, live.longitude);
  $("#detail-altitude").textContent = altitudeLabel(live);
  $("#detail-speed").textContent = speedLabel(live);
  $("#detail-heading").textContent = headingLabel(live.direction);
  $("#detail-aircraft").textContent = live.registration || flight.aircraft?.registration || flight.aircraft?.icao || "Not reported";
  $("#detail-status").textContent = statusLabel(flight.status);
  $("#position-updated").textContent = loading
    ? "Requesting current position"
    : positioned ? `Updated ${dateTimeLabel(live.updated)}` : "No current coordinate report";
  $("#position-message").textContent = loading
    ? "Checking ADS-B receivers for this aircraft…"
    : positioned
      ? `The marker shows ${located.source}’s latest reported position for ${flight.flight_iata}.`
      : options.message || "No live coordinate report is available. The aircraft may be on the ground, outside receiver coverage, or missing a usable identifier.";
  $("#globe-live-badge").textContent = loading ? "LOCATING" : positioned ? (located.source === "ADSB.lol" ? "ADS-B POSITION" : "LIVE POSITION") : "POSITION UNAVAILABLE";
  $("#globe-live-badge").classList.toggle("unavailable", !positioned && !loading);
  $("#center-aircraft").disabled = !positioned && !flight.route;
  $("#center-aircraft").textContent = positioned ? "Center aircraft" : "Center route";
  setPositionSource(located.source);
  updateRouteStatus(flight);
  globe.setFlight(positioned ? live : null, flight.route || null);
}

async function locateWithAdsb(flight) {
  const requestId = ++state.positionRequestId;
  const params = new URLSearchParams();
  if (flight.aircraft?.icao24) params.set("icao24", flight.aircraft.icao24);
  if (flight.aircraft?.registration) params.set("registration", flight.aircraft.registration);
  const callsign = flight.flight_icao || (flight.airline_icao && flight.flight_number ? `${flight.airline_icao}${flight.flight_number}` : null);
  if (callsign) params.set("callsign", callsign);
  if (![...params].length) return;

  renderFlightDetails(flight, { loading: true });
  try {
    const response = await fetch(`/api/position?${params}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not check the aircraft position.");
    if (requestId !== state.positionRequestId || state.selectedFlightCode !== flight.flight_iata) return;
    if (payload.available && isPosition(payload.position)) {
      flight.adsb_live = payload.position;
      renderFlightDetails(flight);
    } else {
      renderFlightDetails(flight, { message: payload.message });
    }
  } catch (error) {
    if (requestId !== state.positionRequestId || state.selectedFlightCode !== flight.flight_iata) return;
    renderFlightDetails(flight, { message: error.message });
  }
}

async function loadFlightRoute(flight) {
  const from = flight.departure?.iata;
  const to = flight.arrival?.iata;
  if (!from || !to || flight.route) return;
  const requestId = ++state.routeRequestId;
  flight.routeLoading = true;
  flight.routeError = false;
  updateRouteStatus(flight);
  try {
    const params = new URLSearchParams({ from, to });
    const response = await fetch(`/api/route?${params}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load the flight path.");
    if (requestId !== state.routeRequestId || state.selectedFlightCode !== flight.flight_iata) return;
    flight.route = payload.route;
    flight.routeLoading = false;
    updateRouteStatus(flight);
    globe.setRoute(flight.route);
    if (!hasLivePosition(flight)) {
      $("#center-aircraft").disabled = false;
      $("#center-aircraft").textContent = "Center route";
    }
  } catch {
    if (requestId !== state.routeRequestId || state.selectedFlightCode !== flight.flight_iata) return;
    flight.routeLoading = false;
    flight.routeError = true;
    updateRouteStatus(flight);
  }
}

function openFlightDetails(index) {
  const flight = state.flights[index];
  if (!flight) return;
  state.selectedFlightCode = flight.flight_iata;
  state.positionRequestId += 1;
  renderFlightDetails(flight);
  if (!flightDialog.open) flightDialog.showModal();
  requestAnimationFrame(() => globe.start());
  loadFlightRoute(flight);
  if (!hasLivePosition(flight) && canLocateAircraft(flight)) locateWithAdsb(flight);
}

async function searchFlights(params = state.lastParams) {
  setLoading();
  state.lastParams = params;
  try {
    const response = await fetch(`/api/flights?${params}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load flights.");
    renderFlights(payload);
    return payload;
  } catch (error) {
    renderError(error.message);
    return null;
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

results.addEventListener("click", (event) => {
  const card = event.target.closest(".flight-card");
  if (card) openFlightDetails(Number(card.dataset.flightIndex));
});

results.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".flight-card");
  if (!card) return;
  event.preventDefault();
  openFlightDetails(Number(card.dataset.flightIndex));
});

$("#close-flight").addEventListener("click", () => flightDialog.close());
$("#center-aircraft").addEventListener("click", () => globe.centerOnPosition());
$("#refresh-position").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = "Updating…";
  const flightCode = state.selectedFlightCode;
  const payload = await searchFlights();
  if (payload) {
    const index = state.flights.findIndex((flight) => flight.flight_iata === flightCode);
    if (index >= 0) openFlightDetails(index);
  }
  button.disabled = false;
  button.textContent = "Refresh position";
});

flightDialog.addEventListener("close", () => {
  state.positionRequestId += 1;
  state.routeRequestId += 1;
  globe.stop();
});
flightDialog.addEventListener("click", (event) => {
  if (event.target === flightDialog) flightDialog.close();
});

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
