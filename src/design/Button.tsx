import { memo, useCallback, type ReactElement } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
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
import {
  Color,
  DISABLED_OPACITY,
  Duration,
  HIT_SLOP,
  HIT_TARGET,
  Motion,
  Radius,
  Space,
  Type,
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

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "lg" | "md";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
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
  icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  accessibilityLabel,
}: ButtonProps): ReactElement {
  const blocked = disabled || loading;
  const press = usePressScale();

  const handlePress = useCallback((): void => {
    if (blocked) {
      return;
    }
    selectionTick();
    playTick();
    onPress();
  }, [blocked, onPress]);

  const tone = TONES[variant];

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
          tone.container,
          pressed && !blocked && tone.pressed,
          blocked && styles.disabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: blocked, busy: loading }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={tone.label.color} />
        ) : (
          <View style={styles.content}>
            {icon ? (
              <Icon name={icon} size={18} color={tone.label.color} />
            ) : null}
            <Text style={[Type.button, tone.label]} numberOfLines={1}>
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
  color = Color.text.secondary,
  disabled = false,
  style,
}: IconButtonProps): ReactElement {
  const press = usePressScale(0.92);

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
        <Icon name={name} size={size} color={color} />
      </Pressable>
    </Animated.View>
  );
}

export const IconButton = memo(IconButtonBase);

// ---------------------------------------------------------------------------

/**
 * El primario es claro sobre oscuro, no un degradado de acento. En una interfaz
 * casi negra el contraste puro es la señal más fuerte que hay, y así el acento
 * cromático queda libre para significar estado (progreso, selección, foco) en
 * lugar de gastarse en decorar el botón más frecuente.
 */
const TONES: Record<
  Variant,
  { container: ViewStyle; pressed: ViewStyle; label: { color: string } }
> = {
  primary: {
    container: { backgroundColor: Color.text.primary },
    pressed: { backgroundColor: Color.text.secondary },
    label: { color: Color.text.inverse },
  },
  secondary: {
    container: {
      backgroundColor: Color.surface.raised,
      borderWidth: 1,
      borderColor: Color.border.default,
    },
    pressed: {
      backgroundColor: Color.surface.interactive,
      borderColor: Color.border.strong,
    },
    label: { color: Color.text.primary },
  },
  ghost: {
    container: { backgroundColor: "transparent" },
    pressed: { backgroundColor: Color.surface.raised },
    label: { color: Color.text.secondary },
  },
  danger: {
    container: {
      backgroundColor: Color.danger.surface,
      borderWidth: 1,
      borderColor: Color.danger.border,
    },
    pressed: { backgroundColor: Color.danger.border },
    label: { color: Color.danger.text },
  },
};

const styles = StyleSheet.create({
  fullWidth: {
    width: "100%",
  },
  base: {
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Space.xl,
  },
  sizeLg: {
    minHeight: 52,
  },
  sizeMd: {
    minHeight: HIT_TARGET,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
  },
  disabled: {
    opacity: DISABLED_OPACITY,
  },
  iconButton: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonSurface: {
    backgroundColor: Color.surface.raised,
    borderWidth: 1,
    borderColor: Color.border.default,
  },
  iconButtonPressed: {
    backgroundColor: Color.surface.interactive,
  },
});

export { usePressScale, Motion };
