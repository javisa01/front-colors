import type { ReactElement } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "@/design/Layout";
import { useThemedStyles } from "@/design/theme";
import { Space, Type, type Palette } from "@/design/tokens";
import { useLocale } from "@/i18n";
import { legalDoc, type LegalBlock } from "@/i18n/legal";

/**
 * Privacidad y términos, dentro de la aplicación.
 *
 * ## Un componente y dos rutas
 *
 * Los dos documentos tienen la misma forma —entradilla y apartados con
 * párrafos— así que la pantalla es una sola y recibe cuál pintar. Las rutas sí
 * son dos y estáticas (`/legal/privacidad`, `/legal/terminos`): una ruta
 * dinámica habría dado una dirección con un parámetro en inglés para un texto
 * que se enlaza desde fuera.
 *
 * ## Por qué están aquí y no en el navegador
 *
 * Abrir la web sería más fácil de mantener, pero deja al jugador fuera de la
 * aplicación para leer las condiciones que acaba de aceptar, y sin conexión no
 * las puede leer en absoluto. El texto vive en `i18n/legal.ts`, en los cuatro
 * idiomas, y va en el paquete.
 */
export function LegalDocScreen({ doc }: { doc: "privacy" | "terms" }): ReactElement {
  const styles = useThemedStyles(createStyles);
  const locale = useLocale();
  const contenido = legalDoc(locale, doc);

  return (
    <Screen title={contenido.title} backTo="/" scrollable>
      <Text style={[Type.body, styles.lead]}>{contenido.lead}</Text>

      {contenido.blocks.map((bloque) => (
        <Bloque key={bloque.title} bloque={bloque} />
      ))}
    </Screen>
  );
}

function Bloque({ bloque }: { bloque: LegalBlock }): ReactElement {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.block}>
      <Text style={[Type.bodyStrong, styles.blockTitle]}>{bloque.title}</Text>
      {bloque.paragraphs.map((parrafo, index) => (
        <Text key={index} style={[Type.body, styles.paragraph]}>
          {parrafo}
        </Text>
      ))}
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    lead: {
      marginBottom: Space.xl,
    },
    /*
      Cada apartado con su línea encima, que es lo que da el ritmo de lectura:
      sin ella, veinte párrafos seguidos son un muro y no se distingue dónde
      acaba uno y empieza el siguiente.
    */
    block: {
      marginBottom: Space.xl,
      paddingTop: Space.lg,
      borderTopWidth: 1,
      borderTopColor: c.border.subtle,
    },
    blockTitle: {
      marginBottom: Space.sm,
    },
    paragraph: {
      color: c.text.secondary,
      marginBottom: Space.sm,
    },
  });
