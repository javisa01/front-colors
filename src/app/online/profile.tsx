import { useFocusEffect, useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useOnlineTabBarSpace } from "@/components/online/OnlineTabBar";
import { AmbientSpotlight } from "@/design/Ambient";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ApiError, describeError } from "@/api/errors";
import type { FriendEntry, FriendsOverview } from "@/api/types";
import { SettingsButton } from "@/components/SettingsButton";
import { Avatar } from "@/design/Avatar";
import { Button, IconButton } from "@/design/Button";
import { ErrorBanner, Pill, ProgressBar } from "@/design/Feedback";
import { Flame } from "@/design/Flame";
import { Field, InfoRow, Notice, RowActions } from "@/design/Form";
import { Card, Divider, Screen, SectionHeader, TextLink } from "@/design/Layout";
import { Color, SECTION_TONE, Space, Type } from "@/design/tokens";
import { t } from "@/i18n";
import { readDailyXp } from "@/online/attempts";
import { useSession } from "@/online/session";
import { useSocial } from "@/online/social";
import { readStreak, visibleStreak } from "@/online/streak";

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

/**
 * Ficha del jugador: identidad, progreso y salida de sesión.
 *
 * El bloque de cuenta alterna entre lectura y edición en el mismo sitio, sin
 * abrir un modal: solo hay un campo editable, y sacar una capa encima para
 * cambiar una línea es más ceremonia de la que el cambio merece.
 */
