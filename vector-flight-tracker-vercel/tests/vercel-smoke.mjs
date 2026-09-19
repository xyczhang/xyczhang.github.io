import assert from "node:assert/strict";
import flightsFunction from "../api/flights.js";
import positionFunction from "../api/position.js";
import routeFunction from "../api/route.js";
import statusFunction from "../api/status.js";

delete process.env.AVIATIONSTACK_API_KEY;

const statusResponse = await statusFunction.fetch(new Request("https://vector.test/api/status"));
assert.equal(statusResponse.status, 200);
assert.deepEqual(await statusResponse.json(), { aviationstack: false, mode: "demo" });

const demoResponse = await flightsFunction.fetch(
  new Request("https://vector.test/api/flights?mode=flight&flight=BA286"),
);
const demo = await demoResponse.json();
assert.equal(demoResponse.status, 200);
assert.equal(demo.demo, true);
assert.equal(demo.flights[0].flight_iata, "BA286");

const invalidResponse = await flightsFunction.fetch(
  new Request("https://vector.test/api/flights?mode=airport&airport=12"),
);
assert.equal(invalidResponse.status, 400);

const invalidPositionResponse = await positionFunction.fetch(
  new Request("https://vector.test/api/position?icao24=not-a-hex"),
);
assert.equal(invalidPositionResponse.status, 400);

const routeResponse = await routeFunction.fetch(
  new Request("https://vector.test/api/route?from=SFO&to=LHR"),
);
const routeBody = await routeResponse.json();
assert.equal(routeResponse.status, 200);
assert.equal(routeBody.route.departure.iata, "SFO");
assert.equal(routeBody.route.arrival.iata, "LHR");
assert.equal(Number.isFinite(routeBody.route.departure.latitude), true);
assert.equal(Number.isFinite(routeBody.route.arrival.longitude), true);

const invalidRouteResponse = await routeFunction.fetch(
  new Request("https://vector.test/api/route?from=12&to=LHR"),
);
assert.equal(invalidRouteResponse.status, 400);

const testSecret = "private-aviationstack-test-key";
process.env.AVIATIONSTACK_API_KEY = testSecret;
const originalFetch = globalThis.fetch;
let upstreamUrl = "";
globalThis.fetch = async (url) => {
  upstreamUrl = String(url);
  return Response.json({
    data: [{
      flight_status: "scheduled",
      airline: { name: "Test Air", icao: "TST" },
      flight: { iata: "TA101", icao: "TST101", number: "101" },
      departure: { airport: "Alpha", iata: "AAA", scheduled: "2026-09-18T12:00:00Z" },
      arrival: { airport: "Bravo", iata: "BBB", scheduled: "2026-09-18T14:00:00Z" },
      live: {
        updated: "2026-09-18T13:00:00Z",
        latitude: 42.25,
        longitude: -38.75,
        altitude: 10668,
        direction: 88,
        speed_horizontal: 845,
        is_ground: false,
      },
      aircraft: { registration: "N101TA", icao: "B789", icao24: "ABC123" },
    }],
  });
};

try {
  const liveResponse = await flightsFunction.fetch(
    new Request("https://vector.test/api/flights?mode=flight&flight=TA101"),
  );
  const bodyText = await liveResponse.text();
  assert.equal(liveResponse.status, 200);
  assert.match(upstreamUrl, /api\.aviationstack\.com/);
  assert.match(upstreamUrl, new RegExp(`access_key=${testSecret}`));
  assert.equal(bodyText.includes(testSecret), false);
  const liveBody = JSON.parse(bodyText);
  assert.equal(liveBody.demo, false);
  assert.equal(liveBody.flights[0].live.latitude, 42.25);
  assert.equal(liveBody.flights[0].live.longitude, -38.75);
  assert.equal(liveBody.flights[0].aircraft.registration, "N101TA");
  assert.equal(liveBody.flights[0].aircraft.icao24, "ABC123");
  assert.equal(liveBody.flights[0].flight_icao, "TST101");
  assert.equal(liveBody.flights[0].airline_icao, "TST");
  assert.equal(liveBody.flights[0].flight_number, "101");

  const inAirResponse = await flightsFunction.fetch(
    new Request("https://vector.test/api/flights?mode=airport&airport=JFK&direction=in-air"),
  );
  assert.equal(inAirResponse.status, 200);
  assert.match(upstreamUrl, /dep_iata=JFK/);
  assert.match(upstreamUrl, /flight_status=active/);
} finally {
  globalThis.fetch = originalFetch;
  delete process.env.AVIATIONSTACK_API_KEY;
}

let adsbUrl = "";
globalThis.fetch = async (url) => {
  adsbUrl = String(url);
  return Response.json({
    ac: [{
      hex: "4ca87c",
      flight: "BAW286 ",
      lat: 51.25,
      lon: -3.4,
      alt_baro: 35000,
      gs: 470,
      track: 82,
      seen_pos: 1.2,
      r: "G-ZBKH",
    }],
    now: 1789761600,
  });
};

try {
  const positionResponse = await positionFunction.fetch(
    new Request("https://vector.test/api/position?icao24=4CA87C"),
  );
  const positionBody = await positionResponse.json();
  assert.equal(positionResponse.status, 200);
  assert.match(adsbUrl, /api\.adsb\.lol\/v2\/hex\/4CA87C/);
  assert.equal(positionBody.available, true);
  assert.equal(positionBody.position.latitude, 51.25);
  assert.equal(positionBody.position.longitude, -3.4);
  assert.equal(positionBody.position.altitude_feet, 35000);
  assert.equal(positionBody.position.speed_knots, 470);
  assert.equal(positionBody.position.source, "ADSB.lol");
} finally {
  globalThis.fetch = originalFetch;
}

globalThis.fetch = async (url) => {
  adsbUrl = String(url);
  return Response.json({
    ac: [{ hex: "aa9679", flight: "RPA3559 ", r: "N781YX", lat: 40.58, lon: -74.49 }],
    now: 1789761600000,
  });
};

try {
  const registrationResponse = await positionFunction.fetch(
    new Request("https://vector.test/api/position?registration=N781YX"),
  );
  const registrationBody = await registrationResponse.json();
  assert.equal(registrationResponse.status, 200);
  assert.match(adsbUrl, /api\.adsb\.lol\/v2\/registration\/N781YX/);
  assert.equal(registrationBody.available, true);
  assert.equal(registrationBody.matched_by, "registration");
  assert.equal(registrationBody.position.icao24, "AA9679");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Vercel flight tracker checks passed");
