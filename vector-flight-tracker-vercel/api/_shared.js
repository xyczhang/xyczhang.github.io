const API_URL = "https://api.aviationstack.com/v1/flights";
const ADSB_URL = "https://api.adsb.lol/v2";
const AIRPORT_DATA_URL = "https://airport-data.com/api/ap_info.json";

const knownAirports = {
  SFO: { iata: "SFO", name: "San Francisco International", latitude: 37.618806, longitude: -122.375417 },
  LHR: { iata: "LHR", name: "London Heathrow", latitude: 51.4706, longitude: -0.461941 },
  EWR: { iata: "EWR", name: "Newark Liberty International", latitude: 40.6925, longitude: -74.168667 },
  LAX: { iata: "LAX", name: "Los Angeles International", latitude: 33.942536, longitude: -118.408075 },
  JFK: { iata: "JFK", name: "John F. Kennedy International", latitude: 40.639751, longitude: -73.778926 },
  SEA: { iata: "SEA", name: "Seattle-Tacoma International", latitude: 47.449, longitude: -122.309306 },
};

const demoFlights = [
  {
    flight_iata: "BA286", flight_icao: "BAW286", flight_number: "286", airline: "British Airways", airline_icao: "BAW", status: "active",
    departure: { airport: "San Francisco International", iata: "SFO", terminal: "I", gate: "A6", scheduled: "2026-09-18T18:30:00-07:00", estimated: "2026-09-18T18:42:00-07:00", delay: 12 },
    arrival: { airport: "London Heathrow", iata: "LHR", terminal: "5", gate: null, scheduled: "2026-09-19T13:05:00+01:00", estimated: "2026-09-19T13:17:00+01:00", delay: 12 },
    live: { updated: "2026-09-19T04:26:00Z", latitude: 56.18, longitude: -38.72, altitude: 11277, direction: 72, speed_horizontal: 861, speed_vertical: 0, is_ground: false },
    aircraft: { registration: "G-ZBKH", iata: "789", icao: "B789", icao24: "406D8E" },
  },
  {
    flight_iata: "UA1847", flight_icao: "UAL1847", flight_number: "1847", airline: "United Airlines", airline_icao: "UAL", status: "scheduled",
    departure: { airport: "Newark Liberty International", iata: "EWR", terminal: "C", gate: "C82", scheduled: "2026-09-18T16:15:00-04:00", estimated: "2026-09-18T16:15:00-04:00", delay: 0 },
    arrival: { airport: "Los Angeles International", iata: "LAX", terminal: "7", gate: "72A", scheduled: "2026-09-18T19:06:00-07:00", estimated: "2026-09-18T19:06:00-07:00", delay: 0 },
    aircraft: { registration: "N38459", iata: "739", icao: "B739", icao24: "A47F69" },
  },
  {
    flight_iata: "DL418", airline: "Delta Air Lines", status: "landed",
    departure: { airport: "John F. Kennedy International", iata: "JFK", terminal: "4", gate: "B31", scheduled: "2026-09-18T11:05:00-04:00", estimated: "2026-09-18T11:08:00-04:00", delay: 3 },
    arrival: { airport: "Seattle-Tacoma International", iata: "SEA", terminal: null, gate: "A5", scheduled: "2026-09-18T14:14:00-07:00", estimated: "2026-09-18T14:02:00-07:00", delay: 0 },
  },
  {
    flight_iata: "AA100", airline: "American Airlines", status: "delayed",
    departure: { airport: "John F. Kennedy International", iata: "JFK", terminal: "8", gate: "14", scheduled: "2026-09-18T18:10:00-04:00", estimated: "2026-09-18T19:05:00-04:00", delay: 55 },
    arrival: { airport: "London Heathrow", iata: "LHR", terminal: "3", gate: null, scheduled: "2026-09-19T06:20:00+01:00", estimated: "2026-09-19T07:15:00+01:00", delay: 55 },
  },
];

export function json(data, status = 200, cache = false) {
  const cacheSeconds = cache === true ? 15 : Number(cache) || 0;
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": cacheSeconds ? `public, max-age=${cacheSeconds}` : "no-store",
    "x-content-type-options": "nosniff",
  };
  if (cacheSeconds) headers["cdn-cache-control"] = `public, max-age=${Math.max(30, cacheSeconds)}`;
  return new Response(JSON.stringify(data), { status, headers });
}

function cleanIata(value, label) {
  const result = (value || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(result)) throw new Error(`${label} must be a 3-letter IATA airport code.`);
  return result;
}

