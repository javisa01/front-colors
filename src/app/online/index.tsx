import { useFocusEffect, useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { describeError } from "@/api/errors";
import type {
  DailyGroupStatus,
  DailyOverview,
  FriendsOverview,
  GroupSummary,
  MyRanking,
} from "@/api/types";
import { SettingsButton } from "@/components/SettingsButton";
import { AmbientOrbit } from "@/design/Ambient";
import { Avatar } from "@/design/Avatar";
import { Button } from "@/design/Button";
import { EmptyState, ErrorBanner, Pill, ProgressBar, Stat } from "@/design/Feedback";
import { Icon, type IconName } from "@/design/Icon";
import {
  Card,
  Divider,
  OptionRow,
  Screen,
  SectionHeader,
  TextLink,
} from "@/design/Layout";
import { Color, Radius, Space, Type, type SpectrumTone } from "@/design/tokens";
import { t, type TranslationKey } from "@/i18n";
import { membersLabel, seasonLabel, sortGroups } from "@/online/groups";
import { useSession } from "@/online/session";

/**
 * Punto de entrada del modo online: **un menú de cómo quieres jugar**.
 *
 * Antes era una lista plana de perfil, amigos y clasificación, es decir un
 * índice de la cuenta. Ahora lo primero es con quién compites —los grupos— y lo
 * social pasa a un bloque secundario.
 *
 * ## La jerarquía
 *
 * Todo estaba dicho con la misma fila: el reto de hoy, los grupos y «ver mi
 * perfil» pesaban lo mismo en pantalla aunque no pesen lo mismo en el juego.
 * Ahora hay cuatro alturas, y cada cosa está a la suya:
 *
 *  1. **Tu puntuación**, la tarjeta grande. Es lo que se viene a mirar: el
 *     nivel, cuánto falta para el siguiente, el puesto global, el puesto entre
 *     amigos y lo que hiciste hoy.
 *  2. **El reto de hoy**, tarjeta destacada. Es la única cosa que caduca.
 *  3. **Tus grupos**, una tarjeta por grupo, y debajo el enlace a la lista
 *     completa. Es el contenido propio del jugador, así que se enseña, no se
 *     resume en una fila que dice «3 activos».
 *  4. **El resto**, filas: la partida en tiempo real que aún no existe, y los
 *     accesos a la cuenta.
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

/**
 * Cuántos grupos se enseñan en el hub.
 *
 * Van ordenados por urgencia —el que antes termina, primero—, así que estos
 * tres son los que de verdad hay que mirar hoy. El resto está a un toque, en el
 * enlace de debajo: el hub es un menú, y un menú que crece sin tope con la
 * cantidad de grupos deja de poder recorrerse de un vistazo.
 */
const MAX_HUB_GROUPS = 3;

export default function OnlineHubScreen(): ReactElement {
  const { user, api, reloadUser } = useSession();
  const router = useRouter();

  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [daily, setDaily] = useState<DailyOverview | null>(null);
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
          // En qué grupos queda reto por jugar hoy. Se pide aquí para poder
          // enseñar el botón de jugar en cada tarjeta sin entrar en ninguna.
          // Si falla, las tarjetas se quedan sin botón en vez de tumbar el
          // menú.
          api.daily.overview().catch(() => null),
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

  /**
   * Los grupos que se enseñan, ordenados por lo que hay que hacer hoy.
   *
   * Primero los que se pueden jugar —el reto de cada grupo es distinto y son
   * los que caducan esta tarde—, y dentro de cada bloque el orden de siempre:
   * los que siguen compitiendo antes que los terminados, y de ellos el que
   * antes acaba. Así, con tres huecos y cinco grupos, salen los tres en los que
   * queda algo por hacer; y si ya se jugaron todos, salen tres cualesquiera
   * para poder entrar a mirar la clasificación.
   */
  const dailyByGroup = new Map<string, DailyGroupStatus>(
    (daily?.groups ?? []).map((entry) => [entry.groupId, entry]),
  );

  const canPlayIn = (group: GroupSummary): boolean =>
    dailyByGroup.get(group.id)?.canPlay ?? false;

  const myGroups = groups
    ? sortGroups(groups).sort(
        (a, b) => Number(canPlayIn(b)) - Number(canPlayIn(a)),
      )
    : null;
  const shownGroups = myGroups?.slice(0, MAX_HUB_GROUPS) ?? null;
  const hasGroups = myGroups != null && myGroups.length > 0;
  const playableCount = myGroups?.filter(canPlayIn).length ?? 0;

  /**
   * Los puntos de hoy, sumando el mejor intento de cada grupo.
   *
   * Sustituye a la «mejor puntuación del día», que con un reto por grupo ya no
   * es una cifra sola. Sumar es además lo que cuenta la historia nueva: cuantos
   * más grupos, más se puede puntuar en un día. `null` mientras no se haya
   * jugado nada, para no enseñar un cero que parece un mal resultado.
   */
  const todayPoints =
    daily == null
      ? null
      : (daily.groups.reduce((total, entry) => total + (entry.bestScore ?? 0), 0) ||
        null);
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

  return (
    <Screen
      eyebrow={t("online.hub.badge")}
      title={t("online.hub.title")}
      subtitle={t("online.hub.subtitle")}
      backTo="/"
      backdrop={<AmbientOrbit />}
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

      {/* ------------------------ Tu puntuación ------------------------ */}
      {user ? (
        <ScoreCard
          username={user.username}
          level={user.level}
          xpIntoLevel={user.progress.xpIntoLevel}
          nextLevelXp={user.progress.nextLevelXp}
          progress={user.progress.progress}
          ranking={ranking}
          todayPoints={todayPoints}
        />
      ) : null}

      {/*
        --------------------- Jugar: tus grupos ---------------------

        Aquí no hay una tarjeta de «reto de hoy», porque **no hay un reto de
        hoy**: hay uno por grupo, con imágenes distintas y con sus propios dos
        intentos. Estar en cinco grupos son cinco retos al día, y por eso lo que
        se enseña es la lista de grupos y no un botón único.

        Los que se pueden jugar salen primero y llevan su botón; los que ya se
        jugaron —o cuya temporada terminó— salen sin él y solo abren la ficha
        del grupo.
      */}
      <SectionHeader
        title={t("online.hub.playSection")}
        hint={t(
          !hasGroups
            ? "online.hub.playHint"
            : playableCount > 0
              ? "online.hub.playHintPending"
              : "online.hub.playHintDone",
        )}
      />

      {shownGroups && shownGroups.length > 0 ? (
        <View style={styles.groupBlock}>
          <View style={styles.groupList}>
            {shownGroups.map((group, index) => (
              <GroupCard
                key={group.id}
                group={group}
                daily={dailyByGroup.get(group.id)}
                enterDelay={index * STAGGER_MS}
                onOpen={() =>
                  router.push({
                    pathname: "/online/groups/[id]",
                    params: { id: group.id },
                  })
                }
                onPlay={() =>
                  router.push({
                    pathname: "/online/daily",
                    params: { group: group.id },
                  })
                }
              />
            ))}
          </View>

          {/*
            Debajo de todas las tarjetas, y como enlace y no como botón: «ver
            todo» no es una decisión del mismo peso que jugar o crear un grupo,
            y con un botón a ancho completo lo parecía.
          */}
          <TextLink
            label={t("online.hub.seeAllGroups")}
            onPress={() => router.push("/online/groups")}
          />
        </View>
      ) : (
        <Card style={styles.groupsEmpty}>
          <EmptyState
            icon="users"
            title={t("online.hub.groupsEmpty")}
            hint={t("online.hub.groupsEmptyHint")}
          />
        </Card>
      )}

      {/* ---------------------------- Más ------------------------------ */}
      <SectionHeader title={t("online.hub.moreSection")} />

      <View style={styles.entries}>
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
              enterDelay={index * STAGGER_MS}
            />
          );
        })}
      </View>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Tu puntuación
