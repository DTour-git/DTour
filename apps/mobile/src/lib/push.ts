import { Platform } from 'react-native';
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

let registeredToken: string | null = null;

/** Registers this installation after permission is granted. */
export async function registerPush(userId: string, requestPermission = false) {
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
  const { error } = await supabase.from('device_push_tokens').upsert({ token, user_id: userId, platform: Platform.OS, updated_at: new Date().toISOString() }, { onConflict: 'token' });
  if (error) throw error;
  registeredToken = token;
  return true;
}

export async function unregisterPush() {
  if (!registeredToken) return;
  await supabase.from('device_push_tokens').delete().eq('token', registeredToken);
  registeredToken = null;
}
