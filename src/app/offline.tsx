import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { SettingsModal } from "@/components/SettingsModal";
import { t, type TranslationKey } from "@/i18n";
import type { GameMode, PartyMode } from "@/types/challenge";
import { playTick } from "@/utils/sound";
import { getHighScore } from "@/utils/storage";

interface SoloModeCard {
  id: GameMode;
  emoji: string;
  colors: [string, string];
}

interface PartyModeCard {
  id: PartyMode;
  emoji: string;
  colors: [string, string];
}

const SOLO_MODES: SoloModeCard[] = [
  { id: "quick", emoji: "⚡", colors: ["#3B82F6", "#2563EB"] },
  { id: "timed", emoji: "⏱️", colors: ["#7C3AED", "#5B21B6"] },
  { id: "daily", emoji: "📅", colors: ["#0EA5E9", "#0369A1"] },
  { id: "multicolor", emoji: "🌈", colors: ["#EC4899", "#BE185D"] },
];

const PARTY_MODES: PartyModeCard[] = [
  { id: "battle", emoji: "⚔️", colors: ["#F59E0B", "#D97706"] },
  { id: "battle-timed", emoji: "🔥", colors: ["#EF4444", "#B91C1C"] },
  { id: "coop", emoji: "🤝", colors: ["#10B981", "#047857"] },
  { id: "coop-timed", emoji: "⏳", colors: ["#14B8A6", "#0F766E"] },
];

