import { Platform, type TextStyle, type ViewStyle } from "react-native";

/**
 * Design tokens — la única fuente de verdad visual de la app.
 *
 * Regla: ningún componente escribe un color, un radio, un espaciado ni un
 * tamaño de fuente a pelo. Si algo no se puede expresar con estos tokens, el
 * token que falta se añade aquí, no se improvisa en la hoja de estilos.
 *
 * Dirección: editorial oscuro. La interfaz es casi acromática a propósito para
 * que lo único saturado en pantalla sea el color del juego — el logo del reto y
 * las muestras de color son el objeto más brillante de cualquier pantalla.
 */

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

/**
 * Rampa de superficies. Los saltos entre niveles son deliberadamente pequeños
 * (4-6% de luminancia): la profundidad la da el borde hairline, no el contraste
 * de relleno. Subir estos valores hace que la app parezca de plástico.
 */
const surface = {
  /** Lienzo de la aplicación. Nada va por detrás de esto. */
  canvas: "#0A0A0B",
  /** Pozo: campos de texto, raíles de progreso, huecos hundidos. */
  sunken: "#060607",
  /** Superficie por defecto: tarjetas, filas, barras. */
  raised: "#131315",
  /** Superficie elevada: modales, sheets, popovers. */
  elevated: "#1B1B1E",
  /** Estado hover/press sobre una superficie elevada. */
  interactive: "#232327",
} as const;

const border = {
  /** Separadores internos, divisores dentro de una tarjeta. */
  subtle: "#1F1F23",
  /** Borde por defecto de cualquier superficie. */
  default: "#2A2A2F",
  /** Borde de un elemento enfocado o seleccionado. */
  strong: "#3A3A41",
} as const;

const text = {
  /** Títulos y cifras. Blanco roto, nunca #FFFFFF puro: quema sobre casi negro. */
  primary: "#F4F4F5",
  /** Cuerpo de texto, descripciones. */
  secondary: "#A3A3AC",
  /** Metadatos, pistas, texto de apoyo. */
  muted: "#71717A",
  /** Texto desactivado o decorativo. Nunca para información necesaria. */
  faint: "#4B4B53",
  /** Texto sobre una superficie clara (botón primario). */
  inverse: "#0A0A0B",
} as const;

/**
 * Acento cromático único. Se usa con avaricia: progreso, foco, selección y
 * enlaces. No se usa para rellenar botones ni para decorar — el botón primario
 * es claro sobre oscuro precisamente para no gastar el acento en él.
 */
const accent = {
  default: "#7A6FF0",
  hover: "#8C82F3",
  pressed: "#6559E2",
  /** Relleno tenue tras un elemento acentuado (pastilla activa, banner). */
  surface: "#17162B",
  /** Borde de un elemento acentuado. */
  border: "#302B57",
  /** Texto acentuado legible sobre superficie oscura. */
  text: "#ADA5F7",
} as const;

/**
 * Colores semánticos. Cada uno trae relleno, borde y texto para que un estado
 * se pinte igual en toda la app sin recalcular tonos a ojo.
 */
const semantic = {
  success: {
    default: "#3FBF7F",
    surface: "#0A1F16",
    border: "#1C4632",
    text: "#6EDCA4",
  },
  warning: {
    default: "#E0A83C",
    surface: "#231A08",
    border: "#4A3616",
    text: "#F0C673",
  },
  danger: {
    default: "#E05A52",
    surface: "#231110",
    border: "#4C2321",
    text: "#F08C86",
  },
} as const;

/**
 * Paleta de categorización.
 *
 * Seis tonos para distinguir elementos de una misma lista —los modos de juego,
 * las secciones del área online— tiñendo únicamente su icono. No es decoración:
 * en una lista de ocho modos, el color es lo que permite reconocer el que
 * buscas antes de haber leído el título, y el mismo modo lleva siempre el mismo
 * tono en toda la aplicación.
 *
 * Tres de los seis reutilizan las rampas semánticas en lugar de inventar tonos
 * nuevos, y todos van a la misma luminosidad para que ninguno pese más que otro:
 * si uno destacase, la lista tendría un favorito sin motivo.
 *
 * Se tiñe el icono y su cuadro, nunca el fondo de la fila entera: ocho rellenos
 * de colores distintos apilados es exactamente el aspecto que hay que evitar.
 */
