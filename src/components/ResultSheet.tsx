import { LinearGradient } from "expo-linear-gradient";
import { memo, type ReactElement } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { Button } from "@/design/Button";
import { scoreTone } from "@/design/Feedback";
import { Divider } from "@/design/Layout";
import { Sheet } from "@/design/Sheet";
import { useColors, useThemedStyles } from "@/design/theme";
import {
  Duration,
  Radius,
  Space,
  Type,
  type Palette,
} from "@/design/tokens";
import { t } from "@/i18n";
import { hexToHSV, hsvToHex } from "@/utils/color";
import type { HSVDelta } from "@/utils/colorScore";

/**
 * Resultado de un intento.
 *
 * Sustituye a `ResultModal`. Cambios de fondo: el panel ya no lleva degradado de
 * fondo, la cifra usa el color semántico que corresponde al acierto —el único
 * color de la app que se gana el derecho a ser vivo— y el botón es el `Button`
 * primario compartido en lugar de un `Pressable` con degradado azul propio.
 *
 * No se puede descartar tocando fuera: es información que el jugador necesita
 * antes de seguir, y un cierre accidental le costaría el paso.
 */

interface ResultSheetProps {
  visible: boolean;
  score: number;
  message: string;
  targetColor: string;
  yourColor: string;
  delta: HSVDelta;
  onNext: () => void;
  nextLabel?: string;
}

function Swatch({
  color,
  label,
}: {
  color: string;
  label: string;
}): ReactElement {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.swatchGroup}>
      <Text style={Type.label}>{label}</Text>
      <View
        style={[styles.swatch, { backgroundColor: color }]}
        accessibilityRole="image"
        accessibilityLabel={`${label}: ${color}`}
      />
      {/* El valor numérico es feedback no dependiente del color: hace el
          resultado legible para quien no distingue los dos tonos. */}
      <Text style={Type.metricSmall}>{color}</Text>
    </View>
  );
}

/** Lo que mide el disco que marca tu respuesta. */
const DOT = 14;

/**
 * Los seis tonos del círculo, de rojo a rojo. Es la escala del tono y no
 * depende del reto, así que se calcula una vez.
 */
const HUE_STOPS: readonly [string, string, ...string[]] = [
  hsvToHex(0, 100, 100),
  hsvToHex(60, 100, 100),
  hsvToHex(120, 100, 100),
  hsvToHex(180, 100, 100),
  hsvToHex(240, 100, 100),
  hsvToHex(300, 100, 100),
  hsvToHex(360, 100, 100),
];

/**
 * Un eje del color, con su escala y las dos marcas.
 *
 * ## Por qué una escala y no un número a secas
 *
 * «Tono 12°» es exacto y no dice nada: doce grados de tono es mucho en los
 * verdes y casi nada en los rojos, y el jugador no tiene forma de saberlo. La
 * escala pone el número en su sitio —el recorrido entero del eje— y la
 * distancia entre las dos marcas se lee sin leer nada.
 *
 * Las tres escalas son las tres preguntas del juego, y se pintan con lo que
 * cada una mide: el tono con el círculo entero, y la saturación y el brillo
 * **teñidos con el color del reto**, porque el recorrido de esos dos ejes
 * depende del color que se estaba buscando. Por eso el resultado sale de otro
 * color en cada partida en vez de ser siempre la misma tabla.
 *
 * ## Las dos marcas
 *
 * La línea es dónde había que llegar; el disco, con tu color dentro, es dónde
 * te quedaste. El disco va después en el orden de pintado, así que en un
 * acierto perfecto lo tapa: no se ven dos marcas peleándose por el mismo
 * punto, se ve una sola, que es exactamente lo que ha pasado.
 */
