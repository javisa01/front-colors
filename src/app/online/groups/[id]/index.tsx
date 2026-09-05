import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import type { ReactElement, ReactNode } from "react";
import { memo, useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { describeError } from "@/api/errors";
import type {
  AppNotification,
  ChatMessage,
  FriendsOverview,
  GroupDetail,
  GroupLeaderboard,
  GroupLeaderboardEntry,
} from "@/api/types";
import { SettingsButton } from "@/components/SettingsButton";
import { DevTimePanel } from "@/components/online/DevTimePanel";
import { UnreadDot } from "@/components/online/UnreadDot";
import { AmbientMesh } from "@/design/Ambient";
import { Avatar, playerTint } from "@/design/Avatar";
import { Button, IconButton } from "@/design/Button";
import { EmptyState, ErrorBanner, Loading, Pill } from "@/design/Feedback";
import { Flame } from "@/design/Flame";
import { Icon } from "@/design/Icon";
import { GlowBorder } from "@/design/Glow";
import { Notice } from "@/design/Form";
import { Card, Screen, SectionHeader } from "@/design/Layout";
import { useAmbientActive } from "@/design/motion";
import { RoundRing, type SolvedRound } from "@/design/RoundRing";
import SVGChallenge from "@/components/SVGChallenge";
import { useColors, useThemedStyles } from "@/design/theme";
import {
  DISABLED_OPACITY,
  HIT_SLOP,
  HIT_TARGET,
  Radius,
  SECTION_TONE,
  Space,
  Type,
  type Palette,
} from "@/design/tokens";
import { useCountdown, useDailyChallenge } from "@/hooks/useDailyChallenge";
import { t } from "@/i18n";
import { previewOf } from "@/online/chat";
import { relationOf } from "@/online/friends";
import { readSeenMessage } from "@/online/chatSeen";
import { formatCountdown } from "@/online/daily";
import {
  daysLeft,
  membersLabel,
  noticeLabel,
  playedDaysLabel,
} from "@/online/groups";
import { useSession } from "@/online/session";
import { useSocial } from "@/online/social";
import { readLatestAttempt, type StoredAttempt } from "@/online/attempts";
import { readStreak, visibleStreak, type Streak } from "@/online/streak";

/**
 * El grupo por dentro. Es **la** pantalla de un grupo: lo que hay que jugar hoy
 * y cómo va la temporada.
 *
 * Absorbió la antesala del reto diario (`/online/daily?group=…`), que enseñaba
 * los mismos intentos, la misma mejor puntuación y la misma cuenta atrás una
 * pantalla más adentro. Dos pantallas para el mismo dato obligaban a un salto
 * antes de poder jugar y dejaban la clasificación —la razón de estar en un
 * grupo— a dos toques de distancia. Ahora se entra al grupo y se juega desde
 * aquí; `/online/daily` solo redirige, y su implementación sigue en el fichero
 * por si hubiera que recuperarla.
 *
 * Los tres estados que tiene que cubrir (apartado 8 del plan):
 *
 *  - **Activo**: días que quedan, reto de hoy y clasificación en vivo.
 *  - **Terminado**: clasificación congelada y el botón de renovar **solo para el
 *    `owner`**; a los demás se les dice quién puede. El chat sigue accesible,
 *    porque un grupo terminado no está cerrado.
 *  - **Sin intentos hoy**: el bloque de jugar se apaga y dice cuándo abre el
 *    siguiente.
 *
 * El estado no se calcula aquí: llega en `group.status`, derivado por el
 * servidor. Por eso basta con releer para que la pantalla se ponga al día.
 *
 * ## Dónde va el color
 *
 * La app es casi acromática a propósito, y esta pantalla es la excepción
 * razonada: es la única donde el color **es** el dato. El puesto se lee en el
 * metal del disco —oro, plata, bronce, nada— y cada jugador lleva en su fila el
 * mismo tono que su avatar tiene en toda la aplicación. Lo demás sigue en gris:
 * si además se tiñeran las tarjetas, el color dejaría de señalar a nadie.
 */
export default function GroupDetailScreen(): ReactElement {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const { api, user } = useSession();
  const { apply: applySocial } = useSocial();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Array.isArray(id) ? id[0] : (id ?? null);

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [board, setBoard] = useState<GroupLeaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [renewing, setRenewing] = useState(false);
  /**
   * Los avisos sin leer de este grupo, capturados justo antes de marcarlos.
   *
   * Es la «línea dentro del grupo» del apartado 8: el punto rojo de la lista
   * dice que hay algo, y esto dice qué. Se guarda porque marcarlos leídos es lo
   * primero que se hace al abrir, así que después ya no habría forma de saber
   * qué se acaba de apagar.
   */
  const [notices, setNotices] = useState<AppNotification[]>([]);
  /** El último mensaje del chat, solo para la vista previa de su entrada. */
  const [lastMessage, setLastMessage] = useState<ChatMessage | null>(null);
  /**
   * Con quién tienes ya algo: es lo que decide si una fila de la clasificación
   * sale con el botón de agregar. Mientras sea `null` no sale ninguno — un
   * botón de «añadir» sobre quien ya es tu amigo es peor que no tener botón.
   */
  const [friends, setFriends] = useState<FriendsOverview | null>(null);
  /** Id de la persona cuya solicitud está en vuelo, para bloquear su fila. */
  const [pendingFriend, setPendingFriend] = useState<string | null>(null);
  /**
   * El último mensaje que este teléfono llegó a ver, del almacén local.
   *
   * El backend no lleva registro de lectura del chat —un mensaje no crea aviso—,
   * así que sin esto la ficha solo podría decir «hay conversación», que es
   * verdad siempre. Ver `online/chatSeen`.
   */
  const [seenMessage, setSeenMessage] = useState<string | null>(null);
  /**
   * El desglose del intento de hoy y la racha, los dos del almacén local.
   *
   * Ninguno viene de la API: el desglose por rondas solo viaja una vez, al
   * cerrar el intento (ver `online/attempts`), y la racha se cuenta en el
   * teléfono. Se leen aquí para poder pintar el mismo anillo que el menú, que
   * es lo que hace que las dos pantallas hablen del mismo reto.
   *
   * Se guardan **con su jornada dentro** y sin filtrar: cuál es la jornada en
   * curso lo dice el reto, y esperar a su respuesta para empezar a leer el
   * disco encadenaba dos esperas seguidas. Ahora las dos salen a la vez y el
   * filtro se aplica al pintar, más abajo.
   */
  const [attempt, setAttempt] = useState<StoredAttempt | null>(null);
  const [streakStore, setStreakStore] = useState<Streak | null>(null);

  /**
   * El reto sale del mismo hook que usa la pantalla de juego.
   *
   * Antes esta pantalla pedía `api.daily.today(id)` a pelo y la antesala usaba
   * el hook: dos formas de leer el mismo dato, y solo una de ellas sabía si el
   * reloj del teléfono es de fiar. Con la antesala fuera, esta pantalla hereda
   * su trabajo entero, hook incluido.
   */
  const {
    status: daily,
    rounds,
    attemptsLeft,
    serverClosed,
    clockTrusted,
    error: dailyError,
    reload: reloadDaily,
  } = useDailyChallenge(groupId);

  const loadGroup = useCallback(async () => {
    if (!groupId) return;
    setError(null);
    try {
      const [detail, leaderboard] = await Promise.all([
        api.groups.get(groupId),
        api.groups.leaderboard(groupId),
      ]);
      setGroup(detail.group);
      setBoard(leaderboard);
    } catch (loadError) {
      setError(describeError(loadError));
    }
  }, [api, groupId]);

  /**
   * El último mensaje del chat.
   *
   * Una sola petición de un solo mensaje, y falla en silencio: la vista previa
   * es lo que hace que la entrada al chat esté viva, pero no vale romper la
   * pantalla del grupo porque no se haya podido traer una línea de texto.
   */
  const loadPreview = useCallback(async () => {
    if (!groupId) return;
    // El registro de lectura es local y no puede fallar por red, así que se lee
    // aparte del mensaje: aunque no llegue la petición, se sabe qué se vio.
    setSeenMessage(await readSeenMessage(groupId));
    try {
      const page = await api.chat.history(groupId, { limit: 1 });
      setLastMessage(page.messages[0] ?? null);
    } catch {
      // Se queda con la línea de reserva.
    }
  }, [api, groupId]);

  /**
   * Lo que ya está en el teléfono: el desglose del intento y la racha.
   *
   * Va dentro de `load` y no en un efecto propio por dos motivos. Uno, sale al
   * mismo tiempo que las peticiones en vez de después de ellas. Y dos —el que
   * era un fallo—, **se vuelve a leer al recuperar el foco**: al volver de
   * jugar, la jornada es la misma, así que un efecto que dependiera de ella no
   * se disparaba y el anillo seguía enseñando el intento anterior hasta salir
   * del grupo y volver a entrar.
   */
  const loadLocal = useCallback(async () => {
    if (!groupId) return;
    const [stored, streak] = await Promise.all([
      readLatestAttempt(groupId),
      readStreak(),
    ]);
    setAttempt(stored);
    setStreakStore(streak);
  }, [groupId]);

  /**
   * La lista de amigos, para la clasificación.
   *
   * Va con su propio `catch` en vez de dentro de `loadGroup`: si esta llamada
   * falla, lo que se pierde es un botón, no la pantalla. Y de paso alimenta el
   * contador de la barra de pestañas, que necesita exactamente este dato —así
   * que abrir un grupo lo deja al día sin una petición de más.
   */
  const loadFriends = useCallback(async () => {
    try {
      const overview = await api.friends.list();
      setFriends(overview);
      applySocial(overview);
    } catch {
      // Las filas se quedan sin botón de agregar, que es el fallo bueno.
    }
  }, [api, applySocial]);

  const load = useCallback(async () => {
    await Promise.all([
      loadGroup(),
      reloadDaily(),
      loadPreview(),
      loadLocal(),
      loadFriends(),
    ]);
  }, [loadFriends, loadGroup, loadLocal, loadPreview, reloadDaily]);

  const addFriend = useCallback(
    async (userId: string) => {
      setPendingFriend(userId);
      try {
        await api.friends.request(userId);
        // Se relee entera: el backend acepta la amistad sola si ya había una
        // solicitud cruzada, así que el resultado no siempre es «enviada».
        await loadFriends();
      } catch (requestError) {
        setError(describeError(requestError));
      } finally {
        setPendingFriend(null);
      }
    },
    [api, loadFriends],
  );

  /**
   * Los avisos de este grupo se marcan leídos al abrirlo (apartado 8), y de
   * paso se guardan para poder decir de qué iban.
   *
   * Se filtran por `groupId` en vez de llamar a «marcar todo»: entrar en un
   * grupo no debe apagar el punto rojo de los demás.
   *
   * `announce` distingue los dos momentos en que hay que hacer esto. Al abrir
   * el grupo sí se cuenta lo que había. Al renovar, no: renovar deja un aviso
   * también a quien renueva, y enseñárselo justo debajo del mensaje de «ya está
   * en marcha» sería decir lo mismo dos veces con dos voces distintas.
   */
  const consumeGroupNotices = useCallback(
    async (announce: boolean) => {
      if (!groupId) return;
      try {
        const { notifications } = await api.notifications.list({
          unreadOnly: true,
        });
        const mine = notifications.filter(
          (notification) => notification.groupId === groupId,
        );
        if (mine.length === 0) return;
        if (announce) {
          setNotices(mine);
        }
        await api.notifications.markRead(mine.map((item) => item.id));
      } catch {
        // Que no se marquen los avisos no es motivo para romper la pantalla.
      }
    },
    [api, groupId],
  );

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await load();
        await consumeGroupNotices(true);
      })();
    }, [consumeGroupNotices, load]),
  );

  /**
   * El aviso dura lo que dura la visita.
   *
   * «Temporada 3 en marcha» confirma algo que se acaba de pulsar; no es un
   * estado del grupo, y la pantalla no se desmonta al salir porque vive en el
   * navegador de pestañas. Sin esto, el cartel seguía puesto días después. Va
   * en su propio efecto y sin dependencias para que solo se dispare al perder
   * el foco.
   */
  useFocusEffect(useCallback(() => () => setNotice(null), []));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const renew = useCallback(async () => {
    if (!group) return;
    setRenewing(true);
    setError(null);
    try {
      const { group: renewed } = await api.groups.renew(group.id);
      setGroup(renewed);
      setBoard(await api.groups.leaderboard(group.id));
      await reloadDaily();
      // El aviso que el servidor acaba de dejarle a todo el mundo incluye a
      // quien renueva: se marca leído aquí mismo para no dejarle un punto rojo
      // de algo que acaba de hacer él.
      setNotices([]);
      await consumeGroupNotices(false);
      setNotice(
        t("online.group.renewed", { season: renewed.currentSeason.seasonNumber }),
      );
    } catch (renewError) {
      setError(describeError(renewError));
    } finally {
      setRenewing(false);
    }
  }, [api, consumeGroupNotices, group, reloadDaily]);

  /**
   * La cuenta atrás solo corre si el reloj del teléfono está de acuerdo con la
   * ventana del reto. Con el viaje en el tiempo del backend (5.5) no lo está, y
   * más vale no enseñar nada que enseñar una cifra inventada.
   */
  const { remainingMs, expired } = useCountdown(
    daily?.closesAt ?? null,
    clockTrusted,
  );

  /**
   * La jornada la manda el reto, no el reloj del teléfono: con el viaje en el
   * tiempo del backend los dos discrepan, y filtrar por la fecha local diría
   * «hoy no hay nada» teniendo el intento guardado.
   *
   * Aquí es donde se cruza lo leído del disco con lo que dice el servidor. Si
   * las dos jornadas no coinciden, lo guardado es de otro día y no se pinta.
   */
  const challengeDate = daily?.challenge.challengeDate ?? null;

  const solved =
    attempt != null && attempt.dateKey === challengeDate ? attempt.rounds : null;
  const streak =
    streakStore != null && challengeDate != null
      ? visibleStreak(streakStore, challengeDate)
      : 0;

  if (!group) {
    return (
      <Screen
        eyebrow={t("online.group.badge")}
        title={t("online.groups.title")}
        backTo="/online/groups"
        // A la lista de grupos, que es de donde cuelga esta ficha. Ver
        // `onBack` en `design/Layout`.
        onBack={() => router.navigate("/online/groups")}
        backdrop={<AmbientMesh />}
      >
        {error ? (
          <ErrorBanner
            message={error}
            onRetry={() => void load()}
          />
        ) : (
          <Loading label={t("online.group.loading")} />
        )}
      </Screen>
    );
  }

  const finished = group.status === "finished";
  const isOwner = group.role === "owner";
  const ownerName =
    group.members.find((member) => member.userId === group.ownerUserId)?.username ??
    "";
  const remaining = daysLeft(group.currentSeason);

  // La autoridad sobre si la jornada cerró es el servidor; la cuenta atrás
  // local solo adelanta el aviso mientras la pantalla está abierta.
  const closed = serverClosed || expired;
  const canPlay = !finished && !closed && attemptsLeft > 0;

  // --- Lo que necesita el anillo ------------------------------------------
  /** Hoy ya hay puntuación: la tarjeta enseña resultado, no la tarea. */
  const played = daily?.bestScore != null;
  const heroAsset = rounds[0]?.asset ?? null;
  /**
   * Las rondas guardadas mandan sobre las del reto: si se jugó, son tantas como
   * arcos hay que pintar, y no dependen de que el reto se haya podido cargar.
   * El 5 de reserva es el tamaño habitual de una jornada — es lo que se enseña
   * mientras llega la respuesta, para que el anillo no cambie de número de
   * sectores a mitad de carga.
   */
  const ringRounds = solved?.length || (rounds.length > 0 ? rounds.length : 5);
  /**
   * Cada arco con **el color que enviaste**, recortado a tu acierto. Es lo que
   * convierte el anillo en el resumen de la jornada y no en una barra de
   * progreso.
   */
  const ringSolved: SolvedRound[] | null =
    solved?.map((round) => ({
      hex: round.answerHex,
      accuracy: round.accuracy,
    })) ?? null;

  return (
    <Screen
      eyebrow={t("online.group.season", {
        season: group.currentSeason.seasonNumber,
      })}
      title={group.name}
      titleAction={
        <SettingsGear
          onPress={() =>
            router.push({
              pathname: "/online/groups/[id]/edit",
              params: { id: group.id },
            })
          }
        />
      }
      backTo="/online/groups"
      /*
        A la lista de grupos, siempre.

        Dentro de las pestañas del online `back()` lleva a la primera —el
        menú de Hoy—, se venga de donde se venga, así que la flecha nunca
        llegaba al sitio que ella misma declara. Ver `onBack` en
        `design/Layout`.
      */
      onBack={() => router.navigate("/online/groups")}
      backdrop={<AmbientMesh />}
      headerAction={<SettingsButton />}
      onRefresh={refresh}
      refreshing={refreshing}
    >
      {/*
        Un solo banner para los dos fallos posibles —el grupo y el reto—: son la
        misma pantalla y el mismo botón de reintentar los arregla. El del grupo
        manda, porque sin grupo no hay nada más que enseñar.
      */}
      {error ?? dailyError ? (
        <ErrorBanner
          message={error ?? dailyError ?? ""}
          onRetry={() => void load()}
        />
      ) : null}
      {notice ? <Notice message={notice} /> : null}

      {/*
        La línea del apartado 8: el punto rojo de la lista dice que hay algo y
        esto dice qué. Se enseña solo la más reciente —llegan de la más nueva a
        la más vieja— porque el sitio donde se ve lo que pasó es el grupo
        mismo, no una bandeja de avisos.
      */}
      {notices.length > 0 ? <Notice message={noticeLabel(notices[0])} /> : null}

      {/*
        ------------------------- La cinta ---------------------------

        Lo que queda de temporada y cuánta gente hay, en dos pastillas de 11
        puntos.

        Eran dos `Stat` con la cifra a 20 puntos dentro de su propia tarjeta, y
        con eso «5 miembros» pesaba en pantalla lo mismo que la puntuación de la
        clasificación. Son datos de contexto —dicen dónde estás, no qué hacer—,
        así que van en el tamaño de un dato de contexto y en una sola línea. El
        número de temporada no repite aquí: ya está en el kicker del título.
      */}
      <View style={styles.ribbon}>
        <Pill
          icon={finished ? "hourglass" : "calendar"}
          label={
            finished
              ? t("online.groups.statusFinished")
              : remaining <= 1
                ? t("online.groups.lastDay")
                : t("online.groups.daysLeft", { days: remaining })
          }
          tone={finished ? "neutral" : remaining <= 1 ? "warning" : "accent"}
        />
        <Pill icon="users" label={membersLabel(group.memberCount)} />
      </View>

      {/* ------------------------ Fin de temporada ---------------------- */}
      {finished ? (
        <Card style={styles.block}>
          <Text style={[Type.bodyStrong, styles.finishedTitle]}>
            {t("online.group.finishedTitle")}
          </Text>
          <Text style={Type.caption}>
            {isOwner
              ? t("online.group.finishedOwner")
              : t("online.group.finishedMember", { owner: ownerName })}
          </Text>
          {/*
            Se dice aquí, en el mismo bloque que anuncia el final, porque es
            justo donde alguien puede dar por hecho lo contrario: la
            clasificación se congela, el reto se apaga, y el chat NO (5.2.1).
          */}
          <Text style={[Type.caption, styles.finishedChat]}>
            {t("online.group.chatStillOpen")}
          </Text>

          {/* El botón de renovar es SOLO del creador (regla 5.2 del plan). */}
          {isOwner ? (
            <Button
              label={t("online.group.renew", {
                season: group.currentSeason.seasonNumber + 1,
              })}
              icon="retry"
              // Renovar la temporada es una accion del grupo, no del reto.
              tone={SECTION_TONE.groups}
              loading={renewing}
              onPress={() => void renew()}
              style={styles.renewButton}
            />
          ) : null}
        </Card>
      ) : (
        /* ------------------------ El reto de hoy ---------------------- */
        <TodaySurface glow={canPlay}>
          <View style={styles.todayHead}>
            <Text style={Type.label}>{t("online.group.daily.title")}</Text>

            <View style={styles.todayMeta}>
              {/*
                La racha es **global**, no de este grupo: cuenta los días
                seguidos que has jugado en cualquiera. Se enseña aquí porque es
                lo único de la pantalla que se puede perder hoy, y la etiqueta
                de accesibilidad lo dice con todas las letras para que nadie la
                lea como «tu racha en este grupo».
              */}
              {streak > 0 ? (
                <View
                  style={styles.streak}
                  accessible
                  accessibilityLabel={t("online.group.daily.streakA11y", {
                    count: streak,
                  })}
                >
                  <Flame size={18} lit={played} />
                  <Text style={[Type.metricSmall, styles.streakCount]}>
                    {streak}
                  </Text>
                </View>
              ) : null}

              {clockTrusted && !closed ? (
                <Text style={[Type.metricSmall, styles.countdown]}>
                  {t("online.group.daily.closesIn", {
                    time: formatCountdown(remainingMs),
                  })}
                </Text>
              ) : null}
            </View>
          </View>

          {/*
            El anillo, el mismo que el menú.

            Antes aquí había un titular con «5 imágenes». Decía cuántas rondas
            hay, que es justo lo que el anillo dice **con su forma** —un arco
            por ronda— y además sin gastar el tamaño de un título en una cifra
            de contexto. Y una vez jugado, el anillo dice algo que el titular no
            podía: con qué precisión fue cada ronda, pintado con los colores que
            enviaste.

            Que sea el mismo componente que el menú no es ahorro de código: es
            que el reto de hoy tiene que ser reconociblemente el mismo objeto
            desde las dos pantallas.
          */}
          <View style={styles.todayRing}>
            <RoundRing
              size={200}
              rounds={ringRounds}
              stroke={10}
              solved={ringSolved}
            >
              {heroAsset ? (
                <SVGChallenge
                  challenge={heroAsset}
                  // Gris: el dibujo se conoce, el color es lo que hay que
                  // acertar. Es el mismo trato que hace el menú.
                  editableColor={colors.text.faint}
                  editableColorIndex={rounds[0]?.colorIndex ?? 0}
                  size={106}
                  animationToken={0}
                />
              ) : (
                <Icon name="palette" size={38} color={colors.text.faint} />
              )}
            </RoundRing>
          </View>

          {/*
            Jugado, lo que interesa es la cifra. Sin jugar, cuántas imágenes
            toca — que ahora es una pista de contexto y no el titular.
          */}
          {played ? (
            <View style={styles.todayScore}>
              <Text style={Type.metricHero}>{String(daily?.bestScore ?? 0)}</Text>
              <Text style={Type.label}>{t("online.daily.bestHint")}</Text>
            </View>
          ) : rounds.length > 0 ? (
            <Text style={[Type.caption, styles.todayRounds]}>
              {rounds.length === 1
                ? t("online.daily.roundsTitleOne")
                : t("online.daily.roundsTitle", { count: rounds.length })}
            </Text>
          ) : null}

          <AttemptTrack
            used={daily?.attemptsUsed ?? 0}
            best={daily?.bestScore ?? null}
          />

          <Button
            label={t(
              closed
                ? "online.daily.statusClosed"
                : attemptsLeft === 0
                  ? // Corto a propósito: el botón recorta a una línea, y el
                    // porqué entero va en la nota de debajo.
                    "online.daily.statusUsed"
                  : (daily?.attemptsUsed ?? 0) > 0
                    ? "online.daily.playSecond"
                    : "online.daily.play",
            )}
            icon={canPlay ? "play" : "lock"}
            // Azul: es la accion del reto de hoy, la misma que abre el menu.
            tone={SECTION_TONE.today}
            disabled={!canPlay}
            onPress={() =>
              router.push({
                pathname: "/online/daily/play",
                params: { group: group.id },
              })
            }
            style={styles.playButton}
          />

          <Text style={[Type.caption, styles.todayRule]}>
            {closed
              ? t("online.daily.closedHint")
              : attemptsLeft === 0
                ? t("online.daily.noAttemptsHint")
                : t("online.group.daily.rule")}
          </Text>
        </TodaySurface>
      )}

      {/* ------------------------ Clasificación ------------------------- */}
      <SectionHeader
        title={t(
          finished
            ? "online.group.leaderboardFrozen"
            : "online.group.leaderboard",
        )}
        /*
          Terminada, la lista es idéntica a la de ayer y no se va a mover más.
          El título ya dice «Resultado final», pero solo la pista puede decir
          qué la descongela, que es lo que alguien se pregunta al verla quieta.
        */
        hint={t(
          finished
            ? "online.group.leaderboardFrozenHint"
            : "online.group.leaderboardHint",
        )}
      />

      {!board || board.entries.every((entry) => entry.playedDays === 0) ? (
        <Card style={styles.block}>
          <EmptyState
            icon="trophy"
            title={t("online.group.leaderboardEmpty")}
            hint={t("online.group.leaderboardEmptyHint")}
          />
        </Card>
      ) : (
        <View style={styles.board}>
          {board.entries.map((entry) => (
            <StandingRow
              key={entry.userId}
              entry={entry}
              you={entry.userId === user?.id}
              /*
                Solo con la lista de amigos en la mano. Sin ella, `relationOf`
                diría «none» de todo el mundo y saldría un botón de agregar
                sobre gente que ya es tu amiga.
              */
              canAdd={
                friends != null &&
                relationOf(entry.userId, user?.id, friends) === "none"
              }
              busy={pendingFriend === entry.userId}
              onAdd={() => void addFriend(entry.userId)}
            />
          ))}
        </View>
      )}

      {/* --------------------------- El chat ---------------------------- */}
      <ChatEntry
        line={
          lastMessage
            ? previewOf(lastMessage, user?.id ?? null)
            : t("online.group.chat.empty")
        }
        /*
          Sin leer es «lo último que hay no es lo último que vi». Nunca haber
          abierto el chat cuenta, que es lo que se quiere: un grupo con
          conversación y sin visitar tiene algo que enseñar.
        */
        unread={lastMessage != null && lastMessage.id !== seenMessage}
        onPress={() =>
          router.push({
            pathname: "/online/groups/[id]/chat",
            params: { id: group.id },
          })
        }
      />

      {/*
        Panel de desarrollo. Aquí lleva además el atajo de terminar ESTA
        temporada sin mover el reloj global, que es lo más cómodo para ver el
        estado «terminado» sin arrastrar también las jornadas del reto diario.
      */}
      <DevTimePanel groupId={group.id} onChanged={load} />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// La tuerca de ajustes
// ---------------------------------------------------------------------------

/** Un latido completo del anillo: sale del borde de la tuerca y se apaga. */
const HALO_MS = 2600;

/**
 * La tuerca que abre los ajustes del grupo, anunciandose.
 *
 * Era un `IconButton` gris junto al nombre y practicamente nadie lo
 * encontraba: es el unico camino al codigo de invitacion, a la lista de
 * miembros y a la salida del grupo, y estaba pintado como la decoracion de una
 * cabecera. El problema no era de tamano —ya tiene sus 44 puntos de area
 * tactil— sino de que **nada decia que fuera pulsable**.
 *
 * Se arregla con dos cosas a la vez, porque una sola no basta:
 *
 *  - **colors.** El icono y su superficie llevan el pigmento de la seccion de
 *    grupos, el mismo de su pestana y el de su boton de crear. Deja de ser un
 *    gris entre grises y pasa a leerse como un control de esta pantalla.
 *  - **Un anillo que respira.** Sale del borde de la tuerca, crece un poco y
 *    se apaga, cada dos segundos y medio. Es el mismo recurso que el halo del
 *    eje de la portada y significa lo mismo: aqui hay algo que pulsar.
 *
 * ## Por que no el borde de aurora
 *
 * Porque esta pantalla ya gasta el suyo en la tarjeta del reto de hoy, y la
 * regla es una superficie brillante por pantalla: con dos, ninguna es la
 * principal — y la principal aqui es jugar, no los ajustes. El anillo es otra
 * cosa: no es un borde permanente, es un pulso que aparece y desaparece, asi
 * que no compite por ser «lo que hay que mirar», solo dice «esto se toca».
 */
function SettingsGearBase({ onPress }: { onPress: () => void }): ReactElement {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const pulse = useSharedValue(0);
  const active = useAmbientActive();

  useEffect(() => {
    // Parado mientras no se ve. Ver `useAmbientActive`.
    if (!active) {
      cancelAnimation(pulse);
      pulse.set(0);
      return;
    }

    pulse.set(
      withRepeat(
        withTiming(1, { duration: HALO_MS, easing: Easing.out(Easing.quad) }),
        -1,
        false,
        undefined,
        // Igual que los orbes del fondo y el borde de aurora: esto no desplaza
        // contenido ni parpadea, y sin el la tuerca vuelve a ser invisible,
        // que es justo el problema que resuelve.
        ReduceMotion.Never,
      ),
    );
  }, [active, pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    // Se apaga antes de llegar al final del recorrido: asi el anillo se ha
    // desvanecido del todo cuando el ciclo salta a cero y no se ve el corte.
    opacity: 0.55 * (1 - pulse.get()),
    transform: [{ scale: 1 + pulse.get() * 0.35 }],
  }));

  return (
    <View style={styles.gearWrap}>
      <Animated.View
        pointerEvents="none"
        style={[styles.gearHalo, haloStyle]}
      />
      <IconButton
        name="gear"
        variant="surface"
        color={colors.spectrum[SECTION_TONE.groups].icon}
        accessibilityLabel={t("online.group.edit")}
        onPress={onPress}
        style={styles.gearButton}
      />
    </View>
  );
}

