import { useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { BUILDINGS } from '../../constants/mockData';
import BuildingCard from '../../components/building/BuildingCard';
import SectionLabel from '../../components/ui/SectionLabel';
import NowPill from '../../components/ui/NowPill';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const router = useRouter();
  const [roomPressed, setRoomPressed] = useState(false);
  const [routePressed, setRoutePressed] = useState(false);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: Colors.bg }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <Text
          className="text-[12px] mb-1"
          style={{ color: Colors.muted, fontFamily: Fonts.body }}
        >
          {getGreeting()}, Bronco 👋
        </Text>
        <Text
          className="text-[26px] mb-6"
          style={{ color: Colors.text, fontFamily: Fonts.display }}
        >
          What's happening now
        </Text>

        {/* Live indicator */}
        <NowPill updatedAt={BUILDINGS[0].updatedAt} />

        {/* Campus Overview */}
        <SectionLabel>Campus Overview</SectionLabel>
        <View className="gap-2.5 mb-10">
          {BUILDINGS.map(b => (
            <BuildingCard
              key={b.id}
              name={b.name}
              code={b.code}
              percentage={b.occupancy}
              level={b.level}
              roomCount={b.roomCount}
              freeCount={b.freeCount}
              onPress={() => {}}
            />
          ))}
        </View>

        {/* Quick Actions */}
        <SectionLabel>Quick Actions</SectionLabel>
        <View className="flex-row gap-2.5">
          <Pressable
            className="flex-1 rounded-xl p-5 border"
            onPress={() => router.push('/(tabs)/rooms')}
            onPressIn={() => setRoomPressed(true)}
            onPressOut={() => setRoomPressed(false)}
            style={{
              backgroundColor: roomPressed ? Colors.cardHover : Colors.accentBg,
              borderColor: Colors.accentBorder,
            }}
          >
            <Text className="text-2xl mb-2">🚪</Text>
            <Text
              className="text-sm mb-0.5"
              style={{ color: Colors.text, fontFamily: Fonts.bodyMedium }}
            >
              Find a Room
            </Text>
            <Text
              className="text-[11px]"
              style={{ color: Colors.muted, fontFamily: Fonts.body }}
            >
              See what's open now
            </Text>
          </Pressable>

          <Pressable
            className="flex-1 rounded-xl p-5 border"
            onPress={() => router.push('/(tabs)/route')}
            onPressIn={() => setRoutePressed(true)}
            onPressOut={() => setRoutePressed(false)}
            style={{
              backgroundColor: routePressed ? Colors.cardHover : Colors.card,
              borderColor: Colors.border,
            }}
          >
            <Text className="text-2xl mb-2">🧭</Text>
            <Text
              className="text-sm mb-0.5"
              style={{ color: Colors.text, fontFamily: Fonts.bodyMedium }}
            >
              Plan a Route
            </Text>
            <Text
              className="text-[11px]"
              style={{ color: Colors.muted, fontFamily: Fonts.body }}
            >
              Avoid the crowds
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}