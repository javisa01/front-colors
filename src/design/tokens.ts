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
  /**
   * Superficie que flota POR ENCIMA del contenido y deja verlo pasar por
   * debajo: hoy solo la pastilla de pestañas del modo online.
   *
   * Es el único color de la rampa con alfa, y lo lleva porque su trabajo es
   * justamente ese. Con el `elevated` opaco, la barra era una franja negra que
   * cortaba la pantalla por abajo y tapaba el fondo ambiental; al 82 % se sigue
   * leyendo el icono encima —el contraste con el texto claro aguanta sobre
   * cualquier cosa que pase por debajo, porque debajo siempre hay lienzo casi
   * negro— y a la vez se ve moverse el orbe detrás.
   */
  floating: "rgba(27,27,30,0.82)",
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
 *
 * ## `pigment` e `ink`: la muestra de pintura
 *
 * Los tres primeros campos son la versión **apagada** del tono, para teñir un
 * icono sobre una superficie oscura. `pigment` es el mismo tono a plena
 * saturación, pensado para **rellenar** —hoy solo el botón primario y la
 * pestaña activa—, e `ink` es el texto que va encima.
 *
 * Que exista un relleno saturado es un cambio de rumbo respecto a la versión
 * anterior, donde el botón primario era blanco sobre negro y el color no
 * rellenaba nada. El motivo: en una app **de colores**, un botón blanco es la
 * única superficie de la pantalla que no dice nada sobre lo que hace. Con
 * pigmento, el relleno se lee como una muestra de pintura —que es el material
 * del juego— y además carga información: el tono dice a qué sección pertenece
 * la acción. La barra de pestañas es la leyenda de ese mapa.
 *
 * La regla que sustituye a la vieja está en `Button`: el pigmento es para lo
 * que ocurre **fuera** de una ronda. Dentro, el único color saturado sigue
 * siendo el del juego y el botón vuelve a ser claro sobre oscuro.
 *
 * Los seis pigmentos van a la misma luminosidad —igual que los iconos— para
 * que ninguna sección grite más que otra, y esa luminosidad está elegida para
 * que la tinta casi negra de encima pase de 8:1 en los seis. `ink` no es negro
 * puro sino el mismo tono llevado casi al negro: es lo que hace que la etiqueta
 * parezca impresa sobre la pintura en vez de pegada encima.
 */
