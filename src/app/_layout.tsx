/*
  Importado peso a peso, por su subruta, y NO desde la raíz del paquete.

  No es cosmético: el `index.js` de la raíz hace un `require()` de **todos** los
  .ttf de la familia, y un `require` es un efecto que Metro no puede eliminar
  por muy poco que se use lo que devuelve. Importando desde la raíz, la app se
  llevaba las 18 variantes de Inter y las 5 de Space Grotesk —23 ficheros, unos
  7 MB— para usar cinco. Con la subruta, cada `index.js` solo requiere su
  propio fichero y entran exactamente los cinco que hay escritos aquí.
*/
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { SpaceGrotesk_600SemiBold } from "@expo-google-fonts/space-grotesk/600SemiBold";
import { SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk/700Bold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemeProvider } from "@/design/theme";
import { Color } from "@/design/tokens";
import { setMusicVolume, startMusic } from "@/utils/music";
import { setSfxVolume } from "@/utils/sound";
import {
  getMusicVolume as loadMusicVolume,
  getSfxVolume as loadSfxVolume,
} from "@/utils/storage";

/**
 * El splash se queda en pantalla hasta que las fuentes estén cargadas.
 *
 * `useFonts` devuelve `false` en el primer render y `true` cuando los .ttf ya
 * están registrados. Sin retener el splash, ese primer render se pinta con la
 * fuente del sistema y se ve saltar toda la maquetación un instante después
 * —las métricas de Space Grotesk no son las de San Francisco ni las de Roboto,
 * así que no es un cambio de forma: es un cambio de tamaño—.
 *
 * Va fuera del componente porque solo debe ejecutarse una vez, al cargar el
 * módulo. El `catch` es deliberado: si el splash ya se ocultó —recarga en
 * caliente, por ejemplo— esto rechaza, y no es motivo para tumbar la app.
 */
void SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Layout raíz: deliberadamente SIN Clerk.
 *
 * `ClerkProvider` se monta en `app/online/_layout.tsx`, no aquí, por la misma
 * razón que `SessionProvider`: el modo offline no debe tocar la red ni leer
 * credenciales. Montarlo en la raíz haría que abrir la app para jugar sin
 * conexión arrancase el cliente de Clerk.
 */
export default function RootLayout() {
  /*
    Cinco cortes, no diez: dos de Space Grotesk para titulares y cifras, tres de
    Inter para el texto. Cada uno son unos 85 KB y Metro solo empaqueta los que
    se importan aquí, así que la lista de arriba es literalmente la factura.

    Las CLAVES de este objeto son los nombres con los que luego se pide la
    fuente en `Type` (`design/tokens.ts`). Si se renombra una aquí, allí deja de
    resolver y React Native cae a la del sistema sin avisar.
  */
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    /*
      Se destapa también si la carga FALLÓ. Quedarse con el splash puesto
      porque no se pudo leer un .ttf sería cambiar un problema tipográfico por
      una app que no arranca: sin fuentes, se ve con la del sistema y se juega
      igual.
    */
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    (async () => {
      const [mv, sv] = await Promise.all([loadMusicVolume(), loadSfxVolume()]);
      setMusicVolume(mv);
      setSfxVolume(sv);
      startMusic();
    })();
  }, []);

  // Ni un render con la fuente equivocada: mientras tanto el splash sigue
  // cubriendo la pantalla, así que aquí no hay nada que enseñar.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    /*
      El proveedor de tema envuelve toda la app desde el primer dia, aunque
      todavia no haya interruptor: asi, el dia que se anada, no hay que mover el
      arbol de componentes — solo pasarle el modo guardado por `mode` y llamar a
      `setMode` desde los ajustes. Ver `design/theme.tsx`.

      Por defecto reparte la paleta oscura, que es la unica que la app usaba
      hasta ahora, asi que montarlo no cambia nada de lo que se ve.
    */
    <ThemeProvider>
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
    </ThemeProvider>
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
