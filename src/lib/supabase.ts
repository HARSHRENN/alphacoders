import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { firebaseAuth } from './firebase';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
function makeClient(url: string, key: string) {
  return createClient(url, key, {
    accessToken: async () => (await firebaseAuth?.currentUser?.getIdToken()) ?? null,
  });
}
export const supabase = url && key ? makeClient(url, key) : null;

// Firebase issues the identity token. The server assigns only the database's
// authenticated role; workspace founder/member roles stay in Postgres.
export async function ensureDatabaseAccess() {
  const user = firebaseAuth?.currentUser;
  if (!user?.emailVerified || !supabase)
    throw new Error('Verify your email before joining a workspace.');
  const result = await user.getIdTokenResult();
  if (result.claims.role !== 'authenticated') {
    const response = await fetch(`${url}/functions/v1/firebase-access`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${result.token}`, apikey: key! },
    });
    if (!response.ok)
      throw new Error(
        'Your account is verified, but the workspace connection is still being set up. Please retry shortly.',
      );
    await user.getIdToken(true);
  }
  await supabase.realtime.setAuth(await user.getIdToken());
}
