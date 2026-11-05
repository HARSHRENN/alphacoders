import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { TypographyProvider } from '../components/Typography';
import { C } from '../components/ui';
import { StoreProvider } from '../store';
import { CloudGate } from '../components/CloudGate';
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  if (!fontsLoaded && !fontError)
    return (
      <View
        style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}
      >
        <ActivityIndicator color={C.green} />
      </View>
    );
  return (
    <TypographyProvider value={fontsLoaded}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <CloudGate>
          <StoreProvider>
            <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
          </StoreProvider>
        </CloudGate>
      </SafeAreaProvider>
    </TypographyProvider>
  );
}
