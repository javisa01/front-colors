import type { ChallengeCategory, ChallengeMetadata } from "@/types/challenge";
import challengeCatalog from "../../generated/challenges.json";

/**
 * Reparto del catálogo por familia de imagen.
 *
 * ## Por qué las banderas no salen en los modos de siempre
 *
 * El catálogo son 126 logos y 243 banderas. Si todos los modos tirasen de la
 * lista entera, «Juego rápido» pasaría a ser un juego de banderas por pura
 * aritmética: dos de cada tres retos lo serían. Los modos heredados se quedan
 * con los logos y las banderas tienen los suyos propios.
 *
 * La separación se hace por *presencia* de `category`, no por una lista de
 * categorías conocidas: los 126 logos no la llevan y no hace falta etiquetarlos
 * uno a uno para que esto funcione. La contrapartida es que un asset nuevo sin
 * categoría cae en el saco de los logos por omisión, así que los importadores
 * tienen que escribirla siempre.
 *
 * Si algún día se quiere el catálogo entero mezclado en todos los modos, esto
 * es lo único que hay que tocar: `catalogFor(null)` devolvería `PLAYABLE`.
 */

function isPlayable(item: ChallengeMetadata): boolean {
  return Boolean(
    item?.id && Array.isArray(item?.colors) && item.colors.length > 0,
  );
}

const PLAYABLE = (challengeCatalog as ChallengeMetadata[]).filter(isPlayable);

/** Los logos heredados: todo lo que no declara categoría. */
const UNCATEGORIZED = PLAYABLE.filter((item) => item.category == null);

/**
 * Catálogo de un modo. `null` significa «los de siempre» (logos), no «todos».
 *
 * Si una categoría se queda sin assets —porque nadie importó nada todavía— se
 * devuelve el catálogo de logos en vez de una lista vacía: un modo que no
 * arranca es peor fallo que un modo que enseña lo que no toca, y la pantalla de
 * «no hay retos» solo debería salir con el catálogo entero roto.
 */
export function catalogFor(
  category: ChallengeCategory | null,
): ChallengeMetadata[] {
  if (category == null) {
    return UNCATEGORIZED;
  }
  const matching = PLAYABLE.filter((item) => item.category === category);
  return matching.length > 0 ? matching : UNCATEGORIZED;
}

/**
 * El catálogo entero, sin separar por familia. Solo para el interruptor de
 * desarrollo `DEV_ONLY_LOGOS`: el juego nunca lo usa, porque mezclarlo todo es
 * justo lo que `catalogFor` evita.
 */
export function allPlayable(): ChallengeMetadata[] {
  return PLAYABLE;
}
