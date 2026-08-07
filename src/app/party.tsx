import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import HSVPicker from "@/components/HSVPicker";
import SVGChallenge from "@/components/SVGChallenge";
import { useParty } from "@/hooks/useParty";
import { t, type TranslationKey } from "@/i18n";
import type { HSVColor, PartyConfig } from "@/types/challenge";
import { hexToHSV, normalizeHex } from "@/utils/color";
import {
  applyTimedBattlePenalty,
  calculateColorScore,
  getRunMessage,
} from "@/utils/colorScore";
import { feedbackForScore } from "@/utils/haptics";
import { buildPartyConfig, getPartyConfig } from "@/utils/party";
import { playScoreSound, playSound } from "@/utils/sound";

const INITIAL_COLOR = "#878787";
const INITIAL_HSV: HSVColor = hexToHSV(INITIAL_COLOR);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function PartyScreen(): ReactElement | null {
  const router = useRouter();
  const [config, setConfig] = useState<PartyConfig | null>(() =>
    getPartyConfig(),
  );
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    if (!config) {
      router.replace("/offline");
    }
  }, [config, router]);

  if (!config) {
    return null;
  }

  return (
    <PartyGame
      key={runId}
      config={config}
      onExit={() => router.replace("/offline")}
      onReplay={() => {
        setConfig(buildPartyConfig(config.mode, config.players));
        setRunId((value) => value + 1);
      }}
    />
  );
}

interface PartyGameProps {
  config: PartyConfig;
  onExit: () => void;
  onReplay: () => void;
}

