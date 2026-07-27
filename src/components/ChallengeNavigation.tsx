import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

interface ChallengeNavigationProps {
  currentIndex: number;
  total: number;
}

function ChallengeNavigation({
  currentIndex,
  total,
}: ChallengeNavigationProps): React.JSX.Element {
  const safeTotal = Math.max(0, total);
  const progress = safeTotal > 0 ? (currentIndex + 1) / safeTotal : 0;

  return (
    <View style={styles.container} accessible accessibilityRole="progressbar">
      <View style={styles.row}>
        <Text style={styles.label}>Progreso</Text>
        <Text style={styles.counter}>
          Reto {Math.min(currentIndex + 1, safeTotal || 1)} de {safeTotal}
        </Text>
      </View>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${Math.max(0, Math.min(1, progress)) * 100}%` },
          ]}
        />
      </View>
    </View>
  );
}

export default memo(ChallengeNavigation);

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: {
    color: "#A1A1AA",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
  },
  counter: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  track: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    backgroundColor: "#27272A",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#3B82F6",
  },
});
