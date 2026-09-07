export interface SessionStore {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}
export function secureSessionAdapter(loadStore: () => Promise<SessionStore>): SessionStore {
  let store: Promise<SessionStore> | undefined;
  const getStore = () => store ??= loadStore().catch(error => { store = undefined; throw error; });
  // Propagate OS errors; never silently persist credentials in web storage.
  return {
    getItem: async key => (await getStore()).getItem(key),
    setItem: async (key,value) => (await getStore()).setItem(key,value),
    removeItem: async key => (await getStore()).removeItem(key),
  };
}
export function sessionStorageForPlatform<T>(native: boolean, webStorage: () => T) {
  if (!native) return webStorage();
  return secureSessionAdapter(async () => {
    const { SecureStorage, KeychainAccess } = await import('@aparajita/capacitor-secure-storage');
    await SecureStorage.setKeyPrefix('casher.auth.');
    await SecureStorage.setSynchronize(false);
    await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
    const probe = crypto.randomUUID();
    await SecureStorage.setItem('availability-check', probe);
    if (await SecureStorage.getItem('availability-check') !== probe) throw new Error('Device secure storage is unavailable.');
    await SecureStorage.removeItem('availability-check');
    // Capacitor plugin proxies synthesize every property, including `then`.
    // Returning the proxy from an async initializer would assimilate it as a
    // thenable and leave authentication waiting forever.
    return {
      getItem: key => SecureStorage.getItem(key),
      setItem: (key,value) => SecureStorage.setItem(key,value),
      removeItem: key => SecureStorage.removeItem(key),
    };
  });
}
