import type { GroupSummary } from "@/api/types";
import { getLocale, t } from "@/i18n";
import type { ChallengeMetadata } from "@/types/challenge";
import challengeCatalog from "../../generated/challenges.json";

/**
 * Lo que la pantalla del reto diario necesita saber, en un solo sitio.
 *
 * Dos cosas viven aquí y conviene entender por qué:
 *
 *  1. **La búsqueda de un logo en el catálogo local.** El servidor manda
 *     `{ assetId, colorIndex }` y nada más (regla 6.2); el dibujo del logo sí
 *     está en la app, así que hay que casarlos por `id`. Es una búsqueda, no
 *     una elección: aquí no se decide nunca qué logo toca.
 *  2. **La cuenta atrás al próximo reto.** El corte de una jornada es la
 *     apertura de la siguiente, así que `closesAt` sirve para las dos cosas.
 */

// ---------------------------------------------------------------------------
// Catálogo local
// ---------------------------------------------------------------------------

/**
 * Índice por `id`, construido a la primera consulta.
 *
 * A propósito **no** se reutiliza `getCatalog()` de `hooks/useChallenge.ts`:
 * ese filtra por `DEV_ONLY_LOGOS`, que existe para acotar los modos offline
 * mientras se prueba algo. Aplicarlo aquí dejaría sin dibujo los logos que el
 * servidor sí ha elegido, que es justo el fallo que el filtro no ve venir.
 */
let index: Map<string, ChallengeMetadata> | null = null;

function catalogIndex(): Map<string, ChallengeMetadata> {
  if (!index) {
    index = new Map(
      (challengeCatalog as ChallengeMetadata[])
        .filter((item) => item?.id && Array.isArray(item?.colors))
        .map((item) => [item.id, item]),
    );
  }
  return index;
}

/**
 * El logo de una ronda, o `null` si la app no lo tiene.
 *
 * Los 137 identificadores coinciden hoy entre el catálogo del backend y el de
 * la app, así que `null` significa que uno de los dos se ha regenerado sin el
 * otro. La pantalla lo trata como un aviso y deja seguir jugando: quedarse
 * colgada obligaría a gastar un intento para nada.
 */
export function findAsset(assetId: string): ChallengeMetadata | null {
  const asset = catalogIndex().get(assetId);
  if (!asset) {
    return null;
  }
  // `svgXml` puede faltar en una entrada mal generada; el render ya sabe
  // enseñar su propio hueco, pero mejor que llegue siempre una cadena.
  return { ...asset, svgXml: asset.svgXml ?? "" };
}

// ---------------------------------------------------------------------------
// Tiempo
// ---------------------------------------------------------------------------

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Milisegundos que faltan para un instante ISO. Nunca negativo. */
export function msUntil(iso: string, now: number = Date.now()): number {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) {
    return 0;
  }
  return Math.max(0, target - now);
}

/**
 * La cuenta atrás en texto, con la unidad que toque.
 *
 * A diez horas vista, los segundos no aportan nada y hacen bailar la línea
 * entera cada segundo; en el último minuto son lo único que importa.
 */
export function formatCountdown(ms: number): string {
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);
  const seconds = Math.floor((ms % MINUTE_MS) / SECOND_MS);

  if (days > 0) {
    return t("online.daily.countdownDays", { days, hours });
  }
  if (hours > 0) {
    return t("online.daily.countdownHours", { hours, minutes });
  }
  if (minutes > 0) {
    return t("online.daily.countdownMinutes", { minutes, seconds });
  }
  return t("online.daily.countdownSeconds", { seconds });
}

/**
 * La jornada en el idioma del jugador.
 *
 * `challengeDate` es `YYYY-MM-DD` en hora de Madrid, no un instante: se
 * construye la fecha con sus tres partes en local en vez de dejar que
 * `new Date("2026-08-28")` la interprete como medianoche UTC, que en un huso
 * al oeste enseñaría el día anterior.
 */
export function formatChallengeDate(challengeDate: string): string {
  const [year, month, day] = challengeDate.split("-").map(Number);
  if (!year || !month || !day) {
    return challengeDate;
  }
  const date = new Date(year, month - 1, day);
  try {
    return date.toLocaleDateString(getLocale(), {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    // Si el motor no trae datos de idioma, la fecha cruda es mejor que nada.
    return challengeDate;
  }
}

// ---------------------------------------------------------------------------
// Grupos
// ---------------------------------------------------------------------------

/**
 * Los grupos en los que este reto sí suma (apartado 5.3).
 *
 * El estado lo deriva el servidor y llega en `status`: aquí no se comparan
 * fechas, igual que en `online/groups.ts`.
 */
export function scoringGroups(groups: GroupSummary[]): GroupSummary[] {
  return groups.filter((group) => group.status === "active");
}

/** La línea de «esto cuenta para...» del reto de hoy. */
export function scoringLabel(count: number): string {
  if (count === 0) {
    return t("online.daily.noActiveGroups");
  }
  if (count === 1) {
    return t("online.daily.countsOne");
  }
  return t("online.daily.countsMany", { count });
}
