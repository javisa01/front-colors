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
}

const EMPTY: Streak = { count: 0, lastDate: null };

/** Un día antes de una jornada `YYYY-MM-DD`, en el mismo formato. */
function previousDay(dateKey: string): string {
  // `Date.UTC` y no `new Date(string)`: el segundo interpreta las fechas sin
  // hora en UTC pero las formatea en local, así que restar un día cerca de
  // medianoche podía saltarse una jornada según el huso del teléfono.
  const [year, month, day] = dateKey.split("-").map(Number);
  const stamp = Date.UTC(year, month - 1, day) - 86_400_000;
  const previous = new Date(stamp);

  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${previous.getUTCFullYear()}-${pad(previous.getUTCMonth() + 1)}-${pad(
    previous.getUTCDate(),
  )}`;
}

function isValid(value: unknown): value is Streak {
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

export async function readStreak(): Promise<Streak> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return EMPTY;
    }
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : EMPTY;
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
