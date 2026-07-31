import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
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
import { t, type TranslationKey } from "@/i18n";
import type { GameMode } from "@/types/challenge";
import { normalizeHex } from "@/utils/color";
import {
  calculateColorScore,
  getHSVDelta,
  getRunMessage,
  getScoreMessage,
  summarizeRun,
  type HSVDelta,
} from "@/utils/colorScore";
import { feedbackForScore } from "@/utils/haptics";
import {
  clearProgress,
  getDailyResult,
  loadProgress,
  saveProgress,
  setDailyResult,
  submitBestStreak,
  submitHighScore,
  type DailyResult,
  type SavedProgress,
} from "@/utils/storage";

const VALID_MODES: GameMode[] = ["quick", "timed", "daily", "multicolor"];
const TIMED_SECONDS = 45;
const STREAK_THRESHOLD = 70;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeMode(value: string | string[] | undefined): GameMode {
  const raw = Array.isArray(value) ? value[0] : value;
  return VALID_MODES.includes(raw as GameMode) ? (raw as GameMode) : "quick";
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dailySeed(): number {
  return Number.parseInt(todayKey().replace(/-/g, ""), 10);
}

function starString(stars: number): string {
  return "★★★".slice(0, stars) + "☆☆☆".slice(0, 3 - stars);
}

function LoadingScreen(): ReactElement {
  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#09090B", "#0A0A0D", "#09090B"]}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>{t("common.loading")}</Text>
      </LinearGradient>
    </SafeAreaView>
  );
}

