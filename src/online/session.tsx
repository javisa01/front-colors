import { useAuth, useClerk } from "@clerk/expo";
import type { ReactElement, ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ApiClient } from "@/api/client";
import { createApi, type Api } from "@/api/endpoints";
import type { PrivateProfile } from "@/api/types";
import { unregisterPush } from "@/online/push";
import { clearUser, loadUser, saveUser } from "@/online/sessionStorage";
import { clearLanding } from "@/utils/storage";

/**
 * Estado de la sesión online.
 *
 * La identidad la lleva Clerk; este provider solo traduce esa identidad al
 * perfil de juego que guarda el backend (nombre, XP, nivel) y expone el cliente
 * REST ya autenticado.
 *
 * Vive SOLO dentro de `app/online/_layout.tsx`, igual que `ClerkProvider`. El
 * árbol offline nunca los monta, así que jugar sin conexión no crea clientes
 * HTTP, no lee credenciales y no depende de que haya backend.
 */

type Status = "loading" | "signedOut" | "signedIn";

interface SessionValue {
  status: Status;
  /** Perfil de juego. `null` mientras se carga o si el backend no responde. */
  user: PrivateProfile | null;
  api: Api;
  /**
   * El cliente en crudo, ya autenticado. Lo usa el panel de desarrollo para
   * montar `createDevApi`, que no forma parte de la superficie normal de la
   * API porque en producción esas rutas no existen.
   */
  client: ApiClient;
  logout: () => Promise<void>;
  /** Refresca el perfil desde el servidor (XP y nivel cambian al jugar). */
  reloadUser: () => Promise<void>;
  /** Actualiza el perfil en memoria y disco tras un PATCH /me. */
  applyUser: (user: PrivateProfile) => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/**
 * El perfil se guarda etiquetado con el id de Clerk de su dueño, igual que en
 * disco. Así el perfil solo se pinta si pertenece a la sesión activa, sin
 * necesidad de vaciarlo desde un efecto al cerrar sesión.
 */
interface OwnedProfile {
  ownerId: string;
  profile: PrivateProfile;
}

export function SessionProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const clerk = useClerk();

  const [owned, setOwned] = useState<OwnedProfile | null>(null);

  /**
   * Un único cliente para toda la vida del provider.
   *
   * `useClerk()` devuelve la instancia singleton de Clerk, que no cambia entre
   * renders: por eso el cliente puede memoizarse con seguridad. `clerk.session`
   * se lee en cada petición, así que el token siempre es el vigente sin tener
   * que reconstruir nada al iniciar o cerrar sesión.
   */
  const client = useMemo(
    () =>
      new ApiClient({
        getToken: async (options) =>
          (await clerk.session?.getToken(options)) ?? null,
        onSessionLost: () => clerk.signOut(),
      }),
    [clerk],
  );

  const api = useMemo(() => createApi(client), [client]);

  const persist = useCallback(
    async (profile: PrivateProfile) => {
      if (!userId) {
        return;
      }
      setOwned({ ownerId: userId, profile });
      await saveUser(userId, profile);
    },
    [userId],
  );

  // Carga el perfil de juego que corresponde a la sesión de Clerk.
  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn || !userId) {
      // Sin `setState`: el perfil ya deja de pintarse porque no hay dueño con
      // el que casar (ver `user` más abajo).
      void clearUser();
      return;
    }

    let active = true;

    (async () => {
      // Primero el perfil cacheado: el hub se pinta al instante y sin red.
      const cached = await loadUser(userId);
      if (active && cached) {
        setOwned({ ownerId: userId, profile: cached });
      }

      try {
        // `GET /me` crea la ficha del jugador si es su primera vez.
        const { user: fresh } = await api.users.me();
        if (active) {
          setOwned({ ownerId: userId, profile: fresh });
          await saveUser(userId, fresh);
        }
      } catch {
        // Sin red se sigue con el perfil cacheado: es preferible a echar al
        // usuario porque el servidor esté apagado un momento. La sesión de
        // Clerk sigue siendo válida.
      }
    })();

    return () => {
      active = false;
    };
  }, [api, isLoaded, isSignedIn, userId]);

  const logout = useCallback(async () => {
    /*
      Primero el teléfono, y antes de cerrar la sesión de Clerk.

      Sin esto, quien sale de su cuenta seguiría recibiendo en ese móvil los
      avisos de los grupos de los que ya no ve nada. Y va antes que el
      `signOut` porque la baja es una petición autenticada: después ya no
      habría token con el que hacerla.
    */
    await unregisterPush(api);
    await clearUser();
    // La portada tiene que apagar la rueda al volver. Es la contrapartida de
    // que sea el área online quien le cuenta lo que pasa: si no se borra aquí,
    // la raíz seguiría ofreciendo «Jugar» a quien acaba de salirse.
    await clearLanding();
    await clerk.signOut();
  }, [api, clerk]);

  const reloadUser = useCallback(async () => {
    const { user: fresh } = await api.users.me();
    await persist(fresh);
  }, [api, persist]);

  const status: Status = !isLoaded
    ? "loading"
    : isSignedIn
      ? "signedIn"
      : "signedOut";

  // El perfil solo vale si es el de la sesión activa: tras cambiar de cuenta,
  // el del usuario anterior deja de coincidir y no se pinta.
  const user = userId && owned?.ownerId === userId ? owned.profile : null;

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      api,
      client,
      logout,
      reloadUser,
      applyUser: persist,
    }),
    [status, user, api, client, logout, reloadUser, persist],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error(
      "useSession solo funciona dentro de SessionProvider (árbol /online)",
    );
  }
  return value;
}
