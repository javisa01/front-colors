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
 *
 * ## Por qué se queda el MEJOR intento y no el último
 *
 * Porque en el centro del anillo va `bestScore`, que lo dice el servidor y es
 * **el mejor de los dos**. Guardando el último, un segundo intento peor dejaba
 * los arcos contando una jornada y la cifra del medio contando otra: el dial se
 * rellenaba con unos colores que no eran los de la puntuación que enseñaba.
 *
 * Por eso cada entrada lleva su puntuación y una nueva solo entra si mejora —
 * el anillo y la cifra hablan siempre del mismo intento.
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

/**
 * El intento guardado de un grupo: sus rondas y lo que puntuó.
 *
 * La puntuación no se enseña desde aquí —esa la manda el servidor— y existe
 * solo para decidir cuál de los dos intentos del día se queda.
 */
interface StoredGroupAttempt {
  score: number;
  rounds: StoredRound[];
}

interface Stored {
  /** Jornada `YYYY-MM-DD` a la que pertenece todo lo de dentro. */
  dateKey: string;
  byGroup: Record<string, StoredGroupAttempt>;
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

// ---------------------------------------------------------------------------
// La cola de escritura
// ---------------------------------------------------------------------------

/**
 * Todo lo que toca la clave pasa por aquí, de una en una.
 *
 * Esto era **un fallo de verdad, no una precaución**. Al cerrar un intento se
 * disparaban a la vez `saveAttempt` y `addDailyXp`, y las dos hacen lo mismo:
 * leer la clave entera, cambiarle un campo y volver a escribirla. Salían en
 * paralelo, así que las dos leían el estado de antes y la última en escribir
 * pisaba a la otra — normalmente `addDailyXp`, que guardaba el `byGroup` viejo
 * y **borraba el desglose recién guardado**.
 *
 * De ahí que el dial apareciera vacío justo después de jugar: el intento se
 * había guardado, y un milisegundo después algo lo machacaba. Se notaba sobre
 * todo en el primer intento del día, que es el que concede XP; en el segundo,
 * `xpEarned` suele ser cero y `addDailyXp` ni llega a escribir.
 *
 * Con la cola, leer-modificar-escribir es atómico respecto a este módulo: cada
 * tarea ve lo que dejó la anterior. Es la garantía que hacía falta y que no da
 * `AsyncStorage`, que solo promete que cada escritura suelta llega entera.
 *
 * Las lecturas entran también: no cuestan nada y así nunca observan el estado
 * de mitad de una escritura pendiente.
 */
let chain: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  // Se encadena al anterior haya ido como haya ido: una tarea que falle no
  // puede dejar la cola colgada para siempre.
  const run = chain.then(task, task);
  chain = run.catch(() => undefined);
  return run;
}

// ---------------------------------------------------------------------------
// El bruto
// ---------------------------------------------------------------------------

/**
 * Normaliza una entrada de grupo.
 *
 * La versión anterior guardaba el desglose como un array pelado, sin
 * puntuación. Quien actualice la app a media jornada tiene una de esas en el
 * disco y hay que poder pintarla: se lee con puntuación `-1`, que significa «no
 * se sabe» y hace que cualquier intento posterior la sustituya. Es la decisión
 * segura de las dos — al revés dejaría clavado para siempre un intento del que
 * se desconoce el valor.
 */
function normalizeGroup(value: unknown): StoredGroupAttempt | null {
  if (Array.isArray(value)) {
    return { score: -1, rounds: value as StoredRound[] };
  }
  if (typeof value === "object" && value !== null) {
    const entry = value as Partial<StoredGroupAttempt>;
    if (Array.isArray(entry.rounds)) {
      return {
        score: typeof entry.score === "number" ? entry.score : -1,
        rounds: entry.rounds,
      };
    }
  }
  return null;
}

function normalize(value: unknown): Stored | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const stored = value as Partial<Stored> & { byGroup?: unknown };
  if (
    typeof stored.dateKey !== "string" ||
    typeof stored.byGroup !== "object" ||
    stored.byGroup === null
  ) {
    return null;
  }

  const byGroup: Record<string, StoredGroupAttempt> = {};
  for (const [groupId, raw] of Object.entries(
    stored.byGroup as Record<string, unknown>,
  )) {
    const entry = normalizeGroup(raw);
    if (entry != null) {
      byGroup[groupId] = entry;
    }
  }

  return {
    dateKey: stored.dateKey,
    byGroup,
    xp: typeof stored.xp === "number" ? stored.xp : undefined,
  };
}

async function read(): Promise<Stored | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return null;
    }
    return normalize(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

/**
 * Lo guardado de esta jornada, o un almacén vacío si lo de dentro es de otro
 * día: al cambiar el día no se acumula, se empieza de cero.
 */
async function readForDay(dateKey: string): Promise<Stored> {
  const stored = await read();
  return stored != null && stored.dateKey === dateKey
    ? stored
    : { dateKey, byGroup: {} };
}

async function write(stored: Stored): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // Es un adorno del menú: si no se puede guardar, el anillo sale vacío.
  }
}

// ---------------------------------------------------------------------------
// Intentos
// ---------------------------------------------------------------------------

/** El desglose de este grupo en esta jornada, o `null` si no hay. */
export async function readAttempt(
  groupId: string,
  dateKey: string,
): Promise<StoredRound[] | null> {
  return serialize(async () => {
    const stored = await read();
    if (stored == null || stored.dateKey !== dateKey) {
      return null;
    }
    return stored.byGroup[groupId]?.rounds ?? null;
  });
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
  return serialize(async () => {
    const stored = await read();
    const entry = stored?.byGroup[groupId];
    if (stored == null || entry == null) {
      return null;
    }
    return { dateKey: stored.dateKey, rounds: entry.rounds };
  });
}

/**
 * Guarda el desglose de un intento, **si es el mejor del día**.
 *
 * Los dos intentos de una jornada compiten por un solo sitio y gana el de más
 * puntos: es el que el servidor cuenta en la clasificación y el que enseña la
 * cifra del centro del anillo. Un segundo intento peor no toca nada, así que el
 * dial sigue enseñando los colores de la puntuación que tiene escrita dentro.
 *
 * En empate se queda el que ya estaba: la cifra en pantalla no cambia, y así se
 * ahorra un viaje al disco.
 */
export async function saveAttempt(
  groupId: string,
  dateKey: string,
  rounds: StoredRound[],
  score: number,
): Promise<void> {
  return serialize(async () => {
    const base = await readForDay(dateKey);
    const previous = base.byGroup[groupId];

    if (previous != null && previous.score >= score) {
      return;
    }

    await write({
      ...base,
      dateKey,
      byGroup: { ...base.byGroup, [groupId]: { score, rounds } },
    });
  });
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

  return serialize(async () => {
    const base = await readForDay(dateKey);
    await write({ ...base, dateKey, xp: (base.xp ?? 0) + xp });
  });
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
  return serialize(async () => {
    const stored = await read();
    if (stored == null) {
      return null;
    }
    return { dateKey: stored.dateKey, xp: stored.xp ?? 0 };
  });
}
