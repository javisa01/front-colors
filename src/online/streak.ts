import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * La racha de jornadas seguidas.
 *
 * ## Por qué vive en el teléfono
 *
 * **El backend no la tiene.** Lo más parecido que llega hoy es `playedDays` de
 * `GroupLeaderboardEntry`, y no sirve: cuenta jornadas jugadas dentro de una
 * temporada, no consecutivas, y es por grupo — con tres grupos habría tres
 * rachas distintas y ninguna sería «la» racha del jugador.
 *
 * Así que de momento se deriva aquí, de lo único que sí llega: la jornada del
 * reto (`DailyOverview.challengeDate`) y si ya se ha jugado en algún grupo.
 *
 * ## Lo que esto NO es
 *
 * No es autoridad. Se pierde al reinstalar, no viaja entre dispositivos y se
 * puede inflar moviendo el reloj del teléfono. Para un contador que solo se
 * enseña a su dueño es un trato aceptable; en el momento en que la racha valga
 * XP, salga en una clasificación o se pueda enseñar a otro, **tiene que subir
 * al servidor**, y este módulo pasa a ser una caché de lo que él diga.
 *
 * El corte de jornada lo decide el servidor (15:00 en Madrid) y llega ya
 * resuelto en `challengeDate`. Aquí no se calcula ninguna fecha con el reloj
 * local: solo se comparan cadenas `YYYY-MM-DD` que vienen de fuera. Es lo que
 * evita que un jugador en otro huso pierda la racha por cruzar su medianoche.
 */

const KEY = "colorquest:v1:dailystreak";

export interface Streak {
  /** Jornadas seguidas. 0 si nunca ha jugado. */
  count: number;
  /** Última jornada contada, `YYYY-MM-DD`. `null` si no hay ninguna. */
  lastDate: string | null;
  /**
   * Las jornadas jugadas recientes, `YYYY-MM-DD`, de más antigua a más nueva.
   *
   * ## Para qué, si ya está el contador
   *
   * El contador dice cuántos días seguidos llevas; **no dice cuáles**. El menú
   * enseña un calendario de dos semanas, y para pintarlo hace falta saber qué
   * casillas van encendidas — un número no basta.
   *
   * Guarda MÁS que la racha actual a propósito: si jugaste lunes, martes y
   * miércoles, fallaste el jueves y volviste el viernes, el contador vale 1 pero
   * el calendario sigue enseñando los cuatro días jugados. Las dos cosas son
   * ciertas y dicen cosas distintas — el contador, la racha viva; el calendario,
   * el mes que llevas.
   *
   * Se recorta a `HISTORY_DAYS`: nadie mira más atrás de dos semanas en el menú
   * y el almacén no debe crecer sin tope.
   */
  days: string[];
}

/**
 * Cuántas jornadas se recuerdan. Dos semanas es lo que enseña el calendario, y
 * las de más son margen para que el borde de la rejilla no se quede sin datos
 * al cambiar de semana.
 */
export const HISTORY_DAYS = 21;

const EMPTY: Streak = { count: 0, lastDate: null, days: [] };

/**
 * Una jornada desplazada `delta` días, en el mismo formato.
 *
 * `Date.UTC` y no `new Date(string)`: el segundo interpreta las fechas sin hora
 * en UTC pero las formatea en local, así que sumar o restar un día cerca de
 * medianoche podía saltarse una jornada según el huso del teléfono.
 */
