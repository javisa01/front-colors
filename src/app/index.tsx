import { LinearGradient } from "expo-linear-gradient";
import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ChallengeNavigation from "@/components/ChallengeNavigation";
import HSVPicker from "@/components/HSVPicker";
import ResultModal from "@/components/ResultModal";
import SVGChallenge from "@/components/SVGChallenge";
import { useChallenge } from "@/hooks/useChallenge";
import { normalizeHex } from "@/utils/color";
import { calculateColorScore, getScoreMessage } from "@/utils/colorScore";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function App(): ReactElement {
  const { width, height } = useWindowDimensions();

  const {
    currentChallenge,
    currentIndex,
    totalChallenges,
    selectedColor,
    selectedHSV,
    setSelectedColor,
    setSelectedHSV,
    nextChallenge,
    restartGame,
  } = useChallenge();

  const [resultVisible, setResultVisible] = useState(false);
  const [score, setScore] = useState(0);
  const [resultMessage, setResultMessage] = useState("");
  const [targetColorHex, setTargetColorHex] = useState("#FFFFFF");
  const [animationToken, setAnimationToken] = useState(0);
  const [gameFinished, setGameFinished] = useState(false);

  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isTablet = width >= 768;
  const isCompactHeight = height < 760;

  const targetColor =
    currentChallenge?.colors?.[currentChallenge.editableColorIndex ?? 0];

  const challengeSize = useMemo(() => {
    const shortestSide = Math.min(width, height);
    const base = isTablet
      ? shortestSide * 0.38
      : isCompactHeight
        ? shortestSide * 0.46
        : shortestSide * 0.5;

    return clamp(base, isTablet ? 220 : 168, isTablet ? 340 : 260);
  }, [height, isCompactHeight, isTablet, width]);

  const pickerCardHeight = useMemo(() => {
    const shortestSide = Math.min(width, height);
    const base = isTablet
      ? shortestSide * 0.34
      : isCompactHeight
        ? shortestSide * 0.42
        : shortestSide * 0.46;

    return clamp(base, isTablet ? 260 : 220, isTablet ? 360 : 300);
  }, [height, isCompactHeight, isTablet, width]);

  const pickerThumbSize = useMemo(() => {
    const base = Math.min(width, height) * (isCompactHeight ? 0.038 : 0.045);
    return clamp(base, 16, 24);
  }, [height, isCompactHeight, width]);

  const sliderThumbSize = useMemo(() => {
    return clamp(pickerThumbSize * 0.9, 14, 22);
  }, [pickerThumbSize]);

  const allowScroll = !isTablet;

  useEffect(() => {
    return () => {
      if (checkTimerRef.current) {
        clearTimeout(checkTimerRef.current);
      }
    };
  }, []);

  const handleColorChange = useCallback(
    (color: string, hsv: typeof selectedHSV): void => {
      setSelectedColor(normalizeHex(color));
      setSelectedHSV(hsv);
    },
    [setSelectedColor, setSelectedHSV],
  );

  const handleCheck = useCallback((): void => {
    if (!targetColor) {
      return;
    }

    const nextScore = calculateColorScore(selectedHSV, targetColor.hsv);

    setScore(nextScore);
    setResultMessage(getScoreMessage(nextScore));
    setTargetColorHex(targetColor.hex);
    setAnimationToken((value) => value + 1);

    setResultVisible(false);

    if (checkTimerRef.current) {
      clearTimeout(checkTimerRef.current);
    }

    checkTimerRef.current = setTimeout(() => {
      setResultVisible(true);
    }, 220);
  }, [selectedHSV, targetColor]);

  const handleNext = useCallback((): void => {
    setResultVisible(false);

    const hasNext = nextChallenge();

    if (!hasNext) {
      setGameFinished(true);
    }
  }, [nextChallenge]);

  const handleRestart = useCallback((): void => {
    setGameFinished(false);
    setResultVisible(false);
    setScore(0);
    setResultMessage("");
    setTargetColorHex("#FFFFFF");

    if (checkTimerRef.current) {
      clearTimeout(checkTimerRef.current);
      checkTimerRef.current = null;
    }

    restartGame();
  }, [restartGame]);

  if (currentChallenge == null && !gameFinished) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient
          colors={["#09090B", "#0A0A0D", "#09090B"]}
          style={styles.loadingContainer}
        >
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Cargando juego...</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#09090B", "#0A0A0D", "#09090B"]}
        style={styles.background}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          scrollEnabled={allowScroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.shell}>
            <View style={styles.header}>
              <Text style={styles.kicker}>Color Quest</Text>
              <Text style={styles.title}>Adivina el color</Text>
              <Text style={styles.subtitle}>
                Ajusta el selector hasta que el resultado se vea igual que el
                reto.
              </Text>
            </View>

            {gameFinished ? (
              <View style={styles.finishedCard}>
                <Text style={styles.finishedEmoji}>🏁</Text>
                <Text style={styles.finishedTitle}>Juego completado</Text>
                <Text style={styles.finishedSubtitle}>
                  Has superado todos los retos disponibles.
                </Text>

                <Pressable
                  onPress={handleRestart}
                  style={({ pressed }) => [
                    styles.restartButton,
                    pressed && styles.buttonPressed,
                  ]}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Volver a jugar"
                >
                  <LinearGradient
                    colors={["#3B82F6", "#2563EB"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.buttonGradient}
                  >
                    <Text style={styles.buttonText}>Jugar otra vez</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            ) : currentChallenge != null ? (
              <View
                style={[
                  styles.content,
                  isTablet ? styles.contentTablet : styles.contentPhone,
                ]}
              >
                <View
                  style={[
                    styles.primaryColumn,
                    isTablet
                      ? styles.primaryColumnTablet
                      : styles.primaryColumnPhone,
                  ]}
                >
                  <ChallengeNavigation
                    currentIndex={currentIndex}
                    total={totalChallenges}
                  />

                  <View style={styles.challengeCard}>
                    <SVGChallenge
                      challenge={currentChallenge}
                      editableColor={selectedColor}
                      size={challengeSize}
                      animationToken={animationToken}
                    />
                  </View>
                </View>

                <View
                  style={[
                    styles.secondaryColumn,
                    isTablet
                      ? styles.secondaryColumnTablet
                      : styles.secondaryColumnPhone,
                  ]}
                >
                  <HSVPicker
                    color={selectedColor}
                    onColorChange={handleColorChange}
                    thumbSize={pickerThumbSize}
                    sliderSize={sliderThumbSize}
                    pickerHeight={pickerCardHeight}
                  />

                  <Pressable
                    onPress={handleCheck}
                    style={({ pressed }) => [
                      styles.checkButton,
                      pressed && styles.buttonPressed,
                    ]}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Comprobar color"
                    disabled={!targetColor}
                  >
                    <LinearGradient
                      colors={["#3B82F6", "#2563EB"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.buttonGradient}
                    >
                      <Text style={styles.buttonText}>Comprobar</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No hay retos disponibles.</Text>
                <Text style={styles.emptySubtitle}>
                  Revisa el catálogo generado o los metadatos de los retos.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <ResultModal
          isVisible={resultVisible}
          score={score}
          message={resultMessage}
          targetColor={targetColorHex}
          onNext={handleNext}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#09090B",
  },
  background: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  shell: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 1060,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 14,
    color: "#A1A1AA",
    fontSize: 15,
    fontFamily: "System",
  },
  header: {
    marginBottom: 14,
  },
  kicker: {
    color: "#A1A1AA",
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontFamily: "System",
    fontWeight: "700",
    marginBottom: 6,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    fontFamily: "System",
  },
  subtitle: {
    marginTop: 8,
    color: "#A1A1AA",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "System",
    maxWidth: 620,
  },
  content: {
    flex: 1,
  },
  contentPhone: {
    justifyContent: "space-between",
  },
  contentTablet: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  primaryColumn: {
    flex: 1,
  },
  primaryColumnPhone: {
    marginBottom: 14,
  },
  primaryColumnTablet: {
    flex: 1.08,
    paddingRight: 12,
  },
  secondaryColumn: {
    flex: 1,
  },
  secondaryColumnPhone: {
    justifyContent: "space-between",
  },
  secondaryColumnTablet: {
    flex: 0.92,
    justifyContent: "space-between",
    paddingLeft: 12,
  },
  challengeCard: {
    flex: 1,
    borderRadius: 30,
    padding: 12,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 14,
    },
    elevation: 8,
  },
  checkButton: {
    marginTop: 14,
    borderRadius: 18,
    overflow: "hidden",
  },
  restartButton: {
    marginTop: 22,
    borderRadius: 18,
    overflow: "hidden",
    width: "100%",
  },
  buttonGradient: {
    minHeight: 54,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    fontFamily: "System",
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  finishedCard: {
    flex: 1,
    borderRadius: 32,
    padding: 24,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    justifyContent: "center",
    alignItems: "center",
  },
  finishedEmoji: {
    fontSize: 44,
    marginBottom: 12,
  },
  finishedTitle: {
    color: "#FFFFFF",
    fontSize: 30,
    fontFamily: "System",
    fontWeight: "800",
    textAlign: "center",
  },
  finishedSubtitle: {
    marginTop: 10,
    color: "#A1A1AA",
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "System",
    textAlign: "center",
    maxWidth: 460,
  },
  emptyCard: {
    flex: 1,
    borderRadius: 32,
    padding: 24,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontFamily: "System",
    fontWeight: "800",
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: 10,
    color: "#A1A1AA",
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "System",
    textAlign: "center",
  },
});
