import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { SettingsButton } from "@/components/SettingsButton";
import { DevTimePanel } from "@/components/online/DevTimePanel";
import { Button } from "@/design/Button";
import { ErrorBanner, Loading, Pill, Stat } from "@/design/Feedback";
import { AmbientOrbit } from "@/design/Ambient";
import { Card, NoticePanel, Screen } from "@/design/Layout";
import { Color, Space, Type } from "@/design/tokens";
import { useCountdown, useDailyChallenge } from "@/hooks/useDailyChallenge";
import { t } from "@/i18n";
import { formatChallengeDate, formatCountdown } from "@/online/daily";

/**
 * La antesala del reto diario: qué toca hoy y si se puede jugar.
 *
 * Vive en `/online/daily` y **no** dentro de un grupo aunque el árbol de
 * pantallas del apartado 8 lo dibujara como `/online/groups/[id]/play`. El
 * motivo es el 5.3: el reto es global, no depende de ningún grupo, y uno de los
 * estados que hay que cubrir es precisamente el del jugador que **no tiene
 * ningún grupo activo** —o ninguno en absoluto—, que colgando la pantalla de un
 * grupo no tendría por dónde entrar. Los grupos enlazan aquí, y aquí se avisa de
 * en cuáles suma la puntuación.
 *
 * Los cuatro estados del apartado 8 se resuelven en esta pantalla:
 * sin intentos, reto cerrado, cuenta atrás al próximo y sin grupo activo.
 */
