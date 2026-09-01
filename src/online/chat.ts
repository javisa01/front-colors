import type { ChatMessage } from "@/api/types";
import { getLocale, t } from "@/i18n";

/**
 * Lo que la pantalla del chat necesita saber, en un solo sitio.
 *
 * Aquí no hay peticiones ni estado: solo las constantes del contrato con el
 * servidor y la conversión de una lista plana de mensajes en las filas que
 * pinta la lista invertida. Separarlo del hook es lo que permite razonar sobre
 * el agrupado —y equivocarse en él— sin tocar el sondeo.
 */

// ---------------------------------------------------------------------------
// Contrato con el servidor
// ---------------------------------------------------------------------------

/**
 * Tope de caracteres de un mensaje. Es el mismo número que valida el servidor
 * (`MESSAGE_MAX_LENGTH` en `chatService.ts`), repetido aquí para poder frenar
 * al jugador **antes** de gastar una petición que ya se sabe que va a fallar.
 * Si allí cambia, aquí también.
 */
export const MESSAGE_MAX_LENGTH = 500;

/**
 * Cada cuánto se pregunta por lo nuevo mientras la pantalla está delante.
 *
 * Cinco segundos son los que sugiere el apartado 8 del plan, y salen de dos
 * límites: el sondeo tiene que sentirse como una conversación —por encima de
 * diez segundos ya se nota que se espera—, y el limitador de ritmo del servidor
 * no puede notarlo. A este paso son 12 peticiones por minuto, muy por debajo
 * del límite global de 600, y **solo mientras alguien está mirando**: en cuanto
 * la pantalla pierde el foco o la app se va al fondo, el sondeo para.
 */
export const POLL_INTERVAL_MS = 5_000;

/**
 * Cuánto se espera tras un fallo antes de volver a preguntar.
 *
 * Insistir cada cinco segundos con el servidor caído no arregla nada y sí gasta
 * batería y cuota. Al primer fallo el sondeo se ralentiza; al primer acierto
 * vuelve al paso normal.
 */
export const POLL_BACKOFF_MS = 20_000;

/** Cuántos mensajes trae cada página de historial. */
export const CHAT_PAGE_SIZE = 40;

// ---------------------------------------------------------------------------
// Un mensaje en la lista
// ---------------------------------------------------------------------------

/**
 * Un mensaje tal y como lo pinta la pantalla.
 *
 * Es el `ChatMessage` del servidor más un estado, porque en la lista conviven
 * los mensajes que ya existen y los que **todavía están volando**: enseñar el
 * tuyo en cuanto lo escribes es lo que hace que el chat se sienta instantáneo
 * pese a ir por sondeo. Un mensaje `pending` lleva un id temporal que no existe
 * en el servidor, así que nunca puede usarse como cursor.
 */
export interface ChatItem extends ChatMessage {
  state: "sent" | "pending" | "failed";
}

export function toItem(message: ChatMessage): ChatItem {
  return { ...message, state: "sent" };
}

/** Id temporal de un mensaje que aún no ha llegado al servidor. */
export function pendingId(seed: number): string {
  return `pending:${seed}`;
}

export function isPendingId(id: string): boolean {
  return id.startsWith("pending:");
}

// ---------------------------------------------------------------------------
// Las filas de la lista
// ---------------------------------------------------------------------------

/**
 * Cuánto puede pasar entre dos mensajes de la misma persona para que sigan
 * contando como una sola intervención. Pasado ese hueco, la conversación ha
 * respirado y el segundo mensaje vuelve a llevar su cabecera.
 */
const STREAK_WINDOW_MS = 5 * 60_000;

export type ChatRow =
  | { kind: "day"; key: string; label: string }
  | {
      kind: "message";
      key: string;
      item: ChatItem;
      /** Lo escribió quien está mirando. */
      mine: boolean;
      /** Primero de su intervención: lleva avatar y nombre. */
      leading: boolean;
      /** Último de su intervención: lleva el pico y la hora. */
      trailing: boolean;
    };

