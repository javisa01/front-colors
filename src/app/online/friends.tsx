import { useFocusEffect } from "expo-router";
import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { describeError } from "@/api/errors";
import type { FriendEntry, FriendsOverview, UserProfile } from "@/api/types";
import {
  Avatar,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  GhostButton,
  Loading,
  Pill,
  SectionLabel,
} from "@/components/online/Controls";
import { OnlineScreen } from "@/components/online/Screen";
import { OnlinePalette } from "@/components/online/theme";
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
    <OnlineScreen
      badge={t("online.friends.badge")}
      title={t("online.friends.title")}
      subtitle={t("online.friends.subtitle")}
      backTo="/online"
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
      <Card>
        <Field
          label={t("online.friends.searchLabel")}
          value={query}
          onChangeText={setQuery}
          placeholder={t("online.friends.searchPlaceholder")}
          hint={t("online.friends.searchHint", { min: MIN_QUERY })}
          maxLength={32}
          returnKeyType="search"
        />

        {searching ? (
          <View style={styles.searchStatus}>
            <ActivityIndicator color={OnlinePalette.accent} size="small" />
            <Text style={styles.searchStatusText}>
              {t("online.friends.searching")}
            </Text>
          </View>
        ) : null}

        {searchError ? <ErrorBanner message={searchError} /> : null}

        {visibleResults && !searching ? (
          visibleResults.length === 0 ? (
            <Text style={styles.noResults}>
              {t("online.friends.noResults", { query: query.trim() })}
            </Text>
          ) : (
            <View style={styles.resultList}>
              {visibleResults.map((result) => {
                const relation = relationOf(result.id);

                return (
                  <View key={result.id} style={styles.row}>
                    <Avatar username={result.username} size={42} />
                    <View style={styles.rowText}>
                      <Text style={styles.rowName}>{result.username}</Text>
                      <Text style={styles.rowMeta}>
                        {t("online.level", { level: result.level })} ·{" "}
                        {t("online.xp", { xp: result.xp })}
                      </Text>
                    </View>

                    {relation === "none" ? (
                      <GhostButton
                        label={t("online.friends.add")}
                        tone="accent"
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
                  </View>
                );
              })}
            </View>
          )
        ) : null}
      </Card>

      {/* --------------------- Solicitudes recibidas -------------------- */}
      {incoming.length > 0 ? (
        <>
          <SectionLabel
            title={t("online.friends.incoming")}
            hint={t("online.friends.incomingHint")}
          />
          <Card>
            {incoming.map((entry, index) => (
              <RequestRow
                key={entry.friendshipId}
                entry={entry}
                index={index}
                busy={pendingId === entry.user.id}
                primaryLabel={t("online.friends.accept")}
                onPrimary={() =>
                  void act(entry.user.id, () =>
                    api.friends.accept(entry.user.id),
                  )
                }
                secondaryLabel={t("online.friends.reject")}
                onSecondary={() =>
                  void act(entry.user.id, () =>
                    api.friends.reject(entry.user.id),
                  )
                }
              />
            ))}
          </Card>
        </>
      ) : null}

      {/* --------------------- Solicitudes enviadas --------------------- */}
      {outgoing.length > 0 ? (
        <>
          <SectionLabel title={t("online.friends.outgoing")} />
          <Card>
            {outgoing.map((entry, index) => (
              <RequestRow
                key={entry.friendshipId}
                entry={entry}
                index={index}
                busy={pendingId === entry.user.id}
                secondaryLabel={t("online.friends.cancel")}
                onSecondary={() =>
                  void act(entry.user.id, () =>
                    api.friends.remove(entry.user.id),
                  )
                }
              />
            ))}
          </Card>
        </>
      ) : null}

      {/* ---------------------------- Amigos ---------------------------- */}
      <SectionLabel
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
            emoji="🫂"
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
              busy={pendingId === entry.user.id}
              secondaryLabel={t("online.friends.remove")}
              onSecondary={() =>
                void act(entry.user.id, () => api.friends.remove(entry.user.id))
              }
            />
          ))}
        </Card>
      )}
    </OnlineScreen>
  );
}

function RequestRow({
  entry,
  index,
  busy,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  entry: FriendEntry;
  index: number;
  busy: boolean;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}): ReactElement {
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(380)}>
      <View style={styles.row}>
        <Avatar username={entry.user.username} size={42} />
        <View style={styles.rowText}>
          <Text style={styles.rowName}>{entry.user.username}</Text>
          <Text style={styles.rowMeta}>
            {t("online.level", { level: entry.user.level })} ·{" "}
            {t("online.xp", { xp: entry.user.xp })}
          </Text>
        </View>

        <View style={styles.rowActions}>
          {busy ? (
            <ActivityIndicator color={OnlinePalette.accent} size="small" />
          ) : (
            <>
              {primaryLabel && onPrimary ? (
                <GhostButton
                  label={primaryLabel}
                  tone="accent"
                  onPress={onPrimary}
                />
              ) : null}
              {secondaryLabel && onSecondary ? (
                <GhostButton
                  label={secondaryLabel}
                  tone="danger"
                  onPress={onSecondary}
                />
              ) : null}
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  searchStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  searchStatusText: {
    color: OnlinePalette.textMuted,
    fontSize: 13,
    fontFamily: "System",
  },
  noResults: {
    paddingVertical: 10,
    color: OnlinePalette.textFaint,
    fontSize: 13,
    fontFamily: "System",
  },
  resultList: {
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: OnlinePalette.border,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    color: OnlinePalette.text,
    fontSize: 15,
    fontWeight: "800",
    fontFamily: "System",
  },
  rowMeta: {
    marginTop: 3,
    color: OnlinePalette.textFaint,
    fontSize: 12,
    fontFamily: "System",
    fontVariant: ["tabular-nums"],
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
