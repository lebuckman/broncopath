import { useRef, useState, useEffect } from "react";
import { ActivityIndicator, Text, Animated } from "react-native";
import { Colors } from "../constants/colors";
import { Fonts } from "../constants/fonts";
import { getBuildingsCached, getRoomsCached } from "../lib/dataCache";

const FUNNY_LINES = [
  "Calculating optimal coffee run routes...",
  "Fighting demons with Billy Bronco...",
  "Scouting study spots before you do...",
  "Bribing buildings to share their secrets...",
  "Consulting the ancient campus spirits...",
];

function buildLoop(): string[] {
  const shuffled = [...FUNNY_LINES].sort(() => Math.random() - 0.5);
  return [
    shuffled[0],
    "Loading buildings...",
    shuffled[1],
    shuffled[2],
    "Loading rooms...",
    shuffled[3],
    shuffled[4],
  ];
}

interface Props {
  onComplete: () => void;
}

export default function LoadingScreen({ onComplete }: Props) {
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const loop = useRef(buildLoop()).current;
  const [msg, setMsg] = useState(loop[0]);

  useEffect(() => {
    // Cycle the 4 loop messages at 800ms each until data is ready
    let i = 0;
    const timer = setInterval(() => {
      i = (i + 1) % loop.length;
      setMsg(loop[i]);
    }, 1400);

    const fetchPromise = (async () => {
      try {
        const buildings = await getBuildingsCached();
        await Promise.all(buildings.map((b) => getRoomsCached(b.id)));
      } catch {
        // cache stays empty; hooks fall back to their own fetch/polling
      }
    })();

    Promise.all([
      fetchPromise,
      new Promise<void>((r) => setTimeout(r, 2000)),
    ]).then(() => {
      clearInterval(timer);
      setMsg("Ready!");
      setTimeout(() => {
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => onComplete());
      }, 600);
    });

    return () => clearInterval(timer);
  }, []);

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: Colors.bg,
        alignItems: "center",
        justifyContent: "center",
        opacity: opacityAnim,
      }}
    >
      <Text style={{ fontSize: 56, marginBottom: 12 }}>🐴</Text>
      <Text
        style={{
          fontFamily: Fonts.display,
          fontSize: 36,
          color: Colors.accent,
          marginBottom: 6,
        }}
      >
        BroncoPath
      </Text>
      <Text
        style={{
          fontFamily: Fonts.body,
          fontSize: 14,
          color: Colors.muted,
          fontStyle: "italic",
          marginBottom: 40,
        }}
      >
        Know your campus.
      </Text>

      <ActivityIndicator size="large" color={Colors.accent} />

      <Text
        style={{
          fontFamily: Fonts.mono,
          fontSize: 10,
          color: Colors.muted,
          marginTop: 35,
        }}
      >
        {msg}
      </Text>
    </Animated.View>
  );
}
