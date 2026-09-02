import { memo, type ReactElement, type ReactNode } from "react";
import Svg, { ClipPath, Defs, G, Path, Rect } from "react-native-svg";

import type { Locale } from "@/i18n";

/**
 * Banderas de los idiomas, dibujadas y no escritas.
 *
 * La tentación era usar los emojis 🇪🇸 🇬🇧 🇫🇷, que son una línea de código. No
 * sirven por dos razones, y la segunda es la que decide:
 *
 *  1. Los pinta el sistema, así que se ven distintos en cada teléfono y no
 *     encajan con el resto de la iconografía —el mismo motivo por el que el set
 *     de `Icon` sustituyó a los 46 emojis que había antes—. En Android, además,
 *     muchas ROM no traen las banderas y salen dos letras en un recuadro.
 *
 *  2. **El catalán no tiene emoji.** La senyera solo existe como secuencia de
 *     etiquetas de subdivisión (ES-CT), que Unicode admite pero prácticamente
 *     ninguna fuente dibuja: donde debería ir la bandera sale un rectángulo
 *     vacío. Un selector de idiomas en el que tres opciones llevan bandera y la
 *     cuarta lleva un hueco no es un selector terminado.
 *
 * Todas se dibujan en la misma caja de 30×20 (3:2) para que la columna quede
 * alineada. La Union Jack es 2:1 de verdad y aquí va comprimida a 3:2, que es lo
 * que hacen todos los sets de iconos de banderas; a 22 puntos no se aprecia.
 * También se le omite el contracambio de las diagonales —el desplazamiento que
 * hace que el rojo no esté centrado sobre el blanco—: es un detalle de dos
 * píxeles a este tamaño y cuesta el triple de geometría.
 *
 * El borde no es decoración: sin él, la banda blanca de Francia se derrama sobre
 * cualquier fondo claro y la bandera pierde el lado derecho. Es negro con poca
 * opacidad para que sobre la paleta oscura no se vea y sobre la clara sí.
 */

interface FlagProps {
  locale: Locale;
  /** Alto del dibujo; el ancho sale de la proporción 3:2. */
  size?: number;
}

const WIDTH = 30;
const HEIGHT = 20;

const FLAGS: Record<Locale, () => ReactNode> = {
  // Rojo, gualda, rojo en proporción 1:2:1. Sin escudo: a este tamaño sería una
  // mancha, y las banderas civiles españolas tampoco lo llevan.
  es: () => (
    <>
      <Rect width={WIDTH} height={HEIGHT} fill="#FFC400" />
      <Rect width={WIDTH} height={5} fill="#C60B1E" />
      <Rect y={15} width={WIDTH} height={5} fill="#C60B1E" />
    </>
  ),

  // Union Jack. El orden importa: fondo, aspa blanca, aspa roja, cruz blanca,
  // cruz roja. Cada capa tapa a la anterior, que es como está construida la
  // bandera de verdad.
  en: () => (
    <>
      <Rect width={WIDTH} height={HEIGHT} fill="#012169" />
      <Path
        d={`M0 0 L${WIDTH} ${HEIGHT} M${WIDTH} 0 L0 ${HEIGHT}`}
        stroke="#FFFFFF"
        strokeWidth={5}
      />
      <Path
        d={`M0 0 L${WIDTH} ${HEIGHT} M${WIDTH} 0 L0 ${HEIGHT}`}
        stroke="#C8102E"
        strokeWidth={2}
      />
      <Rect x={11.5} width={7} height={HEIGHT} fill="#FFFFFF" />
      <Rect y={6.5} width={WIDTH} height={7} fill="#FFFFFF" />
      <Rect x={13} width={4} height={HEIGHT} fill="#C8102E" />
      <Rect y={8} width={WIDTH} height={4} fill="#C8102E" />
    </>
  ),

  fr: () => (
    <>
      <Rect width={10} height={HEIGHT} fill="#0055A4" />
      <Rect x={10} width={10} height={HEIGHT} fill="#FFFFFF" />
      <Rect x={20} width={10} height={HEIGHT} fill="#EF4135" />
    </>
  ),

  // Senyera: nueve franjas iguales, cuatro rojas. Las alturas salen de dividir
  // 20 entre 9, así que se escriben ya calculadas para no repetir la división en
  // cada franja.
  ca: () => (
    <>
      <Rect width={WIDTH} height={HEIGHT} fill="#FCDD09" />
      {[1, 3, 5, 7].map((index) => (
        <Rect
          key={index}
          y={(index * HEIGHT) / 9}
          width={WIDTH}
          height={HEIGHT / 9}
          fill="#DA121A"
        />
      ))}
    </>
  ),
};

function FlagBase({ locale, size = 16 }: FlagProps): ReactElement {
  /*
    Un id por idioma y no uno fijo: las cuatro banderas conviven en pantalla en
    el selector de ajustes, y en Android las definiciones de `<Defs>` se han
    resuelto historicamente por nombre mas alla del `<Svg>` que las declara. Con
    el id repetido, las cuatro acabarian recortando con la primera.
  */
  const clipId = `flag-${locale}`;

  return (
    <Svg
      width={(size * WIDTH) / HEIGHT}
      height={size}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    >
      <Defs>
        {/*
          Recorta el aspa de la Union Jack, que se dibuja de esquina a esquina
          con un trazo grueso y se saldría del rectángulo por las cuatro puntas.
          Vale para todas las banderas, así que se aplica siempre.
        */}
        <ClipPath id={clipId}>
          <Rect width={WIDTH} height={HEIGHT} rx={3} />
        </ClipPath>
      </Defs>

      <G clipPath={`url(#${clipId})`}>{FLAGS[locale]()}</G>

      <Rect
        x={0.5}
        y={0.5}
        width={WIDTH - 1}
        height={HEIGHT - 1}
        rx={2.5}
        fill="none"
        stroke="rgba(0,0,0,0.25)"
        strokeWidth={1}
      />
    </Svg>
  );
}

export const Flag = memo(FlagBase);
