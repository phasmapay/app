import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
      className="flex-row justify-between items-center py-4 border-b border-[#1f1f1f]"
      onPress={onPress}
      disabled={!onPress}
    >
      <Text className="text-[#888] text-sm">{label}</Text>
      <Text
        className="text-sm font-semibold"
        style={{ color: accent ?? '#FFFFFF' }}
      >
        {value}
      </Text>
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
    <SafeAreaView className="flex-1 bg-[#0a0a0a]">
      <View className="flex-1 px-5 pt-4">
        <Text className="text-white text-2xl font-bold mb-6">Settings</Text>

        <View className="bg-[#141414] rounded-2xl px-4 mb-4 border border-[#1f1f1f]">
          <Text className="text-[#888] text-xs font-semibold uppercase tracking-widest py-3">
            Wallet
          </Text>
          <SettingRow
            label="Address"
            value={publicKey ? shortAddress(publicKey.toBase58()) : 'Not connected'}
          />
          <SettingRow
            label="Network"
            value={SOLANA_NETWORK === 'devnet' ? 'Devnet' : 'Mainnet'}
            accent={SOLANA_NETWORK === 'devnet' ? '#FFD700' : '#14F195'}
          />
          <SettingRow label="RPC" value={RPC_URL.replace('https://', '').slice(0, 30)} />
        </View>

        <View className="bg-[#141414] rounded-2xl px-4 mb-4 border border-[#1f1f1f]">
          <Text className="text-[#888] text-xs font-semibold uppercase tracking-widest py-3">
            App
          </Text>
          <SettingRow label="Version" value="1.0.0" />
          <SettingRow label="Hackathon" value="MONOLITH 2026" accent="#9945FF" />
        </View>

        <View className="mt-4">
          {isConnected ? (
            <TouchableOpacity
              className="bg-[#FF4747] rounded-2xl py-4 items-center"
              onPress={handleDisconnect}
            >
              <Text className="text-white font-bold text-base">Disconnect Wallet</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className="rounded-2xl py-4 items-center"
              style={{ backgroundColor: '#9945FF' }}
              onPress={connect}
            >
              <Text className="text-white font-bold text-base">Connect Wallet</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
