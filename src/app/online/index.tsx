import { useFocusEffect, useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SettingsButton } from "@/components/SettingsButton";
import { describeError } from "@/api/errors";
import type {
  DailyGroupStatus,
  DailyOverview,
  GroupLeaderboard,
  GroupSummary,
} from "@/api/types";
import { useOnlineTabBarSpace } from "@/components/online/OnlineTabBar";
import { AmbientOrbs } from "@/design/Ambient";
import { Avatar } from "@/design/Avatar";
import { Button } from "@/design/Button";
import { EmptyState, ErrorBanner, Pill } from "@/design/Feedback";
import { Flame } from "@/design/Flame";
import { GlowBorder } from "@/design/Glow";
import { Icon } from "@/design/Icon";
import { Card, OptionRow, Screen, SectionHeader, TextLink } from "@/design/Layout";
import { RoundRing, type SolvedRound } from "@/design/RoundRing";
import { Color, Radius, Space, Type } from "@/design/tokens";
import SVGChallenge from "@/components/SVGChallenge";
import { t } from "@/i18n";
import type { ChallengeMetadata } from "@/types/challenge";
import { findAsset } from "@/online/daily";
import { membersLabel, seasonLabel, sortGroups } from "@/online/groups";
import { useSession } from "@/online/session";
import { readAttempt, type StoredRound } from "@/online/attempts";
import { markPlayed, readStreak, visibleStreak } from "@/online/streak";

/**
 * El menú del modo online: **una sola pregunta, ¿qué juego hoy?**
 *
 * ## Qué se quitó y por qué
 *
 * La versión anterior apilaba cinco bloques —tu puntuación, tus grupos, «más»,
 * dos atajos y tu cuenta— y, según cuántos grupos tuvieras, entre once y quince
 * objetivos táctiles con el mismo peso visual. Tres de los cinco bloques eran
 * navegación pura, así que la pantalla contestaba «¿a dónde puedo ir?» a alguien
 * que la abría preguntando «¿qué juego hoy?».
 *
 * Ahora la navegación vive en la barra de pestañas, el estado se comprime a una
 * tira de una línea, y la fila de «partida online» —desactivada, con su pastilla
 * de «pronto»— desaparece: una fila que no se puede pulsar ocupa lo mismo que
 * una que sí.
 *
 * ## La tesis: todo empieza sin color
 *
 * Este es un juego de acertar el color de un logo, y el menú viejo no enseñaba
 * ni un logo. El color solo aparecía **después** de jugar, como premio: al que
 * ya había jugado se le enseñaba color y al que no, gris. Justo al revés de lo
 * que hace falta.
 *
 * Aquí el héroe es el logo de la primera ronda **pintado en gris**, con la
 * pregunta debajo. Se puede enseñar sin romper la regla 6.2 porque lo que el
 * servidor se guarda hasta cerrar el intento es el **color**, no el dibujo: el
 * `assetId` llega en el reto y el trazo está en el catálogo local.
 *
 * La llama de la racha sigue la misma idea: apagada mientras hoy no se haya
 * jugado, encendida en cuanto se juega. Jugar es lo que devuelve el color.
 *
 * ## La cola blanda
 *
 * Con varios grupos hay varios retos, y enseñarlos todos a la vez es el
 * problema original con otra cara. Se enseña **uno**, y el siguiente asoma
 * apagado debajo. Pero no se encierra a nadie: ese botón entra si se pulsa, y
 * la pestaña Grupos los tiene todos siempre. El menú propone un orden; no lo
 * impone.
 */

/**
 * Pedir el reto del primer grupo para poder enseñar su logo.
 *
 * `daily.overview()` no trae las rondas —solo intentos y puntuación—, así que
 * el dibujo hay que sacarlo de `daily.today(grupo)`. Tiene un efecto que
 * conviene tener presente: ese endpoint **crea el reto del día** si nadie lo ha
 * abierto todavía, así que abrir el menú lo adelanta a antes de jugar. No gasta
 * intentos ni puntúa, pero es un cambio de comportamiento real.
 *
 * Se pide solo para el grupo que toca, nunca para todos, y solo si queda algo
 * por jugar. Si un día molesta, se pone a `false`: la tarjeta se queda con el
 * anillo vacío y sin logo, y todo lo demás sigue igual.
 */
const PREFETCH_HERO_LOGO = true;

