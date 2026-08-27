import { useRouter } from "expo-router";
import type { ReactElement } from "react";
import { StyleSheet, Text, View } from "react-native";

import { SettingsButton } from "@/components/SettingsButton";
import { AmbientOrbs } from "@/design/Ambient";
import { OptionRow, Screen } from "@/design/Layout";
import { Space, Type } from "@/design/tokens";
import { t } from "@/i18n";

/**
 * Portada: elegir entre jugar sin conexión o en línea.
 *
 * Es la única pantalla con fondo animado. Aquí el adorno se gana el sitio
 * porque no hay nada que hacer todavía —dos opciones y punto—, y porque es lo
 * primero que se ve al abrir la app. En cuanto empieza el juego desaparece: un
 * fondo que respira detrás de una rueda de color sería ruido compitiendo con lo
 * único que el jugador tiene que mirar.
 */
export default function LandingScreen(): ReactElement {
  const router = useRouter();

  return (
    <Screen
      eyebrow={t("landing.badge")}
      title={t("landing.title")}
      subtitle={t("landing.subtitle")}
      backdrop={<AmbientOrbs />}
      headerAction={<SettingsButton />}
      contentStyle={styles.content}
    >
      <View style={styles.options}>
        <OptionRow
          icon="wifiOff"
          tone="teal"
          title={t("landing.offline.title")}
          description={t("landing.offline.description")}
          onPress={() => router.push("/offline")}
          enterDelay={40}
        />

        <OptionRow
          icon="globe"
          tone="blue"
          title={t("landing.online.title")}
          description={t("landing.online.description")}
          note={t("landing.online.locked")}
          onPress={() => router.push("/online")}
          enterDelay={100}
        />
      </View>

      {/*
        La nota del pie se queda quieta: es texto para leer, y un texto que se
        mueve mientras lo lees molesta más de lo que aporta el adorno. El fondo
        ya se encarga de que la portada no parezca congelada.
      */}
      <Text style={[Type.caption, styles.footer]}>{t("landing.footer")}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    // La portada tiene poco contenido, así que se centra verticalmente en lugar
    // de quedar pegada arriba con un hueco muerto debajo.
    justifyContent: "center",
  },
  options: {
    gap: Space.md,
  },
  footer: {
    marginTop: Space.xxl,
    textAlign: "center",
  },
});
