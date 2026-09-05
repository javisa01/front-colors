import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";

/**
 * Cuándo tiene sentido que una animación de fondo se esté moviendo.
 *
 * ## El problema que resuelve
 *
 * Los fondos de la aplicación son bucles infinitos (`withRepeat(-1)`) que se
 * lanzan al montar y no paran nunca. Eso estaría bien si una pantalla montada
 * fuese siempre una pantalla visible, y no lo es:
 *
 *  - En un `Stack`, la pantalla de la que vienes **sigue montada** debajo. Al
 *    entrar en el Taller, el disco y los orbes de la portada siguen girando.
 *  - En las pestañas del modo online conviven cuatro pantallas, cada una con su
 *    fondo. Basta pasar por las cuatro para dejar cuatro fondos latiendo a la
 *    vez, para siempre.
 *  - Con la aplicación en segundo plano siguen igual.
 *  - Y cuando el foco del tutorial se pone encima, tapa el 90 % de la pantalla:
 *    lo de debajo se sigue pintando aunque no se vea.
 *
 * Medido en el emulador, la aplicación en reposo pintaba 485 fotogramas en 8
 * segundos —60 fps constantes sin que nadie la tocara—, y en un móvil de 120 Hz
 * son 120. Ese gasto no compra nada: es trabajo de GPU para dibujar cosas que
 * no está mirando nadie, y deja sin margen a lo que sí se mira.
 *
 * ## Cómo se usa
 *
 * Quien lanza un bucle infinito de fondo lo consulta y, cuando devuelve
 * `false`, cancela la animación en vez de dejarla corriendo. Al volver a
 * `true`, la relanza desde cero.
 *
 * Devolver el valor a su origen antes de relanzar no es un detalle: `withRepeat`
 * con `reverse` rebota entre el valor que tenía al arrancar y el destino, así
 * que reanudar desde donde se quedó encogería el recorrido un poco más en cada
 * pausa hasta dejar el fondo casi quieto. El salto no se ve porque solo ocurre
 * mientras la pantalla está tapada, en segundo plano o ya fuera de foco.
 */
export function useAmbientActive(): boolean {
  const [focused, setFocused] = useState(true);
  const [foreground, setForeground] = useState(
    () => AppState.currentState === "active",
  );
  const covered = useSyncExternalStore(subscribe, isCovered, isCovered);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
    });
    return () => subscription.remove();
  }, []);

  return focused && foreground && !covered;
}

// ---------------------------------------------------------------------------
// Quién tapa la pantalla
// ---------------------------------------------------------------------------

/**
 * Cuántas capas opacas hay puestas ahora mismo. Es una cuenta y no un booleano
 * porque nada impide que dos se solapen —un foco de tutorial sobre una hoja—, y
 * con un booleano la primera en desmontarse encendería los fondos con la otra
 * todavía encima.
 */
let covers = 0;

const listeners = new Set<() => void>();

function isCovered(): boolean {
  return covers > 0;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Declara que este componente tapa la pantalla mientras esté montado, para que
 * los fondos de debajo se paren.
 *
 * Solo para capas **opacas y a pantalla completa**. Una hoja que deja ver la
 * mitad de la pantalla no lo es: pararía un fondo que sigue a la vista.
 */
export function useCoversScreen(active = true): void {
  useEffect(() => {
    if (!active) {
      return;
    }

    covers += 1;
    publish();

    return () => {
      covers -= 1;
      publish();
    };
  }, [active]);
}
