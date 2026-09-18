import { handleFlights, json } from "./_shared.js";

export default {
  async fetch(request) {
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
    return handleFlights(request);
  },
};
