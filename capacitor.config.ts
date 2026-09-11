import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trycasher.app',
  appName: 'Casher',
  webDir: 'dist',
  loggingBehavior: 'none',
  plugins: { StatusBar: { overlaysWebView: false, style: 'LIGHT', backgroundColor: '#f5f2eb' } },
  android: { webContentsDebuggingEnabled: false },
  server: {
    cleartext: false
  }
};

export default config;
