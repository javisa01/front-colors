import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * El desglose del intento de hoy, guardado en el teléfono.
 *
 * ## Por qué hace falta
 *
 * El menú pinta el anillo de rondas con **los colores que enviaste** y con cada
 * arco recortado a tu porcentaje de acierto. Ese desglose solo viaja una vez:
 * dentro de `DailySubmitResult`, al cerrar el intento. `daily.overview()` y
 * `daily.today()` traen la mejor puntuación, pero no las rondas, así que al
 * volver al menú el dato ya no está en ninguna parte.
 *
 * Guardarlo aquí evita inventarse un endpoint para algo que el cliente acaba de
 * tener en la mano. Cuando el backend devuelva el último intento en el estado
 * del día, este módulo se cae y el menú lee de la API.
 *
 * ## Por qué se guarda por jornada y no por grupo
 *
 * Todo cuelga de una sola clave con la jornada dentro. Al cambiar el día, la
 * primera escritura tira el mapa entero y empieza de cero: así el almacén no
 * crece nunca y no hay que barrer claves viejas. Leer una jornada que no es la
 * guardada devuelve `null`, que es exactamente lo que significa —de hoy no hay
 * nada—, en vez de enseñar los colores de ayer.
 */

const KEY = "colorquest:v1:dailyrounds";

export interface StoredRound {
  /**
   * El color que envió el jugador, no el objetivo.
   *
   * Es lo que se pinta: el anillo cuenta lo que hiciste tú. El objetivo ya se
   * enseña, junto al tuyo, en la hoja de resultado de cada ronda.
   */
  answerHex: string;
  /** Precisión 0-100. Es la longitud del arco. */
  accuracy: number;
}

interface Stored {
  /** Jornada `YYYY-MM-DD` a la que pertenece todo lo de dentro. */
  dateKey: string;
  byGroup: Record<string, StoredRound[]>;
  /**
   * XP ganado hoy con el reto, sumando todos los grupos.
   *
   * El backend concede XP **por reto**, y hay un reto por grupo: quien juega en
   * tres grupos cobra tres veces. La cifra viaja una sola vez, dentro de
   * `DailySubmitResult.xpEarned` al cerrar cada intento, y `GET /me` solo trae
   * el total acumulado de siempre. Sumarla aquí es lo que permite al perfil
   * decir cuánto ha subido **hoy**: sin ella, el nivel cambia sin que nada
   * cuente por qué.
   *
   * Es opcional porque quien guardó antes de que existiera no lo tiene. Se lee
   * como cero.
   */
  xp?: number;
}

function isValid(value: unknown): value is Stored {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const stored = value as Partial<Stored>;
  return (
    typeof stored.dateKey === "string" &&
    typeof stored.byGroup === "object" &&
    stored.byGroup !== null
  );
}

async function read(): Promise<Stored | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** El desglose de este grupo en esta jornada, o `null` si no hay. */
export async function readAttempt(
  groupId: string,
  dateKey: string,
): Promise<StoredRound[] | null> {
  const stored = await read();
  if (stored == null || stored.dateKey !== dateKey) {
    return null;
  }
  return stored.byGroup[groupId] ?? null;
}
/**
 * Lo mismo, pero **sin saber todavía de qué jornada es**: devuelve el desglose
 * junto a la jornada a la que pertenece, para que quien llama decida.
 *
 * Existe porque la jornada la dice el servidor, y esperar a su respuesta para
 * empezar a leer el disco encadenaba dos esperas donde solo hacía falta una: la
 * ficha del grupo pedía la red, y solo cuando volvía miraba lo que ya tenía
 * guardado. Así las dos salen a la vez y el anillo se pinta en cuanto ambas
 * están, no una después de la otra.
 *
 * La comparación de jornadas no desaparece, se mueve: el desglose no se enseña
 * mientras su `dateKey` no coincida con la del reto en curso. Nunca se pinta el
 * resultado de ayer.
 */
export interface StoredAttempt {
  /** Jornada `YYYY-MM-DD` a la que pertenece el desglose. */
  dateKey: string;
  rounds: StoredRound[];
}

export async function readLatestAttempt(
  groupId: string,
): Promise<StoredAttempt | null> {
  const stored = await read();
  const rounds = stored?.byGroup[groupId];
  if (stored == null || rounds == null) {
    return null;
  }
  return { dateKey: stored.dateKey, rounds };
}

/**
 * Guarda el desglose de un intento.
 *
 * Si ya había uno de este grupo hoy —el segundo intento— se sobrescribe: el
 * anillo enseña lo último que hiciste, que es lo que el jugador espera ver
 * después de volver a jugar.
 */
export async function saveAttempt(
  groupId: string,
  dateKey: string,
  rounds: StoredRound[],
): Promise<void> {
  const stored = await read();

  // Jornada distinta —o nada guardado—: se empieza de cero en vez de acumular.
  const base: Stored =
    stored != null && stored.dateKey === dateKey
      ? stored
      : { dateKey, byGroup: {} };

  try {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        dateKey,
        byGroup: { ...base.byGroup, [groupId]: rounds },
        // Se arrastra: guardar el desglose de un intento no puede borrar el XP
        // del día, que vive en la misma clave.
        xp: base.xp,
      } satisfies Stored),
    );
  } catch {
    // Es un adorno del menú: si no se puede guardar, el anillo sale vacío.
  }
}

/**
 * Suma al XP de hoy lo que acaba de conceder un intento.
 *
 * Se llama con `DailySubmitResult.xpEarned`, que ya viene neto: el servidor
 * abona solo lo que falte de lo cobrado antes en ese mismo reto, así que un
 * segundo intento que no mejora suma cero. Acumular aquí es correcto porque
 * cada grupo tiene su reto y su propia concesión.
 *
 * Un `xpEarned` de cero no escribe: no cambiaría la cifra y ahorra un viaje al
 * disco justo después de enviar un intento.
 */
export async function addDailyXp(dateKey: string, xp: number): Promise<void> {
  if (xp <= 0) {
    return;
  }

  const stored = await read();
  const base: Stored =
    stored != null && stored.dateKey === dateKey
      ? stored
      : { dateKey, byGroup: {} };

  try {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        ...base,
        dateKey,
        xp: (base.xp ?? 0) + xp,
      } satisfies Stored),
    );
  } catch {
    // El perfil se queda sin la línea de «hoy». El total y el nivel, que son lo
    // que manda, siguen llegando de `GET /me`.
  }
}

/**
 * El XP ganado hoy con el reto, con la jornada a la que pertenece.
 *
 * Devuelve la jornada **sin filtrar**, por el mismo motivo que
 * `readLatestAttempt`: cuál es la jornada en curso lo dice el servidor, y quien
 * llama puede no saberlo todavía. Si no coincide, lo guardado es de otro día y
 * no se enseña.
 */
export async function readDailyXp(): Promise<{
  dateKey: string;
  xp: number;
} | null> {
  const stored = await read();
  if (stored == null) {
    return null;
  }
  return { dateKey: stored.dateKey, xp: stored.xp ?? 0 };
}
