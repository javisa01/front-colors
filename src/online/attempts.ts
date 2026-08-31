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
      } satisfies Stored),
    );
  } catch {
    // Es un adorno del menú: si no se puede guardar, el anillo sale vacío.
  }
}
