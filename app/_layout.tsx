import { useFonts, JetBrainsMono_400Regular, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WalletProvider } from '../src/context/WalletContext';
import { colors } from '../src/design/tokens';
import '../global.css';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'JetBrainsMono-Regular': JetBrainsMono_400Regular,
    'JetBrainsMono-Bold': JetBrainsMono_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <WalletProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.base },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.base },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="pay" options={{ title: 'Pay', presentation: 'modal' }} />
          <Stack.Screen name="receive" options={{ title: 'Receive', presentation: 'modal' }} />
          <Stack.Screen name="receipt/[signature]" options={{ title: 'Receipt', presentation: 'modal' }} />
          <Stack.Screen name="ghost-pay" options={{ title: 'Ghost Pay', presentation: 'modal' }} />
          <Stack.Screen name="ghost-receive" options={{ title: 'Ghost Receive', presentation: 'modal' }} />
        </Stack>
      </WalletProvider>
    </SafeAreaProvider>
  );
}
