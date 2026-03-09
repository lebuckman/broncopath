import { ScrollView, Pressable, Text } from 'react-native';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';

interface Props {
  options: string[];       // options[0] is treated as the "All" / clear option
  active: string[];        // empty = "All" selected; otherwise specific selections
  onChange: (val: string[]) => void;
}

export default function ChipFilter({ options, active, onChange }: Props) {
  function handlePress(option: string) {
    if (option === options[0]) {
      onChange([]);
    } else if (active.includes(option)) {
      onChange(active.filter(o => o !== option)); // deselect; empty → "All"
    } else {
      onChange([...active, option]);
    }
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, gap: 8 }}
    >
      {options.map((option, i) => {
        const isActive = i === 0 ? active.length === 0 : active.includes(option);
        return (
          <Pressable
            key={option}
            onPress={() => handlePress(option)}
            className="px-4 py-2 border rounded-full"
            style={{
              backgroundColor: isActive ? Colors.accentBg : Colors.card,
              borderColor: isActive ? Colors.accentBorder : Colors.border,
            }}
          >
            <Text
              className="text-[12px]"
              style={{
                color: isActive ? Colors.accent : Colors.muted,
                fontFamily: Fonts.bodySemiBold,
              }}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}