const SettingsGear = memo(SettingsGearBase);

// ---------------------------------------------------------------------------
// El reto de hoy
// ---------------------------------------------------------------------------

/**
 * Los dos intentos de la jornada, dibujados como dos intentos.
 *
 * Un «1 de 2» obliga a leer y a hacer la resta; dos marcas se cuentan de un
 * vistazo, y son exactamente dos porque el reto tiene exactamente dos intentos.
 * Si algún día fueran tres, esto sigue valiendo sin tocarlo.
 */
function AttemptTrack({
  used,
  best,
}: {
  used: number;
  best: number | null;
}): ReactElement {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.attempts}>
      <View style={styles.attemptDots}>
        {[0, 1].map((index) => (
          <View
            key={index}
            style={[styles.attemptDot, index < used && styles.attemptDotUsed]}
          />
        ))}
      </View>
      <Text style={Type.caption}>
        {used === 0
          ? t("online.group.daily.attemptsBoth")
          : used === 1
            ? t("online.group.daily.attemptsOne")
            : t("online.group.daily.noAttempts")}
      </Text>
      {best != null ? (
        <>
          <View style={styles.attemptSeparator} />
          <Text style={[Type.metricSmall, styles.attemptBest]}>
            {t("online.group.points", { points: best })}
          </Text>
        </>
      ) : null}
    </View>
  );
}