const spectrum = {
  violet: {
    surface: accent.surface,
    border: accent.border,
    icon: accent.text,
  },
  blue: { surface: "#0D1B2A", border: "#1E3A55", icon: "#7FB6F0" },
  teal: { surface: "#0A2020", border: "#17423E", icon: "#6FD3C8" },
  green: {
    surface: semantic.success.surface,
    border: semantic.success.border,
    icon: semantic.success.text,
  },
  amber: {
    surface: semantic.warning.surface,
    border: semantic.warning.border,
    icon: semantic.warning.text,
  },
  rose: { surface: "#24101A", border: "#4C2233", icon: "#F09AB8" },
} as const;

export type SpectrumTone = keyof typeof spectrum;

/**
 * Capa ambiental: los dos orbes que respiran detrás de la portada.
 *
 * Es el único color decorativo de toda la aplicación, y por eso vive apartado
 * del resto de la paleta — nada que no sea el fondo de la portada debe tirar de
 * aquí. Los tonos son primos del acento en lugar del azul y el rosa saturados
 * de antes: al 50 % de opacidad sobre un lienzo casi negro, aquellos teñían el
 * blanco del texto y competían con el color del propio juego.
 */
const ambient = {
  violet: ["#6B5FD6", "#3B317F"] as const,
  rose: ["#8E3A63", "#4A1F38"] as const,
  /**
   * Trazo y relleno de los círculos sueltos que decoran las pantallas de
   * resultado en grupo. Son los mismos dos tonos de arriba: el fondo de la
   * portada y el de un marcador tienen que ser reconociblemente la misma app,
   * y lo que cambia entre ellos es la forma —aros y puntos frente a manchas—,
   * no la paleta.
   */
  ringCool: "#6B5FD6",
  ringWarm: "#8E3A63",
} as const;

export const Color = {
  surface,
  border,
  text,
  accent,
  ambient,
  spectrum,
  ...semantic,
} as const;

// ---------------------------------------------------------------------------
// Espaciado
// ---------------------------------------------------------------------------

/**
 * Escala de 4pt. Todo margen, padding y hueco sale de aquí. La app tenía 13
 * valores sueltos; estos ocho cubren todos los casos reales.
 */
export const Space = {
  /** 2 — separación óptica dentro de una línea de texto. */
  xxs: 2,
  /** 4 — entre una etiqueta y su valor. */
  xs: 4,
  /** 8 — entre elementos hermanos muy relacionados. */
  sm: 8,
  /** 12 — padding interno de elementos compactos (pastillas, campos). */
  md: 12,
  /** 16 — padding interno por defecto, hueco entre tarjetas. */
  lg: 16,
  /** 20 — margen horizontal de pantalla. */
  xl: 20,
  /** 24 — padding de superficies grandes, separación entre bloques. */
  xxl: 24,
  /** 32 — separación entre secciones. */
  xxxl: 32,
  /** 48 — respiro de cabecera, estados vacíos. */
  huge: 48,
} as const;

// ---------------------------------------------------------------------------
// Radio
// ---------------------------------------------------------------------------

/**
 * Cinco radios, no trece. Un radio comunica el tamaño del elemento: cuanto
 * mayor la superficie, mayor el radio, siempre en esta escala.
 */
export const Radius = {
  /** 8 — pastillas pequeñas, swatches, checkboxes. */
  sm: 8,
  /** 12 — campos de texto, botones compactos, iconos cuadrados. */
  md: 12,
  /** 16 — botones, tarjetas, filas. */
  lg: 16,
  /** 20 — modales, sheets, superficies grandes. */
  xl: 20,
  /** Cápsula. */
  pill: 999,
} as const;

// ---------------------------------------------------------------------------
// Tipografía
// ---------------------------------------------------------------------------

/**
 * La app referenciaba `Inter_700Bold` y compañía en 14 estilos, pero nunca
 * llamaba a `expo-font`: esas familias no existían en runtime y React Native
 * caía silenciosamente a la fuente del sistema. En vez de mantener la ficción,
 * usamos la fuente de plataforma de forma explícita y dejamos la jerarquía en
 * manos del peso y del tamaño.
 *
 * Para adoptar Inter más adelante: instalar `@expo-google-fonts/inter`,
 * cargarla con `useFonts` en el layout raíz y poner su nombre aquí. Es el único
 * sitio que hay que tocar.
 */
const FONT_FAMILY: string | undefined = undefined;

/** Cifras de ancho fijo: marcadores y temporizadores no deben bailar. */
const TABULAR: TextStyle = { fontVariant: ["tabular-nums"] };

type TypeToken = TextStyle;

/**
 * Seis escalones con saltos claros. Si dos textos deben verse distintos, se
 * eligen escalones no contiguos; nunca se inventa un tamaño intermedio.
 */
