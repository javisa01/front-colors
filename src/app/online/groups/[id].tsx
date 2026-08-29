import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";

import { describeError } from "@/api/errors";
import type {
  DailyStatus,
  GroupDetail,
  GroupLeaderboard,
  GroupLeaderboardEntry,
} from "@/api/types";
import { SettingsButton } from "@/components/SettingsButton";
import { DevTimePanel } from "@/components/online/DevTimePanel";
import { Avatar } from "@/design/Avatar";
import { Button, IconButton } from "@/design/Button";
import { EmptyState, ErrorBanner, Loading, Pill, Stat } from "@/design/Feedback";
import { Notice } from "@/design/Form";
import { Card, OptionRow, Screen, SectionHeader } from "@/design/Layout";
import { Color, Radius, Space, Type } from "@/design/tokens";
import { t } from "@/i18n";
import { daysLeft, membersLabel, playedDaysLabel } from "@/online/groups";
import { useSession } from "@/online/session";

/**
 * Un grupo por dentro: código de invitación, reto de hoy, clasificación y
 * miembros.
 *
 * Los tres estados que tiene que cubrir esta pantalla (apartado 8 del plan):
 *
 *  - **Activo**: días que quedan y clasificación en vivo.
 *  - **Terminado**: clasificación congelada con el podio final, y el botón de
 *    renovar **solo para el `owner`**; a los demás se les dice quién puede.
 *    El chat sigue accesible, porque un grupo terminado no está cerrado.
 *  - **Sin ninguna temporada activa**: el reto diario se puede jugar igual,
 *    pero avisando de que no suma en esta clasificación.
 *
 * El estado no se calcula aquí: llega en `group.status`, derivado por el
 * servidor. Por eso basta con releer para que la pantalla se ponga al día.
 */
