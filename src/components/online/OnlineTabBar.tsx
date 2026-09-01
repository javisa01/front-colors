import { memo, useCallback, useEffect, useState, type ReactElement } from "react";
import {
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { UnreadDot } from "@/components/online/UnreadDot";
import { Icon, type IconName } from "@/design/Icon";
import { useColors, useThemedStyles } from "@/design/theme";
import {
  Duration,
  Elevation,
  HIT_TARGET,
  Motion,
  Radius,
  SECTION_TONE,
  Space,
  Type,
  type Palette,
  type SpectrumTone,
} from "@/design/tokens";
import { t, type TranslationKey } from "@/i18n";
import { useSocial } from "@/online/social";
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
  /**
   * El pigmento de la sección. Sale de `SECTION_TONE`, no se escribe aquí: el
   * mismo tono tiñe los botones de esa sección, y con el valor copiado las dos
   * cosas se separarían en cuanto alguien retocase una.
   */
  tone: SpectrumTone;
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
  {
    name: "index",
    icon: "target",
    labelKey: "online.tabs.today",
    tone: SECTION_TONE.today,
  },
  {
    name: "groups/index",
    icon: "users",
    labelKey: "online.tabs.groups",
    tone: SECTION_TONE.groups,
  },
  {
    name: "leaderboard",
    icon: "trophy",
    labelKey: "online.tabs.ranking",
    tone: SECTION_TONE.ranking,
  },
  {
    name: "profile",
    icon: "user",
    labelKey: "online.tabs.profile",
    tone: SECTION_TONE.account,
  },
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

/** Dónde está y cuánto mide una pestaña, medido por `onLayout`. */
interface TabBox {
  x: number;
  width: number;
}

function OnlineTabBarBase({
  state,
  navigation,
  insets,
}: TabBarProps): ReactElement | null {
  const styles = useThemedStyles(tabBarStyles);
  const colors = useColors();

  const activeName = state.routes[state.index]?.name;
  const activeIndex = TABS.findIndex((tab) => tab.name === activeName);

  /**
   * Las solicitudes de amistad sin responder, que salen como punto rojo sobre
   * el icono del perfil.
   *
   * Se vuelve a preguntar al cambiar de pestaña, no en un temporizador: es el
   * momento en que alguien está mirando la barra, y `refresh` trae su propio
   * intervalo mínimo para que cuatro toques seguidos no sean cuatro peticiones.
   */
  const { incoming, refresh } = useSocial();

  useEffect(() => {
    refresh();
  }, [activeName, refresh]);

  /**
   * La pastilla activa se mide, no se calcula.
   *
   * Las cuatro pestañas **no miden lo mismo**: solo la activa escribe su
   * etiqueta, así que es bastante más ancha que las otras tres. Repartir el
   * ancho a partes iguales dejaría el relleno descuadrado respecto al icono que
   * envuelve, y con las etiquetas traducidas —«Ranking», «Classement»— el
   * descuadre cambia además con el idioma. Medir es lo único que aguanta las
   * tres traducciones sin tocar nada.
   */
  const [boxes, setBoxes] = useState<Record<string, TabBox>>({});

  const measure = useCallback((name: string, box: TabBox) => {
    setBoxes((previous) => {
      const old = previous[name];
      // `onLayout` se dispara en cada repintado; sin esta comparación, el
      // `setState` incondicional es un bucle de renders.
      if (
        old != null &&
        Math.abs(old.x - box.x) < 1 &&
        Math.abs(old.width - box.width) < 1
      ) {
        return previous;
      }
      return { ...previous, [name]: box };
    });
  }, []);

  const slot = activeIndex >= 0 ? boxes[TABS[activeIndex].name] : undefined;

  const x = useSharedValue(0);
  const width = useSharedValue(0);
  /**
   * En qué punto del espectro está el relleno. Es un número real, no el índice
   * entero: mientras la pastilla viaja de «grupos» a «perfil» pasa por los tonos
   * intermedios en vez de cambiar de golpe al llegar.
   */
  const hue = useSharedValue(Math.max(0, activeIndex));

  useEffect(() => {
    if (slot == null) {
      return;
    }
    // La primera colocación es un salto, no un viaje: sin esto la pastilla
    // entra deslizándose desde el borde izquierdo cada vez que se abre el modo
    // online, como si acabases de cambiar de pestaña sin haberla tocado.
    if (width.get() === 0) {
      x.set(slot.x);
      width.set(slot.width);
      return;
    }
    x.set(withSpring(slot.x, Motion.spring));
    width.set(withSpring(slot.width, Motion.spring));
  }, [slot, width, x]);

  useEffect(() => {
    if (activeIndex >= 0) {
      hue.set(withTiming(activeIndex, { duration: Duration.base }));
    }
  }, [activeIndex, hue]);

  const pigments = TABS.map((tab) => colors.spectrum[tab.tone].pigment);
  const stops = TABS.map((_, index) => index);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: width.get(),
    transform: [{ translateX: x.get() }],
    backgroundColor: interpolateColor(hue.get(), stops, pigments),
    // Antes de la primera medida no hay nada que enseñar: una pastilla de ancho
    // cero se vería como una raya en el borde izquierdo.
    opacity: width.get() > 0 ? 1 : 0,
  }));

  // Ruta profunda: no hay barra. Ver la nota de arriba. Va después de los
  // ganchos a propósito: React exige que se llamen siempre, y en el mismo orden.
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
        {/*
          El carril no lleva relleno propio, y eso es justo lo que permite que
          el indicador cuadre: la `x` que devuelve `onLayout` de cada pestaña y
          el `translateX` del indicador se miden desde el mismo origen. Con el
          relleno en este mismo nodo, las dos referencias se separan por el
          ancho del relleno y la pastilla queda descolocada.
        */}
        <View style={styles.track}>
          <Animated.View
            pointerEvents="none"
            style={[styles.indicator, indicatorStyle]}
          />

          {TABS.map((tab) => (
            <Tab
              key={tab.name}
              tab={tab}
              focused={activeName === tab.name}
              styles={styles}
              ink={colors.spectrum[tab.tone].ink}
              muted={colors.text.muted}
              badge={tab.name === "profile" ? incoming : 0}
              onMeasure={measure}
              onPress={() => {
                selectionTick();
                playTick();

                const event = navigation.emit({
                  type: "tabPress",
                  target: state.routes.find(
                    (route: { key: string; name: string }) =>
                      route.name === tab.name,
                  )?.key,
                  canPreventDefault: true,
                });

                if (activeName !== tab.name && !event.defaultPrevented) {
                  navigation.navigate(tab.name);
                }
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

export const OnlineTabBar = memo(OnlineTabBarBase);

/**
 * Una pestaña.
 *
 * El icono va **dos veces, superpuestas**: el apagado debajo y el entintado
 * encima, y lo que cambia es la opacidad del de encima. No es un capricho: el
 * color de un icono es una prop de SVG, así que no se puede interpolar en el
 * hilo de UI como se interpola el relleno de la pastilla. Cambiándolo de golpe
 * se veía el icono oscuro sobre el hueco todavía translúcido durante el cuarto
 * de segundo que la pastilla tarda en llegar. Con dos capas, el entintado
 * aparece al ritmo al que llega el relleno que lo hace legible.
 */
function Tab({
  tab,
  focused,
  styles,
  ink,
  muted,
  badge,
  onMeasure,
  onPress,
}: {
  tab: TabDef;
  focused: boolean;
  styles: ReturnType<typeof useThemedStyles<ReturnType<typeof tabBarStyles>>>;
  ink: string;
  muted: string;
  /** Cuántas cosas te esperan dentro. Cero, ninguna. */
  badge: number;
  onMeasure: (name: string, box: TabBox) => void;
  onPress: () => void;
}): ReactElement {
  const label = t(tab.labelKey);
  const lit = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    lit.set(withTiming(focused ? 1 : 0, { duration: Duration.base }));
  }, [focused, lit]);

  const inkStyle = useAnimatedStyle(() => ({ opacity: lit.get() }));

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      onMeasure(tab.name, { x, width });
    },
    [onMeasure, tab.name],
  );

  return (
    <Pressable
      onPress={onPress}
      onLayout={handleLayout}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      /*
        El punto va dentro de la pestaña, y una pestaña se anuncia entera: si
        lo que significa no entra en esta etiqueta, no se oye.
      */
      accessibilityLabel={
        badge > 0
          ? `${label}. ${
              badge === 1
                ? t("online.friends.pendingOneA11y")
                : t("online.friends.pendingA11y", { count: badge })
            }`
          : label
      }
    >
      <View style={styles.iconStack}>
        <Icon name={tab.icon} size={20} color={muted} />
        <Animated.View style={[styles.iconInk, inkStyle]}>
          <Icon name={tab.icon} size={20} color={ink} />
        </Animated.View>
        {/*
          El mismo punto rojo que la lista de grupos y la entrada al chat.
          Tercer sitio, mismo significado: hay algo que no has visto. Aquí sí
          lleva la cifra cuando son varias, porque desde la barra no hay
          ninguna otra forma de saber cuántas son.
        */}
        <View style={styles.badge} pointerEvents="none">
          <UnreadDot count={badge} label={null} />
        </View>
      </View>

      {/*
        La etiqueta solo aparece en la activa. Con las cuatro escritas, la
        pastilla se come el ancho de la pantalla y hay que encoger el texto
        hasta que no se lee; con una sola, la pestaña activa se nombra a sí
        misma y las otras tres se reconocen por el icono, que es como funciona
        una barra de este tamaño.
      */}
      {focused ? (
        <Text
          style={[Type.caption, styles.label, { color: ink }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const tabBarStyles = (colors: Palette) => ({
  dock: {
    // Flota: no ocupa sitio en la disposición, así que el contenido y el fondo
    // ambiental de la pantalla siguen pasando por debajo.
    position: "absolute" as const,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center" as const,
    paddingTop: Space.sm,
    // Sin relleno propio a propósito: la franja opaca era justo el problema.
    backgroundColor: "transparent",
  },
  pill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    padding: Space.xs + 2,
    borderRadius: Radius.pill,
    // Translúcida, no opaca: ver `surface.floating`.
    backgroundColor: colors.surface.floating,
    borderWidth: 1,
    borderColor: colors.border.default,
    // La sombra es lo que separa la pastilla del contenido que pasa por
    // debajo. Sin ella, al cruzar una tarjeta clara, las dos se funden.
    ...Elevation.overlay,
  },
  track: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: Space.xxs,
  },
  /**
   * El relleno de la pestaña activa. Es **uno solo** para las cuatro, y por eso
   * puede viajar: cuatro rellenos que se encienden y se apagan no dicen que las
   * pestañas sean un conjunto; uno que se mueve entre ellas, sí.
   */
  indicator: {
    position: "absolute" as const,
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: Radius.pill,
  },
  tab: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: Space.sm,
    minHeight: HIT_TARGET - 6,
    paddingHorizontal: Space.lg,
    borderRadius: Radius.pill,
  },
  iconStack: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  badge: {
    position: "absolute" as const,
    // Colgado de la esquina del icono, no dentro: el dibujo mide 20 puntos y
    // un punto metido en ese cuadrado taparía justo la cabeza del muñeco.
    top: -6,
    right: -9,
  },
  iconInk: {
    position: "absolute" as const,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  label: {
    fontWeight: "600" as const,
  },
});
