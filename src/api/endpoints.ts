import type { ApiClient } from "./client";
import type {
  FriendsOverview,
  Friendship,
  LeaderboardResponse,
  MyRanking,
  PrivateProfile,
  UserProfile,
} from "./types";

export interface PageInput {
  limit?: number;
  offset?: number;
}

/**
 * Superficie REST del backend, agrupada por área. Solo cubre lo que NO
 * necesita WebSocket: perfil, amigos y rankings. Las partidas en tiempo real
 * van por Socket.IO y llegarán en una segunda fase.
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