export default function ProfileScreen(): ReactElement {
  const { user, api, applyUser, logout, reloadUser } = useSession();
  const { apply: applySocial } = useSocial();
  const tabBarSpace = useOnlineTabBarSpace();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user?.username ?? "");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [banner, setBanner] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  /**
   * Amigos y solicitudes.
   *
   * El perfil es donde vive lo social —lo dice la barra de pestañas, que por eso
   * no le da sitio propio a Amigos—, y hasta ahora no lo enseñaba: desde aquí no
   * había forma de llegar a las solicitudes ni a la lista. Lo que se responde se
   * responde en el sitio, sin salir del perfil; lo demás está a un enlace.
   */
  const [friends, setFriends] = useState<FriendsOverview | null>(null);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  /** Id de quien tiene una respuesta en vuelo, para bloquear solo su fila. */
  const [answering, setAnswering] = useState<string | null>(null);

  /**
   * De dónde sale el nivel: el reto de hoy.
   *
   * `dailyXp` es lo ganado hoy con el reto sumando todos los grupos, y sale del
   * teléfono (`online/attempts`): la cifra solo viaja al cerrar cada intento y
   * `GET /me` trae el total de siempre, no el del día. `played` sí es del
   * servidor, y manda sobre ella: quien jugó desde otro dispositivo tiene la
   * jornada hecha y este móvil no la ha visto pasar.
   */
  const [dailyXp, setDailyXp] = useState<number | null>(null);
  const [played, setPlayed] = useState(false);
  const [streak, setStreak] = useState(0);

  /**
   * El progreso, al día.
   *
   * `reloadUser()` no es opcional aquí. El XP y el nivel los mueve el reto, que
   * se juega en otra pantalla —y puede jugarse en otro dispositivo—, así que el
   * perfil de la sesión puede llegar viejo y esta es **la** pantalla donde esa
   * cifra es el contenido. Los dos fallos se tragan por separado: sin red, se
   * sigue enseñando lo cacheado, que es mejor que un banner sobre un nivel que
   * sigue siendo cierto.
   */
  const loadProgress = useCallback(async () => {
    const [overview] = await Promise.all([
      api.daily.overview().catch(() => null),
      reloadUser().catch(() => undefined),
    ]);

    // Cuál es la jornada en curso lo dice el servidor, nunca el reloj del
    // teléfono: con el viaje en el tiempo del backend no coinciden.
    if (overview == null) {
      setDailyXp(null);
      return;
    }
    const today = overview.challengeDate;

    const [stored, streakStore] = await Promise.all([
      readDailyXp(),
      readStreak(),
    ]);

    setPlayed(overview.groups.some((group) => group.bestScore != null));
    setDailyXp(stored != null && stored.dateKey === today ? stored.xp : 0);
    setStreak(visibleStreak(streakStore, today));
  }, [api, reloadUser]);

  const loadFriends = useCallback(async () => {
    setFriendsError(null);
    try {
      const overview = await api.friends.list();
      setFriends(overview);
      // El punto rojo de esta misma pestaña sale de aquí: responder una
      // solicitud lo apaga sin tener que volver a preguntar.
      applySocial(overview);
    } catch (loadError) {
      // El fallo se cuenta **dentro del bloque**, no arriba del todo: lo que ha
      // fallado son los amigos, y el resto del perfil —tu nombre, tu nivel, tu
      // sesión— sigue ahí y sigue sirviendo. Un banner en la cabecera daría a
      // entender que la pantalla entera está rota.
      setFriendsError(describeError(loadError));
    }
  }, [api, applySocial]);

  useFocusEffect(
    useCallback(() => {
      void loadFriends();
      void loadProgress();
    }, [loadFriends, loadProgress]),
  );

  const answer = useCallback(
    async (userId: string, action: () => Promise<unknown>) => {
      setAnswering(userId);
      setBanner(null);
      try {
        await action();
        await loadFriends();
      } catch (error) {
        setBanner(describeError(error));
      } finally {
        setAnswering(null);
      }
    },
    [loadFriends],
  );

  const startEditing = useCallback(() => {
    setUsername(user?.username ?? "");
    setFieldError(undefined);
    setBanner(null);
    setSaved(false);
    setEditing(true);
  }, [user]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setFieldError(undefined);
    setBanner(null);
  }, []);

  const save = useCallback(async () => {
    const clean = username.trim();

    if (clean === user?.username) {
      setEditing(false);
      return;
    }
    if (clean.length < 3 || clean.length > 24) {
      setFieldError(t("online.auth.error.usernameLength"));
      return;
    }
    if (!USERNAME_PATTERN.test(clean)) {
      setFieldError(t("online.auth.error.usernameChars"));
      return;
    }

    setBusy(true);
    setFieldError(undefined);
    setBanner(null);
    try {
      const { user: updated } = await api.users.updateMe({ username: clean });
      await applyUser(updated);
      setEditing(false);
      setSaved(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === "USERNAME_ALREADY_USED") {
        setFieldError(describeError(error));
      } else {
        setBanner(describeError(error));
      }
    } finally {
      setBusy(false);
    }
  }, [username, user, api, applyUser]);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    // No hace falta navegar: al caer la sesión, la guarda del layout online
    // manda a `/online/auth`.
    await logout();
  }, [logout]);

  if (!user) {
    return (
      <Screen
        title={t("online.profile.title")}
        backdrop={<AmbientSpotlight />}
        contentStyle={{ paddingBottom: tabBarSpace }}
        headerAction={<SettingsButton />}
      >
        <ErrorBanner message={t("online.error.sessionExpired")} />
      </Screen>
    );
  }

  const memberSince = new Date(user.createdAt).toLocaleDateString();
  const incoming = friends?.incoming ?? [];

  return (
    <Screen
      eyebrow={t("online.profile.badge")}
      title={t("online.profile.title")}
      subtitle={t("online.profile.subtitle")}
      backdrop={<AmbientSpotlight />}
      contentStyle={{ paddingBottom: tabBarSpace }}
      headerAction={<SettingsButton />}
    >
      {banner ? <ErrorBanner message={banner} /> : null}

      <Card tone={SECTION_TONE.account} style={styles.block}>
        <View style={styles.identityRow}>
          <Avatar username={user.username} size={60} />
          <View style={styles.identityText}>
            <Text style={Type.title} numberOfLines={1}>
              {user.username}
            </Text>
            <Text style={Type.caption} numberOfLines={1}>
              {user.email}
            </Text>
          </View>
        </View>

        <View style={styles.levelRow}>
          <Pill label={t("online.level", { level: user.level })} tone="accent" />
          <Text style={Type.metricSmall}>{t("online.xp", { xp: user.xp })}</Text>
        </View>

        <ProgressBar value={user.progress.progress} />
        <Text style={[Type.caption, styles.progressHint]}>
          {t("online.profile.nextLevel", {
            xp: user.progress.xpToNextLevel,
            level: user.level + 1,
          })}
        </Text>

        {/*
          Quién mueve esa barra.

          El nivel llevaba desde siempre en esta tarjeta sin decir de dónde
          sale, y desde que existe el reto diario sale de ahí y de ningún otro
          sitio. Una línea al pie de la barra —lo de hoy, y la racha si la
          hay— convierte la cifra en la consecuencia de un hábito en vez de en
          un número que cambia solo.

          Si no se ha podido preguntar por la jornada no se enseña nada: es
          preferible a una línea que no se sabe si es verdad.
        */}
        {dailyXp != null ? (
          <>
            <Divider style={styles.progressDivider} />
            <View style={styles.dailyRow}>
              {streak > 0 ? (
                <View
                  style={styles.streak}
                  accessible
                  accessibilityLabel={t("online.profile.streakA11y", {
                    count: streak,
                  })}
                >
                  <Flame size={18} lit={played} />
                  <Text style={[Type.metricSmall, styles.streakCount]}>
                    {streak}
                  </Text>
                </View>
              ) : null}

              <Text style={[Type.caption, styles.dailyText]}>
                {!played
                  ? t("online.profile.dailyPending")
                  : dailyXp > 0
                    ? t("online.profile.dailyToday", { xp: dailyXp })
                    : // Jugado, pero desde otro teléfono: la jornada está hecha
                      // y este dispositivo no vio pasar la cifra.
                      t("online.profile.dailyPlayed")}
              </Text>
            </View>
          </>
        ) : null}
      </Card>

      {/* ---------------------------- Amigos ---------------------------- */}
      <SectionHeader
        title={t("online.profile.friends")}
        hint={
          incoming.length > 0
            ? t("online.profile.friendsWaiting", { count: incoming.length })
            : t("online.profile.friendsHint")
        }
      />

      <Card style={styles.block}>
        {friendsError ? (
          <ErrorBanner
            message={friendsError}
            onRetry={() => void loadFriends()}
            style={styles.friendsError}
          />
        ) : null}

        {incoming.length > 0 ? (
          <>
            {incoming.map((entry, index) => (
              <RequestRow
                key={entry.friendshipId}
                entry={entry}
                last={index === incoming.length - 1}
                busy={answering === entry.user.id}
                onAccept={() =>
                  void answer(entry.user.id, () =>
                    api.friends.accept(entry.user.id),
                  )
                }
                onReject={() =>
                  void answer(entry.user.id, () =>
                    api.friends.reject(entry.user.id),
                  )
                }
              />
            ))}
            <Divider style={styles.friendsDivider} />
          </>
        ) : (
          <Text style={[Type.caption, styles.friendsEmpty]}>
            {friends != null
              ? t("online.profile.friendsNone")
              : friendsError
                ? // Ya lo cuenta el banner de arriba: aquí solo se dice qué
                  // falta por saber, no se repite el fallo.
                  t("online.profile.friendsUnknown")
                : t("online.profile.friendsLoading")}
          </Text>
        )}

        <TextLink
          label={t("online.profile.friendsOpen")}
          onPress={() => router.push("/online/friends")}
        />
      </Card>

      <SectionHeader title={t("online.profile.account")} />

      <Card style={styles.block}>
        {editing ? (
          <>
            <Field
              label={t("online.auth.username")}
              value={username}
              onChangeText={setUsername}
              hint={t("online.auth.usernameHint")}
              error={fieldError}
              icon="user"
              maxLength={24}
              returnKeyType="done"
              onSubmitEditing={save}
            />
            <View style={styles.actions}>
              <Button
                label={t("online.profile.save")}
                icon="check"
                tone="green"
                onPress={save}
                loading={busy}
              />
              <Button
                label={t("online.profile.cancel")}
                variant="ghost"
                size="md"
                onPress={cancelEditing}
                disabled={busy}
              />
            </View>
          </>
        ) : (
          <>
            <InfoRow label={t("online.auth.username")} value={user.username} />
            <InfoRow label={t("online.auth.email")} value={user.email} />
            <InfoRow
              label={t("online.profile.memberSince")}
              value={memberSince}
              last
            />

            {saved ? <Notice message={t("online.profile.saved")} /> : null}

            <Button
              label={t("online.profile.edit")}
              icon="edit"
              variant="secondary"
              size="md"
              onPress={startEditing}
              style={styles.editButton}
            />
          </>
        )}
      </Card>

      <SectionHeader
        title={t("online.profile.session")}
        hint={t("online.profile.sessionHint")}
      />

      <Button
        label={t("online.profile.logout")}
        icon="logOut"
        variant="danger"
        onPress={signOut}
        loading={signingOut}
      />
    </Screen>
  );
}