/** Cuántos grupos se listan bajo el héroe antes de mandar a la pestaña. */
const MAX_TAIL_GROUPS = 2;

interface HeroChallenge {
  groupId: string;
  asset: ChallengeMetadata | null;
  rounds: number;
  /**
   * Qué color del logo hay que adivinar en la primera ronda.
   *
   * Lo decide el SERVIDOR y hay que pasarlo tal cual. El
   * `editableColorIndex` que trae el catálogo local **no siempre coincide**
   * —`fanta` dice 3 y solo tiene 3 colores, y el backend lo recorta a 0—, así
   * que sin esto el menú apagaría un color distinto del que luego se pide, y el
   * logo del hub y el de la partida no serían el mismo dibujo.
   */
  colorIndex: number;
}

export default function OnlineHubScreen(): ReactElement {
  const { user, api, reloadUser } = useSession();
  const router = useRouter();
  const tabBarSpace = useOnlineTabBarSpace();

  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [daily, setDaily] = useState<DailyOverview | null>(null);
  const [board, setBoard] = useState<GroupLeaderboard | null>(null);
  const [hero, setHero] = useState<HeroChallenge | null>(null);
  const [solved, setSolved] = useState<StoredRound[] | null>(null);
  const [streak, setStreak] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      /*
        Ya no se pide `leaderboards.me()`. El puesto global y el de amigos
        vivían en la tarjeta de puntuación de esta pantalla, y se han ido a la
        pestaña Perfil: son cifras que se miran cuando se quieren mirar, no
        cada vez que se abre la app a jugar. Con ellas se va también su
        petición, en una pantalla que se recarga en cada focus.
      */
      const [groupsResult, dailyResult] = await Promise.all([
        api.groups.list(),
        // Si falla, la pantalla se queda sin saber qué hay jugado hoy y trata
        // todos los grupos como pendientes. Es preferible a tumbar el menú.
        api.daily.overview().catch(() => null),
        reloadUser(),
      ]);

      setGroups(groupsResult.groups);
      setDaily(dailyResult);

      // --- La racha ------------------------------------------------------
      // Se cuenta aquí y no en la pantalla de la partida a propósito: así el
      // reto no tiene que saber nada de rachas, y volver al menú desde
      // cualquier sitio la deja al día. `markPlayed` es idempotente.
      const playedToday =
        dailyResult?.groups.some((entry) => entry.bestScore != null) ?? false;

      const stored = playedToday
        ? await markPlayed(dailyResult!.challengeDate)
        : await readStreak();

      setStreak(
        visibleStreak(stored, dailyResult?.challengeDate ?? stored.lastDate ?? ""),
      );

      // --- El reto que toca ----------------------------------------------
      const byGroup = new Map<string, DailyGroupStatus>(
        (dailyResult?.groups ?? []).map((entry) => [entry.groupId, entry]),
      );
      const next = buildQueue(groupsResult.groups, byGroup)[0] ?? null;

      if (next == null) {
        setHero(null);
        setBoard(null);
        setSolved(null);
        return;
      }

      // Las tres son opcionales: si cualquiera falla, la tarjeta se pinta sin
      // logo, sin anillo pintado o sin la línea de «lo que está en juego»,
      // pero se pinta.
      const [heroResult, boardResult, storedRounds] = await Promise.all([
        PREFETCH_HERO_LOGO
          ? api.daily.today(next.id).catch(() => null)
          : Promise.resolve(null),
        api.groups.leaderboard(next.id).catch(() => null),
        dailyResult
          ? readAttempt(next.id, dailyResult.challengeDate)
          : Promise.resolve(null),
      ]);

      const firstRound = heroResult?.challenge.rounds[0] ?? null;

      setHero({
        groupId: next.id,
        asset: firstRound ? findAsset(firstRound.assetId) : null,
        rounds: heroResult?.challenge.rounds.length ?? 0,
        colorIndex: firstRound?.colorIndex ?? 0,
      });
      setBoard(boardResult);
      setSolved(storedRounds);
    } catch (loadError) {
      setError(describeError(loadError));
    }
  }, [api, reloadUser]);

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

  const dailyByGroup = new Map<string, DailyGroupStatus>(
    (daily?.groups ?? []).map((entry) => [entry.groupId, entry]),
  );

  const ordered = groups ? sortGroups(groups) : null;
  /** Todo lo que todavía admite un intento, con lo no jugado delante. */
  const queue = ordered ? buildQueue(ordered, dailyByGroup) : [];
  const current = queue[0] ?? null;
  const upNext = queue[1] ?? null;
  /** Grupos con puntuación de hoy. Es lo que enciende la racha y llena la cola. */
  const doneCount =
    ordered?.filter((group) => isPlayed(group, dailyByGroup)).length ?? 0;
  const playedToday = doneCount > 0;
  /** El grupo que toca ya se jugó: la tarjeta enseña el resultado, no la pregunta. */
  const currentPlayed = current != null && isPlayed(current, dailyByGroup);

  const todayPoints =
    daily == null
      ? null
      : daily.groups.reduce((total, entry) => total + (entry.bestScore ?? 0), 0) ||
        null;

  return (
    <Screen
      /*
        La flecha se queda AQUÍ y solo aquí, aunque esto sea la raíz de una
        pestaña. `/online` no es la raíz de la app: es una sección en la que se
        entra desde la portada, y sin esta flecha el modo online no tiene
        salida — la barra de pestañas te mueve entre sus cuatro destinos, pero
        ninguno de ellos lleva de vuelta al juego sin conexión.

        Las otras tres pestañas no la llevan: una flecha de volver en la raíz de
        una pestaña apunta a otra pestaña, y eso no es volver, es saltar.
      */
      backTo="/"
      backdrop={<AmbientOrbs />}
      contentStyle={{ paddingBottom: tabBarSpace }}
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

      {/* ---------------------- Quién eres, en una línea ---------------- */}
      {user ? (
        <IdentityStrip
          username={user.username}
          level={user.level}
          streak={streak}
          lit={playedToday}
          onPressStreak={() => router.push("/online/profile")}
        />
      ) : null}

      {/* ------------------------- El reto de hoy ----------------------- */}
      {ordered == null ? null : ordered.length === 0 ? (
        <Card style={styles.block}>
          <EmptyState
            icon="users"
            title={t("online.hub.groupsEmpty")}
            hint={t("online.hub.groupsEmptyHint")}
          />
          <Button
            label={t("online.hub.quickCreate")}
            icon="plus"
            onPress={() =>
              router.push({
                pathname: "/online/groups",
                params: { action: "create" },
              })
            }
            style={styles.emptyAction}
          />
          <Button
            label={t("online.hub.quickJoin")}
            icon="users"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: "/online/groups", params: { action: "join" } })
            }
            style={styles.emptySecondary}
          />
        </Card>
      ) : current == null ? (
        /*
          Solo aquí: cuando NINGÚN grupo admite ya un intento. Antes esta
          pantalla salía en cuanto se había jugado una vez en todos, y eso era
          declarar la jornada terminada teniendo intentos en la mano.
        */
        <AllDone points={todayPoints} total={ordered.length} />
      ) : (
        <>
          <QueueHeader done={doneCount} total={ordered.length} />

          <TodayCard
            group={current}
            asset={hero?.groupId === current.id ? hero.asset : null}
            rounds={hero?.groupId === current.id ? hero.rounds : 0}
            colorIndex={hero?.groupId === current.id ? hero.colorIndex : 0}
            solved={solved}
            played={currentPlayed}
            status={dailyByGroup.get(current.id)}
            board={board}
            username={user?.username ?? ""}
            /*
              Directo al tablero, sin escala.

              La antesala `/online/daily` ya no existe, y su trabajo lo hace la
              ficha del grupo — que es a donde lleva la banda del nombre, justo
              encima de este botón. Mandar aquí también a la ficha dejaría dos
              controles pegados haciendo lo mismo. Esta tarjeta ya enseña los
              intentos y las imágenes de hoy: quien pulsa «jugar» ya ha leído lo
              que hay que leer.
            */
            onPlay={() =>
              router.push({
                pathname: "/online/daily/play",
                params: { group: current.id },
              })
            }
            onOpenGroup={() =>
              router.push({
                pathname: "/online/groups/[id]",
                params: { id: current.id },
              })
            }
          />

          {upNext ? (
            <UpNext
              group={upNext}
              remaining={queue.length - 2}
              onPress={() =>
                router.push({
                  pathname: "/online/groups/[id]",
                  params: { id: upNext.id },
                })
              }
            />
          ) : null}
        </>
      )}

      {/* --------------------- Lo ya hecho, y el resto ------------------ */}
      {ordered && ordered.length > 1 ? (
        <>
          <SectionHeader
            title={t("online.hub.playSection")}
            hint={
              playedToday && queue.length === 0
                ? t("online.hub.playHintDone")
                : undefined
            }
          />

          <View style={styles.tail}>
            {ordered
              .filter((group) => group.id !== current?.id && group.id !== upNext?.id)
              .slice(0, MAX_TAIL_GROUPS)
              .map((group) => {
                const status = dailyByGroup.get(group.id);
                const done = status?.bestScore != null;

                return (
                  <OptionRow
                    key={group.id}
                    icon={done ? "check" : "calendar"}
                    tone={done ? "green" : "teal"}
                    title={group.name}
                    description={`${membersLabel(group.memberCount)} · ${seasonLabel(group)}`}
                    note={
                      done
                        ? t("online.hub.group.played", { score: status?.bestScore ?? 0 })
                        : undefined
                    }
                    badge={
                      group.unreadCount > 0 ? (
                        <Pill label={t("online.groups.unread")} tone="accent" />
                      ) : undefined
                    }
                    onPress={() =>
                      router.push({
                        pathname: "/online/groups/[id]",
                        params: { id: group.id },
                      })
                    }
                  />
                );
              })}
          </View>

          <TextLink
            label={t("online.hub.seeAllGroups")}
            onPress={() => router.push("/online/groups")}
          />
        </>
      ) : null}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Cola
