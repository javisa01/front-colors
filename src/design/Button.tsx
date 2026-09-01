import { memo, useCallback, useMemo, useRef, type ReactElement } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Icon, type IconName } from "@/design/Icon";
import { useColors, useThemedStyles } from "@/design/theme";
import {
  DISABLED_OPACITY,
  Duration,
  HIT_SLOP,
  HIT_TARGET,
  Motion,
  Radius,
  Space,
  Type,
  type Palette,
  type SpectrumTone,
} from "@/design/tokens";
import { selectionTick } from "@/utils/haptics";
import { playTick } from "@/utils/sound";

/**
 * Los botones de la aplicación.
 *
 * Un botón primario es el mismo botón primario en todas las pantallas: mismo
 * alto, mismo radio, mismo texto, misma compresión al pulsar y el mismo par
 * de feedbacks (háptico + sonido). Antes cada pantalla montaba su propio
 * `Pressable` con un degradado azul dentro, y por eso ninguna se parecía a otra.
 *
 * El feedback al pulsar se centraliza aquí a propósito: ninguna pantalla debe
 * volver a llamar a `playTick()` a mano junto a un `onPress`.
 */

/**
 * Ventana en la que un segundo toque se ignora.
 *
 * Un botón no se deshabilita en el mismo instante en que se pulsa: `onPress`
 * cambia el estado, React repinta y solo entonces llega el `disabled`. Entre
 * las dos cosas hay al menos un fotograma, y dos toques rápidos caben de sobra
 * ahí dentro —los dos leen el estado viejo y los dos ejecutan el manejador—.
 * Es lo que permitía enviar dos veces el mismo resultado dando dos toques
 * seguidos a «comprobar».
 *
 * 350 ms está por encima del umbral con el que los dos sistemas reconocen un
 * doble toque (250-300 ms), así que se traga el accidente entero, y por debajo
 * del tiempo que tarda alguien en decidir volver a pulsar a propósito.
 *
 * Va en el botón y no en cada pantalla porque el problema es del botón: toda
 * acción primaria de la aplicación pasa por aquí, y arreglarlo pantalla a
 * pantalla dejaría fuera la siguiente que se escriba. Las pantallas que además
 * no pueden permitirse el doble envío por motivos de datos —el resultado de una
 * ronda, el cierre de un intento— llevan su propia guarda encima de esta: esto
 * es una red, no la cerradura.
 *
 * `IconButton` se queda fuera a propósito: sus usos son contadores y flechas de
 * navegación, donde pulsar rápido varias veces es justo lo que se espera.
 */
const REPRESS_LOCK_MS = 350;

type Variant = "primary" | "secondary" | "ghost" | "accent" | "danger";
type Size = "lg" | "md";

/**
 * De qué sección es la acción. Solo lo lee el primario. La regla que decide qué
 * tono le toca a cada botón está documentada en `toneFor`, al final del fichero.
 */
export type ButtonTone = SpectrumTone | "neutral";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  /**
   * Pigmento del primario. Por defecto `neutral`, que es el claro sobre oscuro
   * de siempre. Solo tiene efecto con `variant="primary"`.
   */
  tone?: ButtonTone;
  /** Icono opcional a la izquierda del texto. */
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Por defecto el botón ocupa todo el ancho disponible. */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Solo si el texto visible no describe la acción por sí mismo. */
  accessibilityLabel?: string;
}

/**
 * Compresión al pulsar. 0.97 es deliberadamente sutil: lo justo para que el
 * dedo note que el elemento respondió, no tanto como para leerse como una
 * animación. Entra rápido y sale algo más lento, que es como se comporta un
 * objeto físico al soltarlo.
 */
function usePressScale(pressedScale = 0.97) {
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const onPressIn = useCallback(() => {
    scale.set(
      withTiming(pressedScale, {
        duration: Duration.instant,
        easing: (t) => t,
      }),
    );
  }, [pressedScale, scale]);

  const onPressOut = useCallback(() => {
    scale.set(withTiming(1, { duration: Duration.fast }));
  }, [scale]);

  return { style, onPressIn, onPressOut };
}

