import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { HomeIcon, HomeOutlineIcon, TimeIcon, TimeOutlineIcon, SettingsIcon, SettingsOutlineIcon } from '../../src/components/Icons';

function TabIcon({ focused, label, ActiveIcon, InactiveIcon }: {
  focused: boolean;
  label: string;
  ActiveIcon: React.FC<{ size?: number; color?: string }>;
  InactiveIcon: React.FC<{ size?: number; color?: string }>;
}) {
  const color = focused ? '#9945FF' : '#666';
  const Icon = focused ? ActiveIcon : InactiveIcon;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 80, paddingTop: 4 }}>
      <Icon size={24} color={color} />
      <Text numberOfLines={1} style={{ fontSize: 11, marginTop: 3, color, fontWeight: focused ? '600' : '400' }}>
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0a0a0a',
          borderTopColor: '#1a1a1a',
          borderTopWidth: 0.5,
          height: 68,
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
