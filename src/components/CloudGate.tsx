import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, configureSupabase } from '../lib/supabase';
import { cancelNotifications } from '../lib/notifications';
import { validateCloudConfig, workspaceConfigUrl } from '../lib/cloudConfig';
import { Button, Field, Card, ErrorText, Icon, C, s } from './ui';

const CONFIG_KEY = 'alphacoders-cloud-v1';
export function CloudGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'connect' | 'ready'>(
    supabase ? 'ready' : 'loading',
  );
  const [url, setUrl] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    // Retire samples and local reminders left by earlier preview builds.
    Promise.all([AsyncStorage.removeItem('pulse-demo-v1'), cancelNotifications()]).catch(() => {});
    if (supabase) return;
    let active = true;
    AsyncStorage.getItem(CONFIG_KEY)
      .then((value) => {
        if (!active) return;
        if (value) {
          const config = validateCloudConfig(JSON.parse(value));
          configureSupabase(config.supabaseUrl, config.supabaseAnonKey);
          setState('ready');
        } else setState('connect');
      })
      .catch(() => {
        if (active) setState('connect');
      });
    return () => {
      active = false;
    };
  }, []);
  async function connect() {
    setBusy(true);
    setError('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(workspaceConfigUrl(url), {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok)
        throw new Error('The workspace server is not ready. Check the URL with your founder.');
      const config = validateCloudConfig(await response.json());
      await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
      configureSupabase(config.supabaseUrl, config.supabaseAnonKey);
      setState('ready');
    } catch (e: any) {
      setError(
        e.name === 'AbortError'
          ? 'The server took too long to respond. Check your internet connection.'
          : e.message,
      );
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  }
  if (state === 'ready') return <>{children}</>;
  if (state === 'loading')
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={C.green} />
      </View>
    );
  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: C.bg,
        padding: 24,
        justifyContent: 'center',
        alignItems: 'center',
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ maxWidth: 440, width: '100%', gap: 22 }}>
        <View style={[s.row, { gap: 10 }]}>
          <Icon name="pulse" color={C.green} size={30} />
          <Text style={s.title}>alphacoders</Text>
        </View>
        <Text style={s.title}>Your team. Anywhere.</Text>
        <Text style={s.body}>
          Connect once to your company workspace. Then sign in with your own account from any Wi-Fi
          or mobile network.
        </Text>
        <Card>
          <Field
            label="Company workspace URL"
            value={url}
            onChangeText={setUrl}
            placeholder="https://your-team.vercel.app"
          />
          <ErrorText text={error} />
          <Button title="Connect workspace" icon="globe-outline" loading={busy} onPress={connect} />
          <Text style={[s.small, { marginTop: 16 }]}>
            Ask your founder for this address. Your work stays in the shared cloud database.
          </Text>
        </Card>
      </View>
    </ScrollView>
  );
}
