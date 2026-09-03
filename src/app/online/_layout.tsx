import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Tabs, useRouter, useSegments } from "expo-router";
import type { ReactElement, ReactNode } from "react";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { OnlineTabBar } from "@/components/online/OnlineTabBar";
import { OnlineTour, OnlineTourProvider } from "@/components/online/OnlineTour";
import { ErrorBanner, Loading } from "@/design/Feedback";
import { Screen } from "@/design/Layout";
import { useColors, useThemedStyles } from "@/design/theme";
import {
  type Palette,
} from "@/design/tokens";
import { t } from "@/i18n";
import { CLERK_PUBLISHABLE_KEY } from "@/online/clerk";
import { PushBridge } from "@/online/pushBridge";
import { SessionProvider, useSession } from "@/online/session";
import { SocialProvider } from "@/online/social";

/**
 * Frontera entre el modo offline y el online.
 *
 * `ClerkProvider` y `SessionProvider` se montan AQUÍ y no en el layout raíz, y
 * esa es la clave de que los dos modos sean independientes: mientras el jugador
 * esté en la parte offline no existe cliente HTTP, no se leen credenciales y no
 * se toca la red. Solo al entrar en `/online` aparece la sesión.
 *
 * El `tokenCache` guarda el JWT de cliente en `expo-secure-store` (Keychain en
 * iOS, EncryptedSharedPreferences en Android): sin él la sesión se perdería al
 * cerrar la app.
 */
export default function OnlineLayout(): ReactElement {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  if (!CLERK_PUBLISHABLE_KEY) {
    // Sin clave no hay online, pero el resto del juego debe seguir abriendo:
    // por eso se avisa aquí en vez de reventar al importar el módulo.
    return (
      <Screen
        eyebrow={t("online.auth.badge")}
        title={t("online.auth.title")}
        backTo="/"
      >
        <ErrorBanner message={t("online.auth.unavailable")} />
      </Screen>
    );
  }

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <SessionProvider>
        {/*
          El contador de solicitudes de amistad vive aquí porque lo pinta la
          barra de pestañas, que está siempre montada y no es de ninguna
          pantalla. Va dentro de `SessionProvider` porque necesita el cliente
          autenticado, y por fuera de la guarda para existir ya cuando la
          barra se monte. No sondea: ver `online/social`.
        */}
        <SocialProvider>
          <SessionGate>
            {/*
              El recorrido de la primera vez envuelve al navegador y se pinta
              POR ENCIMA de él, no dentro de ninguna pantalla. Es lo que le
              permite ir cambiando de pestaña mientras explica la barra sin
              desmontarse en el primer toque. Ver `components/online/OnlineTour`.

              El provider solo guarda un registro de anclajes y un interruptor
              —su valor de contexto no cambia nunca—, así que envolver aquí no
              repinta las pestañas.
            */}
            <OnlineTourProvider>
              <View style={styles.stage}>
                {/*
                  Pestañas, no pila.

                  Los cuatro destinos permanentes —hoy, grupos, ranking,
                  perfil— eran filas dentro del menú principal, y por eso el
                  menú no podía ser un menú: la mitad de su alto la ocupaba un
                  índice de la cuenta. Aquí pasan a ser una barra, y la pantalla
                  de inicio se queda con un solo trabajo, que es decir qué hay
                  que jugar hoy.

                  `href: null` saca una ruta de la barra pero la deja navegable
                  con `router.push`. La barra además se esconde sola en esas
                  pantallas —lo decide `OnlineTabBar`—, porque son sitios a los
                  que se entra y de los que se vuelve, no destinos: jugar el
                  reto con una barra de pestañas debajo es invitar a abandonar
                  la partida a media ronda.
                */}
                <Tabs
                  tabBar={(props) => <OnlineTabBar {...props} />}
                  screenOptions={{
                    headerShown: false,
                    sceneStyle: { backgroundColor: colors.surface.canvas },
                  }}
                >
                  <Tabs.Screen name="index" />
                  {/* Grupos. La carpeta no lleva `_layout` propio: la lista es
                      pestaña y la ficha de un grupo es una pantalla profunda. */}
                  <Tabs.Screen name="groups/index" />
                  <Tabs.Screen name="leaderboard" />
                  <Tabs.Screen name="profile" />

                  {/* --- Profundas: navegables, pero fuera de la barra --- */}
                  <Tabs.Screen name="auth" options={{ href: null }} />
                  <Tabs.Screen name="friends" options={{ href: null }} />
                  <Tabs.Screen name="groups/[id]/index" options={{ href: null }} />
                  <Tabs.Screen name="groups/[id]/edit" options={{ href: null }} />
                  <Tabs.Screen name="groups/[id]/chat" options={{ href: null }} />
                  {/* `daily/index` ya no es una pantalla: solo redirige a la
                      ficha del grupo, que es donde se juega desde ella. Sigue
                      declarada para que los enlaces guardados encuentren la
                      redirección. */}
                  <Tabs.Screen name="daily/index" options={{ href: null }} />
                  <Tabs.Screen name="daily/play" options={{ href: null }} />
                </Tabs>

                {/*
                  Después de `<Tabs>` y dentro del mismo padre: el orden del
                  árbol es lo que pone la capa del recorrido por encima de la
                  barra flotante. Mientras no corre no pinta nada.
                */}
                <OnlineTour />

                {/*
                  Los avisos del teléfono. No pinta nada: da de alta el
                  dispositivo y, cuando alguien toca un aviso, abre el grupo del
                  que iba. Va aquí dentro porque necesita las dos cosas que solo
                  hay en este árbol —el cliente autenticado y el navegador— y
                  porque tiene que seguir escuchando en cualquier pestaña.
                */}
                <PushBridge />
              </View>
            </OnlineTourProvider>
          </SessionGate>
        </SocialProvider>
      </SessionProvider>
    </ClerkProvider>
  );
}

