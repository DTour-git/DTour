import 'expo-crypto';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@dtour/shared';
import { createSessionStorage } from './sessionStorage';

// On iOS and Android the session goes to the Keychain / Keystore, never to
// plaintext AsyncStorage (sessions saved there by older builds are moved over
// and deleted on first read). The web build has no secure store, so it keeps
// the browser's localStorage, as the website does.
const secureOptions: SecureStore.SecureStoreOptions = {
  // Readable while locked (after the first unlock since boot) so a background
  // wake can still read it; never migrated to another device from a backup.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};
const storage =
  Platform.OS === 'web'
    ? AsyncStorage
    : createSessionStorage(
        {
          getItemAsync: (key) => SecureStore.getItemAsync(key, secureOptions),
          setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, secureOptions),
          deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, secureOptions),
        },
        AsyncStorage,
      );

export const supabase = createClient<Database>(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// Refresh tokens only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