// ---------------------------------------------------------------------------

/**
 * ¿El servidor admite otro intento en este grupo?
 *
 * Es lo único que decide si un grupo sigue en la cola. Con la temporada
 * terminada no hay nada que jugar, y sin intentos tampoco.
 *
 * **Ojo, no es lo mismo que «sin jugar hoy».** Un grupo jugado una vez conserva
 * su segundo intento, así que sigue en la cola: la pantalla no puede declarar
 * la jornada terminada mientras quede algo que se pueda jugar. Lo que cambia no
 * es si aparece, sino cómo — con la rueda ya pintada y ofreciendo el segundo
 * intento en vez de la pregunta.
 */
function hasAttempts(
  group: GroupSummary,
  byGroup: Map<string, DailyGroupStatus>,
): boolean {
  if (group.status === "finished") {
    return false;
  }
  const status = byGroup.get(group.id);
  // Sin datos del reto se asume que sí: es mejor ofrecer jugar y que la
  // pantalla del reto lo desmienta, que esconder un reto que sí estaba.
  return status == null || status.attemptsLeft > 0;
}

/** ¿Ya hay una puntuación de hoy en este grupo? */
function isPlayed(
  group: GroupSummary,
  byGroup: Map<string, DailyGroupStatus>,
): boolean {
  return byGroup.get(group.id)?.bestScore != null;
}

