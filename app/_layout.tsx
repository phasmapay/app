import { useFonts, JetBrainsMono_400Regular, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity } from 'react-native';
import { WalletProvider } from '../src/context/WalletContext';
import { ModeProvider, useMode } from '../src/context/ModeContext';
import { colors } from '../src/design/tokens';
import '../global.css';

function MerchantBanner() {
  const { mode, toggleMode } = useMode();
  if (mode !== 'merchant') return null;
  return (
    <View style={{
      backgroundColor: colors.purple,
      paddingVertical: 6,
      paddingHorizontal: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
        MERCHANT MODE
      </Text>
      <TouchableOpacity onPress={toggleMode}>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>Switch to Customer</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'JetBrainsMono-Regular': JetBrainsMono_400Regular,
    'JetBrainsMono-Bold': JetBrainsMono_700Bold,
  });

  // Don't block render on font loading — system fonts work fine

  return (
    <SafeAreaProvider>
      <WalletProvider>
        <ModeProvider>
          <StatusBar style="dark" />
          <MerchantBanner />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.base },
              headerTintColor: colors.text,
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
            <Stack.Screen name="vault" options={{ title: 'Tap Vault', presentation: 'modal' }} />
            <Stack.Screen name="claimable" options={{ title: 'Claimable', presentation: 'modal' }} />
          </Stack>
        </ModeProvider>
      </WalletProvider>
    </SafeAreaProvider>
  );
}
