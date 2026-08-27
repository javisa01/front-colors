import { useFocusEffect } from "expo-router";
import type { ReactElement, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { describeError } from "@/api/errors";
import type { FriendEntry, FriendsOverview, UserProfile } from "@/api/types";
import { SettingsButton } from "@/components/SettingsButton";
import { Avatar } from "@/design/Avatar";
import { IconButton } from "@/design/Button";
import { EmptyState, ErrorBanner, Loading, Pill } from "@/design/Feedback";
import { Field, RowActions } from "@/design/Form";
import { Card, Divider, Screen, SectionHeader } from "@/design/Layout";
import { Color, Duration, Space, Type } from "@/design/tokens";
import { t } from "@/i18n";
import { useSession } from "@/online/session";

interface SearchResults {
  /** Termino que produjo estos resultados, para saber si siguen vigentes. */
  query: string;
  users: UserProfile[];
}

/** El backend exige 2 caracteres mínimo; por debajo no se llama. */
const MIN_QUERY = 2;
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Amigos: buscar jugadores, gestionar solicitudes y ver la lista.
 *
 * Las acciones de cada fila son iconos con área táctil de 44pt, no botones de
 * texto: en una fila que ya lleva avatar, nombre y nivel, dos botones con
 * palabras dentro empujaban el nombre hasta recortarlo en cuanto el jugador
 * tenía más de ocho letras.
 */
export default function FriendsScreen(): ReactElement {
  const { api, user } = useSession();

  const [overview, setOverview] = useState<FriendsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState("");
  // Termino ya estabilizado por el debounce. Separarlo de `query` permite
  // saber si hay una busqueda en vuelo sin llevar un flag aparte.
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  /** Id del usuario cuya acción está en vuelo, para bloquear solo su fila. */
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setOverview(await api.friends.list());
    } catch (loadError) {
      setError(describeError(loadError));
    }
  }, [api]);

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

  // -------------------------------------------------------------------------
  // Búsqueda de jugadores
  // -------------------------------------------------------------------------

  // Paso 1: estabilizar lo tecleado. El setState vive dentro del temporizador,
  // asi que nunca corre de forma sincrona con el efecto.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [query]);

  // Paso 2: buscar. `active` descarta la respuesta si el termino ya cambio,
  // para que una respuesta lenta de "ali" no pise a la de "alice".
  useEffect(() => {
    if (debounced.length < MIN_QUERY) {
      return;
    }

    let active = true;

    void (async () => {
      try {
        const { users } = await api.users.search(debounced);
        if (active) {
          setResults({ query: debounced, users });
          setSearchError(null);
        }
      } catch (error) {
        if (active) {
          setSearchError(describeError(error));
          setResults(null);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [debounced, api]);

  // Hay busqueda en curso mientras el termino estabilizado no coincida con lo
  // ultimo que se ha recibido.
  const searching =
    debounced.length >= MIN_QUERY &&
    results?.query !== debounced &&
    searchError === null;

  // Con menos caracteres del minimo no se ensena nada de la busqueda anterior.
  const visibleResults =
    query.trim().length >= MIN_QUERY ? (results?.users ?? null) : null;

  // -------------------------------------------------------------------------
  // Acciones
  // -------------------------------------------------------------------------

  const act = useCallback(
    async (userId: string, action: () => Promise<unknown>) => {
      setPendingId(userId);
      setError(null);
      try {
        await action();
        // Se relee la lista completa en lugar de parchear el estado: el
        // backend acepta automáticamente si ya había solicitud cruzada, así
        // que el resultado no siempre es el que la UI daría por hecho.
        await load();
      } catch (actionError) {
        setError(describeError(actionError));
      } finally {
        setPendingId(null);
      }
    },
    [load],
  );

  /** Relación actual con un usuario salido de la búsqueda. */
  const relationOf = useCallback(
    (userId: string): "self" | "friend" | "incoming" | "outgoing" | "none" => {
      if (userId === user?.id) return "self";
      if (overview?.friends.some((entry) => entry.user.id === userId)) {
        return "friend";
      }
      if (overview?.incoming.some((entry) => entry.user.id === userId)) {
        return "incoming";
      }
      if (overview?.outgoing.some((entry) => entry.user.id === userId)) {
        return "outgoing";
      }
      return "none";
    },
    [overview, user],
  );

  const incoming = overview?.incoming ?? [];
  const outgoing = overview?.outgoing ?? [];
  const friends = overview?.friends ?? [];

  return (
    <Screen
      eyebrow={t("online.friends.badge")}
      title={t("online.friends.title")}
      subtitle={t("online.friends.subtitle")}
      backTo="/online"
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

      {/* --------------------------- Buscar ---------------------------- */}
      <Card style={styles.block}>
        <Field
          label={t("online.friends.searchLabel")}
          value={query}
          onChangeText={setQuery}
          placeholder={t("online.friends.searchPlaceholder")}
          hint={t("online.friends.searchHint", { min: MIN_QUERY })}
          icon="search"
          maxLength={32}
          returnKeyType="search"
          style={styles.searchField}
        />

        {searching ? (
          <View style={styles.searchStatus}>
            <ActivityIndicator color={Color.text.muted} size="small" />
            <Text style={Type.caption}>{t("online.friends.searching")}</Text>
          </View>
        ) : null}

        {searchError ? <ErrorBanner message={searchError} /> : null}

        {visibleResults && !searching ? (
          visibleResults.length === 0 ? (
            <Text style={[Type.caption, styles.noResults]}>
              {t("online.friends.noResults", { query: query.trim() })}
            </Text>
          ) : (
            <View>
              <Divider style={styles.resultsDivider} />
              {visibleResults.map((result, index) => {
                const relation = relationOf(result.id);

                return (
                  <PlayerRow
                    key={result.id}
                    username={result.username}
                    level={result.level}
                    xp={result.xp}
                    index={index}
                    last={index === visibleResults.length - 1}
                  >
                    {relation === "none" ? (
                      <IconButton
                        name="userPlus"
                        variant="surface"
                        accessibilityLabel={t("online.friends.add")}
                        disabled={pendingId === result.id}
                        onPress={() =>
                          void act(result.id, () =>
                            api.friends.request(result.id),
                          )
                        }
                      />
                    ) : (
                      <Pill
                        label={t(
                          relation === "self"
                            ? "online.friends.you"
                            : relation === "friend"
                              ? "online.friends.alreadyFriend"
                              : relation === "outgoing"
                                ? "online.friends.requestSent"
                                : "online.friends.requestReceived",
                        )}
                        tone={relation === "friend" ? "success" : "neutral"}
                      />
                    )}
                  </PlayerRow>
                );
              })}
            </View>
          )
        ) : null}
      </Card>

      {/* --------------------- Solicitudes recibidas -------------------- */}
      {incoming.length > 0 ? (
        <>
          <SectionHeader
            title={t("online.friends.incoming")}
            hint={t("online.friends.incomingHint")}
          />
          <Card style={styles.block}>
            {incoming.map((entry, index) => (
              <RequestRow
                key={entry.friendshipId}
                entry={entry}
                index={index}
                last={index === incoming.length - 1}
                busy={pendingId === entry.user.id}
              >
                <IconButton
                  name="check"
                  variant="surface"
                  color={Color.success.text}
                  accessibilityLabel={t("online.friends.accept")}
                  onPress={() =>
                    void act(entry.user.id, () =>
                      api.friends.accept(entry.user.id),
                    )
                  }
                />
                <IconButton
                  name="close"
                  variant="surface"
                  accessibilityLabel={t("online.friends.reject")}
                  onPress={() =>
                    void act(entry.user.id, () =>
                      api.friends.reject(entry.user.id),
                    )
                  }
                />
              </RequestRow>
            ))}
          </Card>
        </>
      ) : null}

      {/* --------------------- Solicitudes enviadas --------------------- */}
      {outgoing.length > 0 ? (
        <>
          <SectionHeader title={t("online.friends.outgoing")} />
          <Card style={styles.block}>
            {outgoing.map((entry, index) => (
              <RequestRow
                key={entry.friendshipId}
                entry={entry}
                index={index}
                last={index === outgoing.length - 1}
                busy={pendingId === entry.user.id}
              >
                <IconButton
                  name="close"
                  variant="surface"
                  accessibilityLabel={t("online.friends.cancel")}
                  onPress={() =>
                    void act(entry.user.id, () =>
                      api.friends.remove(entry.user.id),
                    )
                  }
                />
              </RequestRow>
            ))}
          </Card>
        </>
      ) : null}

      {/* ---------------------------- Amigos ---------------------------- */}
      <SectionHeader
        title={t("online.friends.list")}
        hint={
          friends.length > 0
            ? t("online.friends.listCount", { count: friends.length })
            : undefined
        }
      />

      {!overview ? (
        <Loading label={t("online.friends.loading")} />
      ) : friends.length === 0 ? (
        <Card>
          <EmptyState
            icon="users"
            title={t("online.friends.emptyTitle")}
            hint={t("online.friends.emptyHint")}
          />
        </Card>
      ) : (
        <Card>
          {friends.map((entry, index) => (
            <RequestRow
              key={entry.friendshipId}
              entry={entry}
              index={index}
              last={index === friends.length - 1}
              busy={pendingId === entry.user.id}
            >
              <IconButton
                name="trash"
                variant="surface"
                color={Color.danger.text}
                accessibilityLabel={t("online.friends.remove")}
                onPress={() =>
                  void act(entry.user.id, () => api.friends.remove(entry.user.id))
                }
              />
            </RequestRow>
          ))}
        </Card>
      )}
    </Screen>
  );
}

/**
 * Fila de jugador: avatar, nombre, nivel y acciones.
 *
 * El escalonado se limita a las doce primeras filas y usa un fundido sin
 * desplazamiento. Con `FadeInDown` y sin tope, una lista de cuarenta amigos
 * tardaba más de dos segundos en terminar de montarse.
 */
function PlayerRow({
  username,
  level,
  xp,
  index,
  last,
  children,
}: {
  username: string;
  level: number;
  xp: number;
  index: number;
  last: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <Animated.View
      entering={FadeIn.delay(Math.min(index, 12) * 35).duration(Duration.base)}
    >
      <View style={[styles.row, last && styles.rowLast]}>
        <Avatar username={username} size={40} />
        <View style={styles.rowText}>
          <Text style={Type.bodyStrong} numberOfLines={1}>
            {username}
          </Text>
          <Text style={Type.caption}>
            {t("online.level", { level })} · {t("online.xp", { xp })}
          </Text>
        </View>
        <RowActions>{children}</RowActions>
      </View>
    </Animated.View>
  );
}

function RequestRow({
  entry,
  index,
  last,
  busy,
  children,
}: {
  entry: FriendEntry;
  index: number;
  last: boolean;
  busy: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <PlayerRow
      username={entry.user.username}
      level={entry.user.level}
      xp={entry.user.xp}
      index={index}
      last={last}
    >
      {busy ? (
        // Ocupa el sitio de los botones para que la fila no cambie de alto al
        // pasar a «en curso».
        <View style={styles.rowBusy}>
          <ActivityIndicator color={Color.accent.default} size="small" />
        </View>
      ) : (
        children
      )}
    </PlayerRow>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: Space.xxl,
  },
  searchField: {
    marginBottom: 0,
  },
  searchStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    marginTop: Space.md,
  },
  noResults: {
    marginTop: Space.md,
  },
  resultsDivider: {
    marginTop: Space.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    paddingVertical: Space.md,
    borderBottomWidth: 1,
    borderBottomColor: Color.border.subtle,
  },
  rowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  rowText: {
    flex: 1,
    gap: Space.xxs,
  },
  rowBusy: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
