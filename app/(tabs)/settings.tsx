import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWallet } from '../../src/context/WalletContext';
import { SOLANA_NETWORK } from '../../src/utils/constants';
import { shortAddress } from '../../src/utils/solana';
import { router } from 'expo-router';
import { useMode } from '../../src/context/ModeContext';
import { colors, space, radius } from '../../src/design/tokens';

function SettingRow({
  label,
  value,
  onPress,
  accent,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  accent?: string;
}) {
  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: colors.surface2,
      }}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <Text style={{ color: colors.textSub, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: accent ?? colors.text, fontSize: 14, fontWeight: '600' }}>{value}</Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { publicKey, isConnected, connect, disconnect } = useWallet();
  const { mode, toggleMode } = useMode();

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Wallet',
      'Are you sure you want to disconnect?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: disconnect },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.base }}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 24 }}>Settings</Text>

        <View style={{ backgroundColor: colors.surface0, borderRadius: 16, paddingHorizontal: 16, marginBottom: 16, elevation: 1 }}>
          <Text style={{ color: colors.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1, paddingTop: 14, paddingBottom: 4 }}>
            WALLET
          </Text>
          <SettingRow
            label="Address"
            value={publicKey ? shortAddress(publicKey.toBase58()) : 'Not connected'}
            onPress={publicKey ? () => {
              Alert.alert('Address', publicKey.toBase58());
            } : undefined}
            accent={publicKey ? colors.purple : undefined}
          />
          <SettingRow
            label="Network"
            value={SOLANA_NETWORK === 'devnet' ? 'Devnet' : 'Mainnet'}
            accent={colors.green}
          />
          <SettingRow label="RPC" value="Helius Devnet" />
          <View style={{ height: 8 }} />
        </View>

        <View style={{ backgroundColor: colors.surface0, borderRadius: 16, paddingHorizontal: 16, marginBottom: 16, elevation: 1 }}>
          <Text style={{ color: colors.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1, paddingTop: 14, paddingBottom: 4 }}>
            MODE
          </Text>
          <TouchableOpacity
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 }}
            onPress={toggleMode}
          >
            <Text style={{ color: colors.textSub, fontSize: 14 }}>Merchant Mode</Text>
            <View style={{
              backgroundColor: mode === 'merchant' ? colors.purple : colors.surface2,
              paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8,
            }}>
              <Text style={{ color: mode === 'merchant' ? '#fff' : colors.textSub, fontSize: 12, fontWeight: '600' }}>
                {mode === 'merchant' ? 'ON' : 'OFF'}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={{ height: 8 }} />
        </View>

        <View style={{ backgroundColor: colors.surface0, borderRadius: 16, paddingHorizontal: 16, marginBottom: 16, elevation: 1 }}>
          <Text style={{ color: colors.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1, paddingTop: 14, paddingBottom: 4 }}>
            VAULT
          </Text>
          <SettingRow
            label="Tap Vault"
            value="Manage >"
            onPress={() => router.push('/vault')}
            accent={colors.green}
          />
          <View style={{ height: 8 }} />
        </View>

        <View style={{ backgroundColor: colors.surface0, borderRadius: 16, paddingHorizontal: 16, marginBottom: 16, elevation: 1 }}>
          <Text style={{ color: colors.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1, paddingTop: 14, paddingBottom: 4 }}>
            APP
          </Text>
          <SettingRow label="Version" value="1.0.0" />
          <View style={{ height: 8 }} />
        </View>

        <View style={{ backgroundColor: colors.surface0, borderRadius: 16, paddingHorizontal: 16, marginBottom: 16, elevation: 1 }}>
          <Text style={{ color: colors.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1, paddingTop: 14, paddingBottom: 4 }}>
            DATA
          </Text>
          <TouchableOpacity
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 }}
            onPress={() =>
              Alert.alert('Clear History', 'Delete all transaction history?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', style: 'destructive', onPress: () => AsyncStorage.removeItem('phasma:transactions') },
              ])
            }
          >
            <Text style={{ color: colors.textSub, fontSize: 14 }}>Clear Transaction History</Text>
            <Text style={{ color: colors.error, fontSize: 14, fontWeight: '600' }}>Clear</Text>
          </TouchableOpacity>
          <View style={{ height: 8 }} />
        </View>

        <View style={{ marginTop: 8 }}>
          {isConnected ? (
            <TouchableOpacity
              style={{ backgroundColor: colors.surface0, borderRadius: 16, paddingVertical: 16, alignItems: 'center', elevation: 1 }}
              onPress={handleDisconnect}
              activeOpacity={0.7}
            >
              <Text style={{ color: colors.error, fontWeight: '700', fontSize: 15 }}>Disconnect Wallet</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={{ backgroundColor: colors.purple, borderRadius: 16, paddingVertical: 16, alignItems: 'center', elevation: 4 }}
              onPress={connect}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Connect Wallet</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
