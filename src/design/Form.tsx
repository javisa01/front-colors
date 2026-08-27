import {
  memo,
  useCallback,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type LayoutChangeEvent,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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
 * Controles de entrada.
 *
 * Los tres viven aquí porque comparten la misma gramática: un rótulo encima, una
 * superficie hundida donde se escribe o se elige, y el acento reservado para
 * marcar qué está enfocado o seleccionado. La mitad online los tenía duplicados
 * en `components/online/Controls.tsx` con otra paleta y otras alturas.
 */

// ---------------------------------------------------------------------------
// Campo de texto
// ---------------------------------------------------------------------------

interface FieldProps {
  /** Rótulo sobre el campo. Sin él, la etiqueta accesible es el marcador. */
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** Pista bajo el campo. La sustituye el error cuando lo hay. */
  hint?: string;
  error?: string;
  /** Icono a la izquierda, dentro del campo. */
  icon?: IconName;
  /**
   * Elemento propio a la izquierda, dentro del campo, en lugar del icono. Para
   * campos que se identifican por algo que no es un icono: el número de un
   * jugador en una lista, un prefijo telefónico.
   */
  leading?: ReactNode;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoComplete?: TextInputProps["autoComplete"];
  maxLength?: number;
  onSubmitEditing?: () => void;
  returnKeyType?: TextInputProps["returnKeyType"];
  style?: StyleProp<ViewStyle>;
}

/**
 * Campo de texto con rótulo, pista y error.
 *
 * El borde se tiñe con una transición, no con un salto: el foco es un cambio de
 * estado y a 180 ms se lee como que el campo respondió al dedo. Con un cambio
 * instantáneo el campo parece parpadear cada vez que el teclado se mueve entre
 * uno y otro.
 *
 * El error tiene prioridad sobre el foco: mientras haya un error, el borde se
 * queda rojo aunque el campo esté activo, porque lo que hay que corregir importa
 * más que dónde está el cursor.
 */
function FieldBase({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  icon,
  leading,
  secure = false,
  keyboardType,
  autoCapitalize = "none",
  autoComplete,
  maxLength,
  onSubmitEditing,
  returnKeyType = "next",
  style,
}: FieldProps): ReactElement {
  const focus = useSharedValue(0);
  const invalid = error != null;

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: invalid
      ? Color.danger.border
      : interpolateColor(
          focus.get(),
          [0, 1],
          [Color.border.default, Color.accent.default],
        ),
  }));

  const onFocus = useCallback(() => {
    focus.set(withTiming(1, { duration: Duration.fast }));
  }, [focus]);

  const onBlur = useCallback(() => {
    focus.set(withTiming(0, { duration: Duration.fast }));
  }, [focus]);

  return (
    <View style={[styles.field, style]}>
      {label != null ? (
        <Text style={[Type.label, styles.fieldLabel]}>{label}</Text>
      ) : null}

      <Animated.View style={[styles.inputShell, borderStyle]}>
        {leading ??
          (icon != null ? (
            <Icon name={icon} size={18} color={Color.text.muted} />
          ) : null)}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={Color.text.faint}
          style={[Type.body, styles.input]}
          secureTextEntry={secure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          maxLength={maxLength}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          // El error viaja dentro de la etiqueta: un campo en rojo no dice nada
          // a quien usa un lector de pantalla si el motivo solo se ve.
          accessibilityLabel={
            invalid ? `${label ?? placeholder ?? ""}. ${error}` : label
          }
        />
      </Animated.View>

      {error != null ? (
        <Text style={[Type.caption, styles.fieldError]}>{error}</Text>
      ) : hint != null ? (
        <Text style={[Type.caption, styles.fieldHint]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export const Field = memo(FieldBase);

// ---------------------------------------------------------------------------
// Control segmentado
// ---------------------------------------------------------------------------

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Selector de dos o tres opciones excluyentes.
 *
 * La pastilla activa se desplaza con muelle en vez de aparecer y desaparecer:
 * el movimiento es lo que dice que las opciones son las dos caras de una misma
 * cosa. Antes, `auth.tsx` y `leaderboard.tsx` pintaban cada uno sus pestañas con
 * un fondo que cambiaba de golpe, y no había nada que ligase una con otra.
 */
function SegmentedControlInner<T extends string>({
  options,
  value,
  onChange,
  style,
}: SegmentedControlProps<T>): ReactElement {
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const position = useSharedValue(index);

  // La animación se dispara desde el índice, no desde el `onPress`: así la
  // pastilla también acompaña a un cambio que venga de fuera del control.
  useEffect(() => {
    position.set(withSpring(index, Motion.spring));
  }, [index, position]);

  const segmentWidth =
    trackWidth > 0 ? (trackWidth - SEGMENT_PADDING * 2) / options.length : 0;

  const thumbStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: position.get() * segmentWidth }],
  }));

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  return (
    <View
      style={[styles.segmented, style]}
      onLayout={onLayout}
      accessibilityRole="tablist"
    >
      {segmentWidth > 0 ? (
        <Animated.View style={[styles.segmentThumb, thumbStyle]} />
      ) : null}

      {options.map((option) => {
        const active = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (active) {
                return;
              }
              selectionTick();
              playTick();
              onChange(option.value);
            }}
            style={styles.segment}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
          >
            <Text
              style={[
                Type.bodyStrong,
                styles.segmentLabel,
                active && styles.segmentLabelActive,
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const SegmentedControl = memo(
  SegmentedControlInner,
) as typeof SegmentedControlInner;

// ---------------------------------------------------------------------------
// Pastilla seleccionable
// ---------------------------------------------------------------------------

/**
 * Atajo pulsable dentro de un grupo de opciones.
 *
 * A diferencia de `SegmentedControl`, no exige que el valor actual sea uno de
 * los que se muestran: sirve para saltar a un valor frecuente de un rango más
 * amplio (2, 3, 4, 6 u 8 jugadores de los 99 posibles) sin mentir sobre el
 * estado cuando el valor está fuera de la lista.
 */
function ChipBase({
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}): ReactElement {
  return (
    <Pressable
      onPress={() => {
        if (selected) {
          return;
        }
        selectionTick();
        playTick();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && !selected && styles.chipPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
    >
      <Text
        style={[
          Type.bodyStrong,
          styles.chipLabel,
          selected && styles.chipLabelSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export const Chip = memo(ChipBase);

// ---------------------------------------------------------------------------
// Contador
// ---------------------------------------------------------------------------

interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
}

/**
 * Contador de dos botones con la cifra en medio.
 *
 * Los botones se desactivan al tocar el límite en lugar de tragarse la pulsación
 * en silencio: si el número no va a cambiar, el botón tiene que parecer apagado
 * antes de que el dedo llegue.
 */
function StepperBase({
  value,
  min,
  max,
  onChange,
  decreaseLabel,
  increaseLabel,
}: StepperProps): ReactElement {
  return (
    <View style={styles.stepper}>
      <StepperButton
        icon="minus"
        label={decreaseLabel}
        disabled={value <= min}
        onPress={() => onChange(value - 1)}
      />
      <Text style={[Type.display, styles.stepperValue]}>{value}</Text>
      <StepperButton
        icon="plus"
        label={increaseLabel}
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
      />
    </View>
  );
}

export const Stepper = memo(StepperBase);

function StepperButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  disabled: boolean;
  onPress: () => void;
}): ReactElement {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={() => {
          if (disabled) {
            return;
          }
          selectionTick();
          playTick();
          onPress();
        }}
        onPressIn={() => {
          if (!disabled) {
            scale.set(withTiming(0.94, { duration: Duration.instant }));
          }
        }}
        onPressOut={() => {
          scale.set(withTiming(1, { duration: Duration.fast }));
        }}
        disabled={disabled}
        hitSlop={HIT_SLOP}
        style={({ pressed }) => [
          styles.stepperButton,
          pressed && !disabled && styles.stepperButtonPressed,
          disabled && styles.disabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
      >
        <Icon name={icon} size={20} color={Color.text.primary} />
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------

/** Fila etiqueta/valor de solo lectura, para bloques de datos. */
function InfoRowBase({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  /** La última fila de un bloque no lleva línea inferior. */
  last?: boolean;
}): ReactElement {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={Type.caption}>{label}</Text>
      <Text style={[Type.bodyStrong, styles.infoValue]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export const InfoRow = memo(InfoRowBase);

/** Nota breve de confirmación, con marca de verificación. */
function NoticeBase({ message }: { message: string }): ReactElement {
  return (
    <View style={styles.notice} accessibilityRole="alert">
      <Icon name="check" size={16} color={Color.success.text} />
      <Text style={[Type.caption, styles.noticeText]}>{message}</Text>
    </View>
  );
}

export const Notice = memo(NoticeBase);

/** Separador con una palabra en medio («o»). */
function OrDividerBase({ label }: { label: string }): ReactElement {
  return (
    <View style={styles.orDivider}>
      <View style={styles.orLine} />
      <Text style={Type.label}>{label}</Text>
      <View style={styles.orLine} />
    </View>
  );
}

export const OrDivider = memo(OrDividerBase);

/** Envoltorio de una fila de acciones alineadas a la derecha. */
export function RowActions({ children }: { children: ReactNode }): ReactElement {
  return <View style={styles.rowActions}>{children}</View>;
}

const SEGMENT_PADDING = 4;

const styles = StyleSheet.create({
  field: {
    marginBottom: Space.lg,
  },
  fieldLabel: {
    marginBottom: Space.sm,
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    minHeight: 50,
    paddingHorizontal: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    backgroundColor: Color.surface.sunken,
  },
  input: {
    flex: 1,
    // El campo ya centra su contenido; sin esto Android reserva su propio
    // relleno vertical y el texto queda descolgado respecto al icono.
    paddingVertical: 0,
    color: Color.text.primary,
  },
  fieldHint: {
    marginTop: Space.sm,
  },
  fieldError: {
    marginTop: Space.sm,
    color: Color.danger.text,
  },
  segmented: {
    flexDirection: "row",
    padding: SEGMENT_PADDING,
    borderRadius: Radius.md,
    backgroundColor: Color.surface.sunken,
    borderWidth: 1,
    borderColor: Color.border.subtle,
    marginBottom: Space.lg,
  },
  segmentThumb: {
    position: "absolute",
    top: SEGMENT_PADDING,
    left: SEGMENT_PADDING,
    bottom: SEGMENT_PADDING,
    borderRadius: Radius.sm,
    backgroundColor: Color.surface.raised,
    borderWidth: 1,
    borderColor: Color.border.default,
  },
  segment: {
    flex: 1,
    minHeight: HIT_TARGET - Space.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Space.sm,
  },
  segmentLabel: {
    color: Color.text.muted,
  },
  segmentLabelActive: {
    color: Color.text.primary,
  },
  chip: {
    minWidth: HIT_TARGET,
    minHeight: HIT_TARGET - Space.sm,
    paddingHorizontal: Space.md,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.surface.raised,
    borderWidth: 1,
    borderColor: Color.border.default,
  },
  chipSelected: {
    backgroundColor: Color.accent.surface,
    borderColor: Color.accent.border,
  },
  chipPressed: {
    backgroundColor: Color.surface.interactive,
    borderColor: Color.border.strong,
  },
  chipLabel: {
    color: Color.text.secondary,
    fontVariant: ["tabular-nums"],
  },
  chipLabelSelected: {
    color: Color.accent.text,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Space.xl,
  },
  stepperButton: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.surface.raised,
    borderWidth: 1,
    borderColor: Color.border.default,
  },
  stepperButtonPressed: {
    backgroundColor: Color.surface.interactive,
    borderColor: Color.border.strong,
  },
  stepperValue: {
    minWidth: 72,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  disabled: {
    opacity: DISABLED_OPACITY,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.lg,
    paddingVertical: Space.md,
    borderBottomWidth: 1,
    borderBottomColor: Color.border.subtle,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoValue: {
    flexShrink: 1,
    textAlign: "right",
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    marginTop: Space.lg,
  },
  noticeText: {
    color: Color.success.text,
  },
  orDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    marginBottom: Space.lg,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: Color.border.subtle,
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
  },
});
