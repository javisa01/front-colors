import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { describeError } from "@/api/errors";
import type { LeaderboardEntry, LeaderboardResponse } from "@/api/types";
import {
  Avatar,
  Card,
  EmptyState,
  ErrorBanner,
  GhostButton,
  Loading,
  SectionLabel,
} from "@/components/online/Controls";
import { OnlineScreen } from "@/components/online/Screen";
import { OnlinePalette, podiumEmoji } from "@/components/online/theme";
import { t } from "@/i18n";
import { useSession } from "@/online/session";
import { playTick } from "@/utils/sound";

type Scope = "global" | "friends";

const PAGE_SIZE = 20;

export default function LeaderboardScreen(): ReactElement {
  const { api, user } = useSession();

  const [scope, setScope] = useState<Scope>("global");
  const [page, setPage] = useState<LeaderboardResponse | null>(null);
  // `null` = todavia no ha llegado nada. Distinguirlo de `[]` permite derivar
  // el estado de carga del propio dato, sin un flag aparte que mantener.
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loading = entries === null && error === null;

  const fetchPage = useCallback(
    async (target: Scope, offset: number) => {
      const request =
        target === "global" ? api.leaderboards.global : api.leaderboards.friends;
      return request({ limit: PAGE_SIZE, offset });
    },
    [api],
  );

  /** Recarga la primera pagina desde un gesto del usuario: refrescar o reintentar. */
  const load = useCallback(
    async (target: Scope) => {
      try {
        const result = await fetchPage(target, 0);
        setPage(result);
        setEntries(result.entries);
        setError(null);
      } catch (loadError) {
        setError(describeError(loadError));
        setPage(null);
        setEntries([]);
      }
    },
    [fetchPage],
  );

  // La carga inicial va escrita aqui en vez de delegar en `load`: el analisis
  // de React necesita ver el `await` delante del setState para no tomarlo por
  // una escritura sincrona durante el efecto.
  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const result = await fetchPage(scope, 0);
        if (active) {
          setPage(result);
          setEntries(result.entries);
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(describeError(loadError));
          setPage(null);
          setEntries([]);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [scope, fetchPage]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(scope);
    setRefreshing(false);
  }, [load, scope]);

  const loadMore = useCallback(async () => {
    if (!page?.pagination.hasMore || loadingMore) {
      return;
    }
    setLoadingMore(true);
    try {
      const next = await fetchPage(
        scope,
        page.pagination.offset + page.pagination.limit,
      );
      setPage(next);
      setEntries((current) => [...(current ?? []), ...next.entries]);
    } catch (loadError) {
      setError(describeError(loadError));
    } finally {
      setLoadingMore(false);
    }
  }, [page, loadingMore, fetchPage, scope]);

  const switchScope = useCallback((next: Scope) => {
    playTick();
    setScope(next);
    setEntries(null);
    setPage(null);
    setError(null);
  }, []);

  return (
    <OnlineScreen
      badge={t("online.leaderboard.badge")}
      title={t("online.leaderboard.title")}
      subtitle={t("online.leaderboard.subtitle")}
      backTo="/online"
      onRefresh={refresh}
      refreshing={refreshing}
    >
      <View style={styles.tabs}>
        <ScopeTab
          label={t("online.leaderboard.global")}
          active={scope === "global"}
          onPress={() => switchScope("global")}
        />
        <ScopeTab
          label={t("online.leaderboard.friends")}
          active={scope === "friends"}
          onPress={() => switchScope("friends")}
        />
      </View>

      {error ? (
        <ErrorBanner
          message={error}
          onRetry={() => void load(scope)}
          retryLabel={t("common.retry")}
        />
      ) : null}

      {page ? (
        <SectionLabel
          title={
            scope === "global"
              ? t("online.leaderboard.global")
              : t("online.leaderboard.friends")
          }
          hint={t("online.leaderboard.total", {
            total: page.pagination.total,
          })}
        />
      ) : null}

      {loading ? (
        <Loading label={t("online.leaderboard.loading")} />
      ) : !entries || entries.length === 0 ? (
        <Card>
          <EmptyState
            emoji={scope === "global" ? "🏆" : "🫂"}
            title={
              scope === "global"
                ? t("online.leaderboard.emptyGlobal")
                : t("online.leaderboard.emptyFriends")
            }
            hint={
              scope === "global"
                ? t("online.leaderboard.emptyGlobalHint")
                : t("online.leaderboard.emptyFriendsHint")
            }
          />
        </Card>
      ) : (
        <Card>
          {entries.map((entry, index) => (
            <Row
              key={entry.userId}
              entry={entry}
              index={index}
              isMe={entry.userId === user?.id}
            />
          ))}

          {page?.pagination.hasMore ? (
            <View style={styles.moreRow}>
              <GhostButton
                label={
                  loadingMore
                    ? t("online.leaderboard.loadingMore")
                    : t("online.leaderboard.loadMore")
                }
                onPress={() => void loadMore()}
                disabled={loadingMore}
              />
            </View>
          ) : null}
        </Card>
      )}
    </OnlineScreen>
  );
}

function ScopeTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        active && styles.tabActive,
        pressed && styles.tabPressed,
      ]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Row({
  entry,
  index,
  isMe,
}: {
  entry: LeaderboardEntry;
  index: number;
  isMe: boolean;
}): ReactElement {
  const medal = podiumEmoji(entry.position);

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 12) * 45).duration(360)}
    >
      <View style={[styles.row, isMe && styles.rowMe]}>
        <View style={styles.position}>
          {medal ? (
            <Text style={styles.medal}>{medal}</Text>
          ) : (
            <Text style={styles.positionText}>{entry.position}</Text>
          )}
        </View>

        <Avatar username={entry.username} size={40} />

        <View style={styles.rowText}>
          <Text style={[styles.rowName, isMe && styles.rowNameMe]}>
            {entry.username}
            {isMe ? ` · ${t("online.leaderboard.you")}` : ""}
          </Text>
          <Text style={styles.rowMeta}>
            {t("online.level", { level: entry.level })}
          </Text>
        </View>

        <Text style={styles.xp}>{t("online.xp", { xp: entry.xp })}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 16,
    backgroundColor: OnlinePalette.surface,
    borderWidth: 1,
    borderColor: OnlinePalette.border,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: OnlinePalette.accentSurface,
    borderWidth: 1,
    borderColor: OnlinePalette.accent,
  },
  tabPressed: {
    opacity: 0.8,
  },
  tabText: {
    color: OnlinePalette.textMuted,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "System",
  },
  tabTextActive: {
    color: OnlinePalette.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: OnlinePalette.border,
  },
  rowMe: {
    backgroundColor: OnlinePalette.accentSurface,
    borderBottomColor: OnlinePalette.accent,
  },
  position: {
    width: 30,
    alignItems: "center",
  },
  positionText: {
    color: OnlinePalette.textFaint,
    fontSize: 14,
    fontWeight: "800",
    fontFamily: "System",
    fontVariant: ["tabular-nums"],
  },
  medal: {
    fontSize: 20,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    color: OnlinePalette.text,
    fontSize: 15,
    fontWeight: "800",
    fontFamily: "System",
  },
  rowNameMe: {
    color: OnlinePalette.accentSoft,
  },
  rowMeta: {
    marginTop: 3,
    color: OnlinePalette.textFaint,
    fontSize: 12,
    fontFamily: "System",
  },
  xp: {
    color: OnlinePalette.textSoft,
    fontSize: 14,
    fontWeight: "800",
    fontFamily: "System",
    fontVariant: ["tabular-nums"],
  },
  moreRow: {
    marginTop: 14,
  },
});
