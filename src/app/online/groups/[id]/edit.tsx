import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";

import { describeError } from "@/api/errors";
import type {
  FriendsOverview,
  GroupDetail,
  GroupLeaderboard,
  GroupMember,
  GroupSeason,
} from "@/api/types";
import { AmbientMesh } from "@/design/Ambient";
import { Avatar, playerTint } from "@/design/Avatar";
import { Button, IconButton } from "@/design/Button";
import { ErrorBanner, Loading, Pill } from "@/design/Feedback";
import { Field, Notice, Toggle } from "@/design/Form";
import { Card, Screen, SectionHeader } from "@/design/Layout";
import { Color, Radius, Space, Type } from "@/design/tokens";
import { t } from "@/i18n";
import {
  GROUP_NAME_MAX,
  GROUP_NAME_MIN,
  playedDaysLabel,
  seasonRange,
} from "@/online/groups";
import { relationOf, type Relation } from "@/online/friends";
import { useSession } from "@/online/session";
import { useSocial } from "@/online/social";
import { getGroupNotifications, setGroupNotifications } from "@/utils/storage";

/**
 * Ajustes del grupo: quién está, cómo se llama, cómo se invita y cómo se sale.
 *
 * ## Por qué existe
 *
 * El código de invitación y el botón de salirse vivían al final de la ficha del
 * grupo, debajo de la clasificación. Eran dos tarjetas de administración
 * ocupando el sitio al que se llega scrolleando desde lo único que se hace a
 * diario, que es jugar. Aquí no molestan y siguen a un toque, detrás del lápiz
 * que hay junto al nombre.
 *
 * ## Quién puede qué
 *
 * **Renombrar es del `owner`** y lo impone el servidor (`NOT_GROUP_OWNER`): el
 * nombre es la etiqueta bajo la que los otros cuatro tienen guardado el grupo.
 * A los miembros se les enseña el nombre, no un campo apagado, porque un campo
 * que no se puede tocar invita a intentarlo.
 *
 * Todo lo demás —ver quién hay, agregar a alguien, el código, salirse— es de
 * cualquier miembro. Esta pantalla no es «la pantalla del jefe»: es la del
 * grupo.
 */
