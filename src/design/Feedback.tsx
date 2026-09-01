import { memo, useEffect, type ReactElement } from "react";
import {
  ActivityIndicator,
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
  type WithTimingConfig,
} from "react-native-reanimated";

import { Button } from "@/design/Button";
import { Icon, type IconName } from "@/design/Icon";
import {
  Color,
  Duration,
  Radius,
  Space,
  Type,
} from "@/design/tokens";
import { t } from "@/i18n";
import { isHit } from "@/utils/colorScore";

/**
 * Componentes de estado y de dato.
 *
 * Un éxito, un error, un vacío y una carga se ven igual en toda la aplicación
 * porque salen de aquí. Antes cada pantalla componía su propio banner rojo y su
 * propio estado vacío con un emoji distinto.
 */

// ---------------------------------------------------------------------------
// Pastilla
// ---------------------------------------------------------------------------

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const TONE_SURFACE: Record<Tone, { backgroundColor: string; borderColor: string }> =
  {
    neutral: {
      backgroundColor: Color.surface.raised,
      borderColor: Color.border.default,
    },
    accent: {
      backgroundColor: Color.accent.surface,
      borderColor: Color.accent.border,
    },
    success: {
      backgroundColor: Color.success.surface,
      borderColor: Color.success.border,
    },
    warning: {
      backgroundColor: Color.warning.surface,
      borderColor: Color.warning.border,
    },
    danger: {
      backgroundColor: Color.danger.surface,
      borderColor: Color.danger.border,
    },
  };

const TONE_TEXT: Record<Tone, string> = {
  neutral: Color.text.secondary,
  accent: Color.accent.text,
  success: Color.success.text,
  warning: Color.warning.text,
  danger: Color.danger.text,
};

interface PillProps {
  label: string;
  tone?: Tone;
  icon?: IconName;
}

/** Etiqueta compacta de estado. */
function PillBase({
  label,
  tone = "neutral",
  icon,
}: PillProps): ReactElement {
  return (
    <View style={[styles.pill, TONE_SURFACE[tone]]}>
      {icon != null ? (
        <Icon name={icon} size={13} color={TONE_TEXT[tone]} />
      ) : null}
      <Text style={[Type.label, { color: TONE_TEXT[tone] }]}>{label}</Text>
    </View>
  );
}

export const Pill = memo(PillBase);

/**
 * Par etiqueta/valor con una etiqueta al lado. A diferencia de `Pill`, aquí el
 * valor es el protagonista: para temporizadores y rachas durante la partida.
 */
function StatPillBase({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: Tone;
}): ReactElement {
  return (
    <View style={[styles.pill, styles.statPill, TONE_SURFACE[tone]]}>
      <Text style={Type.label}>{label}</Text>
      <Text style={[Type.metricSmall, { color: TONE_TEXT[tone] }]}>
        {value}
      </Text>
    </View>
  );
}

export const StatPill = memo(StatPillBase);

/**
 * Color de una puntuación de 0 a 100.
 *
 * Vive aquí porque lo usan el resultado de un intento y el de una ronda en
 * grupo, y una cifra del 92 % debe salir del mismo verde en los dos sitios. Es
 * la única excepción a que el color solo signifique estado: aquí la cifra *es*
 * el estado.
 */
export function scoreTone(score: number): string {
  if (score >= 90) {
    return Color.success.text;
  }
  // La línea entre el ámbar y el rojo es exactamente la de «acierto»: el color
  // y el marcador tienen que estar de acuerdo sobre si el intento valió.
  if (isHit(score)) {
    return Color.warning.text;
  }
  return Color.danger.text;
}

// ---------------------------------------------------------------------------
// Progreso
// ---------------------------------------------------------------------------

const PROGRESS_TIMING: WithTimingConfig = { duration: Duration.slow };

