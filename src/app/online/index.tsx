import { useFocusEffect, useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { describeError } from "@/api/errors";
import type { FriendsOverview, MyRanking } from "@/api/types";
import { SettingsButton } from "@/components/SettingsButton";
import { Avatar } from "@/design/Avatar";
import { ErrorBanner, Pill, ProgressBar, Stat } from "@/design/Feedback";
import type { IconName } from "@/design/Icon";
import { Card, Divider, OptionRow, Screen } from "@/design/Layout";
import { AmbientOrbs } from "@/design/Ambient";
import { Color, Space, Type, type SpectrumTone } from "@/design/tokens";
import { t, type TranslationKey } from "@/i18n";
import { useSession } from "@/online/session";

/**
 * Punto de entrada del modo online: quién eres y a dónde puedes ir.
 *
 * Las tres entradas son la misma `OptionRow` que usan la portada y el menú
 * offline. Antes cada una llevaba su emoji sobre un degradado propio —azul,
 * verde, dorado—, así que la lista tenía tres colores fuertes que no
 * significaban nada y no se parecía a ninguna otra lista de la aplicación.
 */

interface HubEntry {
  key: "profile" | "friends" | "leaderboard";
  route: "/online/profile" | "/online/friends" | "/online/leaderboard";
  icon: IconName;
  tone: SpectrumTone;
}

const ENTRIES: HubEntry[] = [
  { key: "profile", route: "/online/profile", icon: "user", tone: "violet" },
  { key: "friends", route: "/online/friends", icon: "users", tone: "green" },
  {
    key: "leaderboard",
    route: "/online/leaderboard",
    icon: "trophy",
    tone: "amber",
  },
];

const STAGGER_MS = 45;

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
    <Screen
      eyebrow={t("online.hub.badge")}
      title={t("online.hub.title")}
      subtitle={t("online.hub.subtitle")}
      backTo="/"
      backdrop={<AmbientOrbs />}
      headerAction={<SettingsButton />}
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
        <Card enterDelay={0} style={styles.identityCard}>
          <View style={styles.identityRow}>
            <Avatar username={user.username} size={52} />
            <View style={styles.identityText}>
              <Text style={Type.heading} numberOfLines={1}>
                {user.username}
              </Text>
              <Text style={Type.caption} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
            <Pill label={t("online.level", { level: user.level })} tone="accent" />
          </View>

          <View style={styles.progressBlock}>
            <View style={styles.progressLabels}>
              <Text style={Type.metricSmall}>
                {t("online.xp", { xp: user.xp })}
              </Text>
              <Text style={Type.caption}>
                {t("online.xpToNext", { xp: user.progress.xpToNextLevel })}
              </Text>
            </View>
            <ProgressBar value={user.progress.progress} />
          </View>

          <Divider style={styles.divider} />

          <View style={styles.statsRow}>
            <Stat
              label={t("online.hub.globalRank")}
              value={
                ranking?.global.position ? `#${ranking.global.position}` : "—"
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
                ranking?.friends.position ? `#${ranking.friends.position}` : "—"
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
      ) : null}

      <View style={styles.entries}>
        {ENTRIES.map((entry, index) => {
          const badge = badgeFor(entry.key);

          return (
            <OptionRow
              key={entry.key}
              icon={entry.icon}
              tone={entry.tone}
              title={t(`online.hub.${entry.key}.title` as TranslationKey)}
              description={t(
                `online.hub.${entry.key}.description` as TranslationKey,
              )}
              badge={badge ? <Pill label={badge} tone="accent" /> : undefined}
              onPress={() => router.push(entry.route)}
              enterDelay={(index + 1) * STAGGER_MS}
            />
          );
        })}

        {/*
          Las partidas en tiempo real viajan por Socket.IO, no por REST. La fila
          queda visible pero desactivada para que se vea qué falta, igual que la
          portada hacía con el propio modo online.
        */}
        <OptionRow
          icon="swords"
          title={t("online.hub.match.title")}
          description={t("online.hub.match.description")}
          badge={<Pill label={t("landing.soon")} />}
          note={t("online.hub.match.locked")}
          onPress={() => undefined}
          disabled
          enterDelay={(ENTRIES.length + 1) * STAGGER_MS}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identityCard: {
    marginBottom: Space.xxl,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
  },
  identityText: {
    flex: 1,
    gap: Space.xxs,
  },
  progressBlock: {
    marginTop: Space.xl,
  },
  progressLabels: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: Space.sm,
  },
  divider: {
    marginTop: Space.xl,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  statDivider: {
    width: 1,
    backgroundColor: Color.border.subtle,
  },
  entries: {
    gap: Space.md,
  },
});
