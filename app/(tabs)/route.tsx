import { useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { MOCK_ROUTES } from '../../constants/mockData';
import RouteInputCard from '../../components/route/RouteInputCard';
import RouteOptionCard from '../../components/route/RouteOptionCard';
import CrowdTipCard from '../../components/route/CrowdTipCard';
import SectionLabel from '../../components/ui/SectionLabel';

export default function RouteScreen() {
  const [selected, setSelected] = useState(0);
  const tip = MOCK_ROUTES.find(r => r.crowdTip)?.crowdTip;

  return (
    <SafeAreaView edges={['top']} className="flex-1" style={{ backgroundColor: Colors.bg }}>
      {/* Header */}
      <View className="px-5 pt-6 pb-4">
        <Text
          className="text-[26px]"
          style={{ color: Colors.text, fontFamily: Fonts.display }}
        >
          Plan a Route
        </Text>
        <Text
          className="text-[12px] mt-1"
          style={{ color: Colors.muted, fontFamily: Fonts.body }}
        >
          Smart crowd-avoiding navigation
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <RouteInputCard from="CLA Building (10)" to="Engineering Bldg 9" />

        <SectionLabel>Suggested Routes</SectionLabel>

        {MOCK_ROUTES.map((route, i) => (
          <RouteOptionCard
            key={route.id}
            route={route}
            selected={selected === i}
            onPress={() => setSelected(i)}
          />
        ))}

        {tip && <CrowdTipCard message={tip} />}

        <Pressable
          className="rounded-xl p-4 items-center flex-row justify-center gap-2 mt-2"
          style={{ backgroundColor: Colors.accent }}
        >
          <Feather name="map" size={16} color={Colors.bg} />
          <Text
            className="text-sm"
            style={{ color: Colors.bg, fontFamily: Fonts.bodySemiBold }}
          >
            Start Navigation
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
