import Constants from "expo-constants";

/**
 * Dónde vive la API. Se resuelve una sola vez, por orden de prioridad:
 *
 *   1. `EXPO_PUBLIC_API_URL` — variable de entorno (la que usarás con Neon).
 *   2. `expo.extra.apiUrl` de `app.json`.
 *   3. La IP del propio servidor de Metro, con el puerto del backend.
 *
 * El punto 3 es el que hace que funcione en un móvil físico sin configurar
 * nada: `localhost` en el teléfono es el teléfono, no tu PC, así que se
 * reutiliza la IP de red local por la que Expo ya te está sirviendo la app.
 */

const BACKEND_PORT = 4000;

function fromEnv(): string | null {
  const url = process.env.EXPO_PUBLIC_API_URL;
  return typeof url === "string" && url.length > 0 ? url : null;
}

function fromAppConfig(): string | null {
  const extra = Constants.expoConfig?.extra as
    | { apiUrl?: unknown }
    | undefined;
  return typeof extra?.apiUrl === "string" && extra.apiUrl.length > 0
    ? extra.apiUrl
    : null;
}

function fromMetroHost(): string | null {
  // `hostUri` es "192.168.1.42:8081" cuando Metro sirve por LAN. En builds de
  // producción no existe, y entonces esta vía simplemente no aplica.
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)
      ?.debuggerHost;

  const host = hostUri?.split(":")[0];
  if (!host) {
    return null;
  }
  return `http://${host}:${BACKEND_PORT}`;
}

function resolveBaseUrl(): string {
  const raw =
    fromEnv() ?? fromAppConfig() ?? fromMetroHost() ?? `http://localhost:${BACKEND_PORT}`;
  // Sin barra final: las rutas se concatenan como `${base}/api/...`.
  return raw.replace(/\/+$/, "");
}

export const API_BASE_URL = resolveBaseUrl();

/** Prefijo común de todos los endpoints REST. */
export const API_PREFIX = "/api";

/** Cuánto esperamos a una respuesta antes de darla por perdida. */
export const REQUEST_TIMEOUT_MS = 12_000;