/**
 * La cola del día: todo lo que todavía admite un intento.
 *
 * El orden es el de `sortGroups` —temporada que antes acaba primero— con una
 * capa encima: **lo que no se ha tocado hoy va delante**. Así, con tres grupos
 * y uno ya jugado, el menú ofrece los dos vírgenes antes de proponerte repetir;
 * y cuando ya no queda ninguno virgen, sigue habiendo qué hacer en vez de una
 * pantalla que dice que has terminado teniendo intentos en la mano.
 */
function buildQueue(
  groups: GroupSummary[],
  byGroup: Map<string, DailyGroupStatus>,
): GroupSummary[] {
  return sortGroups(groups)
    .filter((group) => hasAttempts(group, byGroup))
    .sort(
      (a, b) =>
        Number(isPlayed(a, byGroup)) - Number(isPlayed(b, byGroup)),
    );
}

// ---------------------------------------------------------------------------
// Tira de identidad
// ---------------------------------------------------------------------------

/**
 * Quién eres y cómo va tu racha, en una línea.
 *
 * Sustituye a la tarjeta grande de puntuación. Aquella llevaba cinco cifras
 * —nivel, XP, puesto global, puesto entre amigos y puntos de hoy— en la
 * superficie más grande de la pantalla, y ninguna de las cinco es algo que se
 * compare a diario. Se han ido a la pestaña Perfil, que es donde se miran los
 * datos de uno cuando se quieren mirar.
 *
 * Lo único que se queda arriba es la racha, porque no es un dato: es una cosa
 * que se puede perder hoy.
 */