/**
 * Barra de progreso.
 *
 * El relleno se anima porque el movimiento es el que comunica el avance: si
 * saltase de golpe, el jugador no vería que ha progresado, solo que la barra
 * está en otro sitio. Antes se pintaba con un `width` en porcentaje sin animar.
 */
function ProgressBarBase({
  value,
  tone = "accent",
}: {
  /** 0 a 1. */
  value: number;
  tone?: "accent" | "success";
}): ReactElement {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(Math.min(1, Math.max(0, value)), PROGRESS_TIMING));
  }, [progress, value]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.get() * 100}%`,
  }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          {
            backgroundColor:
              tone === "success" ? Color.success.default : Color.accent.default,
          },
          fillStyle,
        ]}
      />
    </View>
  );
}

export const ProgressBar = memo(ProgressBarBase);

// ---------------------------------------------------------------------------
// Dato
// ---------------------------------------------------------------------------

/** Cifra con su rótulo debajo. Para bloques de resumen. */
function StatBase({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  /** Contexto de la cifra: «de 1.240 jugadores». */
  hint?: string;
}): ReactElement {
  return (
    <View style={styles.stat}>
      <Text style={Type.metric}>{value}</Text>
      <Text style={[Type.label, styles.statLabel]}>{label}</Text>
      {hint != null ? (
        <Text style={[Type.caption, styles.statHint]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export const Stat = memo(StatBase);

/**
 * Valoración de 0 a 3 estrellas.
 *
 * Sustituye a `starString()`, que concatenaba «★★★» y «☆☆☆» recortando cadenas.
 * Con caracteres, el espaciado dependía de la fuente del sistema y las estrellas
 * llenas y vacías no tenían el mismo peso visual.
 */
function StarRatingBase({
  value,
  total = 3,
  size = 18,
}: {
  value: number;
  total?: number;
  size?: number;
}): ReactElement {
  return (
    <View
      style={styles.stars}
      accessibilityRole="text"
      accessibilityLabel={t("a11y.stars", { value, total })}
    >
      {Array.from({ length: total }, (_, index) => (
        <Icon
          key={index}
          name="star"
          size={size}
          filled={index < value}
          color={index < value ? Color.warning.default : Color.text.faint}
        />
      ))}
    </View>
  );
}

export const StarRating = memo(StarRatingBase);

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------

/**
 * Algo ha fallado, y qué se puede hacer al respecto.
 *
 * ## Por qué pesa lo que pesa
 *
 * Era un renglón de 13 puntos con un enlace de texto debajo, y en una pantalla
 * llena se leía como un pie de página. Cuando esto aparece es porque **lo que
 * el jugador venía a hacer no ha ocurrido**, así que tiene que verse antes que
 * nada: canto rojo vivo —no el apagado del resto de las superficies teñidas—,
 * el mensaje al tamaño del cuerpo de texto y el reintento como botón de verdad.
 *
 * El enlace de texto no era un botón: su objetivo táctil medía lo que medía la
 * palabra, trece puntos de alto, muy por debajo del mínimo de las dos
 * plataformas. Ahora es un `Button` como los demás, con sus 44.
 *
 * ## Por qué trae sus propios márgenes
 *
 * Porque no forma parte del ritmo de la página: se cuela entre dos cosas que ya
 * estaban colocadas. Sin margen propio quedaba pegado a lo de arriba y a lo de
 * abajo en casi todas las pantallas, y cada sitio lo resolvía —o no— por su
 * cuenta. Aquí el aire va con el componente, y `style` queda para el caso raro
 * que necesite otra cosa.
 *
 * ## Qué dice
 *
 * El mensaje cuenta **qué ha pasado**; el botón dice **qué hacer**. Por eso el
 * texto no acaba en «inténtalo otra vez»: eso ya lo pone el botón, y repetirlo
 * es hacer que dos elementos hagan el mismo trabajo.
 */
function ErrorBannerBase({
  message,
  onRetry,
  retryLabel,
  style,
}: {
  message: string;
  /** Sin esto no hay botón: para un fallo cuyo reintento es otra acción. */
  onRetry?: () => void;
  /** Por defecto, «Reintentar». Solo se pasa si la acción tiene otro nombre. */
  retryLabel?: string;
  style?: StyleProp<ViewStyle>;
}): ReactElement {
  return (
    <View style={[styles.banner, style]} accessibilityRole="alert">
      <View style={styles.bannerIcon}>
        <Icon name="alert" size={20} color={Color.danger.default} />
      </View>

      <View style={styles.bannerBody}>
        <Text style={[Type.body, styles.bannerMessage]}>{message}</Text>

        {onRetry != null ? (
          <Button
            label={retryLabel ?? t("common.retry")}
            icon="retry"
            variant="secondary"
            size="md"
            fullWidth={false}
            onPress={onRetry}
            style={styles.bannerAction}
          />
        ) : null}
      </View>
    </View>
  );
}

export const ErrorBanner = memo(ErrorBannerBase);

/** Estado vacío: icono apagado, título y pista. */
function EmptyStateBase({
  icon,
  title,
  hint,
}: {
  icon: IconName;
  title: string;
  hint?: string;
}): ReactElement {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={22} color={Color.text.muted} />
      </View>
      <Text style={[Type.bodyStrong, styles.centered]}>{title}</Text>
      {hint != null ? (
        <Text style={[Type.caption, styles.emptyHint]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export const EmptyState = memo(EmptyStateBase);

/** Indicador de carga con rótulo. */
function LoadingBase({ label }: { label: string }): ReactElement {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={Color.accent.default} />
      <Text style={[Type.caption, styles.loadingLabel]}>{label}</Text>
    </View>
  );
}

export const Loading = memo(LoadingBase);

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.xs,
    paddingVertical: Space.xs + 1,
    paddingHorizontal: Space.sm + 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  statPill: {
    gap: Space.sm,
    paddingVertical: Space.sm - 1,
  },
  progressTrack: {
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Color.surface.sunken,
    borderWidth: 1,
    borderColor: Color.border.subtle,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: Radius.pill,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Space.md,
  },
  statLabel: {
    marginTop: Space.xs,
  },
  statHint: {
    marginTop: Space.xxs,
    color: Color.text.faint,
    textAlign: "center",
  },
  stars: {
    flexDirection: "row",
    gap: Space.xs,
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Space.md,
    padding: Space.lg,
    borderRadius: Radius.md,
    backgroundColor: Color.danger.surface,
    borderWidth: 1,
    // El rojo vivo, no el canto apagado que usan las pastillas. Es la única
    // superficie de la app cuyo trabajo es interrumpir.
    borderColor: Color.danger.default,
    // El aire va con el componente. Ver la nota de `ErrorBannerBase`.
    marginTop: Space.md,
    marginBottom: Space.lg,
  },
  bannerIcon: {
    // Un pelo abajo: el icono mide 20 y la línea de texto 22, así que sin esto
    // el símbolo queda alto respecto a la primera línea.
    paddingTop: 1,
  },
  bannerBody: {
    flex: 1,
  },
  bannerMessage: {
    color: Color.danger.text,
  },
  bannerAction: {
    marginTop: Space.md,
    alignSelf: "flex-start",
  },
  empty: {
    alignItems: "center",
    paddingVertical: Space.xxxl,
    paddingHorizontal: Space.xl,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Color.surface.raised,
    borderWidth: 1,
    borderColor: Color.border.default,
    marginBottom: Space.lg,
  },
  emptyHint: {
    marginTop: Space.sm,
    textAlign: "center",
    maxWidth: 300,
  },
  centered: {
    textAlign: "center",
  },
  loading: {
    alignItems: "center",
    paddingVertical: Space.huge,
  },
  loadingLabel: {
    marginTop: Space.md,
  },
});
