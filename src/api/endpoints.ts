import type { ApiClient } from "./client";
import type {
  ChatMessage,
  ChatPage,
  DailyAnswer,
  DailyOverview,
  DailyStatus,
  DailySubmitResult,
  FriendsOverview,
  Friendship,
  GroupDetail,
  GroupLeaderboard,
  GroupSeason,
  GroupSummary,
  LeaderboardResponse,
  MyRanking,
  NotificationList,
  PrivateProfile,
  UserProfile,
} from "./types";

export interface PageInput {
  limit?: number;
  offset?: number;
}

/**
 * Superficie REST del backend, agrupada por área. Solo cubre lo que NO
 * necesita WebSocket: perfil, amigos, rankings, grupos, reto diario y avisos.
 * Las partidas 1v1 en tiempo real van por Socket.IO y están aparcadas.
 *
 * No hay endpoints de registro ni de login: la cuenta la crea y la valida
 * Clerk desde el cliente. El backend se limita a comprobar el token y a crear
 * la fila del jugador la primera vez que aparece (ver `GET /me`).
 */
export function createApi(client: ApiClient) {
  return {
    users: {
      me: () => client.request<{ user: PrivateProfile }>("/me"),

      updateMe: (input: { username: string }) =>
        client.request<{ user: PrivateProfile }>("/me", {
          method: "PATCH",
          body: input,
        }),

      getById: (id: string) =>
        client.request<{ user: UserProfile }>(`/users/${id}`),

      search: (query: string, limit = 20) =>
        client.request<{ users: UserProfile[] }>("/users/search", {
          query: { q: query, limit },
        }),
    },

    friends: {
      list: () => client.request<FriendsOverview>("/friends"),

      request: (userId: string) =>
        client.request<{ friendship: Friendship }>(`/friends/${userId}`, {
          method: "POST",
        }),

      accept: (userId: string) =>
        client.request<{ friendship: Friendship }>(
          `/friends/${userId}/accept`,
          { method: "POST" },
        ),

      reject: (userId: string) =>
        client.request<{ friendship: Friendship }>(
          `/friends/${userId}/reject`,
          { method: "POST" },
        ),

      remove: (userId: string) =>
        client.request<null>(`/friends/${userId}`, { method: "DELETE" }),
    },

    groups: {
      /** Mis grupos, con su estado ya derivado y sus avisos sin leer. */
      list: () => client.request<{ groups: GroupSummary[] }>("/groups"),

      create: (input: { name: string }) =>
        client.request<{ group: GroupDetail }>("/groups", {
          method: "POST",
          body: input,
        }),

      /**
       * El código se normaliza en el servidor (mayúsculas, sin espacios ni
       * guiones), así que se puede mandar tal y como lo teclee el jugador.
       */
      join: (code: string) =>
        client.request<{ group: GroupDetail }>("/groups/join", {
          method: "POST",
          body: { code },
        }),

      get: (groupId: string) =>
        client.request<{ group: GroupDetail }>(`/groups/${groupId}`),

      /**
       * Renombrar. **Solo el `owner`**: a los demás el servidor les responde
       * `NOT_GROUP_OWNER`. El código de invitación no se regenera.
       */
      rename: (groupId: string, name: string) =>
        client.request<{ group: GroupDetail }>(`/groups/${groupId}`, {
          method: "PATCH",
          body: { name },
        }),

      seasons: (groupId: string) =>
        client.request<{ seasons: GroupSeason[] }>(`/groups/${groupId}/seasons`),

      /**
       * Con la temporada terminada sigue devolviéndose, congelada: la ventana
       * ya no admite intentos nuevos.
       */
      leaderboard: (groupId: string) =>
        client.request<GroupLeaderboard>(`/groups/${groupId}/leaderboard`),

      /** Solo el `owner`, y solo con la temporada terminada. */
      renew: (groupId: string) =>
        client.request<{ group: GroupDetail }>(`/groups/${groupId}/renew`, {
          method: "POST",
        }),

      leave: (groupId: string) =>
        client.request<null>(`/groups/${groupId}/members/me`, {
          method: "DELETE",
        }),
    },

    /**
     * El chat del grupo (apartado 7 del plan).
     *
     * Va por **sondeo, no por WebSocket**: es una decisión cerrada, y por eso
     * el mismo endpoint tiene dos modos que devuelven la conversación en
     * órdenes distintos. `history` sube por el historial, `since` pregunta por
     * lo nuevo. Pedir los dos cursores a la vez es un 400.
     *
     * **Ninguna de las tres llamadas mira el estado de la temporada**, ni aquí
     * ni en el servidor: un grupo terminado sigue siendo un sitio donde hablar
     * (regla 5.2.1). Lo único que se comprueba es la pertenencia.
     */
    chat: {
      /**
       * Una página de historial, **del más nuevo al más viejo**. Sin `before`
       * es la primera página, o sea el final de la conversación.
       */
      history: (
        groupId: string,
        options: { before?: string; limit?: number } = {},
      ) =>
        client.request<ChatPage>(`/groups/${groupId}/messages`, {
          query: { before: options.before, limit: options.limit },
        }),

      /**
       * Solo lo que ha llegado después de `after`, **en orden cronológico**.
       * Es la llamada del sondeo, y la que hay que dejar de hacer al salir de
       * la pantalla o al pasar la app a segundo plano.
       */
      since: (groupId: string, after: string, limit?: number) =>
        client.request<ChatPage>(`/groups/${groupId}/messages`, {
          query: { after, limit },
        }),

      /**
       * Envía un mensaje. El servidor lo recorta antes de medirlo y rechaza
       * con `MESSAGE_TOO_LONG` a partir de 500 caracteres; el limitador de
       * ritmo son 20 por minuto y por jugador.
       */
      send: (groupId: string, body: string) =>
        client.request<{ message: ChatMessage }>(`/groups/${groupId}/messages`, {
          method: "POST",
          body: { body },
        }),
    },

    /**
     * El reto diario es **por grupo**: hay uno por grupo y jornada, con
     * imágenes distintas y con sus propios dos intentos. Sin grupos no hay reto
     * que jugar, y con la temporada de un grupo terminada tampoco.
     */
    daily: {
      /**
       * En qué grupos queda algo por jugar hoy. Es lo que pinta el menú
       * principal, y **no crea ningún reto**: los grupos donde nadie lo ha
       * abierto salen con `challengeId: null` y cero intentos.
       */
      overview: () => client.request<DailyOverview>("/daily"),

      /** El reto de hoy de un grupo. Lo crea si es la primera visita del día. */
      today: (groupId: string) =>
        client.request<DailyStatus>(`/groups/${groupId}/daily`),

      /**
       * Cierra un intento. Se mandan los colores elegidos, **nunca la
       * puntuación**: la recalcula el servidor (regla 6.1).
       *
       * El `challengeId` es opcional en el contrato, pero aquí se manda
       * siempre: si el jugador empieza a las 14:55 y envía a las 15:01, el
       * servidor detecta que el reto que tenía en pantalla ya no es el de la
       * jornada y responde `DAILY_CLOSED` en vez de puntuar sus respuestas
       * contra otros logos.
       */
      submit: (input: {
        groupId: string;
        challengeId: string;
        answers: DailyAnswer[];
      }) =>
        client.request<DailySubmitResult>(
          `/groups/${input.groupId}/daily/attempts`,
          {
            method: "POST",
            body: { challengeId: input.challengeId, answers: input.answers },
          },
        ),
    },

    notifications: {
      list: (options: { unreadOnly?: boolean } = {}) =>
        client.request<NotificationList>("/notifications", {
          query: options.unreadOnly ? { unreadOnly: "true" } : undefined,
        }),

      /** Sin `ids` se marcan todos los del jugador. */
      markRead: (ids?: string[]) =>
        client.request<{ unreadCount: number }>("/notifications/read", {
          method: "POST",
          body: ids ? { ids } : {},
        }),
    },

    leaderboards: {
      global: (page: PageInput = {}) =>
        client.request<LeaderboardResponse>("/leaderboards/global", {
          query: { limit: page.limit, offset: page.offset },
          auth: false,
        }),

      friends: (page: PageInput = {}) =>
        client.request<LeaderboardResponse>("/leaderboards/friends", {
          query: { limit: page.limit, offset: page.offset },
        }),

      me: () => client.request<MyRanking>("/leaderboards/me"),
    },
  };
}

export type Api = ReturnType<typeof createApi>;
