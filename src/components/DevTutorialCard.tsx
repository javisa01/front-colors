import { useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/design/Button";
import { Space, Type } from "@/design/tokens";
import { t } from "@/i18n";
import { setTutorialSeen } from "@/utils/storage";

/**
 * Atajo para volver a ver la bienvenida. **Solo en desarrollo.**
 *
 * El tutorial se enseña una vez y nunca más, así que sin esto probarlo obliga a
 * desinstalar la aplicación entre intento e intento. Con esto son dos toques.
 *
 * **Es temporal**: cuando la bienvenida esté cerrada, este componente se borra
 * y su sitio definitivo son los ajustes —un tutorial que solo existe una vez y
 * no se puede repetir acaba pidiéndose por soporte—. Por eso vive en un fichero
 * propio y no dentro de la portada: quitarlo es borrar dos líneas y este
 * fichero, no desenredarlo de una pantalla.
 *
 * La comprobación de `__DEV__` es lo primero que hace, igual que en
 * `components/online/DevTimePanel`: en una build de producción el árbol entero
 * se queda en `null` y no hay ni un `useState` que se salte la guarda.
 */
export function DevTutorialCard(): ReactElement | null {
  if (!__DEV__) {
    return null;
  }

  return <Card />;
}

function Card(): ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const replay = useCallback(async () => {
    setBusy(true);
    // Se borra la marca y se navega a mano, en vez de dejar que la portada lo
    // note y redirija: así el recorrido es el mismo que la primera vez —entras
    // por la bienvenida— sin depender de en qué orden se repinta la pantalla.
    await setTutorialSeen(false);
    setBusy(false);
    router.push("/welcome");
  }, [router]);

  return (
    <View style={styles.card}>
      <Text style={Type.label}>{t("dev.tutorialTitle")}</Text>
      <Text style={[Type.caption, styles.hint]}>{t("dev.tutorialHint")}</Text>

      <Button
        label={t("dev.tutorialButton")}
        icon="retry"
        variant="secondary"
        size="md"
        loading={busy}
        onPress={() => void replay()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: Space.xxl,
    gap: Space.sm,
  },
  hint: {
    marginBottom: Space.xs,
  },
});