/**
 * Una solicitud recibida, con sus dos respuestas.
 *
 * Es más corta que la fila equivalente de la pantalla de Amigos a propósito: no
 * lleva nivel ni XP. Aquí la pregunta es «¿le dejo entrar?», y para contestarla
 * hace falta el nombre y nada más; el expediente completo está a un enlace de
 * distancia, en la pantalla que sí va de eso.
 */
function RequestRow({
  entry,
  last,
  busy,
  onAccept,
  onReject,
}: {
  entry: FriendEntry;
  last: boolean;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
}): ReactElement {
  return (
    <View style={[styles.requestRow, last && styles.requestRowLast]}>
      <Avatar username={entry.user.username} size={40} />
      <View style={styles.requestText}>
        <Text style={Type.bodyStrong} numberOfLines={1}>
          {entry.user.username}
        </Text>
        <Text style={Type.caption}>{t("online.profile.wantsToBeFriends")}</Text>
      </View>
      <RowActions>
        <IconButton
          name="check"
          variant="surface"
          color={Color.success.text}
          accessibilityLabel={t("online.friends.accept")}
          disabled={busy}
          onPress={onAccept}
        />
        <IconButton
          name="close"
          variant="surface"
          accessibilityLabel={t("online.friends.reject")}
          disabled={busy}
          onPress={onReject}
        />
      </RowActions>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: Space.xxl,
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    paddingBottom: Space.md,
    marginBottom: Space.md,
    borderBottomWidth: 1,
    borderBottomColor: Color.border.subtle,
  },
  requestRowLast: {
    paddingBottom: 0,
    marginBottom: Space.md,
    borderBottomWidth: 0,
  },
  requestText: {
    flex: 1,
    gap: Space.xxs,
  },
  friendsDivider: {
    marginBottom: Space.md,
  },
  friendsEmpty: {
    marginBottom: Space.md,
  },
  friendsError: {
    // Dentro de una tarjeta el banner ya tiene el relleno de la tarjeta por
    // arriba, así que su margen superior sobra y lo separaría del borde.
    marginTop: 0,
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
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Space.xl,
    marginBottom: Space.md,
  },
  progressHint: {
    marginTop: Space.sm,
  },
  progressDivider: {
    marginTop: Space.lg,
  },
  dailyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    marginTop: Space.md,
  },
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.xxs,
  },
  streakCount: {
    color: Color.ember.text,
  },
  dailyText: {
    flex: 1,
  },
  actions: {
    gap: Space.sm,
  },
  editButton: {
    marginTop: Space.lg,
  },
});