function cleanFlight(value) {
  const result = (value || "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9]{2,3}\d{1,5}[A-Z]?$/.test(result)) throw new Error("Flight number should look like BA286 or UA1847.");
  return result;
}

function buildProviderParams(url) {
  const mode = url.searchParams.get("mode") || "flight";
  const params = new URLSearchParams({ limit: "25" });
  if (mode === "flight") {
    params.set("flight_iata", cleanFlight(url.searchParams.get("flight") || "BA286"));
  } else if (mode === "route") {
    params.set("dep_iata", cleanIata(url.searchParams.get("from"), "Origin"));
    params.set("arr_iata", cleanIata(url.searchParams.get("to"), "Destination"));
  } else if (mode === "airport") {
    const airport = cleanIata(url.searchParams.get("airport"), "Airport");
    const direction = url.searchParams.get("direction") || "departures";
    if (!new Set(["departures", "arrivals", "in-air"]).has(direction)) throw new Error("Board must be departures, arrivals, or in air.");
    params.set(direction === "arrivals" ? "arr_iata" : "dep_iata", airport);
    if (direction === "in-air") params.set("flight_status", "active");
  } else {
    throw new Error("Unknown search mode.");
  }
  return params;
}

function normalizeFlight(item) {
  const normalizeAirport = (name) => {
    const value = item[name] || {};
    return {
      airport: value.airport, iata: value.iata, terminal: value.terminal, gate: value.gate,
      scheduled: value.scheduled, estimated: value.estimated || value.actual, actual: value.actual, delay: value.delay || 0,
    };
  };
  return {
    flight_iata: item.flight?.iata || item.flight?.icao || "—",
    flight_icao: item.flight?.icao || null,
    flight_number: item.flight?.number || null,
    airline: item.airline?.name || item.airline?.iata || "Unknown airline",
    airline_icao: item.airline?.icao || null,
    status: (item.flight_status || "unknown").toLowerCase(),
    departure: normalizeAirport("departure"),
    arrival: normalizeAirport("arrival"),
    live: item.live ? {
      updated: item.live.updated,
      latitude: numberOrNull(item.live.latitude),
      longitude: numberOrNull(item.live.longitude),
      altitude: numberOrNull(item.live.altitude),
      direction: numberOrNull(item.live.direction),
      speed_horizontal: numberOrNull(item.live.speed_horizontal),
      speed_vertical: numberOrNull(item.live.speed_vertical),
      is_ground: Boolean(item.live.is_ground),
    } : null,
    aircraft: item.aircraft ? {
      registration: item.aircraft.registration || null,
      iata: item.aircraft.iata || null,
      icao: item.aircraft.icao || null,
      icao24: item.aircraft.icao24 || null,
    } : null,
  };
}

function cleanHex(value) {
  const result = (value || "").trim().toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(result)) throw new Error("ICAO24 must be a 6-character hexadecimal code.");
  return result;
}

