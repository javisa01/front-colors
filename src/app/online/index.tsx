import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { describeError } from "@/api/errors";
import type { FriendsOverview, MyRanking } from "@/api/types";
import {
  Avatar,
  Card,
  ErrorBanner,
  Pill,
  ProgressBar,
} from "@/components/online/Controls";
import { OnlineScreen } from "@/components/online/Screen";
import { OnlineGradients, OnlinePalette } from "@/components/online/theme";
import { t, type TranslationKey } from "@/i18n";
import { useSession } from "@/online/session";
import { playTick } from "@/utils/sound";

interface HubEntry {
  key: "profile" | "friends" | "leaderboard";
  route: "/online/profile" | "/online/friends" | "/online/leaderboard";
  emoji: string;
  colors: readonly [string, string];
}

const ENTRIES: HubEntry[] = [
  {
    key: "profile",
    route: "/online/profile",
    emoji: "👤",
    colors: OnlineGradients.accent,
  },
  {
    key: "friends",
    route: "/online/friends",
    emoji: "🤝",
    colors: OnlineGradients.success,
  },
  {
    key: "leaderboard",
    route: "/online/leaderboard",
    emoji: "🏆",
    colors: OnlineGradients.gold,
  },
];

export default function OnlineHubScreen(): ReactElement {
  const { user, api, reloadUser } = useSession();
  const router = useRouter();

  const [ranking, setRanking] = useState<MyRanking | null>(null);
  const [friends, setFriends] = useState<FriendsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      // Las tres en paralelo: son independientes y así el hub abre de una vez.
      const [rankingResult, friendsResult] = await Promise.all([
        api.leaderboards.me(),
        api.friends.list(),
        reloadUser(),
      ]);
      setRanking(rankingResult);
      setFriends(friendsResult);
    } catch (loadError) {
      setError(describeError(loadError));
    }
  }, [api, reloadUser]);

  // Al volver de amigos o perfil los contadores pueden haber cambiado.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const pendingRequests = friends?.incoming.length ?? 0;

  const badgeFor = (key: HubEntry["key"]): string | null => {
    if (key === "friends") {
      return pendingRequests > 0 ? String(pendingRequests) : null;
    }
    if (key === "leaderboard" && ranking?.global.position) {
      return `#${ranking.global.position}`;
    }
    return null;
  };

  return (
    <OnlineScreen
      badge={t("online.hub.badge")}
      title={t("online.hub.title")}
      subtitle={t("online.hub.subtitle")}
      backTo="/"
      backLabel={t("common.back")}
      onRefresh={refresh}
      refreshing={refreshing}
    >
      {error ? (
        <ErrorBanner
          message={error}
          onRetry={() => void load()}
          retryLabel={t("common.retry")}
        />
      ) : null}

      {user ? (
        <Animated.View entering={FadeInDown.delay(80).duration(460)}>
          <Card>
            <View style={styles.identityRow}>
              <Avatar username={user.username} size={54} />
              <View style={styles.identityText}>
                <Text style={styles.username}>{user.username}</Text>
                <Text style={styles.email}>{user.email}</Text>
              </View>
              <Pill label={t("online.level", { level: user.level })} tone="accent" />
            </View>

            <View style={styles.progressBlock}>
              <View style={styles.progressLabels}>
                <Text style={styles.progressLabel}>
                  {t("online.xp", { xp: user.xp })}
                </Text>
                <Text style={styles.progressLabel}>
                  {t("online.xpToNext", { xp: user.progress.xpToNextLevel })}
                </Text>
              </View>
              <ProgressBar value={user.progress.progress} />
            </View>

            <View style={styles.statsRow}>
              <Stat
                label={t("online.hub.globalRank")}
                value={
                  ranking?.global.position
                    ? `#${ranking.global.position}`
                    : "—"
                }
                hint={
                  ranking
                    ? t("online.hub.ofPlayers", { total: ranking.global.total })
                    : undefined
                }
              />
              <View style={styles.statDivider} />
              <Stat
                label={t("online.hub.friendsRank")}
                value={
                  ranking?.friends.position
                    ? `#${ranking.friends.position}`
                    : "—"
                }
                hint={
                  friends
                    ? t("online.hub.friendCount", {
                        count: friends.friends.length,
                      })
                    : undefined
                }
              />
            </View>
          </Card>
        </Animated.View>
      ) : null}

      {ENTRIES.map((entry, index) => {
        const badge = badgeFor(entry.key);

        return (
          <Animated.View
            key={entry.key}
            entering={FadeInDown.delay(150 + index * 80).duration(460)}
          >
            <Pressable
              onPress={() => {
                playTick();
                router.push(entry.route);
              }}
              style={({ pressed }) => [
                styles.entryCard,
                pressed && styles.entryCardPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t(`online.hub.${entry.key}.title` as TranslationKey)}
            >
              <View style={styles.entryRow}>
                <LinearGradient
                  colors={entry.colors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.entryIcon}
                >
                  <Text style={styles.entryEmoji}>{entry.emoji}</Text>
                </LinearGradient>

                <View style={styles.entryTextGroup}>
                  <View style={styles.entryTitleRow}>
                    <Text style={styles.entryTitle}>
                      {t(`online.hub.${entry.key}.title` as TranslationKey)}
                    </Text>
                    {badge ? <Pill label={badge} tone="accent" /> : null}
                  </View>
                  <Text style={styles.entryDescription}>
                    {t(`online.hub.${entry.key}.description` as TranslationKey)}
                  </Text>
                </View>

                <Text style={styles.entryArrow}>›</Text>
              </View>
            </Pressable>
          </Animated.View>
        );
      })}

      {/*
        Las partidas en tiempo real viajan por Socket.IO, no por REST. La
        tarjeta queda visible pero bloqueada para que se vea qué falta, igual
        que hacía la pantalla de inicio con el propio modo online.
      */}
      <Animated.View entering={FadeInDown.delay(390).duration(460)}>
        <View style={[styles.entryCard, styles.entryCardDisabled]}>
          <View style={styles.entryRow}>
            <LinearGradient
              colors={["#52525B", "#3F3F46"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.entryIcon}
            >
              <Text style={styles.entryEmoji}>⚔️</Text>
            </LinearGradient>

            <View style={styles.entryTextGroup}>
              <View style={styles.entryTitleRow}>
                <Text style={styles.entryTitle}>
                  {t("online.hub.match.title")}
                </Text>
                <Pill label={t("landing.soon")} />
              </View>
              <Text style={styles.entryDescription}>
                {t("online.hub.match.description")}
              </Text>
              <Text style={styles.lockedHint}>
                🔒 {t("online.hub.match.locked")}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </OnlineScreen>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}): ReactElement {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  identityText: {
    flex: 1,
  },
  username: {
    color: OnlinePalette.text,
    fontSize: 20,
    fontWeight: "800",
    fontFamily: "System",
  },
  email: {
    marginTop: 3,
    color: OnlinePalette.textFaint,
    fontSize: 13,
    fontFamily: "System",
  },
  progressBlock: {
    marginTop: 18,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: {
    color: OnlinePalette.textMuted,
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "System",
    fontVariant: ["tabular-nums"],
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: OnlinePalette.border,
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    backgroundColor: OnlinePalette.border,
  },
  statLabel: {
    color: OnlinePalette.textFaint,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontFamily: "System",
  },
  statValue: {
    marginTop: 6,
    color: OnlinePalette.text,
    fontSize: 22,
    fontWeight: "800",
    fontFamily: "System",
    fontVariant: ["tabular-nums"],
  },
  statHint: {
    marginTop: 3,
    color: OnlinePalette.textDim,
    fontSize: 11,
    fontFamily: "System",
  },
  entryCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: OnlinePalette.surface,
    borderWidth: 1,
    borderColor: OnlinePalette.border,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  entryCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
    borderColor: OnlinePalette.accent,
  },
  entryCardDisabled: {
    opacity: 0.7,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  entryIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  entryEmoji: {
    fontSize: 24,
  },
  entryTextGroup: {
    flex: 1,
  },
  entryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  entryTitle: {
    color: OnlinePalette.text,
    fontSize: 18,
    fontWeight: "800",
    fontFamily: "System",
  },
  entryDescription: {
    marginTop: 4,
    color: OnlinePalette.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "System",
  },
  lockedHint: {
    marginTop: 8,
    color: OnlinePalette.textFaint,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "System",
  },
  entryArrow: {
    color: OnlinePalette.textDim,
    fontSize: 28,
    fontWeight: "300",
    marginLeft: 10,
  },
});
