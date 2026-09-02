import {
  createContext,
  memo,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { StyleSheet } from "react-native";

import { Color, type Palette } from "@/design/tokens";

/**
 * El interruptor de tema.
 *
 * ## Qué hay hecho y qué falta
 *
 * Hecho: existen **dos paletas completas** con la misma forma —la oscura son
 * los tokens de siempre, la clara está aquí abajo—, un proveedor que reparte
 * una de las dos, y `useThemedStyles`, que construye una hoja de estilos por
 * paleta y la memoriza. Cambiar de tema en caliente ya funciona en todo lo que
 * pase por esos dos ganchos.
 *
 * Falta: **migrar el resto de las hojas de estilo**. Hoy casi toda la app llama
 * a `StyleSheet.create` en el ámbito del módulo leyendo `Color`, y eso se
 * evalúa una sola vez al importar: por muy bien que cambie la paleta, esos
 * estilos ya están congelados en oscuro. La migración es mecánica y va fichero
 * a fichero —`StyleSheet.create({...})` pasa a `useThemedStyles((c) => ({...}))`
 * y `Color.x` a `c.x`—, así que se puede hacer en tandas sin romper nada: lo ya
 * migrado responde al tema y lo demás se queda en oscuro, que es exactamente lo
 * que se ve hoy.
 *
 * Migrados ya, como prueba de que la infraestructura aguanta: `Button` y la
 * barra de pestañas del modo online, que son los dos sitios donde el cambio de
 * tema se nota más.
 *
 * ## Por qué no hay interruptor visible todavía
 *
 * Porque no se ha pedido uno. `mode` entra por props y su valor por defecto es
 * `"dark"`, así que la app se ve hoy exactamente igual que antes. Cuando toque
 * añadirlo, son tres cosas: guardar la preferencia en `utils/storage`, pasarla
 * como `mode` al proveedor del layout raíz, y llamar a `setMode` desde la hoja
 * de ajustes. Para seguir al sistema en vez de a una preferencia, el gancho es
 * `useColorScheme()` de `react-native` alimentando ese mismo `mode`.
 */

export type ThemeMode = "dark" | "light";

// ---------------------------------------------------------------------------
// Paleta clara
// ---------------------------------------------------------------------------

/**
 * El modo claro **no es la paleta oscura invertida**, y por eso está escrita a
 * mano en lugar de calculada.
 *
 * Dos decisiones que no salen de invertir nada:
 *
 *  1. **El lienzo no es blanco puro.** Es un gris muy claro, y las tarjetas sí
 *     son blancas. Al revés —lienzo blanco y tarjetas grises— las tarjetas se
 *     leen como zonas desactivadas, y además el blanco puro a pantalla completa
 *     apaga cualquier muestra de color que se ponga encima, que es justo lo que
 *     esta app no se puede permitir.
 *
 *  2. **El pigmento se invierte de papel.** En oscuro es un tono claro con
 *     tinta casi negra encima; sobre papel ese mismo tono claro no se
 *     despegaría del fondo, así que aquí el pigmento baja a un tono profundo y
 *     la tinta pasa a ser blanca. Los seis mantienen 4,5:1 o más contra su
 *     tinta, medidos uno a uno.
 */
export const lightPalette: Palette = {
  surface: {
    canvas: "#F4F4F6",
    sunken: "#E9E9ED",
    raised: "#FFFFFF",
    // En claro la separación entre una tarjeta y un modal no la puede dar el
    // relleno —los dos son blancos sobre papel gris—, la da la sombra.
    elevated: "#FFFFFF",
    interactive: "#E7E7EC",
    floating: "rgba(255,255,255,0.86)",
  },
  border: {
    subtle: "#EDEDF1",
    default: "#DEDEE4",
    strong: "#C6C6D0",
  },
  text: {
    // Negro roto, por el mismo motivo que el blanco de la paleta oscura no es
    // #FFFFFF: el contraste máximo vibra y cansa en un párrafo.
    primary: "#16161A",
    secondary: "#55555F",
    muted: "#7C7C88",
    faint: "#ADADB8",
    inverse: "#FFFFFF",
  },
  accent: {
    default: "#5B4EDB",
    hover: "#6D60E8",
    pressed: "#4A3DC4",
    surface: "#F0EEFD",
    border: "#D5CFF7",
    text: "#4A3DC4",
  },
  ambient: {
    violet: ["#8E80F0", "#B9AEF8"],
    rose: ["#E38AB4", "#F2C2D6"],
    ringCool: "#8E80F0",
    ringWarm: "#E38AB4",
  },
  spectrum: {
    violet: {
      surface: "#F0EEFD",
      border: "#D5CFF7",
      icon: "#5B4EDB",
      pigment: "#5B4EDB",
      pigmentPressed: "#4A3DC4",
      ink: "#FFFFFF",
    },
    blue: {
      surface: "#EAF2FD",
      border: "#C3DBF6",
      icon: "#1F6FD0",
      pigment: "#1F6FD0",
      pigmentPressed: "#185CB2",
      ink: "#FFFFFF",
    },
    teal: {
      surface: "#E6F6F3",
      border: "#B4E2DA",
      icon: "#0B7A6D",
      pigment: "#0B7A6D",
      pigmentPressed: "#086459",
      ink: "#FFFFFF",
    },
    green: {
      surface: "#EAF7F0",
      border: "#B9E3CE",
      icon: "#17864F",
      pigment: "#17864F",
      pigmentPressed: "#106E40",
      ink: "#FFFFFF",
    },
    amber: {
      surface: "#FCF3E3",
      border: "#EDD6A6",
      icon: "#9A6708",
      pigment: "#9A6708",
      pigmentPressed: "#7F5406",
      ink: "#FFFFFF",
    },
    rose: {
      surface: "#FDECF2",
      border: "#F5C4D6",
      icon: "#C0356E",
      pigment: "#C0356E",
      pigmentPressed: "#A32B5C",
      ink: "#FFFFFF",
    },
    orange: {
      surface: "#FDEFE3",
      border: "#F2CFA9",
      icon: "#9C4E0A",
      pigment: "#9C4E0A",
      pigmentPressed: "#823F06",
      ink: "#FFFFFF",
    },
    lime: {
      surface: "#F1F6E0",
      border: "#D2E0A4",
      icon: "#5A6E0C",
      pigment: "#5A6E0C",
      pigmentPressed: "#485907",
      ink: "#FFFFFF",
    },
  },
  /*
    En claro el mismo cálculo con la luminosidad invertida: papel muy claro
    teñido, borde un paso por debajo y la marca bajada hasta que contrasta contra
    el papel. Los seis siguen a la misma luminosidad entre ellos —dispersión
    1,05— y ninguno baja de 4:1 contra su propia marca.
  */
  groupTint: {
    carmin: { wash: "#F5E7E1", edge: "#DDCBC0", mark: "#7D6351" },
    ambar: { wash: "#EAEAC4", edge: "#D1CE9A", mark: "#706711" },
    jade: { wash: "#D8EEE1", edge: "#B9D3BF", mark: "#516D50" },
    azul: { wash: "#DBEEFF", edge: "#BDD2FA", mark: "#586C95" },
    indigo: { wash: "#EBEAFF", edge: "#D1CEFF", mark: "#7266BD" },
    ciruela: { wash: "#F3E8FF", edge: "#DBCBFA", mark: "#7A6495" },
  },
  podium: {
    gold: { fill: "#FDF4E0", border: "#EBD49A", text: "#8A5A0B" },
    silver: { fill: "#F1F2F5", border: "#D3D6DE", text: "#5A5D68" },
    bronze: { fill: "#F9EDE3", border: "#E3C4A8", text: "#8A5227" },
  },
  glow: {
    blue: "#3B6FE8",
    violet: "#6A5CE8",
    magenta: "#C93D8B",
    stops: ["#3B6FE8", "#6A5CE8", "#C93D8B", "#6A5CE8", "#3B6FE8"],
  },
  ember: {
    outer: "#E85A0A",
    inner: "#E09010",
    core: "#8A4A00",
    text: "#B4610A",
    surface: "#FDF2E4",
    border: "#F0D2A8",
    dimOuter: "#D4D4DC",
    dimInner: "#E4E4EA",
  },
  success: {
    default: "#17915A",
    surface: "#EAF7F0",
    border: "#B9E3CE",
    text: "#0F6A45",
  },
  warning: {
    default: "#B87A14",
    surface: "#FCF3E3",
    border: "#EDD6A6",
    text: "#8A5A0B",
  },
  danger: {
    default: "#C63B33",
    surface: "#FDEDEC",
    border: "#F3C7C4",
    text: "#A32E27",
  },
};

/** La oscura es la de siempre: los tokens sin tocar. */
export const darkPalette: Palette = Color as Palette;

const PALETTES: Record<ThemeMode, Palette> = {
  dark: darkPalette,
  light: lightPalette,
};

// ---------------------------------------------------------------------------
// Proveedor
// ---------------------------------------------------------------------------

interface ThemeValue {
  mode: ThemeMode;
  colors: Palette;
  setMode: (mode: ThemeMode) => void;
}

/**
 * El valor por defecto es el tema oscuro **funcionando**, no un hueco.
 *
 * Así un componente migrado a `useThemedStyles` sigue pintando bien aunque
 * nadie haya montado el proveedor todavía —en un test, en una pantalla suelta,
 * o mientras la migración esté a medias—. Un contexto que revienta sin
 * proveedor obligaría a montarlo en sitios donde el tema no importa.
 */
const ThemeContext = createContext<ThemeValue>({
  mode: "dark",
  colors: darkPalette,
  setMode: () => {},
});

function ThemeProviderBase({
  children,
  mode: initialMode = "dark",
}: {
  children: ReactNode;
  /** Tema inicial. Cuando exista la preferencia guardada, entra por aquí. */
  mode?: ThemeMode;
}): ReactElement {
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  const value = useMemo<ThemeValue>(
    () => ({ mode, colors: PALETTES[mode], setMode }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const ThemeProvider = memo(ThemeProviderBase);

/** Tema activo: paleta, modo y el interruptor. */
export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

/** Solo la paleta. El 90 % de los usos. */
export function useColors(): Palette {
  return useContext(ThemeContext).colors;
}

/**
 * Una hoja de estilos por paleta, construida una sola vez por tema.
 *
 * Es el reemplazo de `StyleSheet.create` en el ámbito del módulo. La fábrica
 * recibe la paleta activa y devuelve el mismo objeto de siempre; `useMemo` se
 * encarga de que no se reconstruya en cada render, y de que sí se reconstruya
 * al cambiar de tema.
 *
 * La fábrica tiene que ser **estable** —definida fuera del componente— o el
 * `useMemo` no sirve de nada. En la práctica siempre lo es: una hoja de estilos
 * no depende de props.
 */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: Palette) => T,
): T {
  const colors = useColors();
  return useMemo(() => StyleSheet.create(factory(colors)), [colors, factory]);
}