/** La jornada local de un instante, para agrupar por días. */
function dayKeyOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function sameStreak(earlier: ChatItem, later: ChatItem): boolean {
  if (earlier.author.userId !== later.author.userId) {
    return false;
  }
  if (dayKeyOf(earlier.createdAt) !== dayKeyOf(later.createdAt)) {
    return false;
  }
  const gap =
    new Date(later.createdAt).getTime() - new Date(earlier.createdAt).getTime();
  return Number.isFinite(gap) && gap < STREAK_WINDOW_MS;
}

/**
 * Convierte la conversación en las filas que pinta la lista.
 *
 * Entra **del más nuevo al más viejo**, que es como la guarda el hook y como la
 * devuelve el modo `before` del servidor, y sale en ese mismo orden, que es el
 * que quiere una `FlatList` invertida: la fila 0 es la de abajo.
 *
 * Por dentro se recorre al revés —de la más vieja a la más nueva— porque las
 * tres decisiones que se toman aquí miran hacia atrás en el tiempo: si hay que
 * abrir un día nuevo, si este mensaje continúa la intervención del anterior y
 * si el siguiente continúa la suya. Calcularlas sobre la lista ya invertida es
 * posible, pero se lee al revés y es justo donde se cuelan los fallos.
 */
export function buildChatRows(
  newestFirst: ChatItem[],
  selfId: string | null,
  now: Date = new Date(),
): ChatRow[] {
  const ascending = [...newestFirst].reverse();
  const rows: ChatRow[] = [];

  for (let index = 0; index < ascending.length; index += 1) {
    const item = ascending[index];
    const previous = index > 0 ? ascending[index - 1] : null;
    const next = index + 1 < ascending.length ? ascending[index + 1] : null;

    if (!previous || dayKeyOf(previous.createdAt) !== dayKeyOf(item.createdAt)) {
      rows.push({
        kind: "day",
        key: `day:${dayKeyOf(item.createdAt)}`,
        label: formatDayLabel(item.createdAt, now),
      });
    }

    rows.push({
      kind: "message",
      key: item.id,
      item,
      mine: selfId != null && item.author.userId === selfId,
      leading: previous == null || !sameStreak(previous, item),
      trailing: next == null || !sameStreak(item, next),
    });
  }

  return rows.reverse();
}

// ---------------------------------------------------------------------------
// Tiempo
// ---------------------------------------------------------------------------

/**
 * La hora de un mensaje, en el formato del idioma del jugador.
 *
 * Se pinta con las cifras tabulares de la app (`Type.metricSmall`), así que una
 * columna de horas queda alineada aunque cambien las cifras.
 */
export function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  try {
    return date.toLocaleTimeString(getLocale(), {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    // Sin datos de idioma en el motor, la hora cruda es mejor que nada.
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }
}

/**
 * El rótulo del separador de día: «Hoy», «Ayer» o la fecha escrita.
 *
 * Los dos días recientes van con palabra y el resto con fecha porque es como se
 * habla: nadie dice «el 28 de agosto» de lo de ayer, y nadie dice «hace nueve
 * días» de algo que ya toca ubicar en el calendario.
 */
export function formatDayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const key = dayKeyOf(iso);
  if (key === dayKeyOf(now.toISOString())) {
    return t("online.chat.today");
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === dayKeyOf(yesterday.toISOString())) {
    return t("online.chat.yesterday");
  }

  try {
    return date.toLocaleDateString(getLocale(), {
      day: "numeric",
      month: "long",
      // El año solo cuando no es el corriente: escribirlo siempre es ruido
      // once meses de cada doce.
      ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
    });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

// ---------------------------------------------------------------------------
// La línea de vista previa
// ---------------------------------------------------------------------------

/**
 * El último mensaje resumido en una línea, para la entrada al chat desde la
 * ficha del grupo: «Marta: qué mal el naranja de hoy».
 *
 * Los saltos de línea se aplastan a espacios porque la vista previa es una sola
 * línea: sin esto, un mensaje de tres párrafos se enseñaría como su primera
 * palabra y nada más.
 */
export function previewOf(message: ChatMessage, selfId: string | null): string {
  const body = message.body.replace(/\s+/g, " ").trim();
  return message.author.userId === selfId
    ? t("online.chat.previewMine", { body })
    : t("online.chat.preview", { name: message.author.username, body });
}