function DeltaScale({
  label,
  value,
  unit,
  stops,
  targetAt,
  yourAt,
  yourColor,
}: {
  label: string;
  value: number;
  unit: string;
  stops: readonly [string, string, ...string[]];
  /** Posición del objetivo en el eje, de 0 a 1. */
  targetAt: number;
  /** Posición de tu respuesta en el eje, de 0 a 1. */
  yourAt: number;
  yourColor: string;
}): ReactElement {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.axis}>
      <View style={styles.axisHead}>
        <Text style={Type.body}>{label}</Text>
        <Text style={[Type.metricSmall, styles.deltaValue]}>
          {value}
          {unit}
        </Text>
      </View>

      {/*
        La escala no se anuncia: el número de arriba ya dice lo mismo y con
        más precisión, así que repetirla en voz alta sería decir dos veces lo
        mismo con peores palabras.
      */}
      <View style={styles.scale} importantForAccessibility="no-hide-descendants">
        <View style={styles.scaleFill}>
          <LinearGradient
            colors={stops}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
        {/*
          Las marcas viven en un carril más estrecho que la barra, metido
          media marca por cada lado. Sin eso, un eje clavado al máximo —una
          saturación del 100 %, que es la mitad de los logos— dejaba el disco
          colgando medio fuera del extremo.
        */}
        <View style={styles.marks}>
          <View style={[styles.tick, { left: `${targetAt * 100}%` }]} />
          <View
            style={[
              styles.dot,
              { left: `${yourAt * 100}%`, backgroundColor: yourColor },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

function ResultSheetBase({
  visible,
  score,
  message,
  targetColor,
  yourColor,
  delta,
  onNext,
  nextLabel,
}: ResultSheetProps): ReactElement {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();

  /*
    Las dos respuestas en coordenadas del color, que es lo que colocan las
    marcas en cada escala. Vienen en hexadecimal porque es lo que pinta las
    muestras de arriba, y aquí hacen falta separadas por ejes.
  */
  const target = hexToHSV(targetColor);
  const mine = hexToHSV(yourColor);

  /*
    Las dos escalas que dependen del reto. La saturación va del gris al color
    a pleno, y el brillo del negro al color: cada una recorre su eje dejando
    los otros dos como estaban en el objetivo, que es lo que hace que la
    posición de la marca signifique algo.
  */
  const satStops: readonly [string, string] = [
    hsvToHex(target.h, 0, target.v),
    hsvToHex(target.h, 100, target.v),
  ];
  const valStops: readonly [string, string] = [
    hsvToHex(target.h, target.s, 0),
    hsvToHex(target.h, target.s, 100),
  ];

  return (
    <Sheet visible={visible} onClose={onNext} dismissible={false}>
      <Animated.View
        entering={FadeIn.duration(Duration.base)}
        style={styles.head}
      >
        <Text style={Type.label}>{t("result.kicker")}</Text>
        <Text style={[Type.metricHero, { color: scoreTone(colors, score) }]}>
          {score}%
        </Text>
        <Text style={[Type.bodyStrong, styles.message]}>{message}</Text>
      </Animated.View>

      <View style={styles.compareRow}>
        <Swatch color={yourColor} label={t("result.yours")} />
        <Swatch color={targetColor} label={t("result.target")} />
      </View>

      <Divider style={styles.divider} />

      <Text style={[Type.label, styles.deltaTitle]}>
        {t("result.deltaTitle")}
      </Text>
      <DeltaScale
        label={t("result.hue")}
        value={delta.h}
        unit="°"
        stops={HUE_STOPS}
        targetAt={target.h / 360}
        yourAt={mine.h / 360}
        yourColor={yourColor}
      />
      <DeltaScale
        label={t("result.saturation")}
        value={delta.s}
        unit="%"
        stops={satStops}
        targetAt={target.s / 100}
        yourAt={mine.s / 100}
        yourColor={yourColor}
      />
      <DeltaScale
        label={t("result.value")}
        value={delta.v}
        unit="%"
        stops={valStops}
        targetAt={target.v / 100}
        yourAt={mine.v / 100}
        yourColor={yourColor}
      />

      <Button
        label={nextLabel ?? t("common.next")}
        onPress={onNext}
        style={styles.action}
      />
    </Sheet>
  );
}

export const ResultSheet = memo(ResultSheetBase);

const createStyles = (c: Palette) =>
  StyleSheet.create({
  head: {
    alignItems: "center",
  },
  message: {
    marginTop: Space.xs,
    textAlign: "center",
  },
  compareRow: {
    flexDirection: "row",
    marginTop: Space.xxl,
    gap: Space.lg,
  },
  swatchGroup: {
    flex: 1,
    alignItems: "center",
    gap: Space.sm,
  },
  swatch: {
    width: "100%",
    height: 56,
    borderRadius: Radius.md,
    borderWidth: 1,
    // Un aro claro y translúcido, no un borde blanco de 4px: sobre un color
    // claro el borde blanco desaparecía y la muestra parecía flotar.
    borderColor: "rgba(255,255,255,0.16)",
  },
  divider: {
    marginVertical: Space.xl,
  },
  deltaTitle: {
    marginBottom: Space.sm,
  },
  axis: {
    marginBottom: Space.lg,
  },
  axisHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Space.sm,
  },
  /**
   * La caja de la escala. Es más alta que la barra a propósito: la marca del
   * objetivo la cruza de lado a lado y asoma por arriba y por abajo, y ese
   * trozo que asoma —sobre el fondo de la hoja, no sobre el degradado— es lo
   * que la hace visible caiga donde caiga.
   */
  scale: {
    height: 22,
    justifyContent: "center",
  },
  /** La barra. Recorta el degradado; las marcas van fuera para no recortarse. */
  scaleFill: {
    height: 10,
    borderRadius: Radius.sm,
    overflow: "hidden",
  },
  /** El carril de las marcas. Ver la nota de arriba. */
  marks: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: DOT / 2,
    right: DOT / 2,
  },
  tick: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: c.text.primary,
  },
  dot: {
    position: "absolute",
    width: DOT,
    height: DOT,
    top: 4,
    marginLeft: -DOT / 2,
    borderRadius: DOT / 2,
    // Del color de la hoja, no del tema: es lo que separa el disco del
    // degradado que tiene justo debajo, que a veces es su mismo color.
    borderWidth: 2,
    borderColor: c.surface.elevated,
  },
  deltaValue: {
    color: c.text.primary,
  },
  action: {
    marginTop: Space.xxl,
  },
  });
