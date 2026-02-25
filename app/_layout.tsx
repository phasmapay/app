import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WalletProvider } from '../src/context/WalletContext';
import '../global.css';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <WalletProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#0a0a0a' },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: '#0a0a0a' },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="pay"
            options={{ title: 'Pay', presentation: 'modal' }}
          />
          <Stack.Screen
            name="receive"
            options={{ title: 'Receive', presentation: 'modal' }}
          />
          <Stack.Screen
            name="receipt/[signature]"
            options={{ title: 'Receipt', presentation: 'modal' }}
          />
        </Stack>
      </WalletProvider>
    </SafeAreaProvider>
  );
}
