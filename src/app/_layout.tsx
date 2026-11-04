import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StoreProvider } from '../store';
import { CloudGate } from '../components/CloudGate';
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <CloudGate>
        <StoreProvider>
          <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
        </StoreProvider>
      </CloudGate>
    </SafeAreaProvider>
  );
}
