import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { setMusicVolume, startMusic } from "@/utils/music";
import { setSfxVolume } from "@/utils/sound";
import {
  getMusicVolume as loadMusicVolume,
  getSfxVolume as loadSfxVolume,
} from "@/utils/storage";

export default function RootLayout() {
  useEffect(() => {
    (async () => {
      const [mv, sv] = await Promise.all([loadMusicVolume(), loadSfxVolume()]);
      setMusicVolume(mv);
      setSfxVolume(sv);
      startMusic();
    })();
  }, []);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <View style={styles.shell}>
          <StatusBar style="light" translucent backgroundColor="#09090B" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#09090B" },
              animation: "slide_from_right",
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="offline" />
            <Stack.Screen name="party-setup" />
            <Stack.Screen name="party" />
            <Stack.Screen name="game" />
          </Stack>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  shell: {
    flex: 1,
    backgroundColor: "#09090B",
  },
});
