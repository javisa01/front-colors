import type { GroupSeason, GroupSummary } from "@/api/types";
import { t } from "@/i18n";

/**
 * Lo que la UI necesita saber de una temporada, en un solo sitio.
 *
 * El estado `active`/`finished` **lo decide el servidor** y llega en el campo
 * `status`: aquí no se recalcula comparando fechas con el reloj del teléfono,
 * que puede ir descuadrado y que además no sabe nada del viaje en el tiempo del
 * backend. Lo único que se calcula localmente es cuántos días quedan, y solo
 * para pintar una etiqueta.
 */

const DAY_MS = 86_400_000;

/**
 * Días que le quedan a la temporada, redondeando hacia arriba: mientras quede
 * cualquier resto es que hoy todavía se juega. Nunca menos de cero.
 */
export function daysLeft(season: GroupSeason, now: Date = new Date()): number {
  const remaining = new Date(season.endsAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(remaining / DAY_MS));
}

/** La línea de estado de un grupo: «Quedan 6 días», «Último día», «Terminado». */
export function seasonLabel(group: GroupSummary, now: Date = new Date()): string {
  if (group.status === "finished") {
    return t("online.groups.finishedHint", {
      season: group.currentSeason.seasonNumber,
    });
  }

  const days = daysLeft(group.currentSeason, now);
  if (days <= 0) return t("online.groups.endsSoon");
  if (days === 1) return t("online.groups.lastDay");
  return t("online.groups.daysLeft", { days });
}

export function membersLabel(count: number): string {
  return count === 1
    ? t("online.groups.membersOne")
    : t("online.groups.members", { count });
}

export function playedDaysLabel(days: number): string {
  if (days === 0) return t("online.group.notPlayed");
  if (days === 1) return t("online.group.dayPlayed");
  return t("online.group.daysPlayed", { days });
}

/**
 * Ordena "mis grupos" como espera verlos el jugador: primero los que siguen
 * compitiendo, y dentro de cada bloque el que antes termina —o el que antes
 * terminó—, que es el que más urge mirar.
 */
export function sortGroups(groups: GroupSummary[]): GroupSummary[] {
  return [...groups].sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return (
      new Date(a.currentSeason.endsAt).getTime() -
      new Date(b.currentSeason.endsAt).getTime()
    );
  });
}

/**
 * Cómo se teclea un código: mayúsculas y sin separadores. El servidor lo
 * normaliza igual, pero hacerlo también aquí evita que el campo enseñe algo
 * distinto de lo que se va a enviar.
 */
export function normalizeJoinCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]/g, "");
}

export const JOIN_CODE_LENGTH = 6;
export const GROUP_NAME_MIN = 2;
export const GROUP_NAME_MAX = 40;
