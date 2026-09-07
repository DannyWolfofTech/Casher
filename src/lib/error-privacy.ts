import type { ErrorEvent } from '@sentry/react';

/** Keep failure location; discard dynamic messages that may contain bank data. */
export function privateErrorEvent(event: ErrorEvent): ErrorEvent {
  const values = event.exception?.values?.map(exception => ({
    type: ['Error','TypeError','RangeError','ReferenceError','SyntaxError','URIError','EvalError'].includes(exception.type || '') ? exception.type : 'Error',
    value: 'An application operation failed',
    stacktrace: { frames: exception.stacktrace?.frames?.map(frame => ({
      filename: frame.filename?.match(/\/assets\/[A-Za-z0-9_.-]+\.js/)?.[0] || '[application]',
      lineno: frame.lineno, colno: frame.colno, in_app: frame.in_app,
    })) },
  }));
  const operation = event.tags?.operation;
  return { type: event.type, event_id: event.event_id, timestamp: event.timestamp, level: event.level,
    platform: event.platform, release: event.release, environment: event.environment,
    exception: values?.length ? { values } : undefined,
    message: values?.length ? undefined : 'An application operation failed',
    tags: typeof operation === 'string' && /^[a-z_-]{1,60}$/.test(operation) ? {operation} : undefined,
  };
}
