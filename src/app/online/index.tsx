import { useFocusEffect, useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { describeError } from "@/api/errors";
import type {
  DailyStatus,
  FriendsOverview,
  GroupSummary,
  MyRanking,
} from "@/api/types";
import { SettingsButton } from "@/components/SettingsButton";
import { Avatar } from "@/design/Avatar";
import { Button } from "@/design/Button";
import { ErrorBanner, Pill, ProgressBar } from "@/design/Feedback";
import type { IconName } from "@/design/Icon";
import { Card, OptionRow, Screen, SectionHeader } from "@/design/Layout";
import { AmbientOrbs } from "@/design/Ambient";
import { Space, Type, type SpectrumTone } from "@/design/tokens";
import { t, type TranslationKey } from "@/i18n";
import { useSession } from "@/online/session";

/**
 * Punto de entrada del modo online: **un menú de cómo quieres jugar**.
 *
 * Antes era una lista plana de perfil, amigos y clasificación, es decir un
 * índice de la cuenta. Ahora lo primero es con quién compites —los grupos— y lo
 * social pasa a un bloque secundario. La identidad se queda arriba, pero
 * reducida a una tira: quién eres y cuánto te falta para el siguiente nivel.
 *
 * Crear y unirse a un grupo están también aquí, no solo dentro de la lista de
 * grupos: son las dos primeras cosas que hace alguien que acaba de entrar.
 */

interface AccountEntry {
  key: "profile" | "friends" | "leaderboard";
  route: "/online/profile" | "/online/friends" | "/online/leaderboard";
  icon: IconName;
  tone: SpectrumTone;
}

const ACCOUNT: AccountEntry[] = [
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

  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [daily, setDaily] = useState<DailyStatus | null>(null);
  const [ranking, setRanking] = useState<MyRanking | null>(null);
  const [friends, setFriends] = useState<FriendsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      // Todas a la vez: son independientes y así el menú abre de una tacada.
      const [groupsResult, rankingResult, friendsResult, dailyResult] =
        await Promise.all([
          api.groups.list(),
          api.leaderboards.me(),
          api.friends.list(),
          // El reto de hoy es lo primero que se mira al abrir: se pide aquí
          // para poder decir cuántos intentos quedan sin entrar. Si falla, la
          // fila se queda con su texto genérico en vez de tumbar el menú.
          api.daily.today().catch(() => null),
          reloadUser(),
        ]);
      setGroups(groupsResult.groups);
      setRanking(rankingResult);
      setFriends(friendsResult);
      setDaily(dailyResult);
    } catch (loadError) {
      setError(describeError(loadError));
    }
  }, [api, reloadUser]);

  // Al volver de un grupo el estado puede haber cambiado: una temporada que
  // termina, un aviso que se marca leído, alguien que entra.
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

  const activeGroups = groups?.filter((group) => group.status === "active") ?? [];
  const unread = groups?.reduce((total, group) => total + group.unreadCount, 0) ?? 0;
  const pendingRequests = friends?.incoming.length ?? 0;

  const accountBadge = (key: AccountEntry["key"]): string | null => {
    if (key === "friends") {
      return pendingRequests > 0 ? String(pendingRequests) : null;
    }
    if (key === "leaderboard" && ranking?.global.position) {
      return `#${ranking.global.position}`;
    }
    return null;
  };

  const dailyDescription = (): string => {
    if (!daily) {
      return t("online.hub.daily.description");
    }
    if (daily.attemptsLeft === 0) {
      return t("online.hub.daily.done");
    }
    return daily.attemptsLeft === 1
      ? t("online.hub.daily.oneLeft")
      : t("online.hub.daily.attemptsLeft", { count: daily.attemptsLeft });
  };

  const groupsDescription = (): string => {
    if (!groups || groups.length === 0) {
      return t("online.hub.groups.none");
    }
    if (activeGroups.length > 0) {
      return t("online.hub.groups.count", { count: activeGroups.length });
    }
    return t("online.hub.groups.description");
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
            <Avatar username={user.username} size={44} />
            <View style={styles.identityText}>
              <Text style={Type.bodyStrong} numberOfLines={1}>
                {user.username}
              </Text>
              <Text style={Type.caption} numberOfLines={1}>
                {t("online.xp", { xp: user.xp })} ·{" "}
                {t("online.xpToNext", { xp: user.progress.xpToNextLevel })}
              </Text>
            </View>
            <Pill label={t("online.level", { level: user.level })} tone="accent" />
          </View>
          <View style={styles.progressBlock}>
            <ProgressBar value={user.progress.progress} />
          </View>
        </Card>
      ) : null}

      {/* ----------------------------- Jugar ----------------------------- */}
      <SectionHeader title={t("online.hub.playSection")} hint={t("online.hub.playHint")} />

      <View style={styles.entries}>
        {/*
          El reto diario, lo primero: es la única cosa que se juega cada día y
          es global (5.3), así que no depende de tener ningún grupo.
        */}
        <OptionRow
          icon="palette"
          tone="amber"
          title={t("online.hub.daily.title")}
          description={dailyDescription()}
          badge={
            daily && daily.attemptsLeft > 0 ? (
              <Pill label={t("online.hub.daily.open")} tone="success" />
            ) : undefined
          }
          onPress={() => router.push("/online/daily")}
          enterDelay={STAGGER_MS}
        />

        <OptionRow
          icon="calendar"
          tone="teal"
          title={t("online.hub.groups.title")}
          description={groupsDescription()}
          badge={
            unread > 0 ? (
              <Pill label={t("online.groups.unread")} tone="accent" />
            ) : undefined
          }
          onPress={() => router.push("/online/groups")}
          enterDelay={STAGGER_MS * 2}
        />

        {/*
          Partidas 1v1 en tiempo real: decididas a nivel de producto pero
          aparcadas. La fila se pinta para que se vea qué falta, y se queda
          desactivada a propósito: no se promete nada más allá de esto.
        */}
        <OptionRow
          icon="swords"
          title={t("online.hub.match.title")}
          description={t("online.hub.match.description")}
          badge={<Pill label={t("landing.soon")} />}
          note={t("online.hub.match.locked")}
          onPress={() => undefined}
          disabled
          enterDelay={STAGGER_MS * 3}
        />
      </View>

      {/*
        Los dos atajos que más se usan al empezar. Están aquí además de dentro
        de la lista de grupos porque quien abre la app por primera vez no tiene
        ninguno, y quien recibe un código quiere teclearlo sin buscar dónde.
      */}
      <View style={styles.quickActions}>
        <Button
          label={t("online.hub.quickCreate")}
          icon="plus"
          variant="secondary"
          fullWidth={false}
          onPress={() =>
            router.push({
              pathname: "/online/groups",
              params: { action: "create" },
            })
          }
          style={styles.quickButton}
        />
        <Button
          label={t("online.hub.quickJoin")}
          icon="users"
          variant="secondary"
          fullWidth={false}
          onPress={() =>
            router.push({ pathname: "/online/groups", params: { action: "join" } })
          }
          style={styles.quickButton}
        />
      </View>

      {/* --------------------------- Tu cuenta --------------------------- */}
      <SectionHeader
        title={t("online.hub.accountSection")}
        hint={t("online.hub.accountHint")}
      />

      <View style={styles.entries}>
        {ACCOUNT.map((entry, index) => {
          const badge = accountBadge(entry.key);

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
              enterDelay={(index + 4) * STAGGER_MS}
            />
          );
        })}
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
    marginTop: Space.lg,
  },
  entries: {
    gap: Space.md,
    marginBottom: Space.xl,
  },
  quickActions: {
    flexDirection: "row",
    gap: Space.sm,
    marginBottom: Space.xxxl,
  },
  quickButton: {
    flex: 1,
  },
});
