import { Text } from 'react-native';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';

interface Props {
  children: string;
}

export default function SectionLabel({ children }: Props) {
  return (
    <Text
      className="text-[11px] uppercase mb-2.5"
      style={{
        color: Colors.muted,
        fontFamily: Fonts.body,
        letterSpacing: 1.32,
      }}
    >
      {children}
    </Text>
  );
}