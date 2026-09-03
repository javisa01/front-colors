import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { describeError } from "@/api/errors";
import type { GroupSummary } from "@/api/types";
import { SettingsButton } from "@/components/SettingsButton";
import { DevTimePanel } from "@/components/online/DevTimePanel";
import { useOnlineTabBarSpace } from "@/components/online/OnlineTabBar";
import { UnreadDot } from "@/components/online/UnreadDot";
import { AmbientBands } from "@/design/Ambient";
import { Button } from "@/design/Button";
import { EmptyState, ErrorBanner, Loading, Pill } from "@/design/Feedback";
import { Field, Notice, SegmentedControl } from "@/design/Form";
import { Card, OptionRow, Screen, SectionHeader } from "@/design/Layout";
import { SECTION_TONE, Space } from "@/design/tokens";
import { t } from "@/i18n";
import {
  GROUP_NAME_MAX,
  GROUP_NAME_MIN,
  JOIN_CODE_LENGTH,
  membersLabel,
  normalizeJoinCode,
  seasonLabel,
  silenceMutedGroups,
  sortGroups,
} from "@/online/groups";
import { useFirstRunMock } from "@/online/devFirstRun";
import { useSession } from "@/online/session";

/**
 * Mis grupos, crear uno y entrar con un código.
 *
 * Las dos acciones van arriba y no escondidas tras un botón flotante: quien
 * llega aquí sin ningún grupo tiene que ver de inmediato las dos únicas cosas
 * que puede hacer. El menú principal apunta aquí con `?action=create` o
 * `?action=join` para abrir directamente la pestaña que toca.
 */

type Action = "create" | "join";

export default function GroupsScreen(): ReactElement {
  const { api } = useSession();
  const router = useRouter();

  const tabBarSpace = useOnlineTabBarSpace();
  const params = useLocalSearchParams<{ action?: string }>();
  /**
   * Simulador de primera vez: la lista se pinta vacía sin tocar el servidor.
   *
   * Es la segunda pantalla que ve quien entra sin grupos —el recorrido de la
   * barra manda aquí en su segundo paso—, así que si esta enseñara los grupos
   * de verdad, la simulación se rompería justo donde hay que mirarla. Fuera de
   * desarrollo siempre es `false`. Ver `online/devFirstRun`.
   */
  const firstRunMock = useFirstRunMock();

  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [action, setAction] = useState<Action>(
    params.action === "join" ? "join" : "create",
  );
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { groups: mine } = await api.groups.list();
      // El punto rojo de un grupo silenciado no se pinta (ajustes del grupo).
      setGroups(sortGroups(silenceMutedGroups(mine)));
    } catch (loadError) {
      setError(describeError(loadError));
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /**
   * El aviso dura lo que dura la visita.
   *
   * «Grupo creado» confirma lo que se acaba de pulsar, y crear un grupo lleva
   * derecho a su ficha: al volver aquí días después, el cartel seguía puesto
   * anunciando algo que ya no acaba de pasar. La pantalla es una pestaña y no
   * se desmonta, así que hay que limpiarlo a mano al perder el foco.
   */
  useFocusEffect(useCallback(() => () => setNotice(null), []));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const trimmedName = name.trim();
  const cleanCode = normalizeJoinCode(code);
  const canSubmit =
    action === "create"
      ? trimmedName.length >= GROUP_NAME_MIN &&
        trimmedName.length <= GROUP_NAME_MAX
      : cleanCode.length === JOIN_CODE_LENGTH;

  const submit = useCallback(async () => {
    setBusy(true);
    setFormError(null);
    setNotice(null);
    try {
      const { group } =
        action === "create"
          ? await api.groups.create({ name: trimmedName })
          : await api.groups.join(cleanCode);

      setName("");
      setCode("");
      setNotice(
        t(action === "create" ? "online.groups.created" : "online.groups.joined"),
      );
      await load();
      // Directo al grupo: es lo que quiere ver quien acaba de crearlo o entrar.
      router.push({ pathname: "/online/groups/[id]", params: { id: group.id } });
    } catch (submitError) {
      setFormError(describeError(submitError));
    } finally {
      setBusy(false);
    }
  }, [action, api, cleanCode, trimmedName, load, router]);

  /*
    Lo que se pinta. Se vacía aquí y no en `groups` para que el simulador no
    toque nada de lo que se guarda ni de lo que se ha pedido: apagarlo devuelve
    la lista sin volver a preguntar al servidor.
  */
  const shown = firstRunMock ? [] : groups;

  return (
    <Screen
      eyebrow={t("online.groups.badge")}
      title={t("online.groups.title")}
      subtitle={t("online.groups.subtitle")}
      backdrop={<AmbientBands />}

      contentStyle={{ paddingBottom: tabBarSpace }}
      headerAction={<SettingsButton />}
      onRefresh={refresh}
      refreshing={refreshing}
    >
      {error ? (
        <ErrorBanner
          message={error}
          onRetry={() => void load()}
        />
      ) : null}

      {/* ----------------------- Crear o unirse ------------------------ */}
      {/*
        La tarjeta que abre la sección lleva el canto teal. Es la única de la
        pantalla que lo lleva: el estado vacío de más abajo y las filas de
        grupos no lo repiten, o el tono dejaría de distinguir nada.
      */}
      <Card tone={SECTION_TONE.groups} style={styles.block}>
        <SegmentedControl
          options={[
            { value: "create" as Action, label: t("online.groups.tabCreate") },
            { value: "join" as Action, label: t("online.groups.tabJoin") },
          ]}
          value={action}
          onChange={(next) => {
            setAction(next);
            setFormError(null);
            setNotice(null);
          }}
        />

        <View style={styles.form}>
          {action === "create" ? (
            <Field
              label={t("online.groups.nameLabel")}
              value={name}
              onChangeText={setName}
              placeholder={t("online.groups.namePlaceholder")}
              hint={t("online.groups.nameHint")}
              icon="users"
              maxLength={GROUP_NAME_MAX}
              returnKeyType="done"
              onSubmitEditing={() => canSubmit && void submit()}
              style={styles.field}
            />
          ) : (
            <Field
              label={t("online.groups.codeLabel")}
              value={code}
              // Se normaliza al teclear para que el campo enseñe exactamente lo
              // que se va a enviar, y para que dé igual cómo lo hayan copiado.
              onChangeText={(value) => setCode(normalizeJoinCode(value))}
              placeholder={t("online.groups.codePlaceholder")}
              hint={t("online.groups.codeHint")}
              icon="lock"
              autoCapitalize="characters"
              maxLength={JOIN_CODE_LENGTH}
              returnKeyType="done"
              onSubmitEditing={() => canSubmit && void submit()}
              style={styles.field}
            />
          )}

          {formError ? <ErrorBanner message={formError} /> : null}
          {notice ? <Notice message={notice} /> : null}

          <Button
            label={t(
              action === "create"
                ? "online.groups.createSubmit"
                : "online.groups.joinSubmit",
            )}
            icon={action === "create" ? "plus" : "check"}
            tone={SECTION_TONE.groups}
            loading={busy}
            disabled={!canSubmit}
            onPress={() => void submit()}
          />
        </View>
      </Card>

      {/* --------------------------- Mis grupos ------------------------- */}
      <SectionHeader title={t("online.groups.mine")} />

      {/*
        Al fallar la carga, `groups` se queda a `null`: sin esta guarda el
        indicador giraba indefinidamente **debajo** del banner de error, que es
        la peor combinación posible —una pantalla que dice que ha fallado y a la
        vez que sigue trabajando—.
      */}
      {!shown ? (
        error ? null : <Loading label={t("online.groups.loading")} />
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon="users"
            title={t("online.groups.emptyTitle")}
            hint={t("online.groups.emptyHint")}
          />
        </Card>
      ) : (
        <View style={styles.list}>
          {shown.map((group, index) => (
            <GroupRow
              key={group.id}
              group={group}
              index={index}
              onPress={() =>
                router.push({
                  pathname: "/online/groups/[id]",
                  params: { id: group.id },
                })
              }
            />
          ))}
        </View>
      )}

      {/*
        Panel de desarrollo: mueve el reloj del backend para no esperar 10 días
        reales. Devuelve `null` fuera de `__DEV__`.
      */}
      <DevTimePanel onChanged={load} />
    </Screen>
  );
}

