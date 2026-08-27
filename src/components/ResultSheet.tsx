import { memo, type ReactElement } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { Button } from "@/design/Button";
import { scoreTone } from "@/design/Feedback";
import { Divider } from "@/design/Layout";
import { Sheet } from "@/design/Sheet";
import { Color, Duration, Radius, Space, Type } from "@/design/tokens";
import { t } from "@/i18n";
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

function DeltaRow({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}): ReactElement {
  return (
    <View style={styles.deltaRow}>
      <Text style={Type.body}>{label}</Text>
      <Text style={[Type.metricSmall, styles.deltaValue]}>
        {value}
        {unit}
      </Text>
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
  return (
    <Sheet visible={visible} onClose={onNext} dismissible={false}>
      <Animated.View
        entering={FadeIn.duration(Duration.base)}
        style={styles.head}
      >
        <Text style={Type.label}>{t("result.kicker")}</Text>
        <Text style={[Type.metricHero, { color: scoreTone(score) }]}>
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
      <DeltaRow label={t("result.hue")} value={delta.h} unit="°" />
      <DeltaRow label={t("result.saturation")} value={delta.s} unit="%" />
      <DeltaRow label={t("result.value")} value={delta.v} unit="%" />

      <Button
        label={nextLabel ?? t("common.next")}
        onPress={onNext}
        style={styles.action}
      />
    </Sheet>
  );
}

export const ResultSheet = memo(ResultSheetBase);

const styles = StyleSheet.create({
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
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Space.xs + 1,
  },
  deltaValue: {
    color: Color.text.primary,
  },
  action: {
    marginTop: Space.xxl,
  },
});