/**
 * La superficie del reto de hoy: con borde de aurora si hay algo que jugar, y
 * una tarjeta normal si no.
 *
 * El brillo señala **la acción**, no la sección. Una temporada terminada o unos
 * intentos gastados dejan un botón apagado dentro, y enmarcarlo en color sería
 * llevar la mirada justo a lo único que no se puede tocar. Es la misma regla de
 * una superficie acentuada por pantalla que ya sigue el resto de la app: si
 * brilla algo que no lleva a ninguna parte, deja de significar nada.
 */
function TodaySurface({
  glow,
  children,
}: {
  glow: boolean;
  children: ReactNode;
}): ReactElement {
  const styles = useThemedStyles(createStyles);
  if (!glow) {
    return <Card style={styles.block}>{children}</Card>;
  }

  return (
    <GlowBorder radius={Radius.lg} padding={Space.lg} style={styles.block}>
      {children}
    </GlowBorder>
  );
}

// ---------------------------------------------------------------------------
// Clasificación
// ---------------------------------------------------------------------------

/** El metal de un puesto. Del cuarto en adelante no hay metal: hay puesto. */
function medalFor(
  c: Palette,
  position: number,
): Palette["podium"][keyof Palette["podium"]] | null {
  if (position === 1) return c.podium.gold;
  if (position === 2) return c.podium.silver;
  if (position === 3) return c.podium.bronze;
  return null;
}

