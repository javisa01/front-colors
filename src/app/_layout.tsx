import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Color } from "@/design/tokens";
import { setMusicVolume, startMusic } from "@/utils/music";
import { setSfxVolume } from "@/utils/sound";
import {
  getMusicVolume as loadMusicVolume,
  getSfxVolume as loadSfxVolume,
} from "@/utils/storage";

/**
 * Layout raíz: deliberadamente SIN Clerk.
 *
 * `ClerkProvider` se monta en `app/online/_layout.tsx`, no aquí, por la misma
 * razón que `SessionProvider`: el modo offline no debe tocar la red ni leer
 * credenciales. Montarlo en la raíz haría que abrir la app para jugar sin
 * conexión arrancase el cliente de Clerk.
 */
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
          {/*
            `translucent` dejó de existir en el StatusBar de Expo 57 y estaba
            provocando un error de TypeScript en `main`. El fondo lo pinta ya el
            contenedor, así que la barra solo necesita declarar que sus iconos
            van en claro.
          */}
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Color.surface.canvas },
              animation: "slide_from_right",
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="offline" />
            <Stack.Screen name="online" />
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
    backgroundColor: Color.surface.canvas,
  },
});
