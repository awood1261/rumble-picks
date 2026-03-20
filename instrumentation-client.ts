import posthog from "posthog-js";

const environment =
  process.env.NEXT_PUBLIC_VERCEL_ENV ??
  (process.env.NODE_ENV === "development" ? "development" : "production");

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_TOKEN!, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  defaults: "2026-01-30",
  capture_exceptions: true,
  debug: process.env.NODE_ENV === "development",
  loaded: (client) => {
    client.register({
      environment,
    });
  },
});
