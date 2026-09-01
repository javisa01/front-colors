import type { ReactElement, ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import type { FriendsOverview } from "@/api/types";
import { useSession } from "@/online/session";

/**
 * Cuánta gente está esperando respuesta a su solicitud de amistad.
 *
 * ## Por qué esto existe y no lo pide cada pantalla
 *
 * Lo pinta la **barra de pestañas**, que está siempre montada y no es de nadie.
 * Sin un sitio común, la única forma de que el punto del perfil estuviera al
 * día sería que la propia barra sondease, y este proyecto ya decidió —con el
 * chat— que no se dejan bucles corriendo por ahí.
 *
 * Así que no hay sondeo: se pregunta en los momentos en que la respuesta puede
 * haber cambiado y alguien va a mirarla.
 *
 *  - Al entrar en la parte online.
 *  - Al volver la app a primer plano, que es cuando ha podido pasar el rato.
 *  - Al cambiar de pestaña, con un intervalo mínimo por debajo del cual no se
 *    vuelve a preguntar: el punto no necesita estar al segundo.
 *
 * Y encima de eso, **las pantallas que ya piden la lista de amigos la regalan**
 * con `apply`: amigos, los ajustes del grupo y la ficha del grupo la necesitan
 * de todas formas para saber a quién se puede agregar, así que mantener el
 * contador al día no les cuesta ni una petición más. Aceptar o rechazar una
 * solicitud apaga el punto al instante por esa vía.
 */

const MIN_INTERVAL_MS = 30_000;

interface SocialValue {
  /** Solicitudes recibidas y sin responder. */
  incoming: number;
  /** Vuelve a preguntar. Se ignora si acaba de hacerlo, salvo con `force`. */
  refresh: (options?: { force?: boolean }) => void;
  /** El contador que ya conoce quien acaba de pedir la lista entera. */
  apply: (overview: FriendsOverview) => void;
}

const SocialContext = createContext<SocialValue | null>(null);

export function SocialProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const { api, status } = useSession();
  const [incoming, setIncoming] = useState(0);

  /** Cuándo se supo el contador por última vez. */
  const askedRef = useRef(0);
  /** Hay una petición en vuelo: dos a la vez no dan una respuesta más nueva. */
  const flyingRef = useRef(false);

  const apply = useCallback((overview: FriendsOverview) => {
    askedRef.current = Date.now();
    setIncoming(overview.incoming.length);
  }, []);

  const refresh = useCallback(
    (options?: { force?: boolean }) => {
      if (status !== "signedIn" || flyingRef.current) {
        return;
      }
      if (!options?.force && Date.now() - askedRef.current < MIN_INTERVAL_MS) {
        return;
      }

      flyingRef.current = true;
      void (async () => {
        try {
          const overview = await api.friends.list();
          askedRef.current = Date.now();
          setIncoming(overview.incoming.length);
        } catch {
          // El punto informa, no bloquea: si no se puede preguntar se queda
          // con lo último que se supo y se vuelve a intentar al siguiente
          // motivo. Enseñar un error por esto sería ruido.
        } finally {
          flyingRef.current = false;
        }
      })();
    },
    [api, status],
  );

  // Al entrar en la parte online, en cuanto hay sesión.
  useEffect(() => {
    if (status === "signedIn") {
      refresh({ force: true });
    }
  }, [refresh, status]);

  // Al volver de segundo plano: es cuando más probable es que haya algo nuevo.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        refresh({ force: true });
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  /**
   * Sin sesión no hay solicitudes de nadie.
   *
   * Se deriva en vez de vaciarse desde un efecto —la misma jugada que hace
   * `session` con el perfil—: así el punto se apaga en el mismo fotograma en
   * que cae la sesión, sin un render intermedio en el que todavía se ve.
   */
  const value = useMemo<SocialValue>(
    () => ({
      incoming: status === "signedIn" ? incoming : 0,
      refresh,
      apply,
    }),
    [status, incoming, refresh, apply],
  );

  return (
    <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
  );
}

/**
 * Fuera del proveedor devuelve un contador a cero en vez de reventar.
 *
 * A diferencia de `useSession`, esto no es un requisito para funcionar: es un
 * adorno informativo. Un componente que se monte antes de tiempo —o en una
 * prueba— debe poder pintarse sin punto, no dejar de pintarse.
 */
export function useSocial(): SocialValue {
  return useContext(SocialContext) ?? EMPTY;
}

const EMPTY: SocialValue = {
  incoming: 0,
  refresh: () => {},
  apply: () => {},
};
