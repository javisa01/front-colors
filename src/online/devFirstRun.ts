import { useSyncExternalStore } from "react";

/**
 * Fingir que acabas de registrarte y no tienes ningún grupo. **Solo en
 * desarrollo.**
 *
 * ## Para qué
 *
 * El recorrido de la barra de pestañas está pensado para un estado que solo
 * existe una vez en la vida de una cuenta: sesión recién abierta y cero grupos.
 * Probarlo de verdad obliga a registrar una cuenta nueva cada vez, y ni siquiera
 * eso basta, porque en cuanto se crea un grupo para ver el resto de la app el
 * estado desaparece y no se puede volver a él.
 *
 * Con esto encendido, las pantallas que dependen de tener grupos —el menú de
 * hoy y la lista de grupos— se pintan como si no hubiera ninguno, sin tocar el
 * servidor ni la cuenta. Se apaga y vuelven a estar todos.
 *
 * ## Qué NO hace
 *
 * No miente en el ranking ni en el perfil, y es a propósito: ahí no hay nada que
 * dependa de tener grupos, así que rellenarlos con datos falsos sería inventar
 * una app distinta de la que se está probando. Y sobre todo, **no toca la pista
 * de la portada**: lo que se guarda en el almacenamiento sigue siendo lo que hay
 * de verdad, para que apagar el simulador no deje la rueda apagada.
 *
 * ## Por qué vive fuera de React
 *
 * Porque lo enciende una pantalla y lo leen otras dos, sin parentesco entre
 * ellas. Es el mismo trato que se le da al idioma en `i18n`: la verdad vive en
 * un módulo y `useSyncExternalStore` es la forma de mirarla desde un componente.
 * Un contexto habría exigido un provider más alto que las tres pantallas para
 * algo que en producción no existe.
 */

let active = false;

const listeners = new Set<() => void>();

/** Fuera de `__DEV__` siempre es `false`, pase lo que pase. */
export function isFirstRunMock(): boolean {
  return __DEV__ && active;
}

export function setFirstRunMock(on: boolean): void {
  if (!__DEV__ || on === active) {
    return;
  }

  active = on;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useFirstRunMock(): boolean {
  return useSyncExternalStore(subscribe, isFirstRunMock, () => false);
}
