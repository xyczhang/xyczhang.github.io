import { json } from "./_shared.js";

export default {
  fetch(request) {
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
    const configured = Boolean(process.env.AVIATIONSTACK_API_KEY);
    return json({ aviationstack: configured, mode: configured ? "live" : "demo" });
  },
};
