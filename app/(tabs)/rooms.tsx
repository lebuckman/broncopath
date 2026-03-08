import { ScrollView, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { BUILDINGS } from '../../constants/mockData';
import BuildingAccordion from '../../components/building/BuildingAccordion';

export default function RoomsScreen() {
  const totalFree = BUILDINGS.reduce((sum, b) => sum + b.freeCount, 0);

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

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {BUILDINGS.map(b => (
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
