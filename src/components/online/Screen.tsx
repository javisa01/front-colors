import { LinearGradient } from "expo-linear-gradient";
import { useRouter, type Href } from "expo-router";
import type { ReactElement, ReactNode } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { OnlineGradients, OnlinePalette } from "@/components/online/theme";
import { t } from "@/i18n";
import { playTick } from "@/utils/sound";

interface ScreenProps {
  badge?: string;
  title: string;
  subtitle?: string;
  /** Ruta del enlace «atrás». Sin ella no se pinta la cabecera de vuelta. */
  backTo?: Href;
  backLabel?: string;
  /** Elemento suelto a la derecha del título (contador, avatar, acción...). */
  headerRight?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: ReactNode;
}

/**
 * Armazón común de las pantallas online: fondo degradado, ancho máximo
 * centrado y cabecera con badge + título. Reproduce el mismo layout que
 * `offline.tsx` para que las dos mitades de la app se sientan iguales.
 */
export function OnlineScreen({
  badge,
  title,
  subtitle,
  backTo,
  backLabel,
  headerRight,
  onRefresh,
  refreshing = false,
  children,
}: ScreenProps): ReactElement {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={OnlineGradients.screen} style={styles.background}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={OnlinePalette.textMuted}
                colors={[OnlinePalette.accent]}
                progressBackgroundColor={OnlinePalette.surface}
              />
            ) : undefined
          }
        >
          <View style={styles.shell}>
            <Animated.View
              entering={FadeInDown.duration(460)}
              style={styles.header}
            >
              {backTo ? (
                <Pressable
                  onPress={() => {
                    playTick();
                    router.replace(backTo);
                  }}
                  style={({ pressed }) => [
                    styles.backLink,
                    pressed && styles.backLinkPressed,
                  ]}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={backLabel ?? t("common.backShort")}
                >
                  <Text style={styles.backLinkText}>
                    {backLabel ?? t("common.backShort")}
                  </Text>
                </Pressable>
              ) : null}

              {badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              ) : null}

              <View style={styles.titleRow}>
                <Text style={styles.title}>{title}</Text>
                {headerRight}
              </View>

              {subtitle ? (
                <Text style={styles.subtitle}>{subtitle}</Text>
              ) : null}
            </Animated.View>

            {children}
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: OnlinePalette.background,
  },
  background: {
    flex: 1,
    overflow: "hidden",
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
    marginBottom: 22,
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
    color: OnlinePalette.textMuted,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "System",
  },
  badge: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: OnlinePalette.surface,
    borderWidth: 1,
    borderColor: OnlinePalette.border,
    marginBottom: 16,
  },
  badgeText: {
    color: OnlinePalette.textSoft,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    fontFamily: "System",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    flex: 1,
    color: OnlinePalette.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    fontFamily: "System",
  },
  subtitle: {
    marginTop: 10,
    color: OnlinePalette.textMuted,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "System",
    maxWidth: 460,
  },
});
