import { LinearGradient } from "expo-linear-gradient";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Modal from "react-native-modal";

interface ResultModalProps {
  isVisible: boolean;
  score: number;
  message: string;
  targetColor: string;
  onNext: () => void;
}

function ResultModal({
  isVisible,
  score,
  message,
  targetColor,
  onNext,
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
          <Text style={styles.kicker}>Resultado</Text>
          <Text style={styles.score}>{score}%</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.targetSection}>
            <Text style={styles.targetLabel}>Color correcto</Text>
            <View
              style={[styles.colorSwatch, { backgroundColor: targetColor }]}
              accessibilityLabel="Color correcto"
              accessibilityRole="image"
            />
          </View>

          <Pressable
            onPress={onNext}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Siguiente reto"
          >
            <LinearGradient
              colors={["#3B82F6", "#2563EB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Siguiente</Text>
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
  targetSection: {
    width: "100%",
    marginTop: 24,
    alignItems: "center",
  },
  targetLabel: {
    color: "#A1A1AA",
    fontSize: 13,
    marginBottom: 12,
    fontFamily: "Inter_500Medium",
  },
  colorSwatch: {
    width: 74,
    height: 74,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: "#FFFFFF",
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
