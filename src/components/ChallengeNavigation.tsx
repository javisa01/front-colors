import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ProgressBar } from "@/design/Feedback";
import { Space, Type } from "@/design/tokens";
import { t } from "@/i18n";

interface ChallengeNavigationProps {
  currentIndex: number;
  total: number;
}

/**
 * Progreso dentro de una partida.
 *
 * Llevaba el español escrito a fuego («Progreso», «Reto X de Y») pese a que las
 * claves `progress.label` y `progress.counter` ya existían en los tres idiomas:
 * en inglés y francés la app mostraba estas dos cadenas en castellano. Ahora
 * pasan por `t()` como el resto.
 */
function ChallengeNavigation({
  currentIndex,
  total,
}: ChallengeNavigationProps): React.JSX.Element {
  const safeTotal = Math.max(0, total);
  const current = Math.min(currentIndex + 1, safeTotal || 1);
  const progress = safeTotal > 0 ? current / safeTotal : 0;

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: safeTotal, now: current }}
    >
      <View style={styles.row}>
        <Text style={Type.label}>{t("progress.label")}</Text>
        <Text style={Type.metricSmall}>
          {t("progress.counter", { current, total: safeTotal })}
        </Text>
      </View>

      <ProgressBar value={progress} />
    </View>
  );
}

export default memo(ChallengeNavigation);

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Space.sm,
  },
});