const spectrum = {
  violet: {
    surface: accent.surface,
    border: accent.border,
    icon: accent.text,
    pigment: "#A79BF5",
    pigmentPressed: "#8E80E8",
    ink: "#120E2E",
  },
  blue: {
    surface: "#0D1B2A",
    border: "#1E3A55",
    icon: "#7FB6F0",
    pigment: "#6FA8F0",
    pigmentPressed: "#5A92DC",
    ink: "#071628",
  },
  teal: {
    surface: "#0A2020",
    border: "#17423E",
    icon: "#6FD3C8",
    pigment: "#57CFC0",
    pigmentPressed: "#43B8A9",
    ink: "#04211D",
  },
  green: {
    surface: semantic.success.surface,
    border: semantic.success.border,
    icon: semantic.success.text,
    pigment: "#5CD394",
    pigmentPressed: "#47BC7F",
    ink: "#062114",
  },
  amber: {
    surface: semantic.warning.surface,
    border: semantic.warning.border,
    icon: semantic.warning.text,
    pigment: "#E9B95C",
    pigmentPressed: "#D3A448",
    ink: "#241906",
  },
  rose: {
    surface: "#24101A",
    border: "#4C2233",
    icon: "#F09AB8",
    pigment: "#EE8CB2",
    pigmentPressed: "#DA779E",
    ink: "#2A0C18",
  },
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

/**
 * La aurora: el degradado que recorre el borde de lo importante.
 *
 * Es la única cosa cromática que se mueve por delante del contenido, y por eso
 * está acotada a **un elemento por pantalla** — el que hay que mirar. Si dos
 * superficies brillan a la vez, ninguna es la principal, que es exactamente el
 * problema que tenía el menú online antes de reordenarlo.
 *
 * Los tonos son los mismos primos del acento que ya usa la portada
 * (`ambient.violet` y `ambient.rose`), pero **subidos de saturación**: los de
 * `ambient` están calculados para leerse al 25 % de opacidad detrás del texto,
 * y a plena opacidad en un borde de 1,5 px se ven sucios. El magenta sube de
 * `#8E3A63` a `#D64C9B` y el azul se separa del violeta para que el recorrido
 * tenga de verdad dos extremos y no se lea como un solo morado.
 *
 * `stops` empieza y acaba en el mismo azul a propósito: el degradado gira sin
 * parar, y si los extremos no coincidieran se vería pasar la costura una vez
 * por vuelta.
 */
const glow = {
  blue: "#4C7DF0",
  violet: "#7A6FF0",
  magenta: "#D64C9B",
  /** Recorrido cerrado para la rotación. Ver arriba. */
  stops: ["#4C7DF0", "#7A6FF0", "#D64C9B", "#7A6FF0", "#4C7DF0"],
} as const;

/**
 * El podio: los tres primeros puestos de una clasificación.
 *
 * Vive fuera de `spectrum` porque no es una categoría sino un **rango**, y por
 * eso los tres tonos NO están a la misma luminosidad: el oro pesa más que la
 * plata y la plata más que el bronce, que es exactamente la información que
 * tienen que dar. Un cuarto puesto no lleva color: la frontera del podio es la
 * frontera del color.
 *
 * El oro es el mismo ámbar que ya usa `warning.text` —no hace falta un amarillo
 * nuevo para esto— y los otros dos se calculan a su misma saturación baja para
 * que los tres se lean como una familia y no como tres avisos distintos.
 */
const podium = {
  gold: { fill: "#2A2011", border: "#5C4622", text: "#F0C673" },
  silver: { fill: "#1D1E22", border: "#3E4048", text: "#C9CBD6" },
  bronze: { fill: "#241A13", border: "#4E3626", text: "#D08A5A" },
} as const;

/**
 * La racha encendida. Vive fuera de `spectrum` porque no es una categoría de
 * una lista: es el único elemento cálido de una interfaz deliberadamente fría,
 * y su trabajo es que se le vaya el ojo.
 */
const ember = {
  outer: "#FF6B1A",
  inner: "#FFB020",
  core: "#FFF0C4",
  text: "#FFC53D",
  surface: "#17110B",
  border: "#43301B",
  /** Apagada: la racha existe pero hoy todavía no está asegurada. */
  dimOuter: "#2E2E38",
  dimInner: "#23232B",
} as const;

/**
 * Identidad de grupo: seis superficies teñidas para áreas GRANDES.
 *
 * ## Por qué no vale `spectrum`
 *
 * Es un error de escala, y costó verlo. Los seis tonos de `spectrum` están
 * calculados para teñir un chip de 36 puntos detrás de un icono, y ahí funcionan:
 * a ese tamaño, un tinte del 6 % se lee como «teñido». Puestos a rellenar una
 * baldosa de 200, los mismos valores se leen como **negro sucio** — el verde
 * (`#0A1F16`) era el peor, un botella tan oscuro que parecía un fallo de pintado.
 *
 * Y hay un problema peor que el brillo: **no se distinguen entre sí**. Los
 * matices del espectro se eligieron para verse de uno en uno, así que tres de
 * ellos caben en 33 grados (verde 167°, teal 176°, azul 199°). Como seis bloques
 * contiguos se colapsan: la pareja más parecida está a una distancia perceptual
 * de 0,022, que a tamaño de baldosa es «el mismo color».
 *
 * ## Cómo está calculada esta
 *
 * En OKLCH, y con dos reglas:
 *
 *  - **La misma luminosidad para los seis.** Es la regla que `spectrum` ya
 *    declara y que en la práctica no cumplía: entre su tono más claro y el más
 *    oscuro había un factor 1,5, así que unos pesaban más que otros. Aquí la
 *    dispersión es 1,24, y lo que queda es solo lo que el ojo humano no puede
 *    igualar por construcción.
 *  - **Croma distinto por matiz.** Un ámbar necesita más croma que un azul para
 *    leerse como ámbar y no como marrón a esta luminosidad. Fijar el croma para
 *    los seis es lo que convierte los tonos cálidos en barro.
 *
 * Los seis matices están repartidos con al menos 45 grados entre vecinos, así
 * que la pareja más parecida queda en 0,073 — más del triple de separación que
 * la del espectro.
 *
 * ## Los tres papeles
 *
 * `wash` rellena, `edge` es el borde, y `mark` es lo que se dibuja ENCIMA del
 * relleno: el canto superior, el monograma del fondo y el interrogante del dial.
 * Los tres del mismo matiz, así que una baldosa es de un color y no de tres.
 */
const groupTint = {
  carmin: { wash: "#44362D", edge: "#635144", mark: "#CCB19F" },
  ambar: { wash: "#3D3810", edge: "#5A541D", mark: "#BCB56B" },
  jade: { wash: "#2D3B2C", edge: "#445844", mark: "#9CBC9F" },
  azul: { wash: "#303B51", edge: "#495876", mark: "#A3BBEB" },
  indigo: { wash: "#3D3866", edge: "#5B5393", mark: "#BDB5FF" },
  ciruela: { wash: "#423651", edge: "#615176", mark: "#C9B2EB" },
} as const;

export const Color = {
  surface,
  border,
  text,
  accent,
  ambient,
  spectrum,
  groupTint,
  podium,
  glow,
  ember,
  ...semantic,
} as const;

/**
 * La forma de una paleta.
 *
 * Existe para que el modo claro no pueda quedarse a medias: cualquier paleta
 * alternativa tiene que rellenar exactamente estas claves o no compila. Ver
 * `design/theme.tsx`, donde vive la clara y el interruptor que las cambia.
 *
 * `DeepMutable` quita los `readonly` que introduce el `as const` de arriba. Sin
 * él, una paleta escrita a mano no encaja en el tipo por un detalle que no
 * importa —que sus cadenas sean literales o no— y habría que salpicar `as
 * const` por toda la paleta clara.
 */
type DeepMutable<T> = {
  -readonly [K in keyof T]: T[K] extends string ? string : DeepMutable<T[K]>;
};

export type Palette = DeepMutable<typeof Color>;

/**
 * Qué tono le toca a cada sección del modo online.
 *
 * Es el mapa del que tiran la barra de pestañas —que hace de leyenda— y los
 * botones de cada sección. Vive aquí, en los tokens, y no en la barra, porque
 * la barra es solo el sitio donde se ve: el tono de «grupos» tiene que ser el
 * mismo en la pestaña, en el botón de crear uno y en el borde de sus tarjetas.
 *
 * `hoy` es azul porque es lo que está fresco; `grupos` hereda el verde azulado
 * que ya llevaban sus filas; `ranking` el ámbar del oro del podio; `cuenta` el
 * violeta que ya era el acento del perfil. Ninguno se ha elegido a ojo: los
 * cuatro ya estaban usados así en alguna pantalla, y esto solo los hace ley.
 */
export const SECTION_TONE = {
  today: "blue",
  groups: "teal",
  ranking: "amber",
  account: "violet",
} as const satisfies Record<string, SpectrumTone>;

export type GroupTone = keyof typeof groupTint;

/** Los seis, en orden fijo. Es de donde reparte `tintForKey`. */
export const GROUP_TONES = [
  "carmin",
  "ambar",
  "jade",
  "azul",
  "indigo",
  "ciruela",
] as const satisfies readonly GroupTone[];

/**
 * El tono de una cosa que no tiene color propio: hoy, un grupo.
 *
 * Los grupos no guardan ningún color en el servidor, y aun así conviene que
 * cada uno tenga el suyo: en un muro de baldosas, el color es lo que permite
 * reconocer la tuya antes de haber leído el nombre. Se deriva del `id`, así que
 * es **estable sin guardar nada** y el mismo grupo sale del mismo tono en
 * cualquier dispositivo.
 *
 * Reparte entre los seis en vez de calcular un matiz continuo como hace
 * `playerTint` con los jugadores, y la diferencia importa por dos motivos: seis
 * tonos elegidos a mano se distinguen entre sí —360 matices contiguos no—, y
 * **los seis ya tienen su versión clara**, así que esto sigue siendo legible el
 * día que exista el modo claro.
 *
 * El hash es el multiplicador 31 de siempre, el mismo que usa `Avatar`: barato,
 * determinista y con buen reparto para cadenas cortas.
 */
export function tintForKey(key: string): GroupTone {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % 1_000_003;
  }
  return GROUP_TONES[hash % GROUP_TONES.length];
}

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
 * Dos familias, cada una con un trabajo.
 *
 * ## La pareja
 *
 * **Space Grotesk** para lo que se mira —títulos y, sobre todo, cifras—. Es una
 * grotesca con las formas algo raras y un aire de instrumento de medida, que es
 * exactamente lo que es una puntuación de acierto de color. A 34 y 44 puntos
 * tiene carácter propio; ahí es donde debe estar la personalidad.
 *
 * **Inter** para lo que se lee —cuerpo, pastillas, botones, rótulos—. Es
 * deliberadamente neutra: a 13 y 15 puntos el carácter se paga en legibilidad,
 * y una fuente con personalidad en un párrafo de ayuda estorba. Que la
 * personalidad viva en el titular y no en el párrafo es la decisión, no un
 * atajo.
 *
 * ## Por qué cada nivel nombra su peso
 *
 * Antes esto era una sola `FONT_FAMILY` más un `fontWeight` por nivel. Con
 * fuentes del sistema funciona; con fuentes cargadas, **no**: Android no
 * sintetiza pesos, así que `fontWeight: "700"` sobre una familia cargada como
 * Regular se queda en regular, sin error ni aviso. Por eso cada token nombra su
 * corte exacto —`SpaceGrotesk_700Bold`— y `fontWeight` desaparece: mantenerlo
 * además del corte invita a que iOS sintetice encima de una negrita que ya lo
 * es.
 *
 * Los nombres son las claves que se le pasan a `useFonts` en el layout raíz. Si
 * se renombra una allí, aquí deja de resolver y se cae a la fuente del sistema
 * en silencio — es el único acoplamiento de todo esto, y es de una sola línea.
 */
