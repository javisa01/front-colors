import AsyncStorage from "@react-native-async-storage/async-storage";

import type { PrivateProfile } from "@/api/types";

/**
 * Caché del perfil online.
 *
 * Aquí YA NO se guardan tokens: la sesión de Clerk vive en su propio
 * `tokenCache`, respaldado por `expo-secure-store`. Lo único que se persiste
 * es el último perfil conocido (nombre, XP, nivel) para poder pintar el hub sin
 * esperar a la red al abrir la app.
 *
 * Namespace propio (`...:online:`), separado del de `utils/storage.ts`: el modo
 * offline no lee ni escribe estas claves, y borrar la sesión no toca récords ni
 * partidas guardadas.
 */
const PREFIX = "colorquest:v1:online:";

const KEYS = {
  user: `${PREFIX}user`,
} as const;

/**
 * El perfil se guarda junto al id de Clerk de su dueño. Sin esa etiqueta, tras
 * cambiar de cuenta en el mismo dispositivo se pintaría un instante el perfil
 * del usuario anterior.
 */
interface CachedProfile {
  clerkUserId: string;
  profile: PrivateProfile;
}

function isCached(value: unknown): value is CachedProfile {
  const cached = value as CachedProfile | null;
  return (
    !!cached &&
    typeof cached.clerkUserId === "string" &&
    !!cached.profile &&
    typeof cached.profile.id === "string" &&
    typeof cached.profile.username === "string"
  );
}

export async function loadUser(clerkUserId: string): Promise<PrivateProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.user);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!isCached(parsed) || parsed.clerkUserId !== clerkUserId) {
      return null;
    }
    return parsed.profile;
  } catch {
    return null;
  }
}

export async function saveUser(
  clerkUserId: string,
  profile: PrivateProfile,
): Promise<void> {
  try {
    const cached: CachedProfile = { clerkUserId, profile };
    await AsyncStorage.setItem(KEYS.user, JSON.stringify(cached));
  } catch {
    // Mejor esfuerzo: si el disco falla, el perfil sigue vivo en memoria.
  }
}

export async function clearUser(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.user);
  } catch {
    // ignore
  }
}
