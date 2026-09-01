import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Hasta dónde has leído en el chat de cada grupo.
 *
 * ## Por qué se guarda en el teléfono
 *
 * El backend cuenta avisos sin leer (`notifications`), pero **no** lleva el
 * registro de lectura del chat: un mensaje no crea aviso, así que por su parte
 * no hay forma de saber si alguien ha visto la conversación. Marcarlo aquí es
 * lo que permite que la ficha del grupo diga «hay algo nuevo» en vez de decir
 * «hay conversación», que es verdad siempre y no sirve de nada.
 *
 * ## Por qué basta con un identificador
 *
 * Se guarda el id del último mensaje que estaba en pantalla, no una marca de
 * tiempo ni un contador. Comparar el id con el último mensaje del grupo
 * responde exactamente a la pregunta que se hace la ficha —¿lo que hay arriba
 * del todo es lo mismo que vi?— sin depender del reloj del móvil, que con el
 * viaje en el tiempo del backend puede no coincidir con el del servidor.
 *
 * Nunca haber abierto el chat cuenta como no leído, que es lo que se quiere: un
 * grupo con conversación y sin visitar tiene algo que enseñar.
 *
 * El almacén crece por grupo, así que está acotado por los grupos en los que
 * estés. No hace falta barrerlo.
 */

const KEY = "colorquest:v1:chatseen";

type Stored = Record<string, string>;

function isValid(value: unknown): value is Stored {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

/** El último mensaje que se vio en este grupo, o `null` si nunca se abrió. */
export async function readSeenMessage(groupId: string): Promise<string | null> {
  const stored = await read();
  return stored[groupId] ?? null;
}

/** Anota que este mensaje ya se ha visto. */
export async function markSeenMessage(
  groupId: string,
  messageId: string,
): Promise<void> {
  const stored = await read();
  if (stored[groupId] === messageId) {
    return;
  }
  try {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ ...stored, [groupId]: messageId } satisfies Stored),
    );
  } catch {
    // Si no se puede guardar, la ficha del grupo seguirá diciendo que hay algo
    // nuevo. Es el fallo bueno de los dos: enseña de más, no de menos.
  }
}
