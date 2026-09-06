import * as Sentry from '@sentry/react';

export const initSentry = () => {
  if (!import.meta.env.PROD) return;
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN || 'https://15d3d8c574e8359c17ac46bd95caea78@o4511223518330880.ingest.de.sentry.io/4511223530258512',
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    // Financial screens must not be recorded or included in network breadcrumbs.
    integrations: integrations => integrations.filter(integration => !['BrowserSession', 'Breadcrumbs'].includes(integration.name)),
    tracesSampleRate: 0,
    beforeSend(event) {
      delete event.user;
      delete event.request;
      delete event.extra;
      event.breadcrumbs = [];
      return event;
    },
  });
};
export const captureApiError = (error: unknown, context: { operation: string; [key: string]: unknown }) => {
  if (!import.meta.env.PROD) return;
  // Database errors can embed transaction contents: report the operation, not the payload.
  Sentry.captureException(new Error(`Request failed: ${context.operation}`), { tags: { operation: context.operation } });
};