function DailyDoneScreen({ result }: { result: DailyResult }): ReactElement {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#09090B", "#0A0A0D", "#09090B"]}
        style={styles.background}
      >
        <View style={styles.shell}>
          <View style={styles.finishedCard}>
            <Text style={styles.finishedEmoji}>📅</Text>
            <Text style={styles.finishedTitle}>{t("daily.done.title")}</Text>
            <Text style={styles.finishedSubtitle}>
              {t("daily.done.subtitle")}
            </Text>
            <Text style={styles.bestLine}>
              {t("daily.score", { score: result.score })}
            </Text>

            <Pressable
              onPress={() => router.replace("/offline")}
              style={({ pressed }) => [
                styles.restartButton,
                pressed && styles.buttonPressed,
              ]}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t("summary.home")}
            >
              <LinearGradient
                colors={["#3B82F6", "#2563EB"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>{t("summary.home")}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

export default function GameScreen(): ReactElement {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = normalizeMode(params.mode);
  const seed = mode === "daily" ? dailySeed() : undefined;

  const [ready, setReady] = useState(false);
  const [resume, setResume] = useState<SavedProgress | null>(null);
  const [dailyDone, setDailyDone] = useState<DailyResult | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      if (mode === "daily") {
        const daily = await getDailyResult();
        if (active && daily?.dateKey === todayKey()) {
          setDailyDone(daily);
          setReady(true);
          return;
        }
      }

      const saved = await loadProgress();
      if (active) {
        setResume(saved && saved.mode === mode ? saved : null);
        setReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [mode]);

  if (!ready) {
    return <LoadingScreen />;
  }

  if (dailyDone) {
    return <DailyDoneScreen result={dailyDone} />;
  }

  return <GamePlay mode={mode} seed={seed} resume={resume} />;
}

interface GamePlayProps {
  mode: GameMode;
  seed?: number;
  resume: SavedProgress | null;
}

function GamePlay({ mode, seed, resume }: GamePlayProps): ReactElement {
  const { width, height } = useWindowDimensions();
  const router = useRouter();

  const {
    currentStep,
    currentStepIndex,
    totalSteps,
    challengeIds,
    selectedColor,
    selectedHSV,
    setSelectedColor,
    setSelectedHSV,
    nextStep,
  } = useChallenge({ mode, seed, resume });

  const [scores, setScores] = useState<number[]>(resume?.scores ?? []);
  const [resultVisible, setResultVisible] = useState(false);
  const [score, setScore] = useState(0);
  const [resultMessage, setResultMessage] = useState("");
  const [targetColorHex, setTargetColorHex] = useState("#FFFFFF");
  const [yourColorHex, setYourColorHex] = useState("#FFFFFF");
  const [delta, setDelta] = useState<HSVDelta>({ h: 0, s: 0, v: 0 });
  const [animationToken, setAnimationToken] = useState(0);
  const [gameFinished, setGameFinished] = useState(false);
  const [isRecord, setIsRecord] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreakValue, setBestStreakValue] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMED_SECONDS);

  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoresRef = useRef(scores);
  const maxStreakRef = useRef(0);
  const finishedRef = useRef(false);

  const isTablet = width >= 768;
  const isCompactHeight = height < 760;
  const isTimed = mode === "timed";
  const isDaily = mode === "daily";

  const targetColor = currentStep?.target;

  useEffect(() => {
    scoresRef.current = scores;
  }, [scores]);

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

  const summary = useMemo(() => summarizeRun(scores), [scores]);

  useEffect(() => {
    return () => {
      if (checkTimerRef.current) {
        clearTimeout(checkTimerRef.current);
      }
    };
  }, []);

  const finalizeGame = useCallback(async (): Promise<void> => {
    if (finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    setGameFinished(true);

    const runSummary = summarizeRun(scoresRef.current);
    const record = await submitHighScore(mode, runSummary.total);
    setIsRecord(record.isRecord);
    setBestScore(record.best);

    if (mode === "timed") {
      const streakRecord = await submitBestStreak(
        "timed",
        maxStreakRef.current,
      );
      setBestStreakValue(streakRecord.best);
    }

    if (mode === "daily") {
      await setDailyResult({ dateKey: todayKey(), score: runSummary.average });
    }

    await clearProgress();
  }, [mode]);

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
    const nextScores = [...scoresRef.current, nextScore];
    scoresRef.current = nextScores;
    setScores(nextScores);

    setScore(nextScore);
    setResultMessage(getScoreMessage(nextScore));
    setTargetColorHex(targetColor.hex);
    setYourColorHex(selectedColor);
    setDelta(getHSVDelta(selectedHSV, targetColor.hsv));
    setAnimationToken((value) => value + 1);
    feedbackForScore(nextScore);

    if (isTimed) {
      setStreak((prev) => {
        const updated = nextScore >= STREAK_THRESHOLD ? prev + 1 : 0;
        maxStreakRef.current = Math.max(maxStreakRef.current, updated);
        return updated;
      });
    }

    // Persist progress so the run can be resumed after leaving the app.
    void saveProgress({
      mode,
      challengeIds,
      stepIndex: Math.min(currentStepIndex + 1, Math.max(totalSteps - 1, 0)),
      scores: nextScores,
      savedAt: Date.now(),
    });

    setResultVisible(false);

    if (checkTimerRef.current) {
      clearTimeout(checkTimerRef.current);
    }

    checkTimerRef.current = setTimeout(() => {
      setResultVisible(true);
    }, 220);
  }, [
    targetColor,
    selectedHSV,
    selectedColor,
    isTimed,
    mode,
    challengeIds,
    currentStepIndex,
    totalSteps,
  ]);

  const handleNext = useCallback((): void => {
    setResultVisible(false);

    const hasNext = nextStep();

    if (!hasNext) {
      void finalizeGame();
    }
  }, [nextStep, finalizeGame]);

  const handleGoHome = useCallback((): void => {
    setResultVisible(false);

    if (checkTimerRef.current) {
      clearTimeout(checkTimerRef.current);
      checkTimerRef.current = null;
    }

    void clearProgress();
    router.replace("/offline");
  }, [router]);

  const handleRetry = useCallback((): void => {
    void clearProgress();
    router.replace(`/game?mode=${mode}`);
  }, [mode, router]);

  const handleShare = useCallback(async (): Promise<void> => {
    try {
      await Share.share({
        message: t("summary.shareText", {
          mode: t(`mode.${mode}.title` as TranslationKey),
          total: summary.total,
          max: summary.max,
          average: summary.average,
          stars: starString(summary.stars),
        }),
      });
    } catch {
      // Sharing was dismissed or is unavailable; nothing to do.
    }
  }, [mode, summary]);

  // Countdown for the timed mode. It pauses while the result modal is open so
  // reading the feedback never costs the player time.
  useEffect(() => {
    if (!isTimed || gameFinished || resultVisible) {
      return;
    }

    if (timeLeft <= 0) {
      void finalizeGame();
      return;
    }

    const id = setTimeout(() => setTimeLeft((value) => value - 1), 1000);
    return () => clearTimeout(id);
  }, [isTimed, gameFinished, resultVisible, timeLeft, finalizeGame]);

  const showColorStep = currentStep != null && currentStep.colorCount > 1;

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
              <Pressable
                onPress={handleGoHome}
                style={({ pressed }) => [
                  styles.backLink,
                  pressed && styles.backLinkPressed,
                ]}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t("summary.home")}
              >
                <Text style={styles.backLinkText}>{t("common.back")}</Text>
              </Pressable>
              <Text style={styles.kicker}>
                {t(`mode.${mode}.title` as TranslationKey)}
              </Text>
              <Text style={styles.title}>{t("game.title")}</Text>
              <Text style={styles.subtitle}>{t("game.subtitle")}</Text>
            </View>

            {gameFinished ? (
              <View style={styles.finishedCard}>
                <Text style={styles.finishedEmoji}>
                  {isRecord ? "🏆" : t("finished.emoji")}
                </Text>
                <Text style={styles.finishedTitle}>{t("summary.title")}</Text>
                <Text style={styles.finishedSubtitle}>
                  {getRunMessage(summary.average)}
                </Text>

                <View style={styles.summaryStats}>
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryStatValue}>
                      {summary.total}/{summary.max}
                    </Text>
                    <Text style={styles.summaryStatLabel}>
                      {t("summary.total")}
                    </Text>
                  </View>
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryStatValue}>
                      {summary.average}%
                    </Text>
                    <Text style={styles.summaryStatLabel}>
                      {t("summary.average")}
                    </Text>
                  </View>
                </View>

                <Text style={styles.summaryStars}>
                  {starString(summary.stars)}
                </Text>

                {isRecord ? (
                  <Text style={styles.recordBadge}>{t("summary.record")}</Text>
                ) : (
                  <Text style={styles.bestLine}>
                    {t("summary.best", { score: bestScore })}
                  </Text>
                )}
                {isTimed ? (
                  <Text style={styles.bestLine}>
                    {t("summary.bestStreak", { count: bestStreakValue })}
                  </Text>
                ) : null}

                <View style={styles.summaryActions}>
                  <Pressable
                    onPress={handleShare}
                    style={({ pressed }) => [
                      styles.shareButton,
                      pressed && styles.buttonPressed,
                    ]}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={t("common.share")}
                  >
                    <Text style={styles.shareButtonText}>
                      {t("common.share")}
                    </Text>
                  </Pressable>

                  {!isDaily ? (
                    <Pressable
                      onPress={handleRetry}
                      style={({ pressed }) => [
                        styles.shareButton,
                        pressed && styles.buttonPressed,
                      ]}
                      hitSlop={12}
                      accessibilityRole="button"
                      accessibilityLabel={t("common.retry")}
                    >
                      <Text style={styles.shareButtonText}>
                        {t("common.retry")}
                      </Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    onPress={handleGoHome}
                    style={({ pressed }) => [
                      styles.restartButton,
                      pressed && styles.buttonPressed,
                    ]}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={t("summary.home")}
                  >
                    <LinearGradient
                      colors={["#3B82F6", "#2563EB"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.buttonGradient}
                    >
                      <Text style={styles.buttonText}>{t("summary.home")}</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            ) : currentStep != null ? (
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
                  {isTimed || showColorStep ? (
                    <View style={styles.statusRow}>
                      {isTimed ? (
                        <View style={styles.statusPill}>
                          <Text style={styles.statusPillLabel}>
                            {t("timer.label")}
                          </Text>
                          <Text style={styles.statusPillValue}>
                            {t("timer.seconds", { seconds: timeLeft })}
                          </Text>
                        </View>
                      ) : null}
                      {isTimed ? (
                        <View style={styles.statusPill}>
                          <Text style={styles.statusPillLabel}>
                            {t("streak.label")}
                          </Text>
                          <Text style={styles.statusPillValue}>
                            {t("streak.value", { count: streak })}
                          </Text>
                        </View>
                      ) : null}
                      {showColorStep ? (
                        <View style={styles.statusPill}>
                          <Text style={styles.statusPillLabel}>
                            {currentStep.challenge.id}
                          </Text>
                          <Text style={styles.statusPillValue}>
                            {t("game.colorStep", {
                              current: currentStep.colorPosition,
                              total: currentStep.colorCount,
                            })}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  <ChallengeNavigation
                    currentIndex={currentStepIndex}
                    total={totalSteps}
                  />

                  <View style={styles.challengeCard}>
                    <SVGChallenge
                      challenge={currentStep.challenge}
                      editableColor={selectedColor}
                      editableColorIndex={currentStep.colorIndex}
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
                    accessibilityLabel={t("game.check")}
                    disabled={!targetColor}
                  >
                    <LinearGradient
                      colors={["#3B82F6", "#2563EB"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.buttonGradient}
                    >
                      <Text style={styles.buttonText}>{t("game.check")}</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{t("game.empty.title")}</Text>
                <Text style={styles.emptySubtitle}>
                  {t("game.empty.subtitle")}
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
          yourColor={yourColorHex}
          delta={delta}
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
  backLink: {
    alignSelf: "flex-start",
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  backLinkPressed: {
    opacity: 0.7,
  },
  backLinkText: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "System",
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
  summaryStats: {
    flexDirection: "row",
    marginTop: 20,
    gap: 14,
  },
  summaryStat: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#111113",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#27272A",
    paddingVertical: 16,
    paddingHorizontal: 12,
    minWidth: 120,
  },
  summaryStatValue: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    fontFamily: "System",
    fontVariant: ["tabular-nums"],
  },
  summaryStatLabel: {
    marginTop: 6,
    color: "#A1A1AA",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontWeight: "700",
    fontFamily: "System",
  },
  summaryStars: {
    marginTop: 16,
    fontSize: 26,
    letterSpacing: 4,
    color: "#FBBF24",
  },
  recordBadge: {
    marginTop: 12,
    color: "#34D399",
    fontSize: 15,
    fontWeight: "800",
    fontFamily: "System",
  },
  bestLine: {
    marginTop: 8,
    color: "#A1A1AA",
    fontSize: 14,
    fontFamily: "System",
  },
  summaryActions: {
    width: "100%",
    marginTop: 22,
  },
  shareButton: {
    marginTop: 12,
    borderRadius: 18,
    overflow: "hidden",
    width: "100%",
    borderWidth: 1,
    borderColor: "#27272A",
    backgroundColor: "#18181B",
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  shareButtonText: {
    color: "#E4E4E7",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "System",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  statusPillLabel: {
    color: "#A1A1AA",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontWeight: "700",
    fontFamily: "System",
  },
  statusPillValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    fontFamily: "System",
    fontVariant: ["tabular-nums"],
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
