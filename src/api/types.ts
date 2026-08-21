/**
 * Tipos de la API REST de `back-colors`.
 *
 * Son un espejo de lo que devuelve el backend (ver `src/services/*.ts` allí).
 * Si cambia el backend, este fichero es el único sitio que hay que tocar.
 *
 * No hay tipos de autenticación: de la sesión se encarga Clerk y sus tipos los
 * aporta `@clerk/expo`. El backend solo valida el token que le llega.
 */

// ---------------------------------------------------------------------------
// Usuario
// ---------------------------------------------------------------------------

export interface LevelProgress {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  /** XP que faltan para subir de nivel. */
  xpToNextLevel: number;
  /** 0..1, para pintar la barra de progreso. */
  progress: number;
}

/** Perfil visible de cualquier jugador. */
export interface UserProfile {
  id: string;
  username: string;
  xp: number;
  level: number;
  createdAt: string;
  progress: LevelProgress;
}

/** Perfil propio: añade los campos que solo ve su dueño. */
export interface PrivateProfile extends UserProfile {
  email: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Amigos
// ---------------------------------------------------------------------------

export type FriendshipStatus = "pending" | "accepted" | "rejected" | "blocked";

/** `incoming`: te la han enviado. `outgoing`: la enviaste tú. */
export type FriendDirection = "incoming" | "outgoing";

export interface FriendEntry {
  friendshipId: string;
  status: FriendshipStatus;
  direction: FriendDirection;
  since: string;
  user: UserProfile;
}

export interface FriendsOverview {
  friends: FriendEntry[];
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
}

export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------

export interface Pagination {
  limit: number;
  offset: number;
  total: number;
  page: number;
  pageCount: number;
  hasMore: boolean;
}

export interface LeaderboardEntry {
  position: number;
  userId: string;
  username: string;
  level: number;
  xp: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  pagination: Pagination;
}

export interface MyRanking {
  global: { position: number | null; total: number };
  friends: { position: number | null; total: number };
  user: { userId: string; username: string; level: number; xp: number };
}
