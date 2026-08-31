import { memo, type ReactElement } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/design/Icon";
import {
  Color,
  Elevation,
  HIT_TARGET,
  Radius,
  Space,
  Type,
} from "@/design/tokens";
import { t, type TranslationKey } from "@/i18n";
import { selectionTick } from "@/utils/haptics";
import { playTick } from "@/utils/sound";

/**
 * La barra de pestañas del modo online.
 *
 * ## Por qué existe
 *
 * El menú online tenía tres bloques de navegación —«Más», los dos atajos y
 * «Tu cuenta»— que sumaban ocho destinos permanentes disfrazados de contenido.
 * Un destino que siempre está ahí no debería costar una fila con icono,
 * título y descripción: cuesta un icono en una barra. Sacarlos de la pantalla
 * es lo que deja sitio para que el reto de hoy sea el reto de hoy.
 *
 * ## Cuatro, y por qué estos cuatro
 *
 * `Hoy` es la tarea, `Grupos` es el contenido propio, `Ranking` es la
 * comparación y `Perfil` es la cuenta. Amigos vive dentro de Perfil: es
 * gestión de la cuenta, no un destino que se visite a diario, y como quinta
 * pestaña dejaría las etiquetas sin sitio.
 *
 * ## Por qué es una barra propia y no la de serie
 *
 * Dos motivos, y los dos son de diseño y no de capricho:
 *
 *  1. **Se esconde sola.** Las pantallas profundas —el reto, la partida, la
 *     ficha de un grupo, amigos, el login— son pila, no destinos: se entra y se
 *     vuelve. Jugar el reto con una barra de pestañas debajo invita a
 *     abandonar la partida a media ronda, así que aquí se devuelve `null` en
 *     cuanto la ruta activa no es una de las cuatro raíces.
 *  2. **Flota por encima del contenido.** Es una pastilla translúcida colocada
 *     en absoluto, así que el fondo ambiental y lo que se esté leyendo siguen
 *     pasando por debajo. La primera versión ocupaba sitio en la disposición
 *     con relleno opaco, y eso dibujaba una franja negra que cortaba la
 *     pantalla por abajo y mataba el fondo.
 *
 *     El precio de flotar es que hay que reservar el hueco a mano: para eso
 *     está `useOnlineTabBarSpace`, y las cuatro pantallas raíz se lo pasan a su
 *     `Screen` como relleno inferior. Sin eso, su último elemento queda debajo
 *     de la pastilla.
 */

interface TabDef {
  /** Nombre de la ruta en el árbol de `expo-router`. */
  name: string;
  icon: IconName;
  labelKey: TranslationKey;
}

/**
 * Lo que esta barra necesita de las props que le pasa el navegador.
 *
 * Se declara aquí en vez de importar `BottomTabBarProps` a propósito.
 * `expo-router` no lo reexporta desde su raíz —solo desde
 * `expo-router/build/react-navigation/bottom-tabs`, una ruta interna del
 * paquete compilado que no está en su mapa de `exports`— y `@react-navigation`
 * no es dependencia directa del proyecto, así que las dos formas de importarlo
 * atan este fichero a un detalle que puede moverse en cualquier versión menor.
 *
 * Con cuatro campos declarados aquí la barra sigue tipada, el navegador le pasa
 * un objeto que los cumple de sobra, y el día que cambie la ruta del tipo no se
 * entera nadie.
 */
interface TabBarProps {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  navigation: {
    emit(event: {
      type: "tabPress";
      target?: string;
      canPreventDefault: true;
    }): { defaultPrevented: boolean };
    navigate(name: string): void;
  };
  /** Zonas seguras del dispositivo. Las calcula el navegador y las reparte. */
  insets: { top: number; right: number; bottom: number; left: number };
}

/**
 * El orden es el del recorrido natural: lo que hay que hacer, dónde se hace,
 * cómo vas, quién eres.
 */
const TABS: TabDef[] = [
  { name: "index", icon: "target", labelKey: "online.tabs.today" },
  { name: "groups/index", icon: "users", labelKey: "online.tabs.groups" },
  { name: "leaderboard", icon: "trophy", labelKey: "online.tabs.ranking" },
  { name: "profile", icon: "user", labelKey: "online.tabs.profile" },
];

