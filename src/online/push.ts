import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { Api } from "@/api/endpoints";
import { getLocale } from "@/i18n";
import { Color } from "@/design/tokens";

/**
 * ---------------------------------------------------------------------------
 * AVISOS DEL SISTEMA (los de la barra del teléfono, no los de dentro del juego)
 * ---------------------------------------------------------------------------
 * Cuatro cosas al día, y ninguna se decide aquí:
 *
 *   - hay reto nuevo (15:00),
 *   - quedan cinco horas,
 *   - queda una hora,
 *   - el grupo estrena temporada.
 *
 * **El texto lo escribe el servidor**, no este fichero. Un push llega con la
 * app cerrada —a veces con el teléfono en el bolsillo desde ayer—, así que
 * cuando Android o iOS lo pintan no hay nadie ejecutando `t()`. Por eso al dar
 * de alta el dispositivo se manda también el idioma en el que está la app: es
 * lo único que el servidor necesita para escribirlo en el idioma correcto.
 *
 * Aquí solo hay tres trabajos:
 *
 *   1. **Pedir permiso** y conseguir el *Expo push token* del dispositivo.
 *   2. **Contárselo al backend** (y darlo de baja al cerrar sesión).
 *   3. **Llevar a la pantalla que toca** cuando alguien toca el aviso.
 *
 * ## Lo que hace falta para que esto funcione de verdad
 *
 * Un **development build o una build de EAS**, no Expo Go: desde el SDK 53 los
 * avisos remotos no llegan a Expo Go en Android. En el simulador de iOS
 * tampoco: hace falta un teléfono. Es la razón de la guarda `Device.isDevice`.
 */

/**
 * El canal de Android. **Tiene que llamarse igual que `PUSH_ANDROID_CHANNEL`
 * en el backend**, que es lo que va en cada mensaje; si no coinciden, Android
 * usa el canal por defecto y se pierden la importancia y el color de aquí.
 */
const ANDROID_CHANNEL = "default";

/**
 * Qué hacer con un aviso que llega **con la app abierta**.
 *
 * Se enseña igual, y a propósito. Estos avisos son de tiempo —«queda una
 * hora»—, así que verlos mientras juegas en otro grupo sigue siendo útil; y la
 * alternativa, tragárselos en silencio, hace pensar que el sistema no funciona
 * cuando en realidad funcionaba.
 *
 * Sin sonido: si ya estás mirando la pantalla, el sonido no informa de nada
 * que el banner no diga ya.
 */
if (Platform.OS !== "web") {
  // Guardado porque corre al importar el módulo: expo-notifications no existe
  // en web y en el navegador esto es como mucho un no-op con suerte.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** El proyecto de EAS. Sin él, Expo no sabe para quién emitir el token. */
function projectId(): string | null {
  const fromEas = Constants.expoConfig?.extra?.eas as
    | { projectId?: unknown }
    | undefined;
  if (typeof fromEas?.projectId === "string" && fromEas.projectId.length > 0) {
    return fromEas.projectId;
  }
  // En algunas builds la única copia vive aquí.
  const fromEasConfig = (Constants as unknown as { easConfig?: { projectId?: unknown } })
    .easConfig;
  return typeof fromEasConfig?.projectId === "string" ? fromEasConfig.projectId : null;
}

function platform(): "ios" | "android" | "web" {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
}

/**
 * Crea el canal de Android. Es obligatorio desde Android 8: sin canal, el
 * sistema decide por su cuenta cómo enseñar el aviso.
 *
 * Se llama antes de pedir permiso a propósito, porque el canal define qué es lo
 * que se está pidiendo.
 */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: "Retos y grupos",
    // Alta y no por defecto: son avisos con hora. Con importancia normal
    // Android los agrupa y los retrasa, y «queda una hora» que llega a las
    // 15:30 es peor que no avisar.
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: Color.spectrum.teal.icon,
    vibrationPattern: [0, 250, 250, 250],
  });
}

