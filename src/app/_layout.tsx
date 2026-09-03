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
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  darkPalette,
  lightPalette,
  setThemeMode,
  ThemeProvider,
  useThemeMode,
} from "@/design/theme";
import { setLocale, useLocale } from "@/i18n";
import { setMusicVolume, startMusic } from "@/utils/music";
import { setSfxVolume } from "@/utils/sound";
import {
  getLanguage as loadLanguage,
  getMusicVolume as loadMusicVolume,
  getSfxVolume as loadSfxVolume,
  getThemeMode as loadThemeMode,
  loadLanding,
  loadTutorialSeen,
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

  const locale = useLocale();
  const themeMode = useThemeMode();

  /**
   * El idioma guardado se aplica ANTES del primer pintado, no después.
   *
   * `@/i18n` arranca con el idioma del teléfono, que es el correcto mientras
   * nadie haya elegido otro; la preferencia, en cambio, vive en el
   * almacenamiento y se lee de forma asíncrona. Pintar sin esperarla daría un
   * primer fotograma en el idioma del dispositivo que acto seguido se sustituye
   * por el elegido: un parpadeo de texto en la portada, cada arranque, para
   * todo el que haya cambiado de idioma.
   *
   * La espera es gratis en la práctica: una lectura de `AsyncStorage` es más
   * rápida que registrar cinco tipografías, así que esto ya ha terminado cuando
   * `useFonts` da el visto bueno.
   */
  const [localeReady, setLocaleReady] = useState(false);

  /**
   * La marca del tutorial se lee AQUÍ, con el idioma, y no en la portada.
   *
   * La portada tiene que decidir en su primer render si se aparta para dejar
   * paso a la bienvenida, y `AsyncStorage` es asíncrono: leerla allí
   * enseñaría la portada un instante antes de taparla. Es el mismo parpadeo
   * que el splash ya está evitando con las tipografías.
   *
   * Se guarda en el módulo de almacenamiento, no en un estado: quien la
   * necesita es una pantalla que aún no existe cuando esto resuelve.
   */
  const [tutorialReady, setTutorialReady] = useState(false);

  useEffect(() => {
    (async () => {
      /*
        El tema viaja con el idioma y por la misma razón: los dos se aplican
        ANTES del primer pintado o hay un fotograma en oscuro que acto seguido
        se vuelve claro. Comparten espera porque comparten destino —la `key`
        del navegador— y porque las dos son lecturas de disco que ya terminan
        antes que las tipografías.
      */
      const [storedLocale, storedTheme] = await Promise.all([
        loadLanguage(),
        loadThemeMode(),
      ]);
      if (storedLocale) {
        setLocale(storedLocale);
      }
      if (storedTheme) {
        setThemeMode(storedTheme);
      }
      setLocaleReady(true);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      /*
        La pista de portada viaja con la marca del tutorial, y no por
        comodidad: la portada elige entre tres pantallas distintas —rueda
        encendida, apagada con grupo que crear, o apagada sin cuenta— y tiene
        que hacerlo en su primer render. Leerla desde la pantalla enseñaría el
        estado de invitado un instante a quien lleva doce jornadas seguidas.

        Las dos van en la misma espera porque las dos son lecturas de disco de
        la misma pantalla, y ninguna de las dos puede llegar tarde.
      */
      await Promise.all([loadTutorialSeen(), loadLanding()]);
      setTutorialReady(true);
    })();
  }, []);

  useEffect(() => {
    /*
      Se destapa también si la carga FALLÓ. Quedarse con el splash puesto
      porque no se pudo leer un .ttf sería cambiar un problema tipográfico por
      una app que no arranca: sin fuentes, se ve con la del sistema y se juega
      igual.
    */
    if ((fontsLoaded || fontError) && localeReady && tutorialReady) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError, localeReady, tutorialReady]);

  useEffect(() => {
    (async () => {
      const [mv, sv] = await Promise.all([loadMusicVolume(), loadSfxVolume()]);
      setMusicVolume(mv);
      setSfxVolume(sv);
      startMusic();
    })();
  }, []);

  // Ni un render con la fuente equivocada —ni con el idioma equivocado—:
  // mientras tanto el splash sigue cubriendo la pantalla, así que aquí no hay
  // nada que enseñar.
  if ((!fontsLoaded && !fontError) || !localeReady || !tutorialReady) {
    return null;
  }

  /*
    La paleta, a mano y no por `useColors`: este componente RENDERIZA el
    proveedor, así que está fuera de su contexto. El modo sí es observable desde
    aquí porque vive en el almacén de módulo, no en el proveedor.
  */
  const palette = themeMode === "dark" ? darkPalette : lightPalette;

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
          <View
            style={[styles.shell, { backgroundColor: palette.surface.canvas }]}
          >
            {/*
              `translucent` dejó de existir en el StatusBar de Expo 57 y estaba
              provocando un error de TypeScript en `main`. El fondo lo pinta ya el
              contenedor, así que la barra solo necesita declarar que sus iconos
              van en claro.
            */}
            {/*
              Los iconos de la barra, a contraluz del tema: claros sobre el
              lienzo oscuro, oscuros sobre el papel claro.
            */}
            <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
            {/*
              La `key` con el idioma es lo que hace efectivo un cambio de idioma
              en lo que ya está en pantalla.

              `t()` es una función de módulo: devuelve la cadena del idioma
              activo en el momento de llamarla, y no avisa a nadie cuando ese
              idioma cambia. Repintar solo este layout tampoco bastaría —el
              navegador envuelve cada pantalla en un `StaticContainer`, que
              existe justamente para NO repintarlas cuando su padre lo hace—,
              así que las pantallas ya montadas se quedarían en el idioma
              anterior hasta que algo las tocara.

              Cambiar la `key` las vuelve a montar todas de una vez, con lo que
              cada `t()` se vuelve a evaluar. La ruta actual no se pierde: el
              estado de navegación lo guarda el contenedor, que está por encima
              de este layout y no se remonta. Lo que sí se pierde es el estado
              local de las pantallas, y por eso el ajuste de idioma solo está
              donde no hay partida en curso — menús y portada, nunca `game`.

              El precio se paga una vez, y solo cuando alguien cambia de idioma
              a propósito.

              El TEMA va en la misma `key` y por el mismo mecanismo. Dos cosas
              del tema no se arreglan con un re-render: la tinta de `Type`, que
              se reescribe en caliente sobre los mismos objetos (ver
              `applyTypeColors` en `design/theme.tsx`), y cualquier hoja de
              estilos que quede sin migrar a `useThemedStyles`. Remontar deja
              cada pantalla recién pintada con la paleta nueva, y pasa tan a
              menudo como alguien cambia de tema: casi nunca.
            */}
            <Stack
              key={`${locale}:${themeMode}`}
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: palette.surface.canvas },
                animation: "slide_from_right",
              }}
            >
              <Stack.Screen name="index" />
              {/*
                La bienvenida entra fundiendo y no deslizando: no se llega a
                ella desde ningún sitio, es lo primero que hay.
              */}
              <Stack.Screen name="welcome" options={{ animation: "fade" }} />
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
  // El fondo no está aquí: lo pone la paleta activa en el render, porque este
  // objeto se evalúa una vez y se quedaría con el del arranque.
  shell: {
    flex: 1,
  },
});
