import { memo, type ReactElement, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Color } from "@/design/tokens";

/**
 * El anillo de rondas: un segmento por imagen del reto, alrededor del logo.
 *
 * ## Qué dice
 *
 * Una sola cosa: **cuántas rondas tiene el reto y cómo fue cada una**. Sin
 * jugar son cinco arcos vacíos —la forma de la tarea, aún por hacer—. Jugado,
 * cada arco se pinta con el color objetivo de su ronda y su longitud es lo que
 * acertaste, así que un vistazo basta para ver en cuál te fuiste lejos.
 *
 * Eso lo hace el reverso exacto de una barra de progreso: no mide cuánto llevas
 * hecho, mide **con qué precisión**. Y como el relleno son los colores reales
 * del día, el anillo es el sitio donde el color del juego entra en el menú.
 *
 * ## Lo que deliberadamente NO dice
 *
 * No lleva la cuenta atrás. Un anillo que mezclase tiempo restante y aciertos
 * tendría dos significados en el mismo trazo y no se podría leer ninguno: el
 * tiempo va en el centro, en texto, y cambia a la puntuación cuando ya no queda
 * nada que jugar. Un elemento, un significado.
 *
 * ## La geometría
 *
 * Cinco sectores de 72°, de los que se dibujan 66 y se dejan 6 de hueco. El
 * hueco es lo que hace que se lean como cinco cosas y no como un aro partido.
 * `strokeDasharray` toma la longitud en unidades de circunferencia, así que
 * todo se deriva de `2πr` y no hay ninguna constante mágica.
 */

export interface SolvedRound {
  /** Color objetivo de la ronda. Es el que se pinta. */
  hex: string;
  /** Precisión 0-100. Recorta el arco. */
  accuracy: number;
}

interface RoundRingProps {
  /** Diámetro exterior del anillo. */
  size: number;
  /** Cuántas rondas tiene el reto. */
  rounds: number;
  /**
   * Resultado de cada ronda, en orden. `null` mientras no se haya jugado: el
   * anillo se queda vacío, que es lo que significa.
   */
  solved?: readonly SolvedRound[] | null;
  /** Grosor del trazo. */
  stroke?: number;
  /** Lo que va dentro del anillo: el logo, o la cifra. */
  children?: ReactNode;
}

/** Hueco entre sectores, en grados. */
const GAP_DEG = 6;

/**
 * Margen interior entre el anillo y su contenido.
 *
 * El logo tiene que respirar dentro del aro: pegado al trazo, los dos se leen
 * como un mismo dibujo. Es proporcional para que valga a cualquier tamaño.
 */
const INSET_RATIO = 0.21;

function RoundRingBase({
  size,
  rounds,
  solved = null,
  stroke = 12,
  children,
}: RoundRingProps): ReactElement {
  // El radio se mide al centro del trazo, no al borde exterior: si no, medio
  // grosor se sale del `viewBox` y los arcos salen cortados.
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const sectorDeg = 360 / rounds;
  const drawnDeg = sectorDeg - GAP_DEG;
  const sectorLength = (circumference * drawnDeg) / 360;

  const inset = size * INSET_RATIO;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {Array.from({ length: rounds }, (_, index) => {
          // -90° pone el primer sector arriba; medio hueco lo centra.
          const rotation = -90 + index * sectorDeg + GAP_DEG / 2;

          return (
            <Circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={Color.border.subtle}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${sectorLength} ${circumference}`}
              transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
            />
          );
        })}

        {/* El relleno va en una segunda pasada, encima de todas las pistas: si
            se dibujara cada par junto, el trazo vacío del sector siguiente
            taparía el extremo del relleno del anterior. */}
        {solved
          ? Array.from({ length: rounds }, (_, index) => {
              const result = solved[index];
              if (!result) {
                return null;
              }

              const rotation = -90 + index * sectorDeg + GAP_DEG / 2;
              const filled =
                (sectorLength * Math.max(0, Math.min(100, result.accuracy))) /
                100;

              return (
                <Circle
                  key={`fill-${index}`}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={result.hex}
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={`${filled} ${circumference}`}
                  transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
                />
              );
            })
          : null}
      </Svg>

      {children != null ? (
        <View style={[styles.center, { padding: inset }]} pointerEvents="none">
          {children}
        </View>
      ) : null}
    </View>
  );
}

export const RoundRing = memo(RoundRingBase);

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
});
