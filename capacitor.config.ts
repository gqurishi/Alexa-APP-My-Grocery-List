
import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'app.lovable.c89285be07e043d099d65ce3b3750328',
  appName: 'My Grocery List',
  webDir: 'dist',
  server: {
    url: 'https://c89285be-07e0-43d0-99d6-5ce3b3750328.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#10b981',
      showSpinner: false,
    },
  },
};

export default config;
