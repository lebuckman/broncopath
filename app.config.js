module.exports = {
  expo: {
    name: "broncopath",
    slug: "broncopath",
    scheme: "broncopath",
    newArchEnabled: false,
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0d1117",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.anonymous.broncopath",
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "BroncoPath uses your location to show where you are on campus and guide you along walking routes.",
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
      package: "com.anonymous.broncopath",
      permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: ["expo-router", "@maplibre/maplibre-react-native"],
  },
};
