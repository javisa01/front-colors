import AsyncStorage from "@react-native-async-storage/async-storage";

import type { DailyStatus } from "@/api/types";

/**
 * Lo último que dijo el servidor sobre el reto de cada grupo.
 *
 * ## Qué problema resuelve
 *
 * La ficha del grupo pinta tres cosas que salen todas de `GET /groups/:id/daily`:
 * la mejor puntuación, los intentos gastados y —a través de la jornada— el
 * anillo con el color y el acierto de cada imagen. Esa petición es la más lenta
 * de la pantalla, porque la primera visita del día **crea el reto**, así que la
 * tarjeta aparecía vacía y se rellenaba sola unos segundos después. Se veía
 * como una pantalla a medio cargar, que es exactamente lo que era.
 *
 * Con esto, al volver a un grupo la tarjeta sale llena al instante y la red solo
 * la corrige si hace falta. Es la misma jugada que hace `online/session` con el
 * perfil: primero lo guardado, luego lo fresco.
 *
 * ## Por qué se puede confiar en lo guardado
 *
 * Porque caduca sola con el dato que ya trae dentro. Una jornada tiene un final
 * declarado por el servidor (`closesAt`), así que basta comparar: pasado ese
 * instante lo guardado es de un día anterior y se tira. No hay que calcular
 * ninguna fecha ni saber nada del corte de las 15:00 en Madrid.
 *
 * Si el reloj del móvil está mal —o el del backend viaja en el tiempo (5.5)—,
 * lo peor que pasa es que se descarte una caché que valía, y la pantalla se
 * comporta como antes. Nunca al revés: no puede enseñar la jornada de ayer como
 * si fuera la de hoy.
 */

const KEY = "colorquest:v1:dailystatus";

type Stored = Record<string, DailyStatus>;

function isValid(value: unknown): value is Stored {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Lo guardado sigue siendo de la jornada en curso. */
function isCurrent(status: DailyStatus, now: number): boolean {
  const closes = new Date(status.closesAt).getTime();
  return Number.isFinite(closes) && now < closes;
}

async function read(): Promise<Stored> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** El último estado conocido del reto de un grupo, si aún es de hoy. */
export async function readDailyStatus(
  groupId: string,
  now: number = Date.now(),
): Promise<DailyStatus | null> {
  const stored = (await read())[groupId];
  if (!stored || !isCurrent(stored, now)) {
    return null;
  }
  return stored;
}

/**
 * Guarda lo que acaba de responder el servidor.
 *
 * De paso barre las jornadas caducadas de los demás grupos: es el único momento
 * en que hay que tocar el fichero, así que sale gratis y el almacén no se queda
 * con retos de la semana pasada.
 */
export async function writeDailyStatus(
  groupId: string,
  status: DailyStatus,
  now: number = Date.now(),
): Promise<void> {
  const stored = await read();
  const fresh: Stored = { [groupId]: status };

  for (const [id, entry] of Object.entries(stored)) {
    if (id !== groupId && isCurrent(entry, now)) {
      fresh[id] = entry;
    }
  }

  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(fresh));
  } catch {
    // Es una caché: si no se puede escribir, la pantalla vuelve a esperar a la
    // red, que es como se comportaba antes de que esto existiera.
  }
}