/**
 * Una fila de la clasificación, como pieza suelta.
 *
 * **Es la única lista de la app que no vive dentro de una tarjeta.** Una tabla
 * con divisorias dice «estas filas son campos de lo mismo»; una clasificación
 * no es eso: son personas, y compiten. Separarlas en cápsulas —cada una con el
 * tono que ese jugador tiene en su avatar desde siempre— las convierte en lo
 * que son, y de paso hace que el propio nombre se encuentre sin leer la lista.
 *
 * El disco del puesto lleva metal solo en el podio. Es la única jerarquía
 * cromática de la aplicación, y existe porque el puesto es lo único de esta
 * pantalla que **es** un rango.
 */
function StandingRow({
  entry,
  you,
  canAdd,
  busy,
  onAdd,
}: {
  entry: GroupLeaderboardEntry;
  you: boolean;
  /** Esta persona todavía no es nada tuyo y se le puede pedir amistad. */
  canAdd: boolean;
  busy: boolean;
  onAdd: () => void;
}): ReactElement {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const medal = entry.playedDays > 0 ? medalFor(colors, entry.position) : null;
  const tint = playerTint(entry.username);

  return (
    <View
      style={[
        styles.standing,
        {
          borderColor: tint.border,
          // La fila propia va **rellena de tu color**, no del acento de la app.
          // Es la única maciza de la lista, así que se encuentra sin leer, y
          // sigue siendo tu color: un violeta genérico aquí diría «seleccionado»
          // en vez de «tú».
          backgroundColor: you ? tint.fill : colors.surface.raised,
        },
      ]}
    >
      <View
        style={[
          styles.position,
          medal != null && {
            backgroundColor: medal.fill,
            borderColor: medal.border,
          },
        ]}
      >
        <Text
          style={[
            Type.metricSmall,
            styles.positionText,
            medal != null && { color: medal.text },
          ]}
        >
          {entry.position}
        </Text>
      </View>

      <Avatar username={entry.username} size={36} />

      <View style={styles.standingBody}>
        <View style={styles.standingName}>
          <Text style={Type.bodyStrong} numberOfLines={1}>
            {entry.username}
          </Text>
          {you ? <Pill label={t("online.group.you")} tone="accent" /> : null}
        </View>
        <Text style={Type.caption}>{playedDaysLabel(entry.playedDays)}</Text>
      </View>

      <Text style={[Type.metric, { color: tint.text }]}>{entry.score}</Text>

      {/*
        Pedir amistad, desde donde ves a la gente competir.

        Es un `Pressable` con `hitSlop` y no el `IconButton` de siempre porque
        aquel garantiza su objetivo de 44 puntos **dibujándolo**, y eso subiría
        estas cápsulas de 60 a 68 solo en las filas que llevan botón: una lista
        con dos alturas distintas se lee como una lista mal hecha. El objetivo
        táctil sigue siendo el mismo, repartido en el hueco de alrededor.

        Lleva el tono de esa persona, como su nombre y su cifra. El icono va
        aquí y no una pastilla de «ya sois amigos» en las demás filas: quien ya
        es tu amigo no necesita que se lo recuerden en una clasificación.
      */}
      {canAdd ? (
        <Pressable
          onPress={onAdd}
          disabled={busy}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={t("online.group.settings.addFriend", {
            name: entry.username,
          })}
          accessibilityState={{ disabled: busy }}
          style={({ pressed }) => [
            styles.addFriend,
            (pressed || busy) && styles.addFriendPressed,
          ]}
        >
          <Icon name="userPlus" size={18} color={tint.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

/**
 * La entrada al chat, con forma de lo que lleva dentro.
 *
 * Tres esquinas redondas y la de abajo a la izquierda cuadrada: es un bocadillo,
 * y es la única superficie de la app con las esquinas desiguales. Se distingue
 * de la clasificación que tiene justo encima sin necesidad de teñirla ni de
 * ponerle un borde de otro color — la silueta ya dice de qué va. Es la misma que
 * llevan las burbujas de dentro, y esa repetición es lo que hace que la entrada
 * y el sitio al que lleva se lean como el mismo objeto.
 *
 * Lleva **el último mensaje** en vez de una descripción fija. Una descripción
 * dice lo que un chat es, cosa que ya sabe todo el mundo; el último mensaje dice
 * si hay algo que leer, que es lo único que se necesita decidir desde aquí.
 *
 * Está igual de accesible con la temporada terminada: no se esconde, no se
 * apaga y no cambia de sitio (regla 5.2.1 del plan).
 */
function ChatEntry({
  line,
  unread,
  onPress,
}: {
  line: string;
  unread: boolean;
  onPress: () => void;
}): ReactElement {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chat, pressed && styles.chatPressed]}
      accessibilityRole="button"
      accessibilityLabel={
        unread
          ? `${t("online.group.chat.title")}. ${t("online.group.chat.unread")}`
          : t("online.group.chat.title")
      }
      accessibilityHint={line}
    >
      {/*
        El cuadro va relleno de pigmento, no teñido como los de las listas. Es
        la regla del pigmento del sistema de diseño —rellena lo que ocurre fuera
        de una ronda— y aquí hace falta: esta fila es lo último de una pantalla
        larga y con el cuadro apagado se leía como un pie de página.
      */}
      <View>
        <View style={styles.chatIcon}>
          <Icon name="message" size={20} color={colors.spectrum.violet.ink} />
        </View>
        {/*
          El punto rojo, en la esquina del cuadro y con el mismo rojo que el de
          la lista de grupos. Allí cuenta avisos y aquí mensajes, pero para
          quien mira significan lo mismo —hay algo que no has visto—, y darles
          dos colores obligaría a aprenderse dos señales para una idea. Sobre el
          violeta encendido del cuadro no hay forma de que pase desapercibido,
          que es justo su trabajo.
        */}
        {unread ? (
          <View style={styles.chatBadge}>
            <UnreadDot count={1} label={t("online.group.chat.unread")} />
          </View>
        ) : null}
      </View>
      <View style={styles.chatBody}>
        <Text style={Type.bodyStrong}>{t("online.group.chat.title")}</Text>
        <Text
          style={[
            Type.caption,
            styles.chatDescription,
            // Sin leer, la línea sube al claro de los títulos. Es la señal de
            // toda la vida y no gasta ni un color más.
            unread && styles.chatDescriptionUnread,
          ]}
          numberOfLines={1}
        >
          {line}
        </Text>
      </View>
      <Icon name="chevronRight" size={18} color={colors.text.faint} />
    </Pressable>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  block: {
    marginBottom: Space.xxl,
  },
  ribbon: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Space.sm,
    marginBottom: Space.xl,
  },

  // -- La tuerca ------------------------------------------------------------
  gearWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  gearHalo: {
    position: "absolute",
    width: HIT_TARGET,
    height: HIT_TARGET,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: c.spectrum[SECTION_TONE.groups].icon,
  },
  gearButton: {
    // Tenido, no gris: junto al color del icono es la mitad de lo que hace que
    // se lea como un control y no como un adorno de la cabecera.
    backgroundColor: c.spectrum[SECTION_TONE.groups].surface,
    borderRadius: Radius.md,
  },

  // -- Fin de temporada -----------------------------------------------------
  finishedTitle: {
    marginBottom: Space.xs,
  },
  finishedChat: {
    marginTop: Space.sm,
    color: c.text.secondary,
  },
  renewButton: {
    marginTop: Space.lg,
  },

  // -- Reto de hoy ----------------------------------------------------------
  todayHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.sm,
  },
  countdown: {
    color: c.text.muted,
  },
  todayMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
  },
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.xxs,
  },
  streakCount: {
    color: c.ember.text,
  },
  todayRing: {
    alignItems: "center",
    marginTop: Space.lg,
  },
  todayScore: {
    alignItems: "center",
    marginTop: Space.md,
    gap: Space.xs,
  },
  todayRounds: {
    textAlign: "center",
    marginTop: Space.md,
  },
  attempts: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    marginTop: Space.md,
    marginBottom: Space.xl,
  },
  attemptDots: {
    flexDirection: "row",
    gap: Space.xs,
  },
  attemptDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: c.accent.default,
  },
  attemptDotUsed: {
    backgroundColor: c.surface.interactive,
  },
  attemptSeparator: {
    width: 1,
    height: 12,
    backgroundColor: c.border.default,
  },
  attemptBest: {
    color: c.text.primary,
  },
  playButton: {
    // El botón más alto de la aplicación. Es el único sitio donde se rompe la
    // altura estándar de 52, y se rompe porque esta pantalla tiene una sola
    // cosa que hacer y el resto es información sobre ella.
    minHeight: 60,
  },
  todayRule: {
    marginTop: Space.md,
    textAlign: "center",
  },

  // -- Clasificación --------------------------------------------------------
  board: {
    gap: Space.sm,
    marginBottom: Space.xxl,
  },
  standing: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
    // Cápsula: es lo que separa esta lista de cualquier otra de la app.
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  position: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surface.sunken,
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  positionText: {
    color: c.text.muted,
  },
  standingBody: {
    flex: 1,
    gap: Space.xxs,
  },
  standingName: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.xs,
  },
  addFriend: {
    // Solo el dibujo: el objetivo táctil lo pone el `hitSlop`. Ver la nota de
    // `StandingRow`. Sin sangrado negativo: la fila es una cápsula y su canto
    // curva, así que pegar el icono al borde lo mete dentro de la curva.
    marginLeft: Space.xs,
  },
  addFriendPressed: {
    opacity: DISABLED_OPACITY,
  },

  // -- Chat -----------------------------------------------------------------
  chat: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    padding: Space.lg,
    marginBottom: Space.xxl,
    backgroundColor: c.surface.raised,
    borderWidth: 1,
    // Violeta de verdad, no el canto apagado de antes. El acento es el color
    // de «esto lleva a alguna parte», y hasta ahora esta fila lo llevaba tan
    // bajado que no lo decía.
    borderColor: c.accent.default,
    // El bocadillo. La esquina viva es la de abajo a la izquierda.
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
    borderBottomLeftRadius: Radius.sm / 2,
  },
  chatPressed: {
    backgroundColor: c.surface.interactive,
  },
  chatIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.spectrum.violet.pigment,
  },
  chatBody: {
    flex: 1,
  },
  chatBadge: {
    position: "absolute",
    top: -2,
    right: -2,
  },
  chatDescription: {
    marginTop: Space.xxs,
  },
  chatDescriptionUnread: {
    color: c.text.primary,
  },
  });
