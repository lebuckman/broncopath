import { useState, useEffect } from "react";
import { Text } from "react-native";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";

interface Props {
  freesAt: string; // e.g. "10:00 AM"
}

function parseTargetMs(freesAt: string): number | null {
  const m = freesAt.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let hours = parseInt(m[1]!, 10);
  const minutes = parseInt(m[2]!, 10);
  const period = m[3]!.toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);
  return target.getTime();
}

function formatRemaining(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs >= 3600) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export default function CountdownTimer({ freesAt }: Props) {
  const [remaining, setRemaining] = useState<number | null>(() => {
    const target = parseTargetMs(freesAt);
    if (!target) return null;
    const diff = target - Date.now();
    return diff > 0 ? diff : null;
  });

  useEffect(() => {
    const target = parseTargetMs(freesAt);
    if (!target) return;

    const id = setInterval(() => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setRemaining(null);
        clearInterval(id);
      } else {
        setRemaining(diff);
      }
    }, 1000);

    return () => clearInterval(id);
  }, [freesAt]);

  if (!remaining) return null;

  return (
    <Text style={{ fontSize: 11, color: Colors.muted, fontFamily: Fonts.mono }}>
      {formatRemaining(remaining)}
    </Text>
  );
}
