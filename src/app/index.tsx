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
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { SettingsModal } from "@/components/SettingsModal";
import { t } from "@/i18n";
import { playTick } from "@/utils/sound";

export default function LandingScreen(): ReactElement {
  const { width } = useWindowDimensions();
  const router = useRouter();

  const isTablet = width >= 768;
  const [settingsVisible, setSettingsVisible] = useState(false);

  const glow = useSharedValue(0);
  const float = useSharedValue(0);

  useEffect(() => {
    glow.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );

    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [float, glow]);

  const orbOneStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + glow.value * 0.35,
    transform: [
      { translateY: -float.value * 18 },
      { scale: 1 + glow.value * 0.08 },
    ],
  }));

  const orbTwoStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + (1 - glow.value) * 0.35,
    transform: [
      { translateY: float.value * 22 },
      { scale: 1 + (1 - glow.value) * 0.1 },
    ],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -float.value * 6 }],
  }));

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

        <Animated.View
          pointerEvents="none"
          style={[styles.orb, styles.orbOne, orbOneStyle]}
        >
          <LinearGradient
            colors={["#3B82F6", "#2563EB"]}
            style={styles.orbFill}
          />
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[styles.orb, styles.orbTwo, orbTwoStyle]}
        >
          <LinearGradient
            colors={["#EC4899", "#BE185D"]}
            style={styles.orbFill}
          />
        </Animated.View>

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
              <Animated.View style={[styles.badge, badgeStyle]}>
                <Text style={styles.badgeText}>{t("landing.badge")}</Text>
              </Animated.View>

              <Text style={styles.title}>{t("landing.title")}</Text>
              <Text style={styles.subtitle}>{t("landing.subtitle")}</Text>
            </Animated.View>

            <View
              style={[
                styles.modes,
                isTablet ? styles.modesTablet : styles.modesPhone,
              ]}
            >
              <Animated.View
                entering={FadeInDown.delay(120).duration(520)}
                style={[
                  styles.modeWrapper,
                  isTablet && styles.modeWrapperTablet,
                ]}
              >
                <Pressable
                  onPress={() => {
                    playTick();
                    router.push("/offline");
                  }}
                  style={({ pressed }) => [
                    styles.modeCard,
                    pressed && styles.modeCardPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("landing.offline.title")}
                >
                  <View style={styles.modeRow}>
                    <LinearGradient
                      colors={["#10B981", "#047857"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.modeIcon}
                    >
                      <Text style={styles.modeEmoji}>📶</Text>
                    </LinearGradient>

                    <View style={styles.modeTextGroup}>
                      <Text style={styles.modeTitle}>
                        {t("landing.offline.title")}
                      </Text>
                      <Text style={styles.modeDescription}>
                        {t("landing.offline.description")}
                      </Text>
                    </View>

                    <Text style={styles.modeArrow}>›</Text>
                  </View>
                </Pressable>
              </Animated.View>

              <Animated.View
                entering={FadeInDown.delay(230).duration(520)}
                style={[
                  styles.modeWrapper,
                  isTablet && styles.modeWrapperTablet,
                ]}
              >
                <View
                  style={[styles.modeCard, styles.modeCardDisabled]}
                  accessible
                  accessibilityRole="button"
                  accessibilityState={{ disabled: true }}
                  accessibilityLabel={t("landing.online.title")}
                >
                  <View style={styles.modeRow}>
                    <LinearGradient
                      colors={["#52525B", "#3F3F46"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.modeIcon}
                    >
                      <Text style={styles.modeEmoji}>🌐</Text>
                    </LinearGradient>

                    <View style={styles.modeTextGroup}>
                      <View style={styles.modeTitleRow}>
                        <Text style={styles.modeTitle}>
                          {t("landing.online.title")}
                        </Text>
                        <View style={styles.soonPill}>
                          <Text style={styles.soonPillText}>
                            {t("landing.soon")}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.modeDescription}>
                        {t("landing.online.description")}
                      </Text>
                      <Text style={styles.lockedHint}>
                        🔒 {t("landing.online.locked")}
                      </Text>
                    </View>
                  </View>
                </View>
              </Animated.View>
            </View>

            <Animated.Text
              entering={FadeInDown.delay(340).duration(520)}
              style={styles.footerHint}
            >
              {t("landing.footer")}
            </Animated.Text>
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
  orb: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 320,
  },
  orbFill: {
    flex: 1,
    borderRadius: 320,
  },
  orbOne: {
    top: -120,
    right: -110,
  },
  orbTwo: {
    bottom: -140,
    left: -120,
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
    paddingTop: 24,
    paddingBottom: 32,
    justifyContent: "center",
  },
  header: {
    marginBottom: 28,
  },
  badge: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    marginBottom: 18,
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
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "800",
    fontFamily: "System",
  },
  subtitle: {
    marginTop: 12,
    color: "#A1A1AA",
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "System",
    maxWidth: 460,
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
  modeCardDisabled: {
    opacity: 0.7,
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
  soonPill: {
    marginLeft: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "#27272A",
  },
  soonPillText: {
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "System",
  },
  modeDescription: {
    marginTop: 4,
    color: "#A1A1AA",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "System",
  },
  lockedHint: {
    marginTop: 8,
    color: "#71717A",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "System",
  },
  modeArrow: {
    color: "#52525B",
    fontSize: 28,
    fontWeight: "300",
    marginLeft: 10,
  },
  footerHint: {
    marginTop: 12,
    color: "#52525B",
    fontSize: 13,
    textAlign: "center",
    fontFamily: "System",
  },
});
