import * as Sentry from "@sentry/react";

export const initSentry = () => {
  Sentry.init({
    dsn: "https://15d3d8c574e8359c17ac46bd95caea78@o4511223518330880.ingest.de.sentry.io/4511223530258512",
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 0.3,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
    beforeSend(event) {
      // Don't send events in development
      if (import.meta.env.DEV) {
        console.warn("[Sentry] Event captured (dev mode, not sent):", event);
        return null;
      }
      return event;
    },
  });
};

/**
 * Capture an error with optional context for API/edge function failures.
 */
export const captureApiError = (
  error: unknown,
  context: { operation: string; [key: string]: unknown }
) => {
  Sentry.captureException(error, {
    tags: { operation: context.operation },
    extra: context,
  });
};
