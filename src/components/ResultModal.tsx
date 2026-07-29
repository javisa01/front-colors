import { LinearGradient } from "expo-linear-gradient";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Modal from "react-native-modal";

import { t } from "@/i18n";
import type { HSVDelta } from "@/utils/colorScore";

interface ResultModalProps {
  isVisible: boolean;
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
  hex,
}: {
  color: string;
  label: string;
  hex: string;
}): React.JSX.Element {
  return (
    <View style={styles.swatchGroup}>
      <Text style={styles.swatchLabel}>{label}</Text>
      <View
        style={[styles.colorSwatch, { backgroundColor: color }]}
        accessibilityRole="image"
        accessibilityLabel={`${label}: ${hex}`}
      />
      {/* Numeric value doubles as color-blind friendly feedback. */}
      <Text style={styles.swatchHex}>{hex}</Text>
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
}): React.JSX.Element {
  return (
    <View style={styles.deltaRow}>
      <Text style={styles.deltaLabel}>{label}</Text>
      <Text style={styles.deltaValue}>
        {value}
        {unit}
      </Text>
    </View>
  );
}

function ResultModal({
  isVisible,
  score,
  message,
  targetColor,
  yourColor,
  delta,
  onNext,
  nextLabel,
}: ResultModalProps): React.JSX.Element {
  return (
    <Modal
      isVisible={isVisible}
      backdropOpacity={0.78}
      animationIn="fadeInUp"
      animationOut="fadeOutDown"
      animationInTiming={220}
      animationOutTiming={180}
      useNativeDriver
      useNativeDriverForBackdrop
      hideModalContentWhileAnimating
      onBackdropPress={() => undefined}
      onBackButtonPress={() => undefined}
      style={styles.modal}
    >
      <View style={styles.backdrop}>
        <LinearGradient
          colors={["#18181B", "#101014", "#09090B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <Text style={styles.kicker}>{t("result.kicker")}</Text>
          <Text style={styles.score}>{score}%</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.compareRow}>
            <Swatch
              color={yourColor}
              label={t("result.yours")}
              hex={yourColor}
            />
            <View style={styles.compareDivider} />
            <Swatch
              color={targetColor}
              label={t("result.target")}
              hex={targetColor}
            />
          </View>

          <View style={styles.deltaSection}>
            <Text style={styles.deltaTitle}>{t("result.deltaTitle")}</Text>
            <DeltaRow label={t("result.hue")} value={delta.h} unit="°" />
            <DeltaRow label={t("result.saturation")} value={delta.s} unit="%" />
            <DeltaRow label={t("result.value")} value={delta.v} unit="%" />
          </View>

          <Pressable
            onPress={onNext}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={nextLabel ?? t("common.next")}
          >
            <LinearGradient
              colors={["#3B82F6", "#2563EB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>
                {nextLabel ?? t("common.next")}
              </Text>
            </LinearGradient>
          </Pressable>
        </LinearGradient>
      </View>
    </Modal>
  );
}

export default memo(ResultModal);

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  backdrop: {
    width: "100%",
    maxWidth: 420,
  },
  card: {
    width: "100%",
    borderRadius: 32,
    paddingVertical: 28,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: "#27272A",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 16,
    },
    elevation: 12,
    alignItems: "center",
  },
  kicker: {
    color: "#A1A1AA",
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
  },
  score: {
    color: "#FFFFFF",
    fontSize: 56,
    lineHeight: 62,
    marginTop: 12,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
  },
  message: {
    color: "#E4E4E7",
    fontSize: 19,
    lineHeight: 26,
    textAlign: "center",
    marginTop: 8,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginTop: 24,
  },
  compareDivider: {
    width: 1,
    height: 74,
    backgroundColor: "#27272A",
    marginHorizontal: 22,
  },
  swatchGroup: {
    alignItems: "center",
  },
  swatchLabel: {
    color: "#A1A1AA",
    fontSize: 13,
    marginBottom: 10,
    fontFamily: "Inter_500Medium",
  },
  colorSwatch: {
    width: 74,
    height: 74,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: "#FFFFFF",
  },
  swatchHex: {
    color: "#E4E4E7",
    fontSize: 13,
    marginTop: 10,
    fontVariant: ["tabular-nums"],
    fontFamily: "Inter_600SemiBold",
  },
  deltaSection: {
    width: "100%",
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#27272A",
  },
  deltaTitle: {
    color: "#A1A1AA",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontWeight: "700",
    marginBottom: 10,
    fontFamily: "Inter_600SemiBold",
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  deltaLabel: {
    color: "#E4E4E7",
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  deltaValue: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    fontFamily: "Inter_700Bold",
  },
  button: {
    width: "100%",
    marginTop: 26,
    borderRadius: 18,
    overflow: "hidden",
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  buttonGradient: {
    width: "100%",
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
  },
});