function PartyGame({ config, onExit, onReplay }: PartyGameProps): ReactElement {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;

  const {
    phase,
    playerIndex,
    slot,
    timeLeft,
    lastScore,
    currentStep,
    guesses,
    turnSolved,
    beginTurn,
    submitGuess,
    proceed,
  } = useParty(config);

  const [selectedColor, setSelectedColor] = useState(INITIAL_COLOR);
  const [selectedHSV, setSelectedHSV] = useState<HSVColor>(INITIAL_HSV);

  // Celebrate the end of the run with a sound (no-op until an audio file is
  // registered in `assets/audio`).
  useEffect(() => {
    if (phase === "final") {
      playSound("gameOver");
    }
  }, [phase]);

  const currentPlayer = config.players[playerIndex];
  const stepKey = `${playerIndex}-${slot}-${guesses.length}`;
  const [lastStepKey, setLastStepKey] = useState(stepKey);

  // Reset the picker each time a new color must be guessed. Adjusting state
  // during render (instead of an effect) avoids an extra paint of the old color.
  if (stepKey !== lastStepKey) {
    setLastStepKey(stepKey);
    setSelectedColor(INITIAL_COLOR);
    setSelectedHSV(INITIAL_HSV);
  }

  const challengeSize = useMemo(
    () => clamp(Math.min(width, height) * (isTablet ? 0.34 : 0.44), 160, 300),
    [height, isTablet, width],
  );

  const handleColorChange = (color: string, hsv: HSVColor): void => {
    setSelectedColor(normalizeHex(color));
    setSelectedHSV(hsv);
  };

  const handleCheck = (): void => {
    if (!currentStep) {
      return;
    }
    const rawScore = calculateColorScore(selectedHSV, currentStep.target.hsv);
    feedbackForScore(rawScore);
    playScoreSound(rawScore);
    const score = config.timed ? applyTimedBattlePenalty(rawScore) : rawScore;
    submitGuess(score, currentStep.target.hex, selectedColor);
  };

  // ---- Derived results -------------------------------------------------

  const perPlayer = useMemo(
    () =>
      config.players.map((player, index) => {
        const own = guesses.filter((guess) => guess.player === index);
        return {
          player,
          index,
          score: own.reduce((sum, guess) => sum + guess.score, 0),
          rounds: own.length,
        };
      }),
    [config.players, guesses],
  );

  const ranking = useMemo(
    () => [...perPlayer].sort((a, b) => b.score - a.score),
    [perPlayer],
  );

  const roundGuesses = useMemo(
    () =>
      guesses
        .filter((guess) => guess.slot === slot)
        .map((guess) => ({
          ...guess,
          name: config.players[guess.player]?.name ?? "",
        }))
        .sort((a, b) => b.score - a.score),
    [config.players, guesses, slot],
  );

  const teamTotal = useMemo(
    () => guesses.reduce((sum, guess) => sum + guess.score, 0),
    [guesses],
  );
  const teamMax =
    config.cooperative && !config.timed
      ? config.players.length * config.imagesPerPlayer * 100
      : guesses.length * 100;
  const teamAverage =
    guesses.length > 0 ? Math.round(teamTotal / guesses.length) : 0;

  // ---- Render helpers --------------------------------------------------

  const modeTitle = t(`party.mode.${config.mode}.title` as TranslationKey);

  const renderHandoff = (): ReactElement => (
    <View style={styles.centerCard}>
      <Text style={styles.handoffEmoji}>👋</Text>
      <Text style={styles.handoffTitle}>
        {t("party.handoff.title", { name: currentPlayer.name })}
      </Text>
      <Text style={styles.handoffSubtitle}>{t("party.handoff.subtitle")}</Text>

      {config.mode === "battle" ? (
        <Text style={styles.handoffMeta}>
          {t("party.handoff.image", {
            current: slot + 1,
            total: config.sharedSteps.length,
          })}
        </Text>
      ) : null}
      {config.timed ? (
        <Text style={styles.handoffMeta}>
          {t("party.handoff.timed", { seconds: config.turnSeconds })}
        </Text>
      ) : null}

      <Pressable
        onPress={beginTurn}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.buttonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t("party.handoff.start")}
      >
        <LinearGradient
          colors={["#3B82F6", "#2563EB"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.buttonGradient}
        >
          <Text style={styles.buttonText}>{t("party.handoff.start")}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );

  const renderPlaying = (): ReactElement => (
    <View style={styles.content}>
      <View style={styles.statusRow}>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillLabel}>{currentPlayer.name}</Text>
        </View>
        {config.timed ? (
          <>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillLabel}>{t("timer.label")}</Text>
              <Text style={styles.statusPillValue}>
                {t("timer.seconds", { seconds: timeLeft })}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillLabel}>
                {t("party.play.solved", { count: turnSolved })}
              </Text>
            </View>
          </>
        ) : config.mode === "battle" ? (
          <View style={styles.statusPill}>
            <Text style={styles.statusPillValue}>
              {t("party.play.image", {
                current: slot + 1,
                total: config.sharedSteps.length,
              })}
            </Text>
          </View>
        ) : (
          <View style={styles.statusPill}>
            <Text style={styles.statusPillValue}>
              {t("party.play.image", {
                current: slot + 1,
                total: config.imagesPerPlayer,
              })}
            </Text>
          </View>
        )}
      </View>

      {currentStep ? (
        <>
          <View style={styles.challengeCard}>
            <SVGChallenge
              challenge={currentStep.challenge}
              editableColor={selectedColor}
              editableColorIndex={currentStep.colorIndex}
              size={challengeSize}
              animationToken={guesses.length}
            />
          </View>

          <HSVPicker color={selectedColor} onColorChange={handleColorChange} />

          <Pressable
            onPress={handleCheck}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("party.play.check")}
          >
            <LinearGradient
              colors={["#3B82F6", "#2563EB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>{t("party.play.check")}</Text>
            </LinearGradient>
          </Pressable>
        </>
      ) : null}
    </View>
  );

  const renderGuessResult = (): ReactElement => (
    <View style={styles.centerCard}>
      <Text style={styles.kicker}>{currentPlayer.name}</Text>
      <Text style={styles.bigScore}>{lastScore}%</Text>
      <Text style={styles.handoffTitle}>{t("party.guess.title")}</Text>
      <Text style={styles.handoffSubtitle}>{t("party.guess.hidden")}</Text>

      <Pressable
        onPress={proceed}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.buttonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t("common.continue")}
      >
        <LinearGradient
          colors={["#3B82F6", "#2563EB"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.buttonGradient}
        >
          <Text style={styles.buttonText}>{t("common.continue")}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );

  const renderRoundResult = (): ReactElement => (
    <View style={styles.centerCard}>
      <Text style={styles.kicker}>
        {t("party.play.image", {
          current: slot + 1,
          total: config.sharedSteps.length,
        })}
      </Text>
      <Text style={styles.handoffTitle}>{t("party.round.title")}</Text>

      {currentStep ? (
        <View style={styles.correctBlock}>
          <View
            style={[
              styles.correctSwatch,
              { backgroundColor: currentStep.target.hex },
            ]}
          />
          <Text style={styles.correctLabel}>
            {t("party.round.correct")} · {currentStep.target.hex}
          </Text>
        </View>
      ) : null}

      <View style={styles.rankList}>
        {roundGuesses.map((guess, index) => (
          <View
            key={`${guess.player}-${index}`}
            style={[styles.rankRow, index === 0 && styles.rankRowWinner]}
          >
            <Text style={styles.rankPos}>{index + 1}º</Text>
            <View
              style={[styles.rankSwatch, { backgroundColor: guess.guessHex }]}
            />
            <Text style={styles.rankName} numberOfLines={1}>
              {index === 0
                ? t("party.round.you", { name: guess.name })
                : guess.name}
            </Text>
            <Text style={styles.rankScore}>{guess.score}%</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={proceed}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.buttonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t("common.next")}
      >
        <LinearGradient
          colors={["#3B82F6", "#2563EB"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.buttonGradient}
        >
          <Text style={styles.buttonText}>{t("common.next")}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );

  const renderFinal = (): ReactElement => {
    const isTie = ranking.length > 1 && ranking[0].score === ranking[1].score;

    return (
      <View style={styles.centerCard}>
        <Text style={styles.finishedEmoji}>🏁</Text>
        <Text style={styles.handoffTitle}>
          {config.cooperative
            ? t("party.final.coopTitle")
            : t("party.final.title")}
        </Text>

        {config.cooperative ? (
          <>
            <Text style={styles.bigScore}>
              {config.timed
                ? t("party.final.points", { score: teamTotal })
                : t("party.final.teamScore", {
                    score: teamTotal,
                    max: teamMax,
                  })}
            </Text>
            <Text style={styles.handoffSubtitle}>
              {t("party.final.teamAverage", { average: teamAverage })}
            </Text>
            <Text style={styles.teamMessage}>{getRunMessage(teamAverage)}</Text>
            <Text style={styles.contribHeading}>
              {t("party.final.contributions")}
            </Text>
          </>
        ) : (
          <Text style={styles.winnerLine}>
            {isTie
              ? t("party.final.tie")
              : t("party.final.winner", { name: ranking[0]?.player.name })}
          </Text>
        )}

        <View style={styles.rankList}>
          {ranking.map((entry, index) => (
            <View
              key={entry.index}
              style={[
                styles.rankRow,
                index === 0 && !config.cooperative && styles.rankRowWinner,
              ]}
            >
              <Text style={styles.rankPos}>{index + 1}º</Text>
              <Text style={styles.rankName} numberOfLines={1}>
                {entry.player.name}
              </Text>
              <Text style={styles.rankScore}>
                {config.timed || config.cooperative
                  ? `${entry.score} · ${t("party.final.rounds", {
                      count: entry.rounds,
                    })}`
                  : t("party.final.points", { score: entry.score })}
              </Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={onReplay}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("party.final.replay")}
        >
          <LinearGradient
            colors={["#3B82F6", "#2563EB"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>{t("party.final.replay")}</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={onExit}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("party.final.home")}
        >
          <Text style={styles.secondaryButtonText}>
            {t("party.final.home")}
          </Text>
        </Pressable>
      </View>
    );
  };

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
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.shell}>
            <View style={styles.header}>
              <Pressable
                onPress={onExit}
                style={({ pressed }) => [
                  styles.backLink,
                  pressed && styles.backLinkPressed,
                ]}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t("party.final.home")}
              >
                <Text style={styles.backLinkText}>{t("common.exit")}</Text>
              </Pressable>
              <Text style={styles.kicker}>{modeTitle}</Text>
            </View>

            {phase === "handoff"
              ? renderHandoff()
              : phase === "playing"
                ? renderPlaying()
                : phase === "guessResult"
                  ? renderGuessResult()
                  : phase === "roundResult"
                    ? renderRoundResult()
                    : renderFinal()}
          </View>
        </ScrollView>
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
    maxWidth: 640,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 12,
  },
  backLink: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    marginBottom: 6,
  },
  backLinkPressed: {
    opacity: 0.6,
  },
  backLinkText: {
    color: "#A1A1AA",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "System",
  },
  kicker: {
    color: "#3B82F6",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: "System",
  },
  content: {
    flex: 1,
    width: "100%",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  statusPillLabel: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "System",
  },
  statusPillValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    fontFamily: "System",
    fontVariant: ["tabular-nums"],
  },
  challengeCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    marginBottom: 14,
    borderRadius: 24,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  centerCard: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  handoffEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  finishedEmoji: {
    fontSize: 44,
    marginBottom: 10,
  },
  handoffTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    fontFamily: "System",
  },
  handoffSubtitle: {
    marginTop: 8,
    color: "#A1A1AA",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    fontFamily: "System",
    maxWidth: 360,
  },
  handoffMeta: {
    marginTop: 10,
    color: "#71717A",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "System",
  },
  bigScore: {
    marginTop: 10,
    color: "#FFFFFF",
    fontSize: 52,
    fontWeight: "800",
    fontFamily: "System",
    fontVariant: ["tabular-nums"],
  },
  teamMessage: {
    marginTop: 10,
    color: "#93C5FD",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    fontFamily: "System",
  },
  winnerLine: {
    marginTop: 10,
    color: "#FBBF24",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    fontFamily: "System",
  },
  contribHeading: {
    marginTop: 20,
    alignSelf: "flex-start",
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: "System",
  },
  correctBlock: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  correctSwatch: {
    width: 64,
    height: 64,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#27272A",
  },
  correctLabel: {
    marginTop: 8,
    color: "#E4E4E7",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "System",
  },
  rankList: {
    width: "100%",
    marginTop: 12,
    marginBottom: 20,
    gap: 8,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  rankRowWinner: {
    borderColor: "#FBBF24",
    backgroundColor: "#1C1917",
  },
  rankPos: {
    color: "#A1A1AA",
    fontSize: 14,
    fontWeight: "800",
    width: 28,
    fontFamily: "System",
    fontVariant: ["tabular-nums"],
  },
  rankSwatch: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  rankName: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "System",
  },
  rankScore: {
    color: "#93C5FD",
    fontSize: 14,
    fontWeight: "800",
    fontFamily: "System",
    fontVariant: ["tabular-nums"],
  },
  primaryButton: {
    width: "100%",
    borderRadius: 18,
    overflow: "hidden",
    marginTop: 8,
  },
  buttonGradient: {
    paddingVertical: 18,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    fontFamily: "System",
  },
  buttonPressed: {
    opacity: 0.9,
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#A1A1AA",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "System",
  },
});
