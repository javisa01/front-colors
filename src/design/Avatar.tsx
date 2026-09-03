import { memo, useMemo, type ReactElement } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  getThemeMode,
  useColors,
  useThemedStyles,
  type ThemeMode,
} from "@/design/theme";
import {
  Radius,
  type Palette,
} from "@/design/tokens";
import { hsvToHex } from "@/utils/color";

/**
 * Avatar de jugador: sus iniciales sobre un fondo derivado del propio nombre.
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
  /**
   * `squircle` es el avatar de siempre, el de las listas y las filas.
   *
   * `round` existe para **un solo sitio**: la roseta de miembros de los ajustes
   * del grupo, donde los avatares se solapan en fila. Un círculo se solapa sin
   * que se vean cantos cortados, y ahí es la forma la que dice «esto no es una
   * lista, es el grupo entero de un vistazo».
   */
  shape?: "squircle" | "round";
  /**
   * Cuántas letras del nombre. Dos identifican mejor cuando no hay nombre al
   * lado que las desambigüe —el caso de la roseta—; una basta cuando el avatar
   * acompaña al nombre escrito.
   */
  letters?: 1 | 2;
  /** Aro claro alrededor. Es lo que marca «este eres tú» en la roseta. */
  ring?: boolean;
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

export interface PlayerTint {
  fill: string;
  border: string;
  text: string;
}

/**
 * El color de un jugador, para pintar algo suyo que no sea su avatar.
 *
 * El modo por defecto es el activo, leído del almacén: vale para todos los
 * usos actuales porque el cambio de tema remonta la app entera y con ella
 * cualquier cosa que hubiera calculado un tinte. Solo haría falta pasarlo a
 * mano desde algo que sobreviviera al remontado, y no hay nada así.
 *
 * Lo usa la clasificación del grupo para teñir cada fila con el tono de quien
 * la ocupa. Se exporta —en vez de recalcularlo allí— porque el compromiso es
 * que un jugador tenga **un** color en toda la app: si la fila y el avatar
 * salieran de dos fórmulas distintas, dejarían de identificar a la misma
 * persona.
 */
export function playerTint(username: string, mode: ThemeMode = getThemeMode()): PlayerTint {
  const hue = hueFor(username);
  if (mode === "light") {
    // La misma inversión de papel que la paleta clara hace con `groupTint`:
    // lavado muy claro, borde un paso por debajo y la tinta bajada hasta
    // contrastar. El TONO no cambia: la persona sigue siendo la misma en los
    // dos temas.
    return {
      fill: hsvToHex(hue, 14, 95),
      border: hsvToHex(hue, 18, 84),
      text: hsvToHex(hue, 46, 46),
    };
  }
  return {
    // Saturación baja y valor bajo: se apoya en el fondo casi negro en lugar
    // de perforarlo.
    fill: hsvToHex(hue, 26, 22),
    border: hsvToHex(hue, 24, 34),
    text: hsvToHex(hue, 28, 88),
  };
}

/** Las iniciales tal y como se pintan: «Javier» → «JA». */
export function initialsOf(username: string, letters: 1 | 2 = 1): string {
  return username.slice(0, letters).toUpperCase();
}

function AvatarBase({
  username,
  size = 44,
  shape = "squircle",
  letters = 1,
  ring = false,
}: AvatarProps): ReactElement {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const palette = useMemo(() => playerTint(username), [username]);

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          // El radio crece con el cuadrado para que la curvatura se vea igual
          // en un avatar de 40 y en uno de 62.
          borderRadius:
            shape === "round"
              ? Radius.pill
              : size <= 44
                ? Radius.md
                : Radius.lg,
          backgroundColor: palette.fill,
          // El aro va en el claro del texto y no en el tono del jugador: tiene
          // que decir «este» dentro de una fila donde todos llevan color.
          borderColor: ring ? colors.text.primary : palette.border,
          borderWidth: ring ? 2 : 1,
        },
      ]}
      accessibilityRole="image"
      accessibilityLabel={username}
    >
      <Text
        style={[
          styles.initial,
          {
            // Dos letras necesitan encoger para caber en el mismo círculo.
            fontSize: size * (letters === 2 ? 0.32 : 0.4),
            color: palette.text,
          },
        ]}
      >
        {initialsOf(username, letters)}
      </Text>
    </View>
  );
}

export const Avatar = memo(AvatarBase);

const createStyles = (c: Palette) =>
  StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  });
