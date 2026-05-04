import 'dotenv/config';

export default {
  name: 'Calibra',
  slug: 'calibra',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icons/icon.png',
  splash: {
    image: './assets/icons/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#08080F',
  },
  ios: {
    bundleIdentifier: 'com.calibra.app',
    buildNumber: '1',
    supportsTablet: false,
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          // AsyncStorage and expo-file-system read/write file timestamps
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
        {
          // React Native internals measure elapsed time / intervals
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
        {
          // AsyncStorage writes data files to disk
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1'],
        },
        {
          // Expo modules and React Native store app preferences in UserDefaults
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
      ],
    },
  },
  android: {
    package: 'com.calibra.app',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/icons/icon.png',
      backgroundColor: '#08080F',
    },
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    eas: {
      // Run `npx eas init` to register this project and auto-populate this ID.
      projectId: '7be46428-1b2f-44ff-8fa6-1f17d282f851',
    },
  },
};
