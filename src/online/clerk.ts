import Constants from "expo-constants";

/**
 * Configuración de Clerk en el cliente.
 *
 * La clave publicable NO es un secreto (viaja en el bundle y en cada petición
 * a Clerk), por eso puede resolverse igual que `API_BASE_URL`: primero la
 * variable de entorno pública y, si no está, `expo.extra` de `app.json`.
 *
 * A diferencia del scaffold por defecto de Clerk, aquí no se lanza una
 * excepción al importar el módulo: reventar en el arranque dejaría la app
 * inservible también en modo offline, que no necesita cuenta para nada. Sin
 * clave, la pantalla online enseña un aviso y el resto del juego sigue vivo.
 */

function fromEnv(): string | null {
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return typeof key === "string" && key.length > 0 ? key : null;
}

function fromAppConfig(): string | null {
  const extra = Constants.expoConfig?.extra as
    | { clerkPublishableKey?: unknown }
    | undefined;
  return typeof extra?.clerkPublishableKey === "string" &&
    extra.clerkPublishableKey.length > 0
    ? extra.clerkPublishableKey
    : null;
}

export const CLERK_PUBLISHABLE_KEY = fromEnv() ?? fromAppConfig();
