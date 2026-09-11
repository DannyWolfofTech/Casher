// Non-sensitive display preferences are optional. A full or restricted browser
// store must not prevent the application from rendering.
export function readPreference(key: 'theme' | 'language') {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function writePreference(key: 'theme' | 'language', value: string) {
  try { localStorage.setItem(key, value); } catch { /* Keep the in-memory choice. */ }
}
