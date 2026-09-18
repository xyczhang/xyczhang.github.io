const API_URL = "https://api.aviationstack.com/v1/flights";

const demoFlights = [
  {
    flight_iata: "BA286", airline: "British Airways", status: "active",
    departure: { airport: "San Francisco International", iata: "SFO", terminal: "I", gate: "A6", scheduled: "2026-09-18T18:30:00-07:00", estimated: "2026-09-18T18:42:00-07:00", delay: 12 },
    arrival: { airport: "London Heathrow", iata: "LHR", terminal: "5", gate: null, scheduled: "2026-09-19T13:05:00+01:00", estimated: "2026-09-19T13:17:00+01:00", delay: 12 },
    live: { updated: "2026-09-19T04:26:00Z", latitude: 56.18, longitude: -38.72, altitude: 11277, direction: 72, speed_horizontal: 861, speed_vertical: 0, is_ground: false },
    aircraft: { registration: "G-ZBKH", iata: "789", icao: "B789", icao24: "406D8E" },
  },
  {
    flight_iata: "UA1847", airline: "United Airlines", status: "scheduled",
    departure: { airport: "Newark Liberty International", iata: "EWR", terminal: "C", gate: "C82", scheduled: "2026-09-18T16:15:00-04:00", estimated: "2026-09-18T16:15:00-04:00", delay: 0 },
    arrival: { airport: "Los Angeles International", iata: "LAX", terminal: "7", gate: "72A", scheduled: "2026-09-18T19:06:00-07:00", estimated: "2026-09-18T19:06:00-07:00", delay: 0 },
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
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": cache ? "public, max-age=15" : "no-store",
    "x-content-type-options": "nosniff",
  };
  if (cache) headers["cdn-cache-control"] = "public, max-age=30";
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
    if (!new Set(["departures", "arrivals"]).has(direction)) throw new Error("Direction must be arrivals or departures.");
    params.set(direction === "departures" ? "dep_iata" : "arr_iata", airport);
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
    airline: item.airline?.name || item.airline?.iata || "Unknown airline",
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
  return flights.length ? flights : demoFlights.slice(0, 3);
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