function IdentityStrip({
  username,
  level,
  streak,
  lit,
  onPressStreak,
}: {
  username: string;
  level: number;
  streak: number;
  /** Hoy ya se ha jugado en algún grupo: la racha está asegurada. */
  lit: boolean;
  onPressStreak: () => void;
}): ReactElement {
  return (
    <View style={styles.identity}>
      <Avatar username={username} size={34} />
      <Text style={[Type.bodyStrong, styles.identityName]} numberOfLines={1}>
        {username}
      </Text>
      <Text style={Type.caption}>{t("online.level", { level })}</Text>

      {streak > 0 ? (
        <Pressable
          onPress={onPressStreak}
          style={({ pressed }) => [
            styles.streak,
            lit && styles.streakLit,
            pressed && styles.streakPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t(
            lit ? "online.hub.streakSecured" : "online.hub.streakAtRisk",
            { count: streak },
          )}
        >
          <Flame size={22} lit={lit} />
          <Text
            style={[
              Type.metricSmall,
              styles.streakCount,
              lit && styles.streakCountLit,
            ]}
          >
            {streak}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// La tarjeta del día
// ---------------------------------------------------------------------------

/**
 * El reto que toca ahora mismo. Es la única superficie con borde de aurora de
 * toda la pantalla: si hubiera dos, ninguna sería la principal.
 */
function TodayCard({
  group,
  asset,
  rounds,
  colorIndex,
  solved,
  played,
  status,
  board,
  username,
  onPlay,
  onOpenGroup,
}: {
  group: GroupSummary;
  /** El logo de la primera ronda. `null` si no se pudo cargar. */
  asset: ChallengeMetadata | null;
  rounds: number;
  /** El color del logo que pide la primera ronda. Lo manda el servidor. */
  colorIndex: number;
  /** El desglose del intento de hoy. `null` si aún no se ha jugado. */
  solved: readonly StoredRound[] | null;
  /** Ya hay puntuación de hoy: la tarjeta enseña resultado, no pregunta. */
  played: boolean;
  status: DailyGroupStatus | undefined;
  board: GroupLeaderboard | null;
  username: string;
  onPlay: () => void;
  onOpenGroup: () => void;
}): ReactElement {
  const attemptsLeft = status?.attemptsLeft ?? 2;
  // Las rondas guardadas mandan sobre las del reto: si se jugó, son tantas como
  // arcos hay que pintar, y no dependen de que el logo se haya podido cargar.
  const ringRounds = solved?.length || (rounds > 0 ? rounds : 5);

  /**
   * Cada arco, con **el color que enviaste** y recortado a tu acierto: al 100 %
   * el sector se pinta entero, al 50 % la mitad. Es lo que convierte el anillo
   * en un resumen de la jornada y no en una barra de progreso.
   */
  const ringSolved: SolvedRound[] | null =
    solved?.map((round) => ({
      hex: round.answerHex,
      accuracy: round.accuracy,
    })) ?? null;

  return (
    <GlowBorder radius={Radius.xl} padding={Space.xl} style={styles.today}>
      <View style={styles.todayRing}>
        <RoundRing
          size={232}
          rounds={ringRounds}
          stroke={11}
          solved={ringSolved}
        >
          {asset ? (
            /*
              El logo en gris: el dibujo se conoce, el color no. `SVGChallenge`
              es el mismo componente que pinta el logo dentro de la partida, así
              que el de aquí y el de allí no pueden divergir — se le pasa un
              gris como «color editable» y lo que queda es exactamente la forma
              que habrá que colorear.
            */
            <SVGChallenge
              challenge={asset}
              editableColor={Color.text.faint}
              // El del SERVIDOR, no el del catálogo local: ver `HeroChallenge`.
              editableColorIndex={colorIndex}
              size={124}
              animationToken={0}
            />
          ) : (
            <Icon name="palette" size={44} color={Color.text.faint} />
          )}
        </RoundRing>
      </View>

      {/*
        Jugado, la pregunta ya no toca: lo que interesa es la cifra que has
        hecho. Sin jugar, la pregunta ES el gancho — es literalmente lo que el
        juego te pide.
      */}
      {played ? (
        <View style={styles.todayScore}>
          <Text style={Type.metricHero}>
            {status?.bestScore != null
              ? String(status.bestScore)
              : t("online.hub.unranked")}
          </Text>
          <Text style={Type.label}>{t("online.daily.bestHint")}</Text>
        </View>
      ) : (
        <Text style={[Type.title, styles.todayQuestion]}>
          {t("online.hub.question")}
        </Text>
      )}

      <Pressable
        onPress={onOpenGroup}
        style={({ pressed }) => [styles.todayGroup, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={group.name}
      >
        <Text style={Type.bodyStrong}>{group.name}</Text>
        <Text style={Type.caption}>
          {`${t("online.group.season", {
            season: group.currentSeason.seasonNumber,
          })} · ${seasonLabel(group)}`}
        </Text>
      </Pressable>

      <Stakes board={board} username={username} memberCount={group.memberCount} />

      <Button
        label={t(
          (status?.attemptsUsed ?? 0) > 0
            ? "online.daily.playSecond"
            : "online.hub.group.play",
        )}
        icon="play"
        onPress={onPlay}
        style={styles.todayAction}
      />

      <Text style={[Type.caption, styles.todayMeta]}>
        {`${t(
          attemptsLeft === 1 ? "online.hub.attemptsOne" : "online.hub.attempts",
          { count: attemptsLeft },
        )}${rounds > 0 ? ` · ${t("online.daily.roundsTitle", { count: rounds })}` : ""}`}
      </Text>
    </GlowBorder>
  );
}

/**
 * Lo que está en juego: a quién adelantas si hoy lo haces bien.
 *
 * Es la única línea de la tarjeta que convierte una cifra abstracta en un
 * objetivo con nombre, y sale entera de la clasificación que ya se pide — cero
 * coste de backend. Si no hay nadie por delante (o no se pudo cargar el
 * marcador) no se pinta nada: una línea que diga «vas primero» sobra en una
 * tarjeta cuyo trabajo es que juegues.
 */
function Stakes({
  board,
  username,
  memberCount,
}: {
  board: GroupLeaderboard | null;
  username: string;
  memberCount: number;
}): ReactElement | null {
  if (board == null || board.entries.length === 0) {
    return null;
  }

  const meIndex = board.entries.findIndex((entry) => entry.username === username);
  const above = meIndex > 0 ? board.entries[meIndex - 1] : null;
  const me = meIndex >= 0 ? board.entries[meIndex] : null;

  /**
   * Cuántas personas del grupo han puntuado ya esta temporada.
   *
   * NO es «cuántas han jugado hoy», que es el dato que de verdad aprieta.
   * `DailyGroupStatus` solo trae tus propios intentos, así que hoy no hay forma
   * de saberlo sin un endpoint nuevo. Esto es lo más cerca que se puede estar
   * sin mentir, y por eso el texto dice «compiten» y no «han jugado hoy».
   */
  const active = board.entries.filter((entry) => entry.playedDays > 0).length;

  return (
    <View style={styles.stakes}>
      {above && me ? (
        <View style={styles.stakeLine}>
          <Icon name="target" size={15} color={Color.text.faint} />
          <Text style={[Type.caption, styles.stakeText]}>
            {t("online.hub.overtake", {
              points: above.score - me.score + 1,
              name: above.username,
            })}
          </Text>
        </View>
      ) : null}

      <View style={styles.stakeLine}>
        <Icon name="users" size={15} color={Color.text.faint} />
        <Text style={[Type.caption, styles.stakeText]}>
          {t("online.hub.competing", { count: active, total: memberCount })}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Cola blanda y estado final
// ---------------------------------------------------------------------------

/** «Hoy · 1 de 3», con los puntos de la cola. */
function QueueHeader({ done, total }: { done: number; total: number }): ReactElement {
  return (
    <View style={styles.queue}>
      <Text style={Type.label}>
        {t("online.hub.queuePosition", { index: done + 1, total })}
      </Text>
      <View style={styles.queueDots}>
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index < done && styles.dotDone,
              index === done && styles.dotCurrent,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * El siguiente reto, apagado.
 *
 * Se pinta pulsable a propósito aunque diga «se abre al terminar»: la cola es
 * una sugerencia de orden, no una cerradura. Encerrar al jugador en un grupo
 * que hoy no le apetece sería peor que el problema que la cola resuelve.
 */
function UpNext({
  group,
  remaining,
  onPress,
}: {
  group: GroupSummary;
  /** Cuántos quedan además de este. */
  remaining: number;
  onPress: () => void;
}): ReactElement {
  return (
    <View style={styles.upNext}>
      <SectionHeader title={t("online.hub.nextUp")} />
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.upNextRow, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={group.name}
        accessibilityHint={t("online.hub.opensAfter")}
      >
        <View style={styles.upNextIcon}>
          <Icon name="calendar" size={19} color={Color.text.faint} />
        </View>
        <View style={styles.upNextBody}>
          <Text style={[Type.bodyStrong, styles.upNextTitle]} numberOfLines={1}>
            {group.name}
          </Text>
          <Text style={Type.caption}>
            {remaining > 0
              ? t("online.hub.opensAfterMore", { count: remaining })
              : t("online.hub.opensAfter")}
          </Text>
        </View>
        <Icon name="chevronRight" size={18} color={Color.text.faint} />
      </Pressable>
    </View>
  );
}

/** Nada que jugar: la pantalla deja de pedir cosas. */
function AllDone({
  points,
  total,
}: {
  points: number | null;
  total: number;
}): ReactElement {
  return (
    <GlowBorder radius={Radius.xl} padding={Space.xxl} still style={styles.today}>
      <View style={styles.doneBody}>
        <Text style={Type.label}>
          {t("online.hub.queueDone", { total })}
        </Text>
        <Text style={[Type.metricHero, styles.doneScore]}>
          {points != null ? String(points) : t("online.hub.unranked")}
        </Text>
        <Text style={Type.caption}>{t("online.hub.todayPoints")}</Text>
        <Text style={[Type.body, styles.doneHint]}>
          {t("online.hub.allDoneHint")}
        </Text>
      </View>
    </GlowBorder>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    marginBottom: Space.xl,
  },
  identityName: {
    flexShrink: 1,
  },
  streak: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: Space.xs,
    paddingLeft: Space.sm,
    paddingRight: Space.md,
    paddingVertical: Space.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Color.border.default,
    backgroundColor: Color.surface.raised,
  },
  streakLit: {
    borderColor: Color.ember.border,
    backgroundColor: Color.ember.surface,
  },
  streakPressed: {
    opacity: 0.7,
  },
  streakCount: {
    color: Color.text.muted,
    fontWeight: "700",
  },
  streakCountLit: {
    color: Color.ember.text,
  },
  queue: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Space.md,
  },
  queueDots: {
    flexDirection: "row",
    gap: Space.xs,
    marginLeft: "auto",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Color.border.strong,
  },
  dotCurrent: {
    backgroundColor: Color.text.primary,
  },
  dotDone: {
    backgroundColor: Color.success.default,
  },
  today: {
    marginBottom: Space.xl,
  },
  todayRing: {
    alignItems: "center",
  },
  todayScore: {
    alignItems: "center",
    marginTop: Space.lg,
    gap: Space.xs,
  },
  todayQuestion: {
    textAlign: "center",
    marginTop: Space.lg,
  },
  todayGroup: {
    alignItems: "center",
    marginTop: Space.sm,
    gap: Space.xxs,
  },
  pressed: {
    opacity: 0.7,
  },
  stakes: {
    marginTop: Space.lg,
    gap: Space.sm,
  },
  stakeLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
  },
  stakeText: {
    flex: 1,
    color: Color.text.secondary,
  },
  todayAction: {
    marginTop: Space.lg,
  },
  todayMeta: {
    textAlign: "center",
    marginTop: Space.md,
  },
  upNext: {
    marginBottom: Space.xl,
  },
  upNextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    padding: Space.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Color.border.subtle,
  },
  upNextIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Color.border.subtle,
    backgroundColor: Color.surface.sunken,
  },
  upNextBody: {
    flex: 1,
    gap: Space.xxs,
  },
  upNextTitle: {
    color: Color.text.secondary,
  },
  doneBody: {
    alignItems: "center",
    gap: Space.xs,
  },
  doneScore: {
    marginTop: Space.sm,
  },
  doneHint: {
    textAlign: "center",
    marginTop: Space.md,
  },
  block: {
    marginBottom: Space.xl,
  },
  emptyAction: {
    marginTop: Space.lg,
  },
  emptySecondary: {
    marginTop: Space.sm,
  },
  tail: {
    gap: Space.md,
  },
});
