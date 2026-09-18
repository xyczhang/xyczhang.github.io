import assert from "node:assert/strict";
import flightsFunction from "../api/flights.js";
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

const testSecret = "private-aviationstack-test-key";
process.env.AVIATIONSTACK_API_KEY = testSecret;
const originalFetch = globalThis.fetch;
let upstreamUrl = "";
globalThis.fetch = async (url) => {
  upstreamUrl = String(url);
  return Response.json({
    data: [{
      flight_status: "scheduled",
      airline: { name: "Test Air" },
      flight: { iata: "TA101" },
      departure: { airport: "Alpha", iata: "AAA", scheduled: "2026-09-18T12:00:00Z" },
      arrival: { airport: "Bravo", iata: "BBB", scheduled: "2026-09-18T14:00:00Z" },
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
  assert.equal(JSON.parse(bodyText).demo, false);
} finally {
  globalThis.fetch = originalFetch;
  delete process.env.AVIATIONSTACK_API_KEY;
}

console.log("Vercel flight tracker checks passed");
