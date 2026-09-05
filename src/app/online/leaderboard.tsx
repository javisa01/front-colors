import { LinearGradient } from "expo-linear-gradient";
import type { ReactElement } from "react";
import { useOnlineTabBarSpace } from "@/components/online/OnlineTabBar";
import { AmbientAscent } from "@/design/Ambient";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { describeError } from "@/api/errors";
import type { LeaderboardEntry, LeaderboardResponse, MyRanking } from "@/api/types";
import { SettingsButton } from "@/components/SettingsButton";
import { Avatar } from "@/design/Avatar";
import { Button } from "@/design/Button";
import { EmptyState, ErrorBanner, Loading } from "@/design/Feedback";
import { SegmentedControl } from "@/design/Form";
import { Icon } from "@/design/Icon";
import { Card, Screen, SectionHeader } from "@/design/Layout";
import { useColors, useThemedStyles } from "@/design/theme";
import {
  Duration,
  Radius,
  SECTION_TONE,
  Space,
  Type,
  type Palette,
} from "@/design/tokens";
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
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const { api, user } = useSession();
  const tabBarSpace = useOnlineTabBarSpace();

  const [scope, setScope] = useState<Scope>("global");
  const [page, setPage] = useState<LeaderboardResponse | null>(null);
  // `null` = todavia no ha llegado nada. Distinguirlo de `[]` permite derivar
  // el estado de carga del propio dato, sin un flag aparte que mantener.
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /**
   * Mi puesto, preguntado aparte.
   *
   * No sale de la lista: con ciento cincuenta jugadores el propio puede estar
   * en la página siete, y hasta que no se cargan las seis anteriores no
   * aparece. `/leaderboards/me` lo devuelve de un tiro —posición global, de
   * amigos y mis cifras—, así que la fila fijada se puede pintar desde el
   * primer momento.
   */
  const [mine, setMine] = useState<MyRanking | null>(null);
  /**
   * Lo que ocupa la fila fijada, medido.
   *
   * Hace falta porque esa fila **flota** sobre el contenido: sin descontar su
   * alto del relleno inferior de la lista, lo último que hay —el botón de
   * cargar más— queda debajo y no se puede pulsar. Pasó, y deja el ranking
   * inutilizable justo cuando más se necesita, que es cuando hay tanta gente
   * que tu puesto no cabe en la primera página.
   *
   * Se mide en vez de estimarse: el alto depende del tamaño de letra del
   * sistema y de cuánto mida la zona segura de cada teléfono.
   */
  const [pinnedHeight, setPinnedHeight] = useState(0);

  const loading = entries === null && error === null;

  const fetchPage = useCallback(
    async (target: Scope, offset: number) => {
      const request =
        target === "global" ? api.leaderboards.global : api.leaderboards.friends;
      return request({ limit: PAGE_SIZE, offset });
    },
    [api],
  );

  /**
   * Mi puesto. Falla en silencio a propósito: es un añadido a la lista, y un
   * error aquí no puede tapar el ranking, que es lo que se venía a ver.
   */
  const loadMine = useCallback(async () => {
    try {
      setMine(await api.leaderboards.me());
    } catch {
      setMine(null);
    }
  }, [api]);

  /** Recarga la primera pagina desde un gesto del usuario: refrescar o reintentar. */
  const load = useCallback(
    async (target: Scope) => {
      try {
        const result = await fetchPage(target, 0);
        setPage(result);
        setEntries(result.entries);
        setError(null);
        void loadMine();
      } catch (loadError) {
        setError(describeError(loadError));
        setPage(null);
        setEntries([]);
      }
    },
    [fetchPage, loadMine],
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
          void loadMine();
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
  }, [scope, fetchPage, loadMine]);

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

  const measurePinned = useCallback((event: LayoutChangeEvent) => {
    setPinnedHeight(event.nativeEvent.layout.height);
  }, []);

  const switchScope = useCallback((next: Scope) => {
    setScope(next);
    setEntries(null);
    setPage(null);
    setError(null);
  }, []);

  /**
   * La fila fijada: mi puesto, anclado abajo, **solo cuando no se ve ya**.
   *
   * La condición es «no está en lo cargado», no «no está en la primera
   * página»: quien va pulsando «cargar más» acaba llegando a su propia fila, y
   * a partir de ahí la copia de abajo sería la misma fila dos veces en
   * pantalla. En cuanto aparece de verdad en la lista, esto desaparece.
   *
   * `position` puede ser `null` —sin amigos todavía, por ejemplo—: entonces no
   * hay puesto que enseñar y no se pinta nada. Enseñar un guion en el hueco
   * sería ocupar sitio para decir que no hay nada que decir.
   */
  const myPosition =
    scope === "global" ? mine?.global.position : mine?.friends.position;

  const alreadyVisible = entries?.some((entry) => entry.userId === user?.id);

  const pinned: LeaderboardEntry | null =
    mine != null && myPosition != null && !alreadyVisible
      ? {
          position: myPosition,
          userId: mine.user.userId,
          username: mine.user.username,
          level: mine.user.level,
          xp: mine.user.xp,
        }
      : null;

  return (
    <Screen
      eyebrow={t("online.leaderboard.badge")}
      title={t("online.leaderboard.title")}
      subtitle={t("online.leaderboard.subtitle")}
      backdrop={<AmbientAscent />}
      /*
        El hueco de abajo es el de la barra de pestañas, salvo cuando hay fila
        fijada: entonces manda lo que ella ocupa, que ya incluye ese mismo
        hueco. Así el botón de cargar más siempre acaba por encima de ella.
      */
      contentStyle={{
        paddingBottom: pinned != null ? Math.max(tabBarSpace, pinnedHeight) : tabBarSpace,
      }}
      headerAction={<SettingsButton />}
      onRefresh={refresh}
      refreshing={refreshing}
      footer={
        pinned != null ? (
          <View style={styles.pinned} onLayout={measurePinned}>
            {/*
              El lienzo se derrama desde abajo y se disuelve por encima de la
              tarjeta.

              Sin esto quedaban dos objetos flotando con un trozo de lista
              asomando entre ellos —la tarjeta y la pastilla de pestañas—, y esa
              franja de nombres a medio tapar se leía como un fallo de pintado.
              Es el mismo recurso que usa la portada con el velo del titular:
              atmósfera en vez de una barra opaca, que es justo lo que la barra
              de pestañas evita a propósito.

              El extremo transparente se escribe con el MISMO color en alfa cero
              y no con `transparent`: interpolar desde un negro transparente deja
              una banda gris en Android.
            */}
            <LinearGradient
              colors={[`${colors.surface.canvas}00`, colors.surface.canvas]}
              locations={[0, 0.55]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={[styles.pinnedBody, { paddingBottom: tabBarSpace }]}>
              <View style={styles.pinnedCard}>
                <Row entry={pinned} index={0} last isMe pinned />
              </View>
            </View>
          </View>
        ) : null
      }
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

      {/*
        Un fallo sin datos NO es una clasificación vacía. Enseñar «no hay
        nadie» cuando lo que ha pasado es que no se ha podido preguntar es
        mentir sobre el estado del servidor, y encima deja al jugador sin
        entender por qué su propio nombre no sale.
      */}
      {loading ? (
        <Loading label={t("online.leaderboard.loading")} />
      ) : error && !entries ? null : !entries || entries.length === 0 ? (
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
        <Card tone={SECTION_TONE.ranking}>
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
  pinned = false,
}: {
  entry: LeaderboardEntry;
  index: number;
  last: boolean;
  isMe: boolean;
  /**
   * La copia anclada abajo. Entra sin animación: la escalonada de la lista
   * cuenta que las filas van llegando, y esta no llega — ya estaba.
   */
  pinned?: boolean;
}): ReactElement {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const leader = entry.position === 1;
  const podium = entry.position <= 3;

  return (
    <Animated.View
      entering={
        pinned
          ? undefined
          : FadeIn.delay(Math.min(index, 12) * 35).duration(Duration.base)
      }
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
            <Icon name="trophy" size={18} color={colors.warning.default} />
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

const createStyles = (c: Palette) =>
  StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    paddingVertical: Space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border.subtle,
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
    backgroundColor: c.accent.surface,
  },
  position: {
    width: 26,
    alignItems: "center",
  },
  positionPodium: {
    color: c.text.primary,
  },
  rowText: {
    flex: 1,
    gap: Space.xxs,
  },
  nameMe: {
    color: c.accent.text,
  },
  xp: {
    color: c.text.primary,
  },
  more: {
    marginTop: Space.lg,
  },
  /**
   * El envoltorio de la fila fijada. Solo pone los márgenes; el fondo lo pinta
   * `pinnedCard`, porque si lo pintara este, el color llegaría hasta el borde
   * de la pantalla y se leería como una barra del sistema y no como una fila
   * del ranking que se ha quedado a la vista.
   */
  pinned: {
    // Sin relleno: lo pone `pinnedBody`. Aquí solo vive el degradado, que tiene
    // que llegar hasta el borde de la pantalla por los cuatro lados.
    paddingTop: Space.xl,
  },
  pinnedBody: {
    paddingHorizontal: Space.lg,
  },
  pinnedCard: {
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.border.default,
    // Opaco: flota sobre la lista, y con transparencia se leerían los nombres
    // de debajo cruzando el propio.
    backgroundColor: c.surface.elevated,
    // La misma sombra que usa un modal, y por el mismo motivo: decir que esto
    // está en otro plano y no es la última fila de la lista.
    shadowColor: "#000000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  });
