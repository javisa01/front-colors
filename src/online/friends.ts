import type { FriendsOverview } from "@/api/types";

/**
 * Qué eres de otra persona, en un solo sitio.
 *
 * Vivía dentro de los ajustes del grupo, que era el único sitio donde se podía
 * agregar a alguien de un vistazo. Ahora también se puede desde la
 * clasificación, y dos copias de esta función se habrían separado en cuanto una
 * de las dos tuviera que contemplar un estado nuevo: un botón de agregar que
 * miente —«añadir» a quien ya es tu amigo— es peor que no tenerlo.
 */

export type Relation = "you" | "friend" | "pending" | "none";

/**
 * `pending` no distingue quién pidió a quién a propósito: para decidir si sale
 * el botón de agregar, las dos direcciones significan lo mismo —hay algo en
 * marcha, no vuelvas a pedirlo—. Quien necesite la dirección tiene la lista
 * entera en `FriendsOverview`.
 */
export function relationOf(
  userId: string,
  youId: string | undefined,
  friends: FriendsOverview | null,
): Relation {
  if (userId === youId) return "you";
  if (friends?.friends.some((entry) => entry.user.id === userId)) {
    return "friend";
  }
  if (
    friends?.outgoing.some((entry) => entry.user.id === userId) ||
    friends?.incoming.some((entry) => entry.user.id === userId)
  ) {
    return "pending";
  }
  return "none";
}
