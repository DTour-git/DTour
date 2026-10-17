import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { supabase } from './supabase';

let registeredToken: string | null = null;

/** Registers this installation after permission is granted. */
export async function registerPush(userId: string, requestPermission = false) {
  // Expo Go can't receive remote push (Android dropped it in SDK 53); only dev/store builds register.
  if (Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'DTour updates', importance: AndroidImportance.DEFAULT,
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