/**
 * Guarda de acceso: sin sesión solo se puede estar en `/online/auth`, y con
 * sesión esa pantalla deja de tener sentido. Se resuelve con `replace` para
 * que el botón «atrás» no devuelva al usuario a un sitio donde no puede estar.
 */
function SessionGate({ children }: { children: ReactNode }): ReactElement {
  const styles = useThemedStyles(createStyles);
  const { status } = useSession();
  const segments = useSegments();
  const router = useRouter();

  const onAuthScreen = segments[segments.length - 1] === "auth";

  /**
   * El jugador está donde no le toca y hay una redirección en camino.
   *
   * `router.replace` vive en un efecto, así que se ejecuta DESPUÉS de pintar.
   * Sin esta comprobación, la pantalla protegida llega a montarse un frame y su
   * `useFocusEffect` dispara peticiones autenticadas sin sesión: tres 401, sus
   * tres reintentos, y un `signOut` de propina.
   */
  const misplaced =
    (status === "signedOut" && !onAuthScreen) ||
    (status === "signedIn" && onAuthScreen);

  useEffect(() => {
    if (status === "loading") {
      return;
    }
    if (status === "signedOut" && !onAuthScreen) {
      router.replace("/online/auth");
      return;
    }
    if (status === "signedIn" && onAuthScreen) {
      router.replace("/online");
    }
  }, [status, onAuthScreen, router]);

  // Mientras Clerk restaura la sesión —o mientras se resuelve la redirección—
  // no se pinta nada del árbol online: así no se ve un parpadeo de la pantalla
  // de login a quien ya tiene sesión, ni salen peticiones a destiempo.
  if (status === "loading" || misplaced) {
    return (
      <View style={styles.splash}>
        <Loading label={t("online.session.restoring")} />
      </View>
    );
  }

  return <>{children}</>;
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  /**
   * El escenario del modo online: las pestañas y, encima, el recorrido.
   *
   * Existe solo para dar un padre común a los dos. `<Tabs>` por sí solo llena
   * la pantalla, pero una capa absoluta necesita algo a lo que referirse, y ese
   * algo tiene que contener también al navegador o la capa no lo taparía.
   */
  stage: {
    flex: 1,
  },
  splash: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: c.surface.canvas,
  },
  });
