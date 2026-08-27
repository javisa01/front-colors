import { memo, useMemo, type ReactElement } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Radius } from "@/design/tokens";
import { hsvToHex } from "@/utils/color";

/**
 * Avatar de jugador: la inicial sobre un fondo derivado del propio nombre.
 *
 * El mismo jugador sale siempre del mismo color sin guardar nada, porque el tono
 * se calcula del nombre. La versión anterior usaba cinco degradados vivos de una
 * lista fija, así que en una lista de amigos había cinco rectángulos saturados
 * compitiendo con el resto de la interfaz y dos jugadores de cada cinco salían
 * idénticos.
 *
 * Aquí el tono es continuo (360 posibilidades, no 5) y va desaturado: identifica
 * sin gritar. El único elemento vivo de la pantalla sigue siendo el color del
 * juego.
 */

interface AvatarProps {
  username: string;
  /** Lado del cuadrado, en puntos. */
  size?: number;
}

/**
 * Hash estable del nombre. Es el clásico multiplicador 31 de Java: barato,
 * determinista y con buen reparto para cadenas cortas.
 */
function hueFor(username: string): number {
  let hash = 0;
  for (let index = 0; index < username.length; index += 1) {
    hash = (hash * 31 + username.charCodeAt(index)) % 360;
  }
  return hash;
}

function AvatarBase({ username, size = 44 }: AvatarProps): ReactElement {
  const palette = useMemo(() => {
    const hue = hueFor(username);
    return {
      // Saturación baja y valor bajo: se apoya en el fondo casi negro en lugar
      // de perforarlo.
      fill: hsvToHex(hue, 26, 22),
      border: hsvToHex(hue, 24, 34),
      text: hsvToHex(hue, 28, 88),
    };
  }, [username]);

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          // El radio crece con el cuadrado para que la curvatura se vea igual
          // en un avatar de 40 y en uno de 62.
          borderRadius: size <= 44 ? Radius.md : Radius.lg,
          backgroundColor: palette.fill,
          borderColor: palette.border,
        },
      ]}
      accessibilityRole="image"
      accessibilityLabel={username}
    >
      <Text
        style={[
          styles.initial,
          { fontSize: size * 0.4, color: palette.text },
        ]}
      >
        {username.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

export const Avatar = memo(AvatarBase);

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  initial: {
    fontWeight: "700",
    letterSpacing: -0.2,
  },
});