export default function GroupDetailScreen(): ReactElement {
  const { api, user } = useSession();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [board, setBoard] = useState<GroupLeaderboard | null>(null);
  const [daily, setDaily] = useState<DailyStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<"renew" | "leave" | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [detail, leaderboard, today] = await Promise.all([
        api.groups.get(id),
        api.groups.leaderboard(id),
        // El reto es de ESTE grupo. Se pide aunque la temporada esté
        // terminada: entonces no se puede jugar, pero la tarjeta sigue
        // enseñando lo que se hizo hoy.
        api.daily.today(id),
      ]);
      setGroup(detail.group);
      setBoard(leaderboard);
      setDaily(today);
    } catch (loadError) {
      setError(describeError(loadError));
    }
  }, [api, id]);

  /**
   * Los avisos de este grupo se marcan leídos al abrirlo (apartado 8).
   *
   * Se filtran por `groupId` en vez de llamar a «marcar todo»: entrar en un
   * grupo no debe apagar el punto rojo de los demás.
   */
  const markGroupNotificationsRead = useCallback(async () => {
    if (!id) return;
    try {
      const { notifications } = await api.notifications.list({ unreadOnly: true });
      const mine = notifications
        .filter((notification) => notification.groupId === id)
        .map((notification) => notification.id);
      if (mine.length > 0) {
        await api.notifications.markRead(mine);
      }
    } catch {
      // Que no se marquen los avisos no es motivo para romper la pantalla.
    }
  }, [api, id]);

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

  const share = useCallback(async () => {
    if (!group) return;
    await Share.share({
      message: t("online.group.shareMessage", {
        name: group.name,
        code: group.joinCode,
      }),
    });
  }, [group]);

  const renew = useCallback(async () => {
    if (!group) return;
    setBusy("renew");
    setError(null);
    try {
      const { group: renewed } = await api.groups.renew(group.id);
      setGroup(renewed);
      setBoard(await api.groups.leaderboard(group.id));
      setNotice(
        t("online.group.renewed", { season: renewed.currentSeason.seasonNumber }),
      );
    } catch (renewError) {
      setError(describeError(renewError));
    } finally {
      setBusy(null);
    }
  }, [api, group]);

  const leave = useCallback(async () => {
    if (!group) return;
    setBusy("leave");
    setError(null);
    try {
      await api.groups.leave(group.id);
      router.replace("/online/groups");
    } catch (leaveError) {
      setError(describeError(leaveError));
      setBusy(null);
    }
  }, [api, group, router]);

  if (!group) {
    return (
      <Screen
        eyebrow={t("online.group.badge")}
        title={t("online.groups.title")}
        backTo="/online/groups"
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

  return (
    <Screen
      eyebrow={t("online.group.season", {
        season: group.currentSeason.seasonNumber,
      })}
      title={group.name}
      subtitle={membersLabel(group.memberCount)}
      backTo="/online/groups"
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
      {notice ? <Notice message={notice} /> : null}

      {/* ------------------------ Fin de temporada ---------------------- */}
      {finished ? (
        <Card style={styles.block}>
          <View style={styles.finishedHeader}>
            <Pill label={t("online.groups.statusFinished")} tone="neutral" />
          </View>
          <Text style={[Type.bodyStrong, styles.finishedTitle]}>
            {t("online.group.finishedTitle")}
          </Text>
          <Text style={Type.caption}>
            {isOwner
              ? t("online.group.finishedOwner")
              : t("online.group.finishedMember", { owner: ownerName })}
          </Text>
          <Text style={[Type.caption, styles.chatStillOpen]}>
            {t("online.group.chatStillOpen")}
          </Text>

          {/* El botón de renovar es SOLO del creador (regla 5.2 del plan). */}
          {isOwner ? (
            <Button
              label={t("online.group.renew", {
                season: group.currentSeason.seasonNumber + 1,
              })}
              icon="retry"
              loading={busy === "renew"}
              onPress={() => void renew()}
              style={styles.renewButton}
            />
          ) : null}
        </Card>
      ) : (
        <Card style={styles.block}>
          <View style={styles.statsRow}>
            <Stat
              label={t("online.group.season", {
                season: group.currentSeason.seasonNumber,
              })}
              value={String(remaining)}
              hint={t("online.groups.daysLeft", { days: remaining })}
            />
            <View style={styles.statDivider} />
            <Stat
              label={t("online.group.members")}
              value={String(group.memberCount)}
            />
          </View>
        </Card>
      )}

      {/* ------------------------- Reto de hoy -------------------------- */}
      <SectionHeader title={t("online.group.daily.title")} />
      <Card style={styles.block}>
        <View style={styles.dailyRow}>
          <View style={styles.dailyText}>
            <Text style={Type.bodyStrong}>
              {daily
                ? daily.attemptsLeft === 0
                  ? t("online.group.daily.noAttempts")
                  : daily.attemptsLeft === 1
                    ? t("online.group.daily.attemptsOne")
                    : t("online.group.daily.attemptsLeft", {
                        count: daily.attemptsLeft,
                      })
                : "—"}
            </Text>
            {daily?.bestScore != null ? (
              <Text style={Type.caption}>
                {t("online.group.daily.best", { score: daily.bestScore })}
              </Text>
            ) : null}
          </View>
          {/*
            El reto de ESTE grupo, con sus imágenes y sus dos intentos: se
            juega en `/online/daily?group=<id>` y solo suma en su clasificación.
            Al volver, el `useFocusEffect` de esta pantalla la relee.

            Con la temporada terminada no se puede jugar —el reto no sumaría en
            ningún sitio y solo serviría para cobrar XP en un grupo muerto—, así
            que el botón se apaga igual que cuando no quedan intentos.
          */}
          <Button
            label={t("online.group.daily.play")}
            icon="play"
            size="md"
            fullWidth={false}
            variant={
              finished || (daily && daily.attemptsLeft === 0)
                ? "secondary"
                : "primary"
            }
            disabled={finished || (daily != null && daily.attemptsLeft === 0)}
            onPress={() =>
              router.push({
                pathname: "/online/daily",
                params: { group: id },
              })
            }
          />
        </View>

        {finished ? (
          <Text style={[Type.caption, styles.notCounting]}>
            {t("online.group.daily.notCounting")}
          </Text>
        ) : null}
      </Card>

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
        <Card style={styles.block}>
          {board.entries.map((entry, index) => (
            <LeaderboardRow
              key={entry.userId}
              entry={entry}
              you={entry.userId === user?.id}
              owner={entry.userId === group.ownerUserId}
              last={index === board.entries.length - 1}
            />
          ))}
        </Card>
      )}

      {/* --------------------------- El chat ---------------------------- */}
      <OptionRow
        icon="users"
        tone="violet"
        title={t("online.group.chat.title")}
        description={t("online.group.chat.description")}
        badge={<Pill label={t("online.group.chat.soon")} />}
        onPress={() => undefined}
        disabled
      />

      {/* -------------------------- Miembros ---------------------------- */}
      <SectionHeader title={t("online.group.members")} />
      <Card style={styles.block}>
        {group.members.map((member, index) => (
          <View
            key={member.userId}
            style={[
              styles.memberRow,
              index === group.members.length - 1 && styles.memberRowLast,
            ]}
          >
            <Avatar username={member.username} size={36} />
            <Text style={[Type.body, styles.memberName]} numberOfLines={1}>
              {member.username}
            </Text>
            {member.userId === user?.id ? (
              <Pill label={t("online.group.you")} tone="accent" />
            ) : null}
            {member.role === "owner" ? (
              <Pill label={t("online.group.owner")} />
            ) : null}
          </View>
        ))}
      </Card>

      {/* --------------------- Código de invitación --------------------- */}
      <SectionHeader title={t("online.group.codeTitle")} />
      <Card style={styles.block}>
        <View style={styles.codeRow}>
          <Text style={[Type.metric, styles.code]} selectable>
            {group.joinCode}
          </Text>
          <IconButton
            name="share"
            variant="surface"
            accessibilityLabel={t("online.group.share")}
            onPress={() => void share()}
          />
        </View>
        <Text style={Type.caption}>{t("online.group.codeHint")}</Text>
      </Card>

      {/* ---------------------------- Salir ----------------------------- */}
      <Card style={styles.block}>
        <Button
          label={t("online.group.leave")}
          variant="ghost"
          icon="logOut"
          loading={busy === "leave"}
          onPress={() => void leave()}
        />
        {isOwner ? (
          <Text style={[Type.caption, styles.leaveHint]}>
            {t("online.group.leaveOwnerHint")}
          </Text>
        ) : null}
      </Card>

      {/*
        Panel de desarrollo. Aquí lleva además el atajo de terminar ESTA
        temporada sin mover el reloj global, que es lo más cómodo para ver el
        estado «terminado» sin arrastrar también las jornadas del reto diario.
      */}
      <DevTimePanel groupId={group.id} onChanged={load} />
    </Screen>
  );
}

