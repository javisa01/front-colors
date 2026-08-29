/**
 * Tipos de la API REST de `back-colors`.
 *
 * Son un espejo de lo que devuelve el backend (ver `src/services/*.ts` allí).
 * Si cambia el backend, este fichero es el único sitio que hay que tocar.
 *
 * No hay tipos de autenticación: de la sesión se encarga Clerk y sus tipos los
 * aporta `@clerk/expo`. El backend solo valida el token que le llega.
 */

// El color en HSV es el mismo tipo que usa el juego (`types/challenge.ts`): la
// rueda produce HSV y el backend lo acepta tal cual, así que no tiene sentido
// declarar aquí un gemelo con otro nombre.
import type { HSVColor } from "@/types/challenge";

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

// ---------------------------------------------------------------------------
// Grupos y temporadas
// ---------------------------------------------------------------------------

/**
 * Los dos estados de un grupo. El backend lo **deriva** comparando la hora con
 * el fin de la temporada actual: no hay que calcularlo aquí ni cachearlo, y por
 * eso basta con releer para que se actualice.
 *
 * `finished` significa que deja de competir, **no** que esté cerrado: el chat
 * sigue vivo y se puede seguir entrando con el código.
 */
export type GroupStatus = "active" | "finished";

export type GroupRole = "owner" | "member";

export interface GroupSeason {
  id: string;
  seasonNumber: number;
  startsAt: string;
  endsAt: string;
}

export interface GroupMember {
  userId: string;
  username: string;
  role: GroupRole;
  joinedAt: string;
}

export interface GroupSummary {
  id: string;
  name: string;
  /** 6 caracteres. Es lo que se comparte para invitar. */
  joinCode: string;
  ownerUserId: string;
  createdAt: string;
  status: GroupStatus;
  memberCount: number;
  /** Papel de quien consulta. Solo el `owner` puede renovar. */
  role: GroupRole;
  /** Avisos de este grupo sin leer: el punto rojo de la fila. */
  unreadCount: number;
  currentSeason: GroupSeason;
}

export interface GroupDetail extends GroupSummary {
  members: GroupMember[];
}

export interface GroupLeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  playedDays: number;
  /** Los empates comparten puesto: 1, 2, 2, 4. */
  position: number;
}

export interface GroupLeaderboard {
  season: GroupSeason;
  status: GroupStatus;
  entries: GroupLeaderboardEntry[];
}

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------

export interface AppNotification {
  id: string;
  /** `season_renewed` es el único que existe de momento. */
  type: string;
  groupId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationList {
  notifications: AppNotification[];
  unreadCount: number;
}

// ---------------------------------------------------------------------------
// Reto diario
// ---------------------------------------------------------------------------

/**
 * Una ronda tal y como llega del servidor: **sin el color objetivo**. Solo
 * viaja al cerrar el intento, para que no se pueda leer la respuesta antes de
 * tiempo.
 */
export interface DailyRound {
  round: number;
  assetId: string;
  colorIndex: number;
}

export interface DailyChallenge {
  id: string;
  /** La jornada, `YYYY-MM-DD` en hora de Madrid. */
  challengeDate: string;
  opensAt: string;
  closesAt: string;
  rounds: DailyRound[];
}

export interface DailyStatus {
  /** El grupo cuyo reto es este. Cada grupo tiene el suyo, con otras imágenes. */
  group: DailyGroupView;
  challenge: DailyChallenge;
  attemptsUsed: number;
  attemptsLeft: number;
  bestScore: number | null;
  closesAt: string;
}

export interface DailyGroupView {
  id: string;
  name: string;
  memberCount: number;
}

/**
 * El estado del reto de hoy en UN grupo, sin el reto en sí.
 *
 * Es lo que el menú principal necesita para saber en qué grupos queda algo por
 * jugar. Consultarlo no crea ningún reto: un grupo que nadie ha abierto todavía
 * llega con `challengeId: null` y cero intentos usados, que es justo lo que es.
 */
export interface DailyGroupStatus {
  groupId: string;
  challengeId: string | null;
  attemptsUsed: number;
  attemptsLeft: number;
  bestScore: number | null;
  /** Quedan intentos y la temporada del grupo sigue viva. */
  canPlay: boolean;
}

export interface DailyOverview {
  challengeDate: string;
  opensAt: string;
  closesAt: string;
  groups: DailyGroupStatus[];
}

/**
 * Una respuesta del jugador. El color va en HSV porque es lo que produce la
 * rueda y es su fuente de verdad; el servidor deriva el hexadecimal y
 * **recalcula la puntuación** (regla 6.1: el cliente nunca la manda).
 */
export interface DailyAnswer {
  round: number;
  hsv: HSVColor;
}

/** Un color con sus dos representaciones, tal y como los devuelve el backend. */
export interface ApiColor {
  hex: string;
  hsv: HSVColor;
}

/**
 * El desglose de una ronda **ya cerrada**. Aquí es donde por fin viaja el color
 * objetivo (regla 6.2): antes de enviar el intento la app no lo conoce, y no
 * debe sacarlo del catálogo local para adelantarlo.
 */
export interface DailyRoundResult extends DailyRound {
  answer: ApiColor;
  target: ApiColor;
  /** Precisión de 0 a 100. Es la cifra que se enseña por ronda. */
  accuracy: number;
  distance: number;
  correct: boolean;
  /** Puntos de la ronda: hasta 1000, sin bonus de velocidad. */
  score: number;
}

export interface DailyAttempt {
  id: string;
  attemptNumber: number;
  score: number;
  rounds: DailyRoundResult[];
  createdAt: string;
}

export interface DailySubmitResult {
  attempt: DailyAttempt;
  /** La mejor puntuación de la jornada: es la que cuenta en la clasificación. */
  best: number;
  attemptsUsed: number;
  attemptsLeft: number;
  /** XP concedido por este intento; puede ser 0 si ya se cobró en el primero. */
  xpEarned: number;
  xpTotal: number;
  level: number;
  /** Puesto en el ranking GLOBAL de la jornada, con empates compartidos. */
  position: number;
}
