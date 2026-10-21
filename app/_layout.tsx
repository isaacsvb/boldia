import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { LanguageProvider } from '../src/state/LanguageContext';
import { getDb } from '../src/db/database';
import { colors } from '../src/theme/theme';

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    getDb()
      .then(() => setDbReady(true))
      .catch((e) => {
        console.error('DB init failed', e);
        setDbReady(true); // fail open so the app still renders
      });
  }, []);

  if (!dbReady) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LanguageProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="shadowing" />
            <Stack.Screen name="import" options={{ presentation: 'modal' }} />
          </Stack>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
