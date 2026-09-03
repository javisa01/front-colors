import type { AppNotification, GroupSeason, GroupSummary } from "@/api/types";
import { getLocale, t } from "@/i18n";

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

/**
 * Las fechas de una temporada, «17 sept – 27 sept».
 *
 * Mes abreviado y sin año: diez días no cruzan dos años nunca, y el año en una
 * lista de temporadas seguidas es una palabra repetida que no distingue nada.
 * El idioma sale del que la app tiene puesto, no del sistema, para que la línea
 * hable el mismo idioma que la etiqueta que lleva encima.
 */
export function seasonRange(season: GroupSeason): string {
  const format = (iso: string): string =>
    new Date(iso).toLocaleDateString(getLocale(), {
      day: "numeric",
      month: "short",
    });

  return t("online.group.seasonRange", {
    from: format(season.startsAt),
    to: format(season.endsAt),
  });
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
 * Un aviso, escrito para leerlo dentro del grupo.
 *
 * Hoy el backend solo crea uno, `season_renewed`, pero el tipo llega como
 * cadena libre y va a crecer: por eso hay una rama por tipo conocido y una
 * salida genérica, en vez de dar por hecho que solo puede ser ese. Un aviso que
 * la app no sepa nombrar es mejor enseñarlo en genérico que esconderlo, porque
 * el punto rojo que lo acompaña ya se ha encendido.
 */
export function noticeLabel(notification: AppNotification): string {
  if (notification.type === "season_renewed") {
    const season = Number(notification.payload.seasonNumber);
    if (Number.isFinite(season)) {
      return t("online.group.notice.seasonRenewed", { season });
    }
  }
  return t("online.group.notice.generic");
}

/**
 * Deja a cero el contador de avisos de los grupos silenciados.
 *
 * El punto rojo se pinta en tres sitios —la lista, el menú y la ficha— a partir
 * de `unreadCount`. Apagarlo en cada sitio serían tres reglas que se pueden
 * desincronizar; hacerlo aquí, nada más recibir la lista, deja una sola.
 *
 * ## Antes leía el teléfono; ahora lee el servidor
 *
 * La preferencia vivía en `AsyncStorage` porque no había push y el servidor no
 * tenía ninguna decisión que tomar con ella. Ahora sí la tiene —es él quien
 * manda los avisos—, así que la fuente de verdad es `notificationsEnabled`, que
 * viene con cada grupo. Es lo que hace que apagar los avisos en el móvil los
 * apague también en la tableta, que es lo que la gente espera de un interruptor
 * que dice «Avisos del grupo».
 *
 * Con el interruptor apagado el servidor ya no crea avisos nuevos para ese
 * grupo, así que esto solo redondea: pone a cero los que quedaran de antes.
 *
 * **No se pierde nada.** Los avisos siguen existiendo y se siguen marcando
 * leídos al abrir el grupo: lo único que cambia es que el grupo no interrumpe.
 *
 * Se aplica a la lista, no al detalle: dentro del grupo ya has entrado, y ahí
 * la línea que cuenta qué pasó es contenido, no una llamada de atención.
 */
export function silenceMutedGroups(groups: GroupSummary[]): GroupSummary[] {
  return groups.map((group) =>
    group.notificationsEnabled ? group : { ...group, unreadCount: 0 },
  );
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