function cleanCallsign(value) {
  const result = (value || "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9]{3,10}$/.test(result)) throw new Error("Callsign must contain 3–10 letters or numbers.");
  return result;
}

function cleanRegistration(value) {
  const result = (value || "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9-]{3,12}$/.test(result)) throw new Error("Registration must contain 3–12 letters, numbers, or hyphens.");
  return result;
}

function normalizeAdsbPosition(aircraft, payload, requestedHex) {
  const latitude = numberOrNull(aircraft.lat);
  const longitude = numberOrNull(aircraft.lon);
  if (latitude === null || longitude === null) return null;
  const altitudeFeet = aircraft.alt_baro === "ground"
    ? 0
    : numberOrNull(aircraft.alt_baro) ?? numberOrNull(aircraft.alt_geom);
  const providerTime = numberOrNull(payload.now);
  const updated = providerTime === null
    ? new Date().toISOString()
    : new Date(providerTime > 10_000_000_000 ? providerTime : providerTime * 1000).toISOString();
  return {
    latitude,
    longitude,
    altitude_feet: altitudeFeet,
    speed_knots: numberOrNull(aircraft.gs),
    direction: numberOrNull(aircraft.track),
    vertical_rate_fpm: numberOrNull(aircraft.baro_rate) ?? numberOrNull(aircraft.geom_rate),
    is_ground: aircraft.alt_baro === "ground",
    updated,
    age_seconds: numberOrNull(aircraft.seen_pos) ?? numberOrNull(aircraft.seen),
    callsign: String(aircraft.flight || "").trim() || null,
    registration: aircraft.r || null,
    icao24: String(aircraft.hex || requestedHex || "").toUpperCase() || null,
    source: "ADSB.lol",
  };
}

export async function handlePosition(request) {
  const url = new URL(request.url);
  const lookups = [];
  try {
    if (url.searchParams.get("icao24")) {
      const value = cleanHex(url.searchParams.get("icao24"));
      lookups.push({ type: "ICAO24", path: `hex/${value}`, value });
    }
    if (url.searchParams.get("registration")) {
      const value = cleanRegistration(url.searchParams.get("registration"));
      lookups.push({ type: "registration", path: `registration/${value}`, value });
    }
    if (url.searchParams.get("callsign")) {
      const value = cleanCallsign(url.searchParams.get("callsign"));
      lookups.push({ type: "callsign", path: `callsign/${value}`, value });
    }
    if (!lookups.length) throw new Error("Provide an ICAO24 code, aircraft registration, or ICAO callsign.");
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  let successfulRequests = 0;
  for (const lookup of lookups) {
    let upstream;
    try {
      upstream = await fetch(`${ADSB_URL}/${lookup.path}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": `VectorFlightTracker/1.0 (+${url.origin})`,
        },
      });
    } catch {
      continue;
    }
    if (!upstream.ok) continue;
    successfulRequests += 1;
    const payload = await upstream.json().catch(() => ({}));
    const reports = Array.isArray(payload.ac) ? payload.ac : [];
    const exact = reports.find((item) => {
      if (lookup.type === "ICAO24") return String(item.hex || "").toUpperCase() === lookup.value;
      if (lookup.type === "registration") return String(item.r || "").toUpperCase() === lookup.value;
      return String(item.flight || "").trim().toUpperCase() === lookup.value;
    });
    const candidates = exact ? [exact, ...reports.filter((item) => item !== exact)] : reports;
    const position = candidates.map((item) => normalizeAdsbPosition(item, payload, lookup.type === "ICAO24" ? lookup.value : null)).find(Boolean);
    if (position) return json({ available: true, position, matched_by: lookup.type }, 200, true);
  }
  if (!successfulRequests) return json({ error: "Could not reach ADSB.lol. Try again in a moment." }, 502);
  const tried = lookups.map((lookup) => lookup.type).join(", ");
  return json({
    available: false,
    source: "ADSB.lol",
    tried: lookups.map((lookup) => lookup.type),
    message: `No current ADS-B coordinate report was found. Checked ${tried}.`,
  }, 200, true);
}

async function getAirport(iata, origin) {
  if (knownAirports[iata]) return knownAirports[iata];
  let upstream;
  try {
    upstream = await fetch(`${AIRPORT_DATA_URL}?iata=${iata}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": `VectorFlightTracker/1.0 (+${origin})`,
      },
    });
  } catch {
    return null;
  }
  if (!upstream.ok) return null;
  const payload = await upstream.json().catch(() => ({}));
  const latitude = numberOrNull(payload.latitude);
  const longitude = numberOrNull(payload.longitude);
  if (latitude === null || longitude === null) return null;
  return {
    iata,
    name: payload.name || iata,
    latitude,
    longitude,
  };
}

export async function handleRoute(request) {
  const url = new URL(request.url);
  let from;
  let to;
  try {
    from = cleanIata(url.searchParams.get("from"), "Departure airport");
    to = cleanIata(url.searchParams.get("to"), "Arrival airport");
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  const [departure, arrival] = await Promise.all([
    getAirport(from, url.origin),
    getAirport(to, url.origin),
  ]);
  if (!departure || !arrival) {
    return json({ error: "Airport coordinates are unavailable for this route." }, 502);
  }
  return json({ route: { departure, arrival } }, 200, 86400);
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function demoResults(params) {
  let flights = demoFlights;
  const flight = params.get("flight_iata");
  if (flight) {
    const matches = flights.filter((item) => item.flight_iata === flight);
    return matches.length ? matches : flights.slice(0, 1);
  }
  if (params.get("dep_iata")) flights = flights.filter((item) => item.departure.iata === params.get("dep_iata"));
  if (params.get("arr_iata")) flights = flights.filter((item) => item.arrival.iata === params.get("arr_iata"));
  if (params.get("flight_status")) flights = flights.filter((item) => item.status === params.get("flight_status"));
  return flights.length ? flights : params.get("flight_status") ? [] : demoFlights.slice(0, 3);
}

export async function handleFlights(request) {
  const url = new URL(request.url);
  let params;
  try {
    params = buildProviderParams(url);
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  const apiKey = process.env.AVIATIONSTACK_API_KEY;
  if (!apiKey) {
    return json({
      flights: demoResults(params), demo: true,
      message: "Showing sample data. Add AVIATIONSTACK_API_KEY as a private Vercel secret for live results.",
      updated_at: new Date().toISOString(),
    });
  }

  params.set("access_key", apiKey);
  let upstream;
  try {
    upstream = await fetch(`${API_URL}?${params}`, { headers: { Accept: "application/json" } });
  } catch {
    return json({ error: "Could not reach Aviationstack. Try again in a moment." }, 502);
  }
  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok || payload.error) {
    const detail = payload.error?.message || payload.error?.info || "Aviationstack rejected the request.";
    return json({ error: detail }, 502);
  }
  return json({
    flights: (payload.data || []).map(normalizeFlight),
    pagination: payload.pagination || {},
    demo: false,
    updated_at: new Date().toISOString(),
  }, 200, true);
}