export function shiftDay(dateKey: string, delta: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const stamp = Date.UTC(year, month - 1, day) + delta * 86_400_000;
  const moved = new Date(stamp);

  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}-${pad(
    moved.getUTCDate(),
  )}`;
}

/** Día de la semana de una jornada: 0 domingo … 6 sábado. */
export function weekdayOf(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Día del mes de una jornada. Es lo que se escribe dentro de la casilla. */
export function dayOfMonth(dateKey: string): number {
  return Number(dateKey.split("-")[2]);
}

function previousDay(dateKey: string): string {
  return shiftDay(dateKey, -1);
}

function isValid(value: unknown): value is Partial<Streak> & {
  count: number;
  lastDate: string | null;
} {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const streak = value as Partial<Streak>;
  return (
    typeof streak.count === "number" &&
    Number.isFinite(streak.count) &&
    streak.count >= 0 &&
    (streak.lastDate === null || typeof streak.lastDate === "string")
  );
}

/**
 * Rellena el historial de quien ya tenía racha antes de que existiera.
 *
 * **No es una estimación.** Si la racha vale `count` y acabó en `lastDate`,
 * entonces esas `count` jornadas seguidas se jugaron — o el contador no valdría
 * `count`. Así que las fechas se pueden reconstruir hacia atrás y son exactas.
 *
 * Lo que NO se puede reconstruir es nada anterior al arranque de la racha, y por
 * eso el calendario pinta esos días como no jugados: es lo único que la app sabe
 * y coincide con lo que enseña el contador. Si alguien jugó hace un mes, falló un
 * día y volvió, ese pasado se ha perdido — no se inventa.
 */
function backfill(count: number, lastDate: string | null): string[] {
  if (lastDate == null || count <= 0) {
    return [];
  }
  const total = Math.min(count, HISTORY_DAYS);
  return Array.from({ length: total }, (_, index) =>
    shiftDay(lastDate, -(total - 1 - index)),
  );
}

/** Recorta a las últimas `HISTORY_DAYS`, sin duplicados y en orden. */
function trim(days: string[]): string[] {
  return [...new Set(days)].sort().slice(-HISTORY_DAYS);
}

export async function readStreak(): Promise<Streak> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return EMPTY;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isValid(parsed)) {
      return EMPTY;
    }

    return {
      count: parsed.count,
      lastDate: parsed.lastDate,
      // Quien guardó antes de que el historial existiera no tiene `days`. Se
      // reconstruye del contador, que es exacto. Ver `backfill`.
      days: Array.isArray(parsed.days)
        ? trim(parsed.days.filter((day): day is string => typeof day === "string"))
        : backfill(parsed.count, parsed.lastDate),
    };
  } catch {
    // La racha es un adorno motivacional: si el almacenamiento falla se enseña
    // cero, nunca se rompe la pantalla.
    return EMPTY;
  }
}

/**
 * Cuenta la jornada `dateKey` como jugada y devuelve la racha resultante.
 *
 * Es **idempotente**: el menú la llama en cada carga mientras haya algún grupo
 * con puntuación de hoy, así que volver a la pantalla diez veces no puede sumar
 * diez días.
 */
export async function markPlayed(dateKey: string): Promise<Streak> {
  const current = await readStreak();

  if (current.lastDate === dateKey) {
    return current;
  }

  const next: Streak = {
    // Solo encadena si la última contada fue justo la jornada anterior. Con un
    // hueco de por medio la racha se rompe y vuelve a empezar en uno.
    count: current.lastDate === previousDay(dateKey) ? current.count + 1 : 1,
    lastDate: dateKey,
    // El historial NO se reinicia cuando la racha se rompe: el calendario sigue
    // enseñando los días jugados de las dos semanas, con su hueco en medio. Es
    // justamente el hueco lo que se quiere ver.
    days: trim([...current.days, dateKey]),
  };

  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Se devuelve igual: la pantalla enseña el número correcto en esta sesión
    // aunque no haya podido guardarse.
  }

  return next;
}

/**
 * La racha tal y como debe ENSEÑARSE hoy.
 *
 * Guardar y mostrar son cosas distintas: si la última jornada contada no es ni
 * hoy ni ayer, la racha ya está rota aunque en disco siga el número viejo, y
 * enseñar «12» a alguien que lleva una semana sin jugar es mentirle. No se
 * borra nada —si vuelve hoy, empieza en 1 igualmente—, solo se deja de contar.
 */
export function visibleStreak(streak: Streak, todayKey: string): number {
  if (streak.lastDate == null) {
    return 0;
  }
  if (streak.lastDate === todayKey || streak.lastDate === previousDay(todayKey)) {
    return streak.count;
  }
  return 0;
}
