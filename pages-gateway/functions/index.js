// The catch-all [[path]] route does not reliably cover the site root "/".
// This explicit index route sends homepage requests to the same Next.js Worker.
export { onRequest } from "./[[path]].js";
