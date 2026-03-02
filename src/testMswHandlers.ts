import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("*/rest/v1/*", () => HttpResponse.json([])),
];
