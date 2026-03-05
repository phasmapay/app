import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { useMode } from '../../src/context/ModeContext';
import {
  HomeIcon, HomeOutlineIcon, TimeIcon, TimeOutlineIcon,
  SettingsIcon, SettingsOutlineIcon, MerchantIcon, MerchantOutlineIcon,
} from '../../src/components/Icons';
import { colors } from '../../src/design/tokens';

function TabIcon({ focused, label, ActiveIcon, InactiveIcon }: {
  focused: boolean;
  label: string;
  ActiveIcon: React.FC<{ size?: number; color?: string }>;
  InactiveIcon: React.FC<{ size?: number; color?: string }>;
}) {
  const color = focused ? colors.purple : colors.textMute;
  const Icon = focused ? ActiveIcon : InactiveIcon;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 80, paddingTop: 10 }}>
      <Icon size={24} color={color} />
      <Text numberOfLines={1} style={{ fontSize: 11, marginTop: 3, color, fontWeight: focused ? '600' : '400' }}>
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { mode } = useMode();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.base,
          borderTopColor: colors.surface2,
          borderTopWidth: 0.5,
          height: 72,
          paddingBottom: 4,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Home" ActiveIcon={HomeIcon} InactiveIcon={HomeOutlineIcon} />
          ),
        }}
      />
      <Tabs.Screen
        name="merchant"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Merchant" ActiveIcon={MerchantIcon} InactiveIcon={MerchantOutlineIcon} />
          ),
          href: mode === 'merchant' ? '/(tabs)/merchant' : null,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="History" ActiveIcon={TimeIcon} InactiveIcon={TimeOutlineIcon} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Settings" ActiveIcon={SettingsIcon} InactiveIcon={SettingsOutlineIcon} />
          ),
        }}
      />
    </Tabs>
  );
}
