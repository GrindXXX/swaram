import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.swaram.citizen',
  appName: 'Swaram',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
