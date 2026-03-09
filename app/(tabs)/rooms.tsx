import { useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { BUILDINGS } from '../../constants/mockData';
import type { Room } from '../../constants/mockData';
import BuildingAccordion from '../../components/building/BuildingAccordion';
import ChipFilter from '../../components/ui/ChipFilter';

const FILTER_OPTIONS = ['All', 'Free Now', 'Study Rooms', 'Labs'];

function roomMatchesFilters(room: Room, filters: string[]): boolean {
  return filters.some(f => {
    if (f === 'Free Now')    return room.status === 'free';
    if (f === 'Study Rooms') return room.type.includes('Study') || room.type === 'Quiet Zone' || room.type === 'Group Room';
    if (f === 'Labs')        return room.type.includes('Lab');
    return false;
  });
}

export default function RoomsScreen() {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const filteredBuildings = BUILDINGS
    .map(b => {
      const rooms = activeFilters.length === 0
        ? b.rooms
        : b.rooms.filter(r => roomMatchesFilters(r, activeFilters));
      return { ...b, rooms, freeCount: rooms.filter(r => r.status === 'free').length };
    })
    .filter(b => b.rooms.length > 0);

  const totalFree = filteredBuildings.reduce((sum, b) => sum + b.freeCount, 0);

  return (
    <SafeAreaView edges={['top']} className="flex-1" style={{ backgroundColor: Colors.bg }}>
      {/* Header */}
      <View className="px-5 pt-6 pb-4">
        <Text
          className="text-[26px]"
          style={{ color: Colors.text, fontFamily: Fonts.display }}
        >
          Find a Room
        </Text>
        <Text
          className="text-[12px] mt-1"
          style={{ color: Colors.muted, fontFamily: Fonts.body }}
        >
          {totalFree} rooms available right now
        </Text>
      </View>

      <ChipFilter
        options={FILTER_OPTIONS}
        active={activeFilters}
        onChange={setActiveFilters}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {filteredBuildings.map(b => (
          <BuildingAccordion
            key={b.id}
            name={b.name}
            code={b.code}
            freeCount={b.freeCount}
            rooms={b.rooms}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}