/**
 * Una fila de la clasificación. Los tres primeros puestos van marcados: es el
 * podio que pide el plan, sin montar una escenografía aparte que luego habría
 * que mantener en dos sitios.
 */
function LeaderboardRow({
  entry,
  you,
  owner,
  last,
}: {
  entry: GroupLeaderboardEntry;
  you: boolean;
  owner: boolean;
  last: boolean;
}): ReactElement {
  const podium = entry.position <= 3 && entry.playedDays > 0;

  return (
    <View style={[styles.boardRow, last && styles.boardRowLast]}>
      <View style={[styles.position, podium && styles.positionPodium]}>
        <Text style={[Type.bodyStrong, podium && styles.positionPodiumText]}>
          {entry.position}
        </Text>
      </View>

      <Avatar username={entry.username} size={36} />

      <View style={styles.boardText}>
        <View style={styles.boardName}>
          <Text style={Type.bodyStrong} numberOfLines={1}>
            {entry.username}
          </Text>
          {you ? <Pill label={t("online.group.you")} tone="accent" /> : null}
          {owner ? <Pill label={t("online.group.owner")} /> : null}
        </View>
        <Text style={Type.caption}>{playedDaysLabel(entry.playedDays)}</Text>
      </View>

      <Text style={Type.metricSmall}>
        {t("online.group.points", { points: entry.score })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: Space.xxl,
  },
  finishedHeader: {
    flexDirection: "row",
    marginBottom: Space.md,
  },
  finishedTitle: {
    marginBottom: Space.xs,
  },
  chatStillOpen: {
    marginTop: Space.sm,
  },
  renewButton: {
    marginTop: Space.lg,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  statDivider: {
    width: 1,
    backgroundColor: Color.border.subtle,
  },
  dailyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
  },
  dailyText: {
    flex: 1,
    gap: Space.xxs,
  },
  notCounting: {
    marginTop: Space.md,
  },
  boardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    paddingVertical: Space.md,
    borderBottomWidth: 1,
    borderBottomColor: Color.border.subtle,
  },
  boardRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  position: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.surface.raised,
  },
  positionPodium: {
    backgroundColor: Color.accent.surface,
  },
  positionPodiumText: {
    color: Color.accent.text,
  },
  boardText: {
    flex: 1,
    gap: Space.xxs,
  },
  boardName: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.xs,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    paddingVertical: Space.sm,
    borderBottomWidth: 1,
    borderBottomColor: Color.border.subtle,
  },
  memberRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  memberName: {
    flex: 1,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Space.sm,
  },
  code: {
    letterSpacing: 4,
  },
  leaveHint: {
    marginTop: Space.sm,
    textAlign: "center",
  },
});
