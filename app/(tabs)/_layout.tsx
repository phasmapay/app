import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';

function TabIcon({ focused, label, icon }: { focused: boolean; label: string; icon: string }) {
  return (
    <View className="items-center">
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text
        className={`text-xs mt-0.5 ${focused ? 'text-[#9945FF]' : 'text-[#888888]'}`}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0a0a0a' },
        headerTintColor: '#FFFFFF',
        tabBarStyle: {
          backgroundColor: '#141414',
          borderTopColor: '#1f1f1f',
          height: 80,
          paddingBottom: 12,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'PhasmaPay',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Home" icon="👻" />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="History" icon="📋" />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Settings" icon="⚙️" />
          ),
        }}
      />
    </Tabs>
  );
}
