import 'react-native-url-polyfill/auto';
import { createClient, processLock } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const storage = {
  async getItem(key: string) {
    return Platform.OS === 'web' ? sessionStorage.getItem(key) : SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === 'web') sessionStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string) {
    if (Platform.OS === 'web') sessionStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  },
};
function makeClient(url: string, key: string) {
  return createClient(url, key, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  });
}
export let supabase = url && key ? makeClient(url, key) : null;
export function configureSupabase(url: string, key: string) {
  supabase = makeClient(url, key);
}
