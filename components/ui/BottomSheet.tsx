import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Pressable, View } from 'react-native';
import { Colors } from '../../constants/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const SCREEN_H = Dimensions.get('window').height;

export default function BottomSheet({ visible, onClose, children }: Props) {
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  // Keep modal mounted during the close animation
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_H,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setModalVisible(false));
    }
  }, [visible, translateY]);

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Overlay */}
      <Pressable
        className="flex-1"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        onPress={onClose}
      />

      {/* Sheet */}
      <Animated.View
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl"
        style={{
          backgroundColor: Colors.surface,
          transform: [{ translateY }],
        }}
      >
        {/* Drag handle */}
        <View className="items-center pt-3 pb-1">
          <View
            className="rounded-full"
            style={{ width: 40, height: 4, backgroundColor: Colors.borderMd }}
          />
        </View>

        {children}
      </Animated.View>
    </Modal>
  );
}