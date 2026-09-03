import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

import { useLocale } from "@/i18n";
import { registerPush, routeForNotification } from "@/online/push";
import { useSession } from "@/online/session";

/**
 * El puente entre los avisos del sistema y la app.
 *
 * No pinta nada. Vive dentro del árbol `/online` porque necesita las dos cosas
 * que solo hay ahí: el cliente autenticado (`useSession`) y el navegador de
 * expo-router.
 *
 * Hace dos cosas:
 *
 *  1. **Da de alta el teléfono** cuando hay sesión, y lo vuelve a hacer si
 *     cambia el idioma —el servidor escribe los textos, así que un idioma
 *     desactualizado significa avisos en el idioma equivocado hasta el
 *     siguiente arranque—.
 *  2. **Lleva al grupo** cuando alguien toca un aviso, esté la app abierta,
 *     en segundo plano o cerrada del todo.
 *
 * En web no hay nada que puentear: expo-notifications solo existe en Android e
 * iOS —`getLastNotificationResponse` lanza en el navegador—, así que el
 * componente se parte en dos para que en web no se monte ni un hook.
 */
export function PushBridge(): ReactElement | null {
  if (Platform.OS === "web") return null;
  return <NativePushBridge />;
}

function NativePushBridge(): ReactElement | null {
  const { api, status, user } = useSession();
  const router = useRouter();
  const locale = useLocale();

  /*
    El id, no el perfil.

    `user` es un objeto nuevo cada vez que se relee el perfil, y se relee cada
    vez que se juega —el XP cambia—. Dependiendo del objeto, cada intento del
    reto volvería a pedir el token y a dar de alta el teléfono.
  */
  const userId = user?.id ?? null;

  /*
    El alta cuelga del jugador y del idioma, no solo de "hay sesión".

    Del jugador porque cambiar de cuenta en el mismo móvil tiene que mover el
    token a la cuenta nueva: es el caso de dos personas compartiendo teléfono, y
    sin esto la segunda recibiría los avisos de la primera.

    Del idioma porque el texto lo escribe el servidor con el que se guardó al
    dar de alta. Sin esta dependencia, cambiar la app a inglés en los ajustes
    seguiría trayendo avisos en español hasta el siguiente arranque.
  */
  useEffect(() => {
    if (status !== "signedIn" || !userId) return;
    void registerPush(api);
  }, [api, status, userId, locale]);

  /*
    La respuesta ya atendida.

    `getLastNotificationResponse` devuelve la última que hubo, incluida la que
    abrió la app desde cero; sin recordar cuál se ha usado ya, volver a esta
    pantalla la volvería a atender y sacaría al jugador de donde estuviera.
  */
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "signedIn") return;

    const go = (response: Notifications.NotificationResponse): void => {
      const id = response.notification.request.identifier;
      if (handled.current === id) return;
      handled.current = id;

      const route = routeForNotification(response);
      if (route) router.navigate(route);
    };

    // El arranque en frío: tocar el aviso con la app cerrada la abre, y para
    // cuando este efecto corre la respuesta ya está esperando aquí.
    const pending = Notifications.getLastNotificationResponse();
    if (pending) go(pending);

    const subscription = Notifications.addNotificationResponseReceivedListener(go);
    return () => subscription.remove();
  }, [router, status]);

  return null;
}
