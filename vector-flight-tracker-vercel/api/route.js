import { handleRoute } from "./_shared.js";

export default {
  async fetch(request) {
    return handleRoute(request);
  },
};