const DISPLAY_BOLD = "SpaceGrotesk_700Bold";
const DISPLAY_SEMI = "SpaceGrotesk_600SemiBold";
const BODY_REGULAR = "Inter_400Regular";
const BODY_SEMI = "Inter_600SemiBold";
const BODY_BOLD = "Inter_700Bold";

/**
 * Cifras de ancho fijo: marcadores y temporizadores no deben bailar.
 *
 * **Esta línea ahora es obligatoria, no un adorno.** Las cifras de Space
 * Grotesk son proporcionales de fábrica —el «1» mide 418 unidades y el «7» 625,
 * comprobado en la propia TTF—, así que una cuenta atrás sin esto cambia de
 * ancho en cada segundo. Las dos familias traen la característica `tnum`, que
 * es la que iguala los anchos; el día que se cambie de fuente hay que
 * comprobarlo antes, porque si falta no da error: simplemente vuelve a bailar.
 */
const TABULAR: TextStyle = { fontVariant: ["tabular-nums"] };

type TypeToken = TextStyle;

/**
 * Seis escalones con saltos claros. Si dos textos deben verse distintos, se
 * eligen escalones no contiguos; nunca se inventa un tamaño intermedio.
 */
export const Type = {
  /** 34 — título principal de una pantalla. Uno por pantalla, como mucho. */
  display: {
    fontFamily: DISPLAY_BOLD,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.5,
    color: text.primary,
  },
  /** 24 — título de modal o de bloque destacado. */
  title: {
    fontFamily: DISPLAY_BOLD,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
    color: text.primary,
  },
  /** 18 — título de tarjeta o de fila. */
  heading: {
    fontFamily: DISPLAY_SEMI,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: text.primary,
  },
  /** 15 — cuerpo de texto por defecto. */
  body: {
    fontFamily: BODY_REGULAR,
    fontSize: 15,
    lineHeight: 22,
    color: text.secondary,
  },
  /** 15 con peso — cuerpo que necesita énfasis sin cambiar de tamaño. */
  bodyStrong: {
    fontFamily: BODY_SEMI,
    fontSize: 15,
    lineHeight: 22,
    color: text.primary,
  },
  /** 13 — metadatos, pistas, descripciones secundarias. */
  caption: {
    fontFamily: BODY_REGULAR,
    fontSize: 13,
    lineHeight: 18,
    color: text.muted,
  },
  /** 11 en versalitas — kickers y encabezados de sección. */
  label: {
    fontFamily: BODY_BOLD,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: text.muted,
  },
  /** 16 — texto de botón. Un único tamaño para todos los botones de la app. */
  button: {
    fontFamily: BODY_SEMI,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.1,
    color: text.primary,
  },
  /** 44 — la puntuación en el modal de resultado. Cifra protagonista. */
  metricHero: {
    fontFamily: DISPLAY_BOLD,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -1.2,
    color: text.primary,
    ...TABULAR,
  },
  /** 20 — cifras de estadística y temporizadores. */
  metric: {
    fontFamily: DISPLAY_BOLD,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
    color: text.primary,
    ...TABULAR,
  },
  /** 13 — valores hexadecimales y deltas numéricos. */
  metricSmall: {
    fontFamily: DISPLAY_SEMI,
    fontSize: 13,
    lineHeight: 18,
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
