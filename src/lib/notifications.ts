import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { Profile } from '../types';
import { supabase } from './supabase';

export async function enableNotifications(profile: Profile) {
  if (Platform.OS !== 'android')
    throw new Error('Work reminders are available in the installed Android app.');
  const N = await import('expo-notifications');
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  await N.setNotificationChannelAsync('work-updates', {
    name: 'Work updates & reminders',
    importance: N.AndroidImportance.HIGH,
    sound: 'default',
  });
  const permissions = await N.requestPermissionsAsync();
  if (!permissions.granted)
    throw new Error(
      'Notifications are turned off. Enable them in Android Settings to receive reminders.',
    );
  await registerPushToken(profile.id);
  await N.cancelAllScheduledNotificationsAsync();
}

async function registerPushToken(userId: string) {
  const N = await import('expo-notifications');
  await N.setNotificationChannelAsync('work-updates', {
    name: 'Work updates & reminders',
    importance: N.AndroidImportance.HIGH,
    sound: 'default',
  });
  if (!Device.isDevice)
    throw new Error('Use a physical Android device to register team push notifications.');
  const token = (await N.getDevicePushTokenAsync()).data;
  if (typeof token !== 'string') throw new Error('Android push registration failed. Please retry.');
  const { error } = await supabase!
    .from('push_tokens')
    .upsert({ user_id: userId, token, provider: 'fcm' }, { onConflict: 'token' });
  if (error) throw error;
}
export async function cancelNotifications() {
  if (Platform.OS !== 'web') {
    const N = await import('expo-notifications');
    await N.cancelAllScheduledNotificationsAsync();
  }
}

// Refresh a previously authorized device token without opening a permission prompt.
export async function syncPushRegistration(userId: string) {
  if (Platform.OS !== 'android' || !Device.isDevice) return;
  const N = await import('expo-notifications');
  const permission = await N.getPermissionsAsync();
  if (permission.granted) await registerPushToken(userId);
}
