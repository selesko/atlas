import 'dotenv/config';

export default {
  name: 'Calibra',
  slug: 'calibra',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icons/icon.png',
  splash: {
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    bundleIdentifier: 'com.calibra.app',
    buildNumber: '1',
    supportsTablet: false,
  },
  android: {
    package: 'com.calibra.app',
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: '#ffffff',
    },
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    eas: {
      projectId: '',
    },
  },
};
