import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useEffect } from "react";
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

interface GameMode {
  id: string;
  title: string;
  description: string;
  emoji: string;
  colors: [string, string];
  href: "/game" | null;
}

const GAME_MODES: GameMode[] = [
  {
    id: "quick",
    title: "Juego rápido",
    description: "Adivina el color de cada reto y supera todos los niveles.",
    emoji: "⚡",
    colors: ["#3B82F6", "#2563EB"],
    href: "/game",
  },
  {
    id: "timed",
    title: "Contrarreloj",
    description:
      "Muy pronto: acierta el máximo de colores antes de que acabe el tiempo.",
    emoji: "⏱️",
    colors: ["#7C3AED", "#5B21B6"],
    href: null,
  },
  {
    id: "daily",
    title: "Reto diario",
    description:
      "Muy pronto: un color nuevo cada día para poner a prueba tu ojo.",
    emoji: "📅",
    colors: ["#0EA5E9", "#0369A1"],
    href: null,
  },
];

export default function HomeScreen(): ReactElement {
  const { width } = useWindowDimensions();
  const router = useRouter();

  const isTablet = width >= 768;

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
            colors={["#7C3AED", "#5B21B6"]}
            style={styles.orbFill}
          />
        </Animated.View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          bounces={false}
          alwaysBounceVertical={false}
          alwaysBounceHorizontal={false}
          overScrollMode="never"
        >
          <View style={styles.shell}>
            <Animated.View
              entering={FadeInDown.duration(500)}
              style={styles.header}
            >
              <Animated.View style={[styles.badge, badgeStyle]}>
                <Text style={styles.badgeText}>🎨 Color Quest</Text>
              </Animated.View>

              <Text style={styles.title}>
                Pon a prueba{"\n"}tu ojo para el color
              </Text>
              <Text style={styles.subtitle}>
                Elige un modo de juego y demuestra cuánto te acercas al color
                perfecto.
              </Text>
            </Animated.View>

            <View
              style={[
                styles.modes,
                isTablet ? styles.modesTablet : styles.modesPhone,
              ]}
            >
              {GAME_MODES.map((mode, index) => {
                const isAvailable = mode.href != null;

                return (
                  <Animated.View
                    key={mode.id}
                    entering={FadeInDown.delay(120 + index * 110).duration(520)}
                    style={[
                      styles.modeWrapper,
                      isTablet && styles.modeWrapperTablet,
                    ]}
                  >
                    <Pressable
                      onPress={() => {
                        if (mode.href != null) {
                          router.push(mode.href);
                        }
                      }}
                      disabled={!isAvailable}
                      style={({ pressed }) => [
                        styles.modeCard,
                        !isAvailable && styles.modeCardDisabled,
                        pressed && isAvailable && styles.modeCardPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={mode.title}
                      accessibilityState={{ disabled: !isAvailable }}
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
                            <Text style={styles.modeTitle}>{mode.title}</Text>
                            {!isAvailable ? (
                              <View style={styles.soonPill}>
                                <Text style={styles.soonPillText}>Pronto</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.modeDescription}>
                            {mode.description}
                          </Text>
                        </View>

                        {isAvailable ? (
                          <Text style={styles.modeArrow}>›</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            <Animated.Text
              entering={FadeInDown.delay(520).duration(520)}
              style={styles.footerHint}
            >
              Más modos de juego en camino.
            </Animated.Text>
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
    overflow: "hidden",
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
    opacity: 0.6,
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