/**
 * El token de este arranque, si se llegó a conseguir.
 *
 * Vive en el módulo y no en un estado de React porque quien lo necesita —el
 * cierre de sesión— no es un componente, y porque hay exactamente uno por
 * proceso: el sistema operativo emite un token por instalación.
 */
let registeredToken: string | null = null;

export type PushPermission = "granted" | "denied" | "unsupported";

/**
 * Pide permiso, si hace falta.
 *
 * **Solo pregunta una vez**, y no porque se lleve la cuenta: `requestPermissions`
 * sobre un permiso ya denegado no vuelve a enseñar el diálogo del sistema, así
 * que llamarlo en cada arranque es inofensivo. Quien lo denegó lo reactiva
 * desde los ajustes del teléfono, que es donde toca.
 */
export async function ensurePushPermission(): Promise<PushPermission> {
  // Ni el emulador de Android ni el simulador de iOS reciben avisos remotos.
  if (!Device.isDevice) return "unsupported";

  await ensureAndroidChannel();

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return "granted";
  // En iOS, «provisional» es un sí a medias —avisos silenciosos— y cuenta.
  if (current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return "granted";
  }
  if (!current.canAskAgain) return "denied";

  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return asked.granted ? "granted" : "denied";
}

/**
 * Da de alta este teléfono en el backend. Devuelve el token si lo consiguió.
 *
 * Se llama **en cada arranque con sesión**, no solo la primera vez: el token lo
 * emite el sistema operativo y puede rotar sin avisar a nadie. Volver a
 * mandarlo es barato —una fila que se reescribe— y es la única forma de que un
 * token rotado no deje a alguien sin avisos para siempre.
 *
 * No lanza nunca. Quedarse sin avisos es un incordio; que la app no abra porque
 * el servicio de push de Expo no contesta, no.
 */
export async function registerPush(api: Api): Promise<string | null> {
  try {
    if ((await ensurePushPermission()) !== "granted") return null;

    const id = projectId();
    if (!id) {
      console.warn("[push] sin projectId de EAS: no se puede pedir el token");
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: id,
    });

    await api.push.register({
      token,
      platform: platform(),
      // El idioma **de este teléfono**: es lo que decide en qué idioma escribe
      // el servidor los textos del aviso.
      locale: getLocale(),
    });

    registeredToken = token;
    return token;
  } catch (error) {
    console.warn("[push] no se pudo registrar el dispositivo", error);
    return null;
  }
}

/**
 * Baja al cerrar sesión.
 *
 * Sin esto, quien sale de su cuenta seguiría recibiendo en ese móvil los avisos
 * de los grupos de los que ya no ve nada. Tampoco lanza: cerrar sesión no puede
 * fallar porque el backend esté caído.
 */
export async function unregisterPush(api: Api): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;

  try {
    await api.push.unregister(token);
  } catch {
    // El servidor limpia solo los tokens muertos cuando Expo le responde
    // `DeviceNotRegistered`, así que perder esta llamada no deja basura eterna.
  }
}

// ---------------------------------------------------------------------------
// A dónde lleva tocar un aviso
// ---------------------------------------------------------------------------

/** Lo que el backend mete en `data` de cada mensaje. */
interface PushData {
  type?: unknown;
  groupId?: unknown;
}

/**
 * La ruta que corresponde a un aviso, o `null` si no lleva a ningún sitio.
 *
 * Los cuatro avisos son de un grupo, así que todos llevan a su ficha: es donde
 * se juega el reto y donde está la clasificación que acaba de reiniciarse. No
 * se lleva directamente a la pantalla de juego a propósito —abrir el reto gasta
 * uno de los dos intentos del día en la cabeza de quien lo abre sin querer—.
 */
export function routeForNotification(
  response: Notifications.NotificationResponse,
): { pathname: "/online/groups/[id]"; params: { id: string } } | null {
  const data = response.notification.request.content.data as PushData | undefined;
  const groupId = data?.groupId;
  if (typeof groupId !== "string" || groupId.length === 0) return null;

  return { pathname: "/online/groups/[id]", params: { id: groupId } };
}
