import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { supabase } from './supabase';

type NotificationsModule = typeof import('expo-notifications');

/** Phone push needs a development or store build: Expo Go can't load expo-notifications' native modules. */
export const pushSupported = Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

/** Loads expo-notifications lazily, so importing this file never crashes Expo Go. */
export function loadNotifications(): NotificationsModule | null {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return pushSupported ? (require('expo-notifications') as NotificationsModule) : null;
}

// The token registered from this installation, kept across restarts so sign-out
// can always remove it (#44). It isn't a secret on its own: RLS keeps the row
// private, and only the token's owner can delete it.
const TOKEN_KEY = 'dtour.pushToken';

/** Registers this installation after permission is granted. */
export async function registerPush(requestPermission = false) {
  const Notifications = loadNotifications();
  if (!Notifications) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'DTour updates', importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted' && requestPermission) permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return false;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('Set up the Expo EAS project before enabling phone notifications.');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  // The RPC takes the token over from whoever registered it before on this phone (#44).
  const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
  if (error) throw error;
  await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {});
  return true;
}

/** Removes this installation's push registration. Call it while still signed in: RLS needs the session to delete the row. */
export async function unregisterPush() {
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (!token) return;
  const { error } = await supabase.from('device_push_tokens').delete().eq('token', token);
  if (error) throw error;
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
}
