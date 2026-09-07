// Test-only entrypoint adapter. Production imports the real Deno HTTP server.
export const handlers: ((req: Request) => Promise<Response>)[] = [];
export function serve(handler: (req: Request) => Promise<Response>) { handlers.push(handler); }