function ButtonBase({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  tone = "neutral",
  icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  accessibilityLabel,
}: ButtonProps): ReactElement {
  const blocked = disabled || loading;
  const press = usePressScale();
  const styles = useThemedStyles(buttonStyles);
  const colors = useColors();

  /** Instante del último toque aceptado. Ver `REPRESS_LOCK_MS`. */
  const lastPressRef = useRef(0);

  const handlePress = useCallback((): void => {
    if (blocked) {
      return;
    }

    const now = Date.now();
    if (now - lastPressRef.current < REPRESS_LOCK_MS) {
      // Ni háptico ni sonido: el toque no ha ocurrido. Un «clic» sin efecto es
      // peor que el silencio, porque hace creer que sí se ha registrado algo.
      return;
    }
    lastPressRef.current = now;

    selectionTick();
    playTick();
    onPress();
  }, [blocked, onPress]);

  const skin = useMemo(
    () => toneFor(colors, variant, tone),
    [colors, variant, tone],
  );

  return (
    <Animated.View style={[fullWidth && styles.fullWidth, press.style, style]}>
      <Pressable
        onPress={handlePress}
        onPressIn={blocked ? undefined : press.onPressIn}
        onPressOut={blocked ? undefined : press.onPressOut}
        disabled={blocked}
        style={({ pressed }) => [
          styles.base,
          size === "lg" ? styles.sizeLg : styles.sizeMd,
          skin.container,
          pressed && !blocked && skin.pressed,
          blocked && styles.disabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: blocked, busy: loading }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={skin.label.color} />
        ) : (
          <View style={styles.content}>
            {icon ? (
              <Icon name={icon} size={18} color={skin.label.color} />
            ) : null}
            <Text style={[Type.button, skin.label]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export const Button = memo(ButtonBase);

// ---------------------------------------------------------------------------
// Botón de icono
// ---------------------------------------------------------------------------

interface IconButtonProps {
  name: IconName;
  onPress: () => void;
  /** Obligatorio: un icono suelto no se lee con un lector de pantalla. */
  accessibilityLabel: string;
  /** Tamaño del dibujo. El área táctil es siempre de 44pt. */
  size?: number;
  variant?: "plain" | "surface";
  color?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Icono pulsable con área táctil garantizada.
 *
 * El dibujo puede medir 18pt, pero el objetivo mide siempre 44 —el mínimo de
 * las guías de accesibilidad de ambas plataformas— más `hitSlop`. El tamaño de
 * lo que se ve y el tamaño de lo que se puede tocar son cosas distintas.
 */
function IconButtonBase({
  name,
  onPress,
  accessibilityLabel,
  size = 20,
  variant = "plain",
  color,
  disabled = false,
  style,
}: IconButtonProps): ReactElement {
  const press = usePressScale(0.92);
  const styles = useThemedStyles(buttonStyles);
  const colors = useColors();

  const handlePress = useCallback((): void => {
    if (disabled) {
      return;
    }
    selectionTick();
    playTick();
    onPress();
  }, [disabled, onPress]);

  return (
    <Animated.View style={[press.style, style]}>
      <Pressable
        onPress={handlePress}
        onPressIn={disabled ? undefined : press.onPressIn}
        onPressOut={disabled ? undefined : press.onPressOut}
        disabled={disabled}
        hitSlop={HIT_SLOP}
        style={({ pressed }) => [
          styles.iconButton,
          variant === "surface" && styles.iconButtonSurface,
          pressed && !disabled && styles.iconButtonPressed,
          disabled && styles.disabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
      >
        <Icon name={name} size={size} color={color ?? colors.text.secondary} />
      </Pressable>
    </Animated.View>
  );
}

export const IconButton = memo(IconButtonBase);

// ---------------------------------------------------------------------------

interface Skin {
  container: ViewStyle;
  pressed: ViewStyle;
  label: { color: string };
}

/**
 * ## La regla del pigmento
 *
 * El primario **rellena con el pigmento de su sección**: teal si la acción es
 * de grupos, azul si es del reto de hoy, ámbar si es del ranking, violeta si es
 * de la cuenta, verde si cierra algo bien. La leyenda de ese mapa es la barra de
 * pestañas, que pinta cada destino con su mismo tono, y el diccionario está en
 * `SECTION_TONE`.
 *
 * ### Qué regla sustituye, y por qué
 *
 * Antes el primario era blanco sobre negro, con este argumento: en una interfaz
 * casi negra el contraste puro es la señal más fuerte que hay, así que el acento
 * cromático quedaba libre para significar estado en vez de gastarse en decorar.
 *
 * El argumento era bueno y su conclusión ya no lo es. Con todas las pantallas
 * hechas se ve el efecto acumulado: tarjetas grises, iconos apagados y un botón
 * blanco por pantalla: en una aplicación **de colores**, la única superficie
 * grande y saturada nunca aparecía. Y el blanco no era neutral, era mudo:
 * «crear grupo» y «salir» se pintaban exactamente igual.
 *
 * El pigmento arregla las dos cosas a la vez sin romper el fondo del argumento
 * viejo, porque **el color sigue significando algo**: no decora el botón, lo
 * clasifica. Y sigue habiendo un primario por pantalla, así que sigue habiendo
 * una sola superficie que grita.
 *
 * ### Dónde NO va el pigmento
 *
 * `tone="neutral"` —el valor por defecto— es el blanco sobre negro de siempre, y
 * es obligatorio **dentro de una ronda**. Ahí hay una muestra de color del juego
 * en pantalla, y es la que hay que mirar: un botón teal de 52 puntos de alto al
 * lado de un logo que hay que igualar compite con lo único que importa. La
 * frontera es literal — si la pantalla enseña un color que hay que adivinar, el
 * botón es neutro.
 *
 * También se queda neutra la navegación pura («inicio», «volver»): no pertenece
 * a ninguna sección, así que no hay tono que le corresponda.
 */
function toneFor(colors: Palette, variant: Variant, tone: ButtonTone): Skin {
  if (variant === "primary") {
    if (tone === "neutral") {
      return {
        container: { backgroundColor: colors.text.primary },
        pressed: { backgroundColor: colors.text.secondary },
        label: { color: colors.text.inverse },
      };
    }

    const pigment = colors.spectrum[tone];
    return {
      container: { backgroundColor: pigment.pigment },
      pressed: { backgroundColor: pigment.pigmentPressed },
      label: { color: pigment.ink },
    };
  }

  switch (variant) {
    case "secondary":
      return {
        container: {
          backgroundColor: colors.surface.raised,
          borderWidth: 1,
          borderColor: colors.border.default,
        },
        pressed: {
          backgroundColor: colors.surface.interactive,
          borderColor: colors.border.strong,
        },
        label: { color: colors.text.primary },
      };
    case "ghost":
      return {
        container: { backgroundColor: "transparent" },
        pressed: { backgroundColor: colors.surface.raised },
        label: { color: colors.text.secondary },
      };
    /**
     * Acción con color, pero de segunda fila.
     *
     * Se construye igual que `danger` —relleno tenue, borde y texto de la misma
     * rampa— porque son la misma clase de botón: el que dice de qué va la acción
     * antes de leerla. La usan los pares de acciones donde las dos importan y
     * ninguna es «la principal» de la pantalla, como compartir el código frente
     * a salirse del grupo: dos secundarios grises harían falta leerlos para
     * saber cuál es cuál.
     *
     * Sigue existiendo con el pigmento en escena porque no hace lo mismo: el
     * pigmento **rellena** y hay uno por pantalla; esto es un relleno tenue con
     * borde, y pueden convivir dos sin que ninguno pretenda ser el principal.
     */
    case "accent":
      return {
        container: {
          backgroundColor: colors.accent.surface,
          borderWidth: 1,
          borderColor: colors.accent.border,
        },
        pressed: { backgroundColor: colors.accent.border },
        label: { color: colors.accent.text },
      };
    case "danger":
      return {
        container: {
          backgroundColor: colors.danger.surface,
          borderWidth: 1,
          borderColor: colors.danger.border,
        },
        pressed: { backgroundColor: colors.danger.border },
        label: { color: colors.danger.text },
      };
  }
}

const buttonStyles = (colors: Palette) => ({
  fullWidth: {
    width: "100%" as const,
  },
  base: {
    borderRadius: Radius.lg,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: Space.xl,
  },
  sizeLg: {
    minHeight: 52,
  },
  sizeMd: {
    minHeight: HIT_TARGET,
  },
  content: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: Space.sm,
  },
  disabled: {
    opacity: DISABLED_OPACITY,
  },
  iconButton: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    borderRadius: Radius.md,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  iconButtonSurface: {
    backgroundColor: colors.surface.raised,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  iconButtonPressed: {
    backgroundColor: colors.surface.interactive,
  },
});

export { usePressScale, Motion };
