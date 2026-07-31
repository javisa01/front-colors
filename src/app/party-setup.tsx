import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { t, type TranslationKey } from "@/i18n";
import type { PartyMode, PartyPlayer } from "@/types/challenge";
import {
  BATTLE_IMAGES,
  buildPartyConfig,
  clampPlayers,
  coopImagesPerPlayer,
  isCooperativeMode,
  isTimedMode,
  MAX_PLAYERS,
  MIN_PLAYERS,
  setPartyConfig,
  TURN_SECONDS,
} from "@/utils/party";

const VALID_MODES: PartyMode[] = [
  "battle",
  "battle-timed",
  "coop",
  "coop-timed",
];

const QUICK_COUNTS = [2, 3, 4, 6, 8];

function normalizeMode(value: string | string[] | undefined): PartyMode {
  const raw = Array.isArray(value) ? value[0] : value;
  return VALID_MODES.includes(raw as PartyMode) ? (raw as PartyMode) : "battle";
}

export default function PartySetupScreen(): ReactElement {
  const params = useLocalSearchParams<{ mode?: string }>();
  const router = useRouter();
  const mode = normalizeMode(params.mode);

  const timed = isTimedMode(mode);
  const cooperative = isCooperativeMode(mode);

  const [count, setCount] = useState(MIN_PLAYERS);
  const [names, setNames] = useState<string[]>([]);

  const setPlayerCount = useCallback((next: number) => {
    setCount(clampPlayers(next));
  }, []);

  const setName = useCallback((index: number, value: string) => {
    setNames((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  }, []);

  const infoText = useMemo(() => {
    if (timed) {
      return t("party.setup.timedInfo", { seconds: TURN_SECONDS });
    }
    if (cooperative) {
      return t("party.setup.coopInfo", {
        count: coopImagesPerPlayer(count),
      });
    }
    return t("party.setup.battleInfo", { count: BATTLE_IMAGES });
  }, [cooperative, count, timed]);

  const handleStart = useCallback(() => {
    const players: PartyPlayer[] = Array.from({ length: count }, (_, index) => {
      const custom = names[index]?.trim();
      return {
        id: index,
        name:
          custom && custom.length > 0
            ? custom
            : t("party.playerN", { n: index + 1 }),
      };
    });

    setPartyConfig(buildPartyConfig(mode, players));
    router.push({ pathname: "/party", params: { mode } });
  }, [count, mode, names, router]);

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
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.shell}>
            <Pressable
              onPress={() => router.replace("/offline")}
              style={({ pressed }) => [
                styles.backLink,
                pressed && styles.backLinkPressed,
              ]}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t("common.back")}
            >
              <Text style={styles.backLinkText}>← Atrás</Text>
            </Pressable>

            <Text style={styles.kicker}>
              {t(`party.mode.${mode}.title` as TranslationKey)}
            </Text>
            <Text style={styles.title}>{t("party.setup.title")}</Text>
            <Text style={styles.info}>{infoText}</Text>

            <View style={styles.card}>
              <Text style={styles.label}>{t("party.setup.playersLabel")}</Text>
              <Text style={styles.hint}>
                {t("party.setup.playersHint", {
                  min: MIN_PLAYERS,
                  max: MAX_PLAYERS,
                })}
              </Text>

              <View style={styles.stepper}>
                <Pressable
                  onPress={() => setPlayerCount(count - 1)}
                  style={({ pressed }) => [
                    styles.stepButton,
                    pressed && styles.stepButtonPressed,
                  ]}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="-"
                >
                  <Text style={styles.stepButtonText}>−</Text>
                </Pressable>

                <View style={styles.countBox}>
                  <Text style={styles.countValue}>{count}</Text>
                </View>

                <Pressable
                  onPress={() => setPlayerCount(count + 1)}
                  style={({ pressed }) => [
                    styles.stepButton,
                    pressed && styles.stepButtonPressed,
                  ]}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="+"
                >
                  <Text style={styles.stepButtonText}>+</Text>
                </Pressable>
              </View>

              <View style={styles.chipsRow}>
                {QUICK_COUNTS.map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setPlayerCount(value)}
                    style={({ pressed }) => [
                      styles.chip,
                      count === value && styles.chipActive,
                      pressed && styles.chipPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${value}`}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        count === value && styles.chipTextActive,
                      ]}
                    >
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>{t("party.setup.namesLabel")}</Text>
              <Text style={styles.hint}>{t("party.setup.namesHint")}</Text>

              {Array.from({ length: count }, (_, index) => (
                <View key={index} style={styles.nameRow}>
                  <View style={styles.nameBadge}>
                    <Text style={styles.nameBadgeText}>{index + 1}</Text>
                  </View>
                  <TextInput
                    value={names[index] ?? ""}
                    onChangeText={(value) => setName(index, value)}
                    placeholder={t("party.playerN", { n: index + 1 })}
                    placeholderTextColor="#52525B"
                    style={styles.nameInput}
                    maxLength={20}
                    returnKeyType="done"
                  />
                </View>
              ))}
            </View>

            <Pressable
              onPress={handleStart}
              style={({ pressed }) => [
                styles.startButton,
                pressed && styles.startButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("party.setup.start")}
            >
              <LinearGradient
                colors={["#3B82F6", "#2563EB"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.startGradient}
              >
                <Text style={styles.startText}>{t("party.setup.start")}</Text>
              </LinearGradient>
            </Pressable>
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
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 48,
  },
  backLink: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    marginBottom: 12,
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
  title: {
    marginTop: 6,
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    fontFamily: "System",
  },
  info: {
    marginTop: 8,
    marginBottom: 20,
    color: "#A1A1AA",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "System",
  },
  card: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    marginBottom: 16,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    fontFamily: "System",
  },
  hint: {
    marginTop: 4,
    marginBottom: 14,
    color: "#71717A",
    fontSize: 13,
    fontFamily: "System",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  stepButton: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },
  stepButtonPressed: {
    opacity: 0.7,
  },
  stepButtonText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "System",
  },
  countBox: {
    minWidth: 96,
    alignItems: "center",
    paddingHorizontal: 12,
  },
  countValue: {
    color: "#FFFFFF",
    fontSize: 40,
    fontWeight: "800",
    fontFamily: "System",
    fontVariant: ["tabular-nums"],
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 16,
    gap: 8,
  },
  chip: {
    minWidth: 48,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#27272A",
    alignItems: "center",
  },
  chipActive: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipText: {
    color: "#A1A1AA",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "System",
  },
  chipTextActive: {
    color: "#93C5FD",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  nameBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  nameBadgeText: {
    color: "#E4E4E7",
    fontSize: 14,
    fontWeight: "800",
    fontFamily: "System",
    fontVariant: ["tabular-nums"],
  },
  nameInput: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: "#09090B",
    borderWidth: 1,
    borderColor: "#27272A",
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "System",
  },
  startButton: {
    marginTop: 8,
    borderRadius: 18,
    overflow: "hidden",
  },
  startButtonPressed: {
    opacity: 0.9,
  },
  startGradient: {
    paddingVertical: 18,
    alignItems: "center",
  },
  startText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    fontFamily: "System",
  },
});