/**
 * Una fila de grupo, sobre la misma `OptionRow` que usan el menú y la portada.
 *
 * Lleva el estado de la temporada porque es lo que decide qué se puede hacer
 * dentro: competir, o solo hablar y —si eres el creador— renovar.
 */
function GroupRow({
  group,
  index,
  onPress,
}: {
  group: GroupSummary;
  index: number;
  onPress: () => void;
}): ReactElement {
  const finished = group.status === "finished";

  return (
    <OptionRow
      icon={finished ? "hourglass" : "calendar"}
      tone={finished ? "rose" : "teal"}
      title={group.name}
      description={`${membersLabel(group.memberCount)} · ${seasonLabel(group)}`}
      badge={
        <View style={styles.badges}>
          {/*
            El punto rojo, no una pastilla que ponga «Novedades». Una pastilla
            más al lado de la de estado obliga a leer dos etiquetas para saber
            dos cosas distintas; el punto se ve sin leer nada y deja el estado
            de la temporada como la única palabra de la fila.
          */}
          <UnreadDot count={group.unreadCount} />
          <Pill
            label={t(
              finished
                ? "online.groups.statusFinished"
                : "online.groups.statusActive",
            )}
            tone={finished ? "neutral" : "success"}
          />
        </View>
      }
      // El punto no se oye: lo que significa entra por aquí.
      accessibilityLabel={
        group.unreadCount > 0
          ? `${group.name}. ${t("online.groups.unread")}`
          : group.name
      }
      onPress={onPress}
      enterDelay={Math.min(index, 12) * 35}
    />
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: Space.xxl,
  },
  form: {
    marginTop: Space.lg,
  },
  field: {
    marginBottom: Space.md,
  },
  list: {
    gap: Space.md,
    marginBottom: Space.xxl,
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.xs,
  },
});
