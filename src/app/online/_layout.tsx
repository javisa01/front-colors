import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack, useRouter, useSegments } from "expo-router";
import type { ReactElement, ReactNode } from "react";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { ErrorBanner, Loading } from "@/design/Feedback";
import { Screen } from "@/design/Layout";
import { Color } from "@/design/tokens";
import { t } from "@/i18n";
import { CLERK_PUBLISHABLE_KEY } from "@/online/clerk";
import { SessionProvider, useSession } from "@/online/session";

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
        <SessionGate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Color.surface.canvas },
              animation: "slide_from_right",
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="friends" />
            <Stack.Screen name="leaderboard" />
            {/* Grupos. La carpeta no lleva `_layout` propio: sus pantallas
                viven en esta misma pila, así que el gesto de volver funciona
                igual que en el resto del árbol online. */}
            <Stack.Screen name="groups/index" />
            <Stack.Screen name="groups/[id]" />
            {/* El reto diario es GLOBAL (5.3): cuelga de `/online` y no de un
                grupo, porque se juega igual sin tener ninguno. */}
            <Stack.Screen name="daily/index" />
            <Stack.Screen name="daily/play" />
          </Stack>
        </SessionGate>
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

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: Color.surface.canvas,
  },
});