// ---------------------------------------------------------------------------

/**
 * La tarjeta grande del hub.
 *
 * Antes era una tira: avatar, nombre, una línea de XP y la barra. Decía quién
 * eres, pero no cómo vas, que es justo lo que se viene a mirar. Ahora lleva las
 * tres cifras que se comparan —puesto global, puesto entre amigos y lo que
 * hiciste hoy— además del nivel y de cuánto falta para el siguiente.
 *
 * Se separa del resto de tarjetas por el fondo teñido de acento y por el tamaño
 * del avatar y de las cifras. Es la única superficie acentuada de la pantalla:
 * si hubiera dos, ninguna sería la principal.
 */
function ScoreCard({
  username,
  level,
  xpIntoLevel,
  nextLevelXp,
  progress,
  ranking,
  todayPoints,
}: {
  username: string;
  level: number;
  xpIntoLevel: number;
  nextLevelXp: number;
  progress: number;
  ranking: MyRanking | null;
  /** Suma de lo mejor de hoy en todos los grupos. `null` si aún no ha jugado. */
  todayPoints: number | null;
}): ReactElement {
  /** Sin puesto todavía —nadie ha jugado, o tú no— se enseña una raya. */
  const rank = (position: number | null | undefined): string =>
    position ? `#${position}` : t("online.hub.unranked");

  return (
    <Card style={styles.scoreCard}>
      <View style={styles.scoreHead}>
        <Avatar username={username} size={56} />
        <View style={styles.scoreIdentity}>
          <Text style={Type.heading} numberOfLines={1}>
            {username}
          </Text>
          <Text style={Type.caption} numberOfLines={1}>
            {t("online.hub.levelProgress", {
              current: xpIntoLevel,
              total: nextLevelXp,
              next: level + 1,
            })}
          </Text>
        </View>
        <Pill label={t("online.level", { level })} tone="accent" />
      </View>

      <View style={styles.scoreProgress}>
        <ProgressBar value={progress} />
      </View>

      <Divider style={styles.scoreDivider} />

      <View style={styles.scoreStats}>
        <Stat
          value={rank(ranking?.global.position)}
          label={t("online.hub.globalRank")}
          hint={
            ranking
              ? t("online.hub.ofPlayers", { total: ranking.global.total })
              : undefined
          }
        />
        <Stat
          value={rank(ranking?.friends.position)}
          label={t("online.hub.friendsRank")}
          hint={
            ranking
              ? t("online.hub.ofPlayers", { total: ranking.friends.total })
              : undefined
          }
        />
        <Stat
          value={todayPoints != null ? String(todayPoints) : t("online.hub.unranked")}
          label={t("online.hub.todayPoints")}
          hint={t("online.hub.todayPointsHint")}
        />
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta de grupo
// ---------------------------------------------------------------------------

/**
 * Un grupo del jugador, con el reto de hoy dentro.
 *
 * Es la pieza central del menú desde que **cada grupo tiene su propio reto**.
 * La versión anterior resumía todos los grupos en una fila que decía «3
 * activos» y ponía aparte un botón único de «reto de hoy»; las dos cosas eran
 * mentira a la vez: ni el recuento decía en cuál hay algo que hacer, ni el reto
 * era uno solo.
 *
 * Cuando queda algo por jugar la tarjeta se abre entera —icono grande, nombre a
 * tamaño de título y botón de jugar—, porque es lo que caduca esta tarde. Ya
 * jugado, o con la temporada terminada, se queda en una fila: sigue siendo un
 * sitio al que entrar, pero ya no es una tarea.
 */
function GroupCard({
  group,
  daily,
  enterDelay,
  onOpen,
  onPlay,
}: {
  group: GroupSummary;
  /** Estado del reto de hoy en este grupo. `undefined` si no se pudo cargar. */
  daily: DailyGroupStatus | undefined;
  enterDelay: number;
  onOpen: () => void;
  onPlay: () => void;
}): ReactElement {
  const finished = group.status === "finished";
  const tone: SpectrumTone = finished ? "rose" : "teal";
  const icon: IconName = finished ? "hourglass" : "calendar";
  const meta = `${membersLabel(group.memberCount)} · ${seasonLabel(group)}`;

  const statusPill = (
    <Pill
      label={t(
        finished ? "online.groups.statusFinished" : "online.groups.statusActive",
      )}
      tone={finished ? "neutral" : "success"}
    />
  );
  const unreadPill =
    group.unreadCount > 0 ? (
      <Pill label={t("online.groups.unread")} tone="accent" />
    ) : null;

  // Sin datos del reto no se promete nada: la tarjeta queda como fila y el
  // jugador entra al grupo, donde sí se sabe si puede jugar.
  if (!daily?.canPlay) {
    return (
      <OptionRow
        icon={icon}
        tone={tone}
        title={group.name}
        description={meta}
        note={
          daily && daily.attemptsLeft === 0
            ? t("online.hub.group.played", { score: daily.bestScore ?? 0 })
            : undefined
        }
        badge={unreadPill ?? statusPill}
        onPress={onOpen}
        enterDelay={enterDelay}
      />
    );
  }

  return (
    <Card enterDelay={enterDelay} style={styles.groupCard}>
      {/* El cuerpo abre la ficha del grupo; el botón va directo al reto. */}
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [styles.groupHead, pressed && styles.groupHeadPressed]}
        accessibilityRole="button"
        accessibilityLabel={group.name}
        accessibilityHint={meta}
      >
        <View
          style={[
            styles.groupIcon,
            {
              backgroundColor: Color.spectrum[tone].surface,
              borderColor: Color.spectrum[tone].border,
            },
          ]}
        >
          <Icon name={icon} size={24} color={Color.spectrum[tone].icon} />
        </View>

        <View style={styles.groupBody}>
          <View style={styles.groupTitleRow}>
            <Text style={Type.title} numberOfLines={1}>
              {group.name}
            </Text>
            {unreadPill}
          </View>
          <Text style={[Type.body, styles.groupMeta]}>{meta}</Text>
        </View>

        <Icon name="chevronRight" size={18} color={Color.text.faint} />
      </Pressable>

      <Button
        label={t(
          daily.attemptsUsed > 0
            ? "online.daily.playSecond"
            : "online.hub.group.play",
        )}
        icon="play"
        onPress={onPlay}
        style={styles.groupAction}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  scoreCard: {
    marginBottom: Space.xxl,
    padding: Space.xl,
    // La única superficie acentuada de la pantalla. Es lo que la separa de las
    // demás tarjetas sin tener que hacerla más grande todavía.
    backgroundColor: Color.accent.surface,
    borderColor: Color.accent.border,
  },
  scoreHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
  },
  scoreIdentity: {
    flex: 1,
    gap: Space.xxs,
  },
  scoreProgress: {
    marginTop: Space.lg,
  },
  scoreDivider: {
    marginVertical: Space.lg,
    // Sobre fondo acentuado el divisor por defecto desaparece.
    backgroundColor: Color.accent.border,
  },
  scoreStats: {
    flexDirection: "row",
  },
  groupCard: {
    padding: Space.xl,
  },
  groupHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
  },
  groupHeadPressed: {
    opacity: 0.7,
  },
  groupIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  groupBody: {
    flex: 1,
  },
  groupTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: Space.sm,
  },
  groupMeta: {
    marginTop: Space.xs,
  },
  groupAction: {
    marginTop: Space.lg,
  },
  groupBlock: {
    // Cierra la sección con el mismo aire que los demás bloques. El enlace ya
    // trae sus 44 puntos de área táctil, así que aquí basta con lo que falta
    // para llegar a la separación habitual entre secciones.
    marginBottom: Space.md,
  },
  groupList: {
    gap: Space.md,
  },
  groupsEmpty: {
    marginBottom: Space.xxl,
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
