import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import type { ReactElement, ReactNode } from "react";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { describeError } from "@/api/errors";
import type { GroupDetail, GroupLeaderboard, GroupLeaderboardEntry } from "@/api/types";
import { SettingsButton } from "@/components/SettingsButton";
import { DevTimePanel } from "@/components/online/DevTimePanel";
import { AmbientOrbs } from "@/design/Ambient";
import { Avatar, playerTint } from "@/design/Avatar";
import { Button, IconButton } from "@/design/Button";
import { EmptyState, ErrorBanner, Loading, Pill } from "@/design/Feedback";
import { Icon } from "@/design/Icon";
import { GlowBorder } from "@/design/Glow";
import { Notice } from "@/design/Form";
import { Card, Screen, SectionHeader } from "@/design/Layout";
import { Color, Radius, Space, Type } from "@/design/tokens";
import { useCountdown, useDailyChallenge } from "@/hooks/useDailyChallenge";
import { t } from "@/i18n";
import { formatCountdown } from "@/online/daily";
import { daysLeft, membersLabel, playedDaysLabel } from "@/online/groups";
import { useSession } from "@/online/session";

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
  const { api, user } = useSession();
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

  const load = useCallback(async () => {
    await Promise.all([loadGroup(), reloadDaily()]);
  }, [loadGroup, reloadDaily]);

  /**
   * Los avisos de este grupo se marcan leídos al abrirlo (apartado 8).
   *
   * Se filtran por `groupId` en vez de llamar a «marcar todo»: entrar en un
   * grupo no debe apagar el punto rojo de los demás.
   */
  const markGroupNotificationsRead = useCallback(async () => {
    if (!groupId) return;
    try {
      const { notifications } = await api.notifications.list({ unreadOnly: true });
      const mine = notifications
        .filter((notification) => notification.groupId === groupId)
        .map((notification) => notification.id);
      if (mine.length > 0) {
        await api.notifications.markRead(mine);
      }
    } catch {
      // Que no se marquen los avisos no es motivo para romper la pantalla.
    }
  }, [api, groupId]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await load();
        await markGroupNotificationsRead();
      })();
    }, [load, markGroupNotificationsRead]),
  );

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
      setNotice(
        t("online.group.renewed", { season: renewed.currentSeason.seasonNumber }),
      );
    } catch (renewError) {
      setError(describeError(renewError));
    } finally {
      setRenewing(false);
    }
  }, [api, group, reloadDaily]);

  /**
   * La cuenta atrás solo corre si el reloj del teléfono está de acuerdo con la
   * ventana del reto. Con el viaje en el tiempo del backend (5.5) no lo está, y
   * más vale no enseñar nada que enseñar una cifra inventada.
   */
  const { remainingMs, expired } = useCountdown(
    daily?.closesAt ?? null,
    clockTrusted,
  );

  if (!group) {
    return (
      <Screen
        eyebrow={t("online.group.badge")}
        title={t("online.groups.title")}
        backTo="/online/groups"
        backdrop={<AmbientOrbs />}
      >
        {error ? (
          <ErrorBanner
            message={error}
            onRetry={() => void load()}
            retryLabel={t("common.retry")}
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

  return (
    <Screen
      eyebrow={t("online.group.season", {
        season: group.currentSeason.seasonNumber,
      })}
      title={group.name}
      titleAction={
        <IconButton
          name="gear"
          variant="surface"
          accessibilityLabel={t("online.group.edit")}
          onPress={() =>
            router.push({
              pathname: "/online/groups/[id]/edit",
              params: { id: group.id },
            })
          }
        />
      }
      backTo="/online/groups"
      backdrop={<AmbientOrbs />}
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
          retryLabel={t("common.retry")}
        />
      ) : null}
      {notice ? <Notice message={notice} /> : null}

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

          {/* El botón de renovar es SOLO del creador (regla 5.2 del plan). */}
          {isOwner ? (
            <Button
              label={t("online.group.renew", {
                season: group.currentSeason.seasonNumber + 1,
              })}
              icon="retry"
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
            {clockTrusted && !closed ? (
              <Text style={[Type.metricSmall, styles.countdown]}>
                {t("online.group.daily.closesIn", {
                  time: formatCountdown(remainingMs),
                })}
              </Text>
            ) : null}
          </View>

          {/*
            Cuántas imágenes toca hoy. No se pinta hasta saberlo: un texto de
            relleno del tamaño de un título es lo primero que se lee, y sería lo
            primero que cambia al llegar la respuesta.
          */}
          {rounds.length > 0 ? (
            <Text style={[Type.title, styles.todayTitle]}>
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
        hint={t("online.group.leaderboardHint")}
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
            />
          ))}
        </View>
      )}

      {/* --------------------------- El chat ---------------------------- */}
      <ChatBubble />

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
function medalFor(position: number): (typeof Color.podium)[keyof typeof Color.podium] | null {
  if (position === 1) return Color.podium.gold;
  if (position === 2) return Color.podium.silver;
  if (position === 3) return Color.podium.bronze;
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
}: {
  entry: GroupLeaderboardEntry;
  you: boolean;
}): ReactElement {
  const medal = entry.playedDays > 0 ? medalFor(entry.position) : null;
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
          backgroundColor: you ? tint.fill : Color.surface.raised,
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
    </View>
  );
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

/**
 * El chat, con forma de lo que es.
 *
 * Tres esquinas redondas y la de abajo a la izquierda cuadrada: es un bocadillo,
 * y es la única superficie de la app con las esquinas desiguales. Se distingue
 * de la clasificación que tiene justo encima sin necesidad de teñirla ni de
 * ponerle un borde de otro color — la silueta ya dice de qué va.
 *
 * Va apagado porque todavía no está: el backend tiene los mensajes, pero la
 * pantalla no. Se deja visible en vez de esconderlo porque forma parte de lo que
 * un grupo es, y verlo apagado con «en desarrollo» dice más que no verlo.
 */
function ChatBubble(): ReactElement {
  return (
    <View style={styles.chat} accessibilityRole="summary">
      <View style={styles.chatIcon}>
        <Icon name="users" size={20} color={Color.spectrum.violet.icon} />
      </View>
      <View style={styles.chatBody}>
        <Text style={Type.bodyStrong}>{t("online.group.chat.title")}</Text>
        <Text style={[Type.caption, styles.chatDescription]}>
          {t("online.group.chat.description")}
        </Text>
      </View>
      <Pill label={t("online.group.chat.soon")} tone="accent" />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: Space.xxl,
  },
  ribbon: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Space.sm,
    marginBottom: Space.xl,
  },

  // -- Fin de temporada -----------------------------------------------------
  finishedTitle: {
    marginBottom: Space.xs,
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
    color: Color.text.muted,
  },
  todayTitle: {
    marginTop: Space.sm,
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
    backgroundColor: Color.accent.default,
  },
  attemptDotUsed: {
    backgroundColor: Color.surface.interactive,
  },
  attemptSeparator: {
    width: 1,
    height: 12,
    backgroundColor: Color.border.default,
  },
  attemptBest: {
    color: Color.text.primary,
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
    backgroundColor: Color.surface.sunken,
    borderWidth: 1,
    borderColor: Color.border.subtle,
  },
  positionText: {
    color: Color.text.muted,
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

  // -- Chat -----------------------------------------------------------------
  chat: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    padding: Space.lg,
    marginBottom: Space.xxl,
    backgroundColor: Color.surface.raised,
    borderWidth: 1,
    borderColor: Color.accent.border,
    // El bocadillo. La esquina viva es la de abajo a la izquierda.
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
    borderBottomLeftRadius: Radius.sm / 2,
  },
  chatIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.spectrum.violet.surface,
    borderWidth: 1,
    borderColor: Color.spectrum.violet.border,
  },
  chatBody: {
    flex: 1,
  },
  chatDescription: {
    marginTop: Space.xxs,
  },
});
