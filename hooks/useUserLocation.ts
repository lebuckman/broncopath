import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import * as MLRN from "@maplibre/maplibre-react-native";

export type LngLat = [number, number];

export function useUserLocation(minDisplacementMeters = 3) {
  const [lngLat, setLngLat] = useState<LngLat | null>(null);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(
    null,
  );
  const [isLocating, setIsLocating] = useState(false);

  const listenerRef = useRef<((location: any) => void) | null>(null);

  useEffect(() => {
    let mounted = true;

    function consumeLocation(location: any) {
      const coords = location?.coords ?? location?.nativeEvent?.coords;
      const lat = coords?.latitude;
      const lng = coords?.longitude;

      if (typeof lat === "number" && typeof lng === "number") {
        setLngLat([lng, lat]);
        setAccuracyMeters(
          typeof coords.accuracy === "number" ? coords.accuracy : null,
        );
        setIsLocating(false);
      }
    }

    async function start() {
      setIsLocating(true);

      console.log("Requesting Expo location permission...");
      const permission = await Location.requestForegroundPermissionsAsync();
      console.log("Expo location permission:", permission.status);

      if (!mounted) return;

      const granted = permission.status === "granted";
      setPermissionGranted(granted);

      if (!granted) {
        setIsLocating(false);
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (!mounted) return;
      consumeLocation(current);

      MLRN.LocationManager.setMinDisplacement(minDisplacementMeters);

      const listener = (location: any) => {
        consumeLocation(location);
      };

      listenerRef.current = listener;
      MLRN.LocationManager.addListener(listener);
      MLRN.LocationManager.start();
    }

    start().catch((error) => {
      console.log("Location startup failed:", error);
      if (!mounted) return;
      setPermissionGranted(false);
      setIsLocating(false);
    });

    return () => {
      mounted = false;

      if (listenerRef.current) {
        MLRN.LocationManager.removeListener(listenerRef.current);
      }

      MLRN.LocationManager.stop();
    };
  }, [minDisplacementMeters]);

  return {
    lngLat,
    accuracyMeters,
    permissionGranted,
    isLocating,
  };
}