export default function DailyScreen(): ReactElement {
  const router = useRouter();
  /**
   * El grupo llega por parámetro porque hay un reto por grupo: esta pantalla no
   * elige ninguno. Se entra desde el menú principal o desde la ficha del grupo,
   * y las dos mandan el `group`.
   */
  const { group: groupParam } = useLocalSearchParams<{ group?: string }>();
  const groupId = Array.isArray(groupParam) ? groupParam[0] : (groupParam ?? null);

  const {
    loading,
    error,
    status,
    rounds,
    attemptsLeft,
    serverClosed,
    clockTrusted,
    reload,
  } = useDailyChallenge(groupId);

  const [refreshing, setRefreshing] = useState(false);

  // Al volver de la partida los intentos y la mejor puntuación han cambiado.
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  /**
   * La cuenta atrás solo corre si el reloj del teléfono está de acuerdo con la
   * ventana del reto. Con el viaje en el tiempo del backend (5.5) no lo está, y
   * más vale no enseñar nada que enseñar una cifra inventada.
   */
  const { remainingMs, expired } = useCountdown(
    status?.closesAt ?? null,
    clockTrusted,
  );

  // La autoridad sobre si la jornada cerró es el servidor; la cuenta atrás
  // local solo adelanta el aviso mientras la pantalla está abierta.
  const closed = serverClosed || expired;
  const canPlay = !closed && attemptsLeft > 0;

  /**
   * Sin grupo no hay reto.
   *
   * Se llega aquí por un enlace directo o por una recarga en web que pierde el
   * parámetro. En vez de una pantalla vacía, se dice lo que pasa y se ofrece lo
   * único que arregla la situación: entrar en un grupo.
   */
  if (!groupId) {
    return (
      <Screen
        eyebrow={t("online.daily.badge")}
        title={t("online.daily.title")}
        backTo="/online"
        backdrop={<AmbientOrbit />}
      >
        <Card>
          <Text style={Type.bodyStrong}>{t("online.daily.noGroupTitle")}</Text>
          <Text style={[Type.caption, styles.blockHint]}>
            {t("online.daily.noGroupHint")}
          </Text>
          <Button
            label={t("online.daily.goToGroups")}
            icon="users"
            onPress={() => router.push("/online/groups")}
            style={styles.blockAction}
          />
        </Card>
      </Screen>
    );
  }

  if (loading && !status) {
    return (
      <Screen
        eyebrow={t("online.daily.badge")}
        title={t("online.daily.title")}
        backTo="/online"
      >
        {error ? (
          <ErrorBanner
            message={error}
            onRetry={() => void reload()}
            retryLabel={t("common.retry")}
          />
        ) : (
          <Loading label={t("online.daily.loading")} />
        )}
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow={t("online.daily.badge")}
      title={t("online.daily.title")}
      subtitle={
        status ? formatChallengeDate(status.challenge.challengeDate) : undefined
      }
      backTo="/online"
      backdrop={<AmbientOrbit />}
      headerAction={<SettingsButton />}
      onRefresh={refresh}
      refreshing={refreshing}
    >
      {error ? (
        <ErrorBanner
          message={error}
          onRetry={() => void reload()}
          retryLabel={t("common.retry")}
        />
      ) : null}

      {status ? (
        <>
          {/* ----------------------- Qué toca hoy ---------------------- */}
          <Card style={styles.block}>
            <View style={styles.headRow}>
              {/* «Imágenes» y no «logos»: el nombre de la marca es la
                  respuesta, y aquí no se nombra ninguna. */}
              <Text style={Type.heading}>
                {rounds.length === 1
                  ? t("online.daily.roundsTitleOne")
                  : t("online.daily.roundsTitle", { count: rounds.length })}
              </Text>
              <Pill
                label={
                  closed
                    ? t("online.daily.statusClosed")
                    : attemptsLeft === 0
                      ? t("online.daily.statusUsed")
                      : t("online.daily.statusOpen")
                }
                tone={canPlay ? "success" : "neutral"}
              />
            </View>
            <Text style={[Type.caption, styles.headHint]}>
              {t("online.daily.roundsHint")}
            </Text>

            <View style={styles.statsRow}>
              <Stat
                value={String(attemptsLeft)}
                label={t("online.daily.attemptsLabel")}
                hint={t("online.daily.attemptsHint", {
                  used: status.attemptsUsed,
                })}
              />
              <View style={styles.statDivider} />
              <Stat
                value={
                  status.bestScore != null ? String(status.bestScore) : "—"
                }
                label={t("online.daily.bestLabel")}
                hint={t("online.daily.bestHint")}
              />
            </View>
          </Card>

          {/* -------------------- Cuenta atrás ------------------------- */}
          {clockTrusted && !closed ? (
            <Card style={styles.block}>
              <Text style={Type.label}>
                {t(
                  canPlay
                    ? "online.daily.closesIn"
                    : "online.daily.nextChallengeIn",
                )}
              </Text>
              <Text style={[Type.metric, styles.countdown]}>
                {formatCountdown(remainingMs)}
              </Text>
              <Text style={Type.caption}>{t("online.daily.cutHint")}</Text>
            </Card>
          ) : null}

          {/* ---------------------- Reto cerrado ----------------------- */}
          {closed ? (
            <Card style={styles.block}>
              <Text style={Type.bodyStrong}>
                {t("online.daily.closedTitle")}
              </Text>
              <Text style={[Type.caption, styles.blockHint]}>
                {t("online.daily.closedHint")}
              </Text>
              <Button
                label={t("online.daily.reload")}
                icon="retry"
                variant="secondary"
                onPress={() => void reload()}
                style={styles.blockAction}
              />
            </Card>
          ) : null}

          {/* ------------------- Sin intentos hoy ---------------------- */}
          {!closed && attemptsLeft === 0 ? (
            <Card style={styles.block}>
              <Text style={Type.bodyStrong}>
                {t("online.daily.noAttemptsTitle")}
              </Text>
              <Text style={[Type.caption, styles.blockHint]}>
                {t("online.daily.noAttemptsHint")}
              </Text>
            </Card>
          ) : null}

          {/*
            ------------------- Dónde cuenta esto ---------------------

            Antes aquí se listaban todos los grupos activos, porque el reto era
            global y sumaba en todos a la vez. Ahora cuenta en uno y solo uno:
            el que se está jugando. La tarjeta lo dice y ofrece ir a su
            clasificación, que es la pregunta siguiente.
          */}
          <Card style={styles.block}>
            <View style={styles.headRow}>
              <Text style={Type.bodyStrong}>
                {t("online.daily.countsIn", { group: status.group.name })}
              </Text>
              <Pill
                label={t("online.groups.members", {
                  count: status.group.memberCount,
                })}
              />
            </View>
            <Text style={[Type.caption, styles.blockHint]}>
              {t("online.daily.countsInHint")}
            </Text>
            <Button
              label={t("online.daily.goToGroup")}
              icon="trophy"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/online/groups/[id]",
                  params: { id: status.group.id },
                })
              }
              style={styles.blockAction}
            />
          </Card>

          {/*
            --------------------------- Reglas -------------------------
            Encima del botón y no debajo: son las condiciones de lo que se va a
            pulsar —dos intentos, cuenta el mejor—, y una condición que se lee
            después de haber decidido llega tarde. Debajo del botón, además,
            quedaba fuera de pantalla en un móvil corto.
          */}
          <NoticePanel
            title={t("online.daily.rulesTitle")}
            items={[
              t("online.daily.ruleAttempts"),
              t("online.daily.ruleBest"),
              t("online.daily.ruleServer"),
            ]}
            style={styles.rules}
          />

          {/* --------------------------- Jugar ------------------------- */}
          <Button
            label={t(
              status.attemptsUsed > 0
                ? "online.daily.playSecond"
                : "online.daily.play",
            )}
            icon="play"
            disabled={!canPlay}
            onPress={() =>
              router.push({
                pathname: "/online/daily/play",
                params: { group: groupId },
              })
            }
          />
        </>
      ) : null}

      {/*
        Panel de desarrollo: aquí es donde más falta hace, porque permite cruzar
        el corte de las 15:00 sin esperar a que llegue y ver aparecer el reto
        nuevo. Devuelve `null` fuera de `__DEV__`.
      */}
      <DevTimePanel onChanged={reload} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: Space.xxl,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.sm,
  },
  headHint: {
    marginTop: Space.xs,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: Space.xl,
  },
  statDivider: {
    width: 1,
    backgroundColor: Color.border.subtle,
  },
  countdown: {
    marginTop: Space.xs,
    marginBottom: Space.xs,
  },
  blockHint: {
    marginTop: Space.xs,
  },
  blockAction: {
    marginTop: Space.lg,
  },
  rules: {
    marginBottom: Space.xl,
  },
});