export default function OfflineScreen(): ReactElement {
  const { width } = useWindowDimensions();
  const router = useRouter();

  const isTablet = width >= 768;

  const [bestScores, setBestScores] = useState<Record<string, number>>({});
  const [settingsVisible, setSettingsVisible] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      const entries = await Promise.all(
        SOLO_MODES.map(
          async (mode) => [mode.id, await getHighScore(mode.id)] as const,
        ),
      );
      if (active) {
        setBestScores(Object.fromEntries(entries));
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#09090B", "#0A0A0D", "#09090B"]}
        style={styles.background}
      >
        <Pressable
          onPress={() => {
            playTick();
            setSettingsVisible(true);
          }}
          style={styles.gear}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t("settings.title")}
        >
          <Text style={styles.gearText}>⚙️</Text>
        </Pressable>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
        >
          <View style={styles.shell}>
            <Animated.View
              entering={FadeInDown.duration(500)}
              style={styles.header}
            >
              <Pressable
                onPress={() => {
                  playTick();
                  router.replace("/");
                }}
                style={({ pressed }) => [
                  styles.backLink,
                  pressed && styles.backLinkPressed,
                ]}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t("common.back")}
              >
                <Text style={styles.backLinkText}>{t("common.backShort")}</Text>
              </Pressable>

              <View style={styles.badge}>
                <Text style={styles.badgeText}>{t("offline.badge")}</Text>
              </View>

              <Text style={styles.title}>{t("offline.title")}</Text>
              <Text style={styles.subtitle}>{t("offline.subtitle")}</Text>
            </Animated.View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t("offline.solo.section")}
              </Text>
              <Text style={styles.sectionHint}>{t("offline.solo.hint")}</Text>
            </View>

            <View
              style={[
                styles.modes,
                isTablet ? styles.modesTablet : styles.modesPhone,
              ]}
            >
              {SOLO_MODES.map((mode, index) => {
                const best = bestScores[mode.id] ?? 0;

                return (
                  <Animated.View
                    key={mode.id}
                    entering={FadeInDown.delay(120 + index * 90).duration(500)}
                    style={[
                      styles.modeWrapper,
                      isTablet && styles.modeWrapperTablet,
                    ]}
                  >
                    <Pressable
                      onPress={() => {
                        playTick();
                        router.push({
                          pathname: "/game",
                          params: { mode: mode.id },
                        });
                      }}
                      style={({ pressed }) => [
                        styles.modeCard,
                        pressed && styles.modeCardPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={t(
                        `mode.${mode.id}.title` as TranslationKey,
                      )}
                    >
                      <View style={styles.modeRow}>
                        <LinearGradient
                          colors={mode.colors}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.modeIcon}
                        >
                          <Text style={styles.modeEmoji}>{mode.emoji}</Text>
                        </LinearGradient>

                        <View style={styles.modeTextGroup}>
                          <View style={styles.modeTitleRow}>
                            <Text style={styles.modeTitle}>
                              {t(`mode.${mode.id}.title` as TranslationKey)}
                            </Text>
                            {best > 0 ? (
                              <View style={styles.bestPill}>
                                <Text style={styles.bestPillText}>
                                  {t("home.best", { score: best })}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.modeDescription}>
                            {t(`mode.${mode.id}.description` as TranslationKey)}
                          </Text>
                        </View>

                        <Text style={styles.modeArrow}>›</Text>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>
                {t("offline.group.section")}
              </Text>
              <View style={styles.dividerLine} />
            </View>
            <Text style={styles.dividerHint}>{t("offline.group.hint")}</Text>

            <View
              style={[
                styles.modes,
                isTablet ? styles.modesTablet : styles.modesPhone,
              ]}
            >
              {PARTY_MODES.map((mode, index) => (
                <Animated.View
                  key={mode.id}
                  entering={FadeInDown.delay(120 + index * 90).duration(500)}
                  style={[
                    styles.modeWrapper,
                    isTablet && styles.modeWrapperTablet,
                  ]}
                >
                  <Pressable
                    onPress={() => {
                      playTick();
                      router.push({
                        pathname: "/party-setup",
                        params: { mode: mode.id },
                      });
                    }}
                    style={({ pressed }) => [
                      styles.modeCard,
                      pressed && styles.modeCardPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      `party.mode.${mode.id}.title` as TranslationKey,
                    )}
                  >
                    <View style={styles.modeRow}>
                      <LinearGradient
                        colors={mode.colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.modeIcon}
                      >
                        <Text style={styles.modeEmoji}>{mode.emoji}</Text>
                      </LinearGradient>

                      <View style={styles.modeTextGroup}>
                        <Text style={styles.modeTitle}>
                          {t(`party.mode.${mode.id}.title` as TranslationKey)}
                        </Text>
                        <Text style={styles.modeDescription}>
                          {t(
                            `party.mode.${mode.id}.description` as TranslationKey,
                          )}
                        </Text>
                      </View>

                      <Text style={styles.modeArrow}>›</Text>
                    </View>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </View>
        </ScrollView>
        <SettingsModal
          isVisible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
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
    overflow: "hidden",
  },
  gear: {
    position: "absolute",
    top: 12,
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    alignItems: "center",
    justifyContent: "center",
  },
  gearText: {
    fontSize: 20,
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
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  backLink: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    marginBottom: 10,
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
  badge: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    marginBottom: 16,
  },
  badgeText: {
    color: "#E4E4E7",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    fontFamily: "System",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    fontFamily: "System",
  },
  subtitle: {
    marginTop: 10,
    color: "#A1A1AA",
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "System",
    maxWidth: 460,
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontFamily: "System",
  },
  sectionHint: {
    marginTop: 4,
    color: "#71717A",
    fontSize: 13,
    fontFamily: "System",
  },
  modes: {
    width: "100%",
  },
  modesPhone: {
    flexDirection: "column",
  },
  modesTablet: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  modeWrapper: {
    marginBottom: 14,
  },
  modeWrapperTablet: {
    width: "48.5%",
  },
  modeCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    elevation: 6,
  },
  modeCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
    borderColor: "#3B82F6",
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  modeIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  modeEmoji: {
    fontSize: 24,
  },
  modeTextGroup: {
    flex: 1,
  },
  modeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  modeTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    fontFamily: "System",
  },
  bestPill: {
    marginLeft: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  bestPillText: {
    color: "#93C5FD",
    fontSize: 11,
    fontWeight: "800",
    fontFamily: "System",
    fontVariant: ["tabular-nums"],
  },
  modeDescription: {
    marginTop: 4,
    color: "#A1A1AA",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "System",
  },
  modeArrow: {
    color: "#52525B",
    fontSize: 28,
    fontWeight: "300",
    marginLeft: 10,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#27272A",
  },
  dividerLabel: {
    marginHorizontal: 12,
    color: "#E4E4E7",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontFamily: "System",
  },
  dividerHint: {
    color: "#71717A",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
    fontFamily: "System",
  },
});
