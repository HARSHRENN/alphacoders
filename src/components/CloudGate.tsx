import { Text } from './Typography';
import React, { useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { firebaseAuth } from '../lib/firebase';
import { cancelNotifications } from '../lib/notifications';
import { Card, Icon, Tag, C, s } from './ui';

export function CloudGate({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Retire preview records and the old user-entered hosting configuration.
    Promise.all([
      AsyncStorage.multiRemove(['pulse-demo-v1', 'alphacoders-cloud-v1']),
      cancelNotifications(),
    ]).catch(() => {});
  }, []);

  if (supabase && firebaseAuth) return <>{children}</>;

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        backgroundColor: C.bg,
        padding: 24,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View style={{ maxWidth: 440, width: '100%', gap: 22 }}>
        <View style={[s.row, { gap: 10 }]}>
          <Icon name="pulse" color={C.green} size={30} />
          <Text style={s.title}>alphacoders</Text>
        </View>
        <Text style={s.title}>Getting your workspace ready.</Text>
        <Text style={s.body}>
          Your app connects automatically to its live server. Team members don’t need to enter a
          company URL or hosting address.
        </Text>
        <Card style={{ gap: 16 }}>
          <Tag text="SETUP PENDING" />
          <Icon name="cloud-outline" color={C.green} size={32} />
          <Text style={s.h2}>The live server isn’t connected yet.</Text>
          <Text style={s.body}>
            Account creation and sign-in will be available here once the initial server setup is
            complete.
          </Text>
        </Card>
      </View>
    </ScrollView>
  );
}
