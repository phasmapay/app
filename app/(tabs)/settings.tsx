import React from 'react';
import { View, Text, TouchableOpacity, Alert, Share, Clipboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWallet } from '../../src/context/WalletContext';
import { SOLANA_NETWORK, RPC_URL } from '../../src/utils/constants';
import { shortAddress } from '../../src/utils/solana';

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
        paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#1a1a1a',
      }}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <Text style={{ color: '#888', fontSize: 14 }}>{label}</Text>
      <Text style={{ color: accent ?? '#fff', fontSize: 14, fontWeight: '600' }}>{value}</Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { publicKey, isConnected, connect, disconnect } = useWallet();

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 24 }}>Settings</Text>

        <View style={{ backgroundColor: '#111', borderRadius: 16, paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ color: '#777', fontSize: 11, fontWeight: '600', letterSpacing: 1, paddingTop: 14, paddingBottom: 4 }}>
            WALLET
          </Text>
          <SettingRow
            label="Address"
            value={publicKey ? shortAddress(publicKey.toBase58()) : 'Not connected'}
            onPress={publicKey ? () => {
              Clipboard.setString(publicKey.toBase58());
              Alert.alert('Copied', publicKey.toBase58());
            } : undefined}
            accent={publicKey ? '#9945FF' : undefined}
          />
          <SettingRow
            label="Network"
            value={SOLANA_NETWORK === 'devnet' ? 'Devnet' : 'Mainnet'}
            accent={SOLANA_NETWORK === 'devnet' ? '#FFD700' : '#14F195'}
          />
          <SettingRow label="RPC" value="Helius Devnet" />
          <View style={{ height: 8 }} />
        </View>

        <View style={{ backgroundColor: '#111', borderRadius: 16, paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ color: '#777', fontSize: 11, fontWeight: '600', letterSpacing: 1, paddingTop: 14, paddingBottom: 4 }}>
            APP
          </Text>
          <SettingRow label="Version" value="1.0.0" />
          <View style={{ height: 8 }} />
        </View>

        <View style={{ backgroundColor: '#111', borderRadius: 16, paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ color: '#777', fontSize: 11, fontWeight: '600', letterSpacing: 1, paddingTop: 14, paddingBottom: 4 }}>
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
            <Text style={{ color: '#888', fontSize: 14 }}>Clear Transaction History</Text>
            <Text style={{ color: '#FF4747', fontSize: 14, fontWeight: '600' }}>Clear</Text>
          </TouchableOpacity>
          <View style={{ height: 8 }} />
        </View>

        <View style={{ marginTop: 8 }}>
          {isConnected ? (
            <TouchableOpacity
              style={{ backgroundColor: '#1a1a1a', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
              onPress={handleDisconnect}
              activeOpacity={0.7}
            >
              <Text style={{ color: '#FF4747', fontWeight: '700', fontSize: 15 }}>Disconnect Wallet</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={{ backgroundColor: '#9945FF', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
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
