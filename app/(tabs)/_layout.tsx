import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(13,17,23,0.95)',
          borderTopColor: 'rgba(255,255,255,0.07)',
          height: 84,
        },
        tabBarActiveTintColor: '#4ade80',
        tabBarInactiveTintColor: '#7d8590',
        tabBarLabelStyle: {
          textTransform: 'uppercase',
          fontSize: 10,
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Feather name="home" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => (
            <Feather name="map" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rooms"
        options={{
          title: 'Rooms',
          tabBarIcon: ({ color }) => (
            <Feather name="grid" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="route"
        options={{
          title: 'Routes',
          tabBarIcon: ({ color }) => (
            <Feather name="navigation" size={20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}