const TAB_NAMES = new Set(TABS.map((tab) => tab.name));

/**
 * Alto de la pastilla más el aire de arriba, sin contar la zona segura.
 *
 * Sale de la suma de sus propias medidas —relleno de la pastilla, alto mínimo
 * de una pestaña y separación superior— y está aquí escrito una sola vez para
 * que el hueco que reservan las pantallas no pueda desincronizarse del alto
 * real de la barra.
 */
const PILL_BLOCK = Space.sm + (HIT_TARGET - 6) + (Space.xs + 2) * 2;

/**
 * El hueco que una pantalla con pestañas debe dejar al final de su contenido.
 *
 * Se usa como `contentStyle={{ paddingBottom: useOnlineTabBarSpace() }}` en las
 * cuatro raíces. Incluye la zona segura porque la pastilla flota sobre ella: el
 * `SafeAreaView` de `Screen` solo protege arriba y a los lados.
 */
export function useOnlineTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return PILL_BLOCK + Math.max(insets.bottom, Space.md);
}

function OnlineTabBarBase({
  state,
  navigation,
  insets,
}: TabBarProps): ReactElement | null {
  const activeName = state.routes[state.index]?.name;

  // Ruta profunda: no hay barra. Ver la nota de arriba.
  if (activeName == null || !TAB_NAMES.has(activeName)) {
    return null;
  }

  return (
    <View
      // `box-none` deja pasar el toque al contenido que hay debajo del hueco
      // que rodea a la pastilla: el contenedor ocupa todo el ancho, pero solo
      // la pastilla intercepta el dedo.
      pointerEvents="box-none"
      style={[
        styles.dock,
        // El gesto de inicio de iOS y la barra de navegación de Android viven
        // justo debajo; sin esto la pastilla queda pegada a ellos.
        { paddingBottom: Math.max(insets.bottom, Space.md) },
      ]}
    >
      <View style={styles.pill}>
        {TABS.map((tab) => {
          const focused = activeName === tab.name;
          const label = t(tab.labelKey);

          const onPress = (): void => {
            selectionTick();
            playTick();

            const event = navigation.emit({
              type: "tabPress",
              target: state.routes.find(
                (route: { key: string; name: string }) => route.name === tab.name,
              )?.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(tab.name);
            }
          };

          return (
            <Pressable
              key={tab.name}
              onPress={onPress}
              style={[styles.tab, focused && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
            >
              <Icon
                name={tab.icon}
                size={20}
                color={focused ? Color.text.inverse : Color.text.muted}
              />
              {/*
                La etiqueta solo aparece en la activa. Con las cuatro escritas,
                la pastilla se come el ancho de la pantalla y hay que encoger el
                texto hasta que no se lee; con una sola, la pestaña activa se
                nombra a sí misma y las otras tres se reconocen por el icono,
                que es como funciona una barra de este tamaño.
              */}
              {focused ? (
                <Text style={[Type.caption, styles.label]} numberOfLines={1}>
                  {label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const OnlineTabBar = memo(OnlineTabBarBase);

const styles = StyleSheet.create({
  dock: {
    // Flota: no ocupa sitio en la disposición, así que el contenido y el fondo
    // ambiental de la pantalla siguen pasando por debajo.
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingTop: Space.sm,
    // Sin relleno propio a propósito: la franja opaca era justo el problema.
    backgroundColor: "transparent",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.xxs,
    padding: Space.xs + 2,
    borderRadius: Radius.pill,
    // Translúcida, no opaca: ver `surface.floating`.
    backgroundColor: Color.surface.floating,
    borderWidth: 1,
    borderColor: Color.border.default,
    // La sombra es lo que separa la pastilla del contenido que pasa por
    // debajo. Sin ella, al cruzar una tarjeta clara, las dos se funden.
    ...Elevation.overlay,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    minHeight: HIT_TARGET - 6,
    paddingHorizontal: Space.lg,
    borderRadius: Radius.pill,
  },
  tabActive: {
    // Claro sobre oscuro, igual que el botón primario: en una interfaz casi
    // negra el contraste puro es la señal más fuerte que hay, y así la pestaña
    // activa no gasta el acento cromático.
    backgroundColor: Color.text.primary,
  },
  label: {
    color: Color.text.inverse,
    fontWeight: "600",
  },
});
