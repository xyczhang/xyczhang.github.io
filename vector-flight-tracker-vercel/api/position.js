import { handlePosition } from "./_shared.js";

export default {
  async fetch(request) {
    return handlePosition(request);
  },
};