export const Type = {
  /** 34 — título principal de una pantalla. Uno por pantalla, como mucho. */
  display: {
    fontFamily: FONT_FAMILY,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: text.primary,
  },
  /** 24 — título de modal o de bloque destacado. */
  title: {
    fontFamily: FONT_FAMILY,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: text.primary,
  },
  /** 18 — título de tarjeta o de fila. */
  heading: {
    fontFamily: FONT_FAMILY,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: text.primary,
  },
  /** 15 — cuerpo de texto por defecto. */
  body: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400",
    color: text.secondary,
  },
  /** 15 con peso — cuerpo que necesita énfasis sin cambiar de tamaño. */
  bodyStrong: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: text.primary,
  },
  /** 13 — metadatos, pistas, descripciones secundarias. */
  caption: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
    color: text.muted,
  },
  /** 11 en versalitas — kickers y encabezados de sección. */
  label: {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: text.muted,
  },
  /** 16 — texto de botón. Un único tamaño para todos los botones de la app. */
  button: {
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: -0.1,
    color: text.primary,
  },
  /** 44 — la puntuación en el modal de resultado. Cifra protagonista. */
  metricHero: {
    fontFamily: FONT_FAMILY,
    fontSize: 44,
    lineHeight: 50,
    fontWeight: "700",
    letterSpacing: -1.2,
    color: text.primary,
    ...TABULAR,
  },
  /** 20 — cifras de estadística y temporizadores. */
  metric: {
    fontFamily: FONT_FAMILY,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: text.primary,
    ...TABULAR,
  },
  /** 13 — valores hexadecimales y deltas numéricos. */
  metricSmall: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: text.secondary,
    ...TABULAR,
  },
} satisfies Record<string, TypeToken>;

// ---------------------------------------------------------------------------
// Elevación
// ---------------------------------------------------------------------------

/**
 * Dos niveles y basta. En una interfaz casi negra una sombra fuerte se lee como
 * suciedad, no como profundidad: lo que separa las capas es el borde hairline.
 */
export const Elevation = {
  /** Tarjetas y filas: apenas un asentamiento. */
  raised: {
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  /** Modales y sheets: la única sombra que se debe notar. */
  overlay: {
    shadowColor: "#000000",
    shadowOpacity: 0.5,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 16,
  },
} satisfies Record<string, ViewStyle>;

// ---------------------------------------------------------------------------
// Movimiento
// ---------------------------------------------------------------------------

/**
 * Duraciones. La regla es que una microinteracción no debe poder percibirse
 * como "una animación": debe sentirse como que el elemento respondió.
 */
export const Duration = {
  /** 120 — respuesta táctil: compresión de un botón. */
  instant: 120,
  /** 180 — cambio de estado: color, opacidad, selección. */
  fast: 180,
  /** 260 — entrada y salida de un elemento. */
  base: 260,
  /** 380 — transición de superficie grande: modal, sheet. */
  slow: 380,
} as const;

/**
 * Curvas. `standard` para casi todo; `decelerate` para lo que entra; `spring`
 * para lo que el dedo mueve, porque necesita sentirse físico.
 */
export const Motion = {
  /** Movimiento neutro: empieza y acaba suave. */
  standard: [0.4, 0.0, 0.2, 1] as const,
  /** Entradas: llega rápido y frena. */
  decelerate: [0.0, 0.0, 0.2, 1] as const,
  /** Salidas: arranca suave y se va rápido. */
  accelerate: [0.4, 0.0, 1, 1] as const,
  /** Muelle para elementos arrastrados o soltados. Sin rebote visible. */
  spring: { damping: 26, stiffness: 260, mass: 0.9 } as const,
  /** Muelle más blando para superficies grandes (sheets). */
  springSoft: { damping: 30, stiffness: 180, mass: 1 } as const,
} as const;

// ---------------------------------------------------------------------------
// Reglas de interacción
// ---------------------------------------------------------------------------

/**
 * Área táctil mínima. Un icono de 20px vive dentro de un objetivo de 44px:
 * el tamaño del dibujo y el tamaño del objetivo son cosas distintas.
 */
export const HIT_TARGET = 44;

/** `hitSlop` estándar para cualquier elemento pulsable pequeño. */
export const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;

/** Opacidad de un elemento desactivado. Un único valor en toda la app. */
export const DISABLED_OPACITY = 0.4;

/** Ancho máximo de contenido: el texto no debe cruzar una tablet de lado a lado. */
export const CONTENT_MAX_WIDTH = 640;

/** Umbral de tablet. Un único punto de corte, usado igual en cada pantalla. */
export const TABLET_BREAKPOINT = 768;

/** Grosor de línea hairline. */
export const HAIRLINE = Platform.select({ ios: 0.5, default: 1 }) ?? 1;
