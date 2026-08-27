import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { describeError } from "@/api/errors";
import type { LeaderboardEntry, LeaderboardResponse } from "@/api/types";
import { SettingsButton } from "@/components/SettingsButton";
import { Avatar } from "@/design/Avatar";
import { Button } from "@/design/Button";
import { EmptyState, ErrorBanner, Loading } from "@/design/Feedback";
import { SegmentedControl } from "@/design/Form";
import { Icon } from "@/design/Icon";
import { Card, Screen, SectionHeader } from "@/design/Layout";
import { Color, Duration, Radius, Space, Type } from "@/design/tokens";
import { t } from "@/i18n";
import { useSession } from "@/online/session";

type Scope = "global" | "friends";

const PAGE_SIZE = 20;

/**
 * Ranking mundial y de amigos.
 *
 * El podio ya no se marca con medallas de emoji —🥇🥈🥉 los dibuja el sistema
 * operativo, así que se veían distintos en cada teléfono y no se podían alinear
 * con las cifras de debajo—. El primer puesto lleva copa; el segundo y el
 * tercero, su número en el tono claro del texto en lugar del apagado. La
 * jerarquía se lee igual y todo cae en la misma rejilla.
 */
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
    setScope(next);
    setEntries(null);
    setPage(null);
    setError(null);
  }, []);

  return (
    <Screen
      eyebrow={t("online.leaderboard.badge")}
      title={t("online.leaderboard.title")}
      subtitle={t("online.leaderboard.subtitle")}
      backTo="/online"
      headerAction={<SettingsButton />}
      onRefresh={refresh}
      refreshing={refreshing}
    >
      <SegmentedControl
        options={[
          { value: "global", label: t("online.leaderboard.global") },
          { value: "friends", label: t("online.leaderboard.friends") },
        ]}
        value={scope}
        onChange={switchScope}
      />

      {error ? (
        <ErrorBanner
          message={error}
          onRetry={() => void load(scope)}
          retryLabel={t("common.retry")}
        />
      ) : null}

      {page ? (
        <SectionHeader
          title={
            scope === "global"
              ? t("online.leaderboard.global")
              : t("online.leaderboard.friends")
          }
          hint={t("online.leaderboard.total", { total: page.pagination.total })}
        />
      ) : null}

      {loading ? (
        <Loading label={t("online.leaderboard.loading")} />
      ) : !entries || entries.length === 0 ? (
        <Card>
          <EmptyState
            icon={scope === "global" ? "trophy" : "users"}
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
              last={index === entries.length - 1}
              isMe={entry.userId === user?.id}
            />
          ))}

          {page?.pagination.hasMore ? (
            <Button
              label={
                loadingMore
                  ? t("online.leaderboard.loadingMore")
                  : t("online.leaderboard.loadMore")
              }
              variant="secondary"
              size="md"
              onPress={() => void loadMore()}
              loading={loadingMore}
              style={styles.more}
            />
          ) : null}
        </Card>
      )}
    </Screen>
  );
}

function Row({
  entry,
  index,
  last,
  isMe,
}: {
  entry: LeaderboardEntry;
  index: number;
  last: boolean;
  isMe: boolean;
}): ReactElement {
  const leader = entry.position === 1;
  const podium = entry.position <= 3;

  return (
    <Animated.View
      entering={FadeIn.delay(Math.min(index, 12) * 35).duration(Duration.base)}
    >
      <View
        style={[
          styles.row,
          last && styles.rowLast,
          // La fila propia se marca con relleno y borde de acento: es el único
          // sitio de la lista donde el jugador se busca a sí mismo.
          isMe && styles.rowMe,
        ]}
      >
        <View
          style={styles.position}
          // La copa del primer puesto no lleva texto: sin esto, quien use un
          // lector de pantalla se quedaría sin saber en qué posición va.
          accessible
          accessibilityLabel={t("a11y.rank", { position: entry.position })}
        >
          {leader ? (
            <Icon name="trophy" size={18} color={Color.warning.default} />
          ) : (
            <Text
              style={[Type.metricSmall, podium && styles.positionPodium]}
            >
              {entry.position}
            </Text>
          )}
        </View>

        <Avatar username={entry.username} size={40} />

        <View style={styles.rowText}>
          <Text
            style={[Type.bodyStrong, isMe && styles.nameMe]}
            numberOfLines={1}
          >
            {entry.username}
            {isMe ? ` · ${t("online.leaderboard.you")}` : ""}
          </Text>
          <Text style={Type.caption}>
            {t("online.level", { level: entry.level })}
          </Text>
        </View>

        <Text style={[Type.metricSmall, styles.xp]}>
          {t("online.xp", { xp: entry.xp })}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    paddingVertical: Space.md,
    borderBottomWidth: 1,
    borderBottomColor: Color.border.subtle,
  },
  rowLast: {
    borderBottomWidth: 0,
    // La última fila no necesita relleno abajo: el hueco hasta el borde de la
    // tarjeta ya lo pone el propio `padding` de la tarjeta.
    paddingBottom: 0,
  },
  rowMe: {
    marginHorizontal: -Space.sm,
    paddingHorizontal: Space.sm,
    // ...salvo cuando esa última fila es la propia, que es la única que pinta
    // fondo. Ahí el relleno no es aire sobrante sino el interior del bloque de
    // acento, y sin él el color se corta a ras del nombre. Va después de
    // `rowLast` en el array de estilos, así que lo recupera.
    paddingVertical: Space.md,
    borderRadius: Radius.md,
    borderBottomColor: "transparent",
    backgroundColor: Color.accent.surface,
  },
  position: {
    width: 26,
    alignItems: "center",
  },
  positionPodium: {
    color: Color.text.primary,
  },
  rowText: {
    flex: 1,
    gap: Space.xxs,
  },
  nameMe: {
    color: Color.accent.text,
  },
  xp: {
    color: Color.text.primary,
  },
  more: {
    marginTop: Space.lg,
  },
});