export default function GroupSettingsScreen(): ReactElement {
  const { api, user } = useSession();
  const { apply: applySocial } = useSocial();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Array.isArray(id) ? id[0] : (id ?? null);

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [board, setBoard] = useState<GroupLeaderboard | null>(null);
  /**
   * Las temporadas jugadas, de la más reciente a la más antigua.
   *
   * El orden lo da el servidor (`seasonNumber` descendente) y se respeta: la
   * que está en curso encabeza la lista, que es como se lee un historial.
   *
   * Es lo único de la app que dice que el grupo tuvo un pasado. Renovar no
   * borra nada (3.3), pero la clasificación se filtra por la ventana de la
   * temporada en curso, así que al empezar la siguiente el podio anterior
   * desaparece de la vista sin dejar rastro. Aquí queda el rastro.
   *
   * El servidor da las fechas, no los ganadores: `GET /groups/:id/leaderboard`
   * solo sabe de la temporada actual. Enseñar cuántas van y desde cuándo es
   * todo lo que hay, y es más que nada.
   */
  const [seasons, setSeasons] = useState<GroupSeason[] | null>(null);
  const [friends, setFriends] = useState<FriendsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [notify, setNotify] = useState(true);
  /** Id de la persona cuya solicitud de amistad está en vuelo. */
  const [pendingFriend, setPendingFriend] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!groupId) return;
    setError(null);
    try {
      const [detail, leaderboard, overview, history] = await Promise.all([
        api.groups.get(groupId),
        api.groups.leaderboard(groupId),
        // La lista de amigos es lo que decide si un miembro sale con el botón
        // de agregar o con «ya sois amigos». Sin ella el botón mentiría.
        api.friends.list(),
        // Con su propio `catch`: el historial es un apunte al pie, y quedarse
        // sin él no vale tumbar unos ajustes que van sobre todo del código de
        // invitación.
        api.groups.seasons(groupId).catch(() => null),
      ]);
      setGroup(detail.group);
      setBoard(leaderboard);
      setFriends(overview);
      setSeasons(history?.seasons ?? null);
      // Sale gratis: esta pantalla ya necesitaba la lista, así que el contador
      // de la barra se pone al día sin una petición más.
      applySocial(overview);
      setName((current) => (current === "" ? detail.group.name : current));
    } catch (loadError) {
      setError(describeError(loadError));
    }
  }, [api, applySocial, groupId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!groupId) return;
    void getGroupNotifications(groupId).then(setNotify);
  }, [groupId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const rename = useCallback(async () => {
    if (!group) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { group: renamed } = await api.groups.rename(group.id, name.trim());
      setGroup(renamed);
      setName(renamed.name);
      setNotice(t("online.group.settings.renamed"));
    } catch (renameError) {
      setError(describeError(renameError));
    } finally {
      setSaving(false);
    }
  }, [api, group, name]);

  const toggleNotify = useCallback(
    (value: boolean) => {
      setNotify(value);
      if (groupId) void setGroupNotifications(groupId, value);
    },
    [groupId],
  );

  const addFriend = useCallback(
    async (userId: string) => {
      setPendingFriend(userId);
      setError(null);
      try {
        await api.friends.request(userId);
        // Se relee entera: el backend acepta sola la amistad si ya había una
        // solicitud cruzada, así que el resultado no siempre es «enviada».
        setFriends(await api.friends.list());
      } catch (requestError) {
        setError(describeError(requestError));
      } finally {
        setPendingFriend(null);
      }
    },
    [api],
  );

  const share = useCallback(async () => {
    if (!group) return;
    await Share.share({
      message: t("online.group.shareMessage", {
        name: group.name,
        code: group.joinCode,
      }),
    });
  }, [group]);

  const leave = useCallback(async () => {
    if (!group) return;
    setLeaving(true);
    setError(null);
    try {
      await api.groups.leave(group.id);
      // `dismissTo` y no `back`: la ficha del grupo del que se acaba de salir
      // sigue en la pila, y volver a ella daría un 404.
      router.dismissTo("/online/groups");
    } catch (leaveError) {
      setError(describeError(leaveError));
      setLeaving(false);
    }
  }, [api, group, router]);

  /**
   * Los miembros con lo que se sabe de cada uno.
   *
   * Los puntos y las jornadas salen de la clasificación, que es donde el
   * servidor los tiene; la lista de miembros por sí sola no los trae. Quien no
   * aparezca —no debería pasar, pero la clasificación se pide aparte— sale a
   * cero, que es lo que significa no haber jugado.
   */
  const roster = useMemo(() => {
    if (!group) return [];
    const scores = new Map(board?.entries.map((entry) => [entry.userId, entry]));

    return group.members.map((member) => ({
      member,
      score: scores.get(member.userId)?.score ?? 0,
      playedDays: scores.get(member.userId)?.playedDays ?? 0,
      relation: relationOf(member.userId, user?.id, friends),
    }));
  }, [board, friends, group, user]);

  /** Yo primero: la roseta se lee empezando por uno mismo. */
  const rosette = useMemo(() => {
    if (!group) return [];
    const mine = group.members.filter((member) => member.userId === user?.id);
    const others = group.members.filter((member) => member.userId !== user?.id);
    return [...mine, ...others];
  }, [group, user]);

  if (!group) {
    return (
      <Screen
        eyebrow={t("online.group.badge")}
        title={t("online.group.settings.title")}
        backTo="/online/groups"
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

  const isOwner = group.role === "owner";
  const trimmed = name.trim();
  const canSave =
    isOwner &&
    trimmed !== group.name &&
    trimmed.length >= GROUP_NAME_MIN &&
    trimmed.length <= GROUP_NAME_MAX;

  return (
    <Screen
      eyebrow={group.name}
      title={t("online.group.settings.title")}
      backTo={{ pathname: "/online/groups/[id]", params: { id: group.id } }}
      backdrop={<AmbientMesh />}
      onRefresh={refresh}
      refreshing={refreshing}
    >
      {/*
        Este banner recoge dos clases de fallo —releer la pantalla y las
        acciones de dentro—, y `load` sirve para las dos: si lo que falló fue
        la lectura, la repite; si fue una acción, deja la pantalla al día para
        volver a intentarla sabiendo cómo está de verdad.
      */}
      {error ? (
        <ErrorBanner message={error} onRetry={() => void load()} />
      ) : null}
      {notice ? <Notice message={notice} /> : null}

      <Rosette members={rosette} youId={user?.id} total={group.memberCount} />

      {/* --------------------------- Nombre ----------------------------- */}
      {isOwner ? (
        <Card style={styles.block}>
          <Field
            label={t("online.groups.nameLabel")}
            value={name}
            onChangeText={setName}
            placeholder={group.name}
            hint={t("online.groups.nameHint")}
            maxLength={GROUP_NAME_MAX}
            returnKeyType="done"
          />
          <Button
            label={t("online.group.settings.saveName")}
            icon="check"
            // Verde: cierra bien lo que se estaba editando. No es una accion
            // "de grupos", es la confirmacion de un cambio.
            tone="green"
            disabled={!canSave}
            loading={saving}
            onPress={() => void rename()}
            style={styles.saveButton}
          />
        </Card>
      ) : (
        <Card style={styles.block}>
          <Text style={Type.label}>{t("online.groups.nameLabel")}</Text>
          <Text style={[Type.heading, styles.readOnlyName]}>{group.name}</Text>
          <Text style={Type.caption}>
            {t("online.group.settings.ownerOnly")}
          </Text>
        </Card>
      )}

      {/* --------------------------- Avisos ----------------------------- */}
      <Card style={styles.block}>
        <Toggle
          icon="bell"
          label={t("online.group.settings.notifications")}
          description={t("online.group.settings.notificationsHint")}
          value={notify}
          onValueChange={toggleNotify}
        />
      </Card>

      {/* -------------------------- Miembros ---------------------------- */}
      <SectionHeader
        title={t("online.group.members")}
        hint={t("online.group.settings.membersHint")}
      />
      <Card style={styles.block}>
        {/*
          Alto fijo y scroll propio.

          La lista puede tener tres personas o treinta, y sin tope el código de
          invitación —lo que casi siempre se viene a buscar aquí— acabaría a
          media pantalla de distancia en los grupos grandes. Con el tope, todo
          lo de debajo está siempre en el mismo sitio.

          `nestedScrollEnabled` es lo que hace que funcione dentro del scroll de
          la pantalla en Android.
        */}
        <ScrollView
          style={styles.roster}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {roster.map(({ member, score, playedDays, relation }, index) => (
            <MemberRow
              key={member.userId}
              member={member}
              score={score}
              playedDays={playedDays}
              relation={relation}
              owner={member.userId === group.ownerUserId}
              busy={pendingFriend === member.userId}
              last={index === roster.length - 1}
              onAdd={() => void addFriend(member.userId)}
            />
          ))}
        </ScrollView>
      </Card>

      {/* --------------------- Código de invitación --------------------- */}
      <SectionHeader title={t("online.group.codeTitle")} />
      <View style={styles.codeCard}>
        <Text style={[Type.metricHero, styles.code]} selectable>
          {group.joinCode}
        </Text>
        <Text style={[Type.caption, styles.codeHint]}>
          {t("online.group.codeHint")}
        </Text>
        <Button
          label={t("online.group.settings.shareCode")}
          icon="share"
          variant="accent"
          onPress={() => void share()}
        />
      </View>

      {/* ------------------------- Temporadas ---------------------------- */}
      {/*
        Va aquí, justo antes de la salida, porque es lo único de la pantalla que
        mira hacia atrás. Y solo si hay más de una: en un grupo estrenado, una
        sección que dice «Temporada 1, en curso» no cuenta nada que el resto de
        la ficha no diga ya.
      */}
      {seasons != null && seasons.length > 1 ? (
        <>
          <SectionHeader
            title={t("online.group.settings.seasons")}
            hint={t("online.group.settings.seasonsHint")}
          />
          <Card style={styles.block}>
            {seasons.map((season, index) => (
              <SeasonRow
                key={season.id}
                season={season}
                current={season.id === group.currentSeason.id}
                last={index === seasons.length - 1}
              />
            ))}
          </Card>
        </>
      ) : null}

      {/* ---------------------------- Salir ----------------------------- */}
      <Button
        label={t("online.group.leave")}
        variant="danger"
        icon="logOut"
        loading={leaving}
        onPress={() => void leave()}
      />
      <Text style={[Type.caption, styles.leaveHint]}>
        {isOwner
          ? t("online.group.leaveOwnerHint")
          : t("online.group.settings.leaveHint")}
      </Text>
    </Screen>
  );
}

/**
 * Una temporada del historial: cuál fue y entre qué fechas.
 *
 * Sin puntuaciones a propósito. El servidor no las guarda por temporada más
 * allá de la actual —la clasificación se deriva filtrando los intentos por la
 * ventana—, y poner una cifra aquí obligaría a inventarla. Decir cuántas van y
 * desde cuándo es verdad entera.
 */
function SeasonRow({
  season,
  current,
  last,
}: {
  season: GroupSeason;
  current: boolean;
  last: boolean;
}): ReactElement {
  return (
    <View style={[styles.seasonRow, last && styles.seasonRowLast]}>
      <View style={styles.seasonText}>
        <Text style={Type.bodyStrong}>
          {t("online.group.season", { season: season.seasonNumber })}
        </Text>
        <Text style={Type.caption}>{seasonRange(season)}</Text>
      </View>
      {current ? (
        <Pill label={t("online.group.seasonCurrent")} tone="accent" />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// La roseta
// ---------------------------------------------------------------------------

/**
 * Cuántas caras caben antes del disco de resto.
 *
 * Seis y no «todas» porque a partir de ahí la fila se sale del móvil más
 * estrecho, y porque una roseta que crece sin parar deja de ser un retrato del
 * grupo y pasa a ser otra lista — y la lista ya está más abajo, con nombres.
 */
const ROSETTE_MAX = 6;

/**
 * El grupo, de un vistazo, antes que cualquier ajuste.
 *
 * Son las iniciales de cada persona en un círculo de su propio color, tú
 * primero y con aro claro. Es lo que contesta «¿este es el grupo que creo que
 * es?» sin leer una sola palabra, y por eso abre la pantalla en vez de ir al
 * final con los datos administrativos.
 *
 * Se solapan a propósito: una fila de círculos pegados se lee como **un** grupo
 * y no como seis elementos sueltos.
 */
function Rosette({
  members,
  youId,
  total,
}: {
  members: GroupMember[];
  youId: string | undefined;
  total: number;
}): ReactElement {
  const shown = members.slice(0, ROSETTE_MAX);
  const rest = total - shown.length;

  return (
    <View style={styles.rosette}>
      {shown.map((member, index) => (
        <View
          key={member.userId}
          style={[styles.rosetteSlot, index > 0 && styles.rosetteOverlap]}
        >
          <Avatar
            username={member.username}
            size={52}
            shape="round"
            letters={2}
            ring={member.userId === youId}
          />
        </View>
      ))}

      {rest > 0 ? (
        <View style={[styles.rosetteSlot, styles.rosetteOverlap]}>
          <View style={styles.rosetteRest}>
            <Text style={[Type.metricSmall, styles.rosetteRestText]}>+{rest}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Miembros
// ---------------------------------------------------------------------------

function MemberRow({
  member,
  score,
  playedDays,
  relation,
  owner,
  busy,
  last,
  onAdd,
}: {
  member: GroupMember;
  score: number;
  playedDays: number;
  relation: Relation;
  owner: boolean;
  busy: boolean;
  last: boolean;
  onAdd: () => void;
}): ReactElement {
  const tint = playerTint(member.username);

  return (
    <View style={[styles.memberRow, last && styles.memberRowLast]}>
      <Avatar username={member.username} size={40} shape="round" letters={2} />

      <View style={styles.memberBody}>
        <View style={styles.memberName}>
          <Text style={Type.bodyStrong} numberOfLines={1}>
            {member.username}
          </Text>
          {relation === "you" ? (
            <Pill label={t("online.group.you")} tone="accent" />
          ) : null}
          {owner ? <Pill label={t("online.group.owner")} /> : null}
        </View>
        <Text style={Type.caption}>
          {t("online.group.points", { points: score })} · {playedDaysLabel(playedDays)}
        </Text>
      </View>

      {relation === "none" ? (
        <IconButton
          name="userPlus"
          variant="surface"
          color={tint.text}
          accessibilityLabel={t("online.group.settings.addFriend", {
            name: member.username,
          })}
          disabled={busy}
          onPress={onAdd}
        />
      ) : relation === "friend" ? (
        <Pill label={t("online.friends.alreadyFriend")} tone="success" />
      ) : relation === "pending" ? (
        <Pill label={t("online.friends.requestSent")} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: Space.xxl,
  },

  // -- Temporadas -----------------------------------------------------------
  seasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    paddingBottom: Space.md,
    marginBottom: Space.md,
    borderBottomWidth: 1,
    borderBottomColor: Color.border.subtle,
  },
  seasonRowLast: {
    paddingBottom: 0,
    marginBottom: 0,
    borderBottomWidth: 0,
  },
  seasonText: {
    flex: 1,
    gap: Space.xxs,
  },

  // -- Roseta ---------------------------------------------------------------
  rosette: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Space.xxl,
  },
  rosetteSlot: {
    // El fondo del lienzo detrás de cada círculo: es lo que hace que el de
    // delante recorte al de detrás en vez de transparentarse encima.
    borderRadius: Radius.pill,
    backgroundColor: Color.surface.canvas,
    padding: 2,
  },
  rosetteOverlap: {
    marginLeft: -Space.md,
  },
  rosetteRest: {
    // El mismo lado que un avatar de la roseta, para que el disco de resto no
    // sea el círculo más grande de la fila.
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.surface.raised,
    borderWidth: 1,
    borderColor: Color.border.default,
  },
  rosetteRestText: {
    color: Color.text.muted,
  },

  // -- Nombre ---------------------------------------------------------------
  saveButton: {
    marginTop: Space.lg,
  },
  readOnlyName: {
    marginTop: Space.sm,
    marginBottom: Space.xs,
  },

  // -- Miembros -------------------------------------------------------------
  roster: {
    // Cuatro filas y media: el corte a media fila es lo que dice que hay más
    // abajo sin necesidad de una flecha ni de un «desliza».
    maxHeight: 264,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    paddingVertical: Space.md,
    borderBottomWidth: 1,
    borderBottomColor: Color.border.subtle,
  },
  memberRowLast: {
    borderBottomWidth: 0,
  },
  memberBody: {
    flex: 1,
    gap: Space.xxs,
  },
  memberName: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.xs,
  },

  // -- Código ---------------------------------------------------------------
  codeCard: {
    padding: Space.xl,
    marginBottom: Space.xxl,
    borderRadius: Radius.lg,
    alignItems: "center",
    // Teñido, y el único bloque teñido de la pantalla: el código es lo que se
    // viene a buscar aquí, y el color es más barato que un título más grande.
    backgroundColor: Color.spectrum.teal.surface,
    borderWidth: 1,
    borderColor: Color.spectrum.teal.border,
  },
  code: {
    color: Color.spectrum.teal.icon,
    letterSpacing: 8,
  },
  codeHint: {
    marginTop: Space.xs,
    marginBottom: Space.lg,
    textAlign: "center",
  },

  // -- Salir ----------------------------------------------------------------
  leaveHint: {
    marginTop: Space.sm,
    textAlign: "center",
  },
});
