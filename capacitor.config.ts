import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trycasher.app',
  appName: 'Casher',
  webDir: 'dist',
  loggingBehavior: 'none',
  android: { webContentsDebuggingEnabled: false },
  server: {
    cleartext: false
  }
};

export default config;
