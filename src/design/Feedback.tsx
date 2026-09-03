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
import { useColors, useThemedStyles } from "@/design/theme";
import {
  Duration,
  Radius,
  Space,
  Type,
  type Palette,
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

/*
  Funciones de la paleta y no constantes: una constante de módulo se evalúa una
  vez y se quedaría con los tonos del tema con el que arrancó el proceso.
*/
function toneSurface(
  c: Palette,
  tone: Tone,
): { backgroundColor: string; borderColor: string } {
  const source = tone === "neutral"
    ? { backgroundColor: c.surface.raised, borderColor: c.border.default }
    : { backgroundColor: c[tone === "accent" ? "accent" : tone].surface,
        borderColor: c[tone === "accent" ? "accent" : tone].border };
  return source;
}

function toneText(c: Palette, tone: Tone): string {
  if (tone === "neutral") return c.text.secondary;
  return c[tone].text;
}

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
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  return (
    <View style={[styles.pill, toneSurface(colors, tone)]}>
      {icon != null ? (
        <Icon name={icon} size={13} color={toneText(colors, tone)} />
      ) : null}
      <Text style={[Type.label, { color: toneText(colors, tone) }]}>{label}</Text>
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
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  return (
    <View style={[styles.pill, styles.statPill, toneSurface(colors, tone)]}>
      <Text style={Type.label}>{label}</Text>
      <Text style={[Type.metricSmall, { color: toneText(colors, tone) }]}>
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
/*
 * La paleta entra como parámetro porque esto no es un componente y no puede
 * llamar a un gancho: quien pinta la cifra ya tiene `useColors()` y la trae.
 */
export function scoreTone(c: Palette, score: number): string {
  if (score >= 90) {
    return c.success.text;
  }
  // La línea entre el ámbar y el rojo es exactamente la de «acierto»: el color
  // y el marcador tienen que estar de acuerdo sobre si el intento valió.
  if (isHit(score)) {
    return c.warning.text;
  }
  return c.danger.text;
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
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
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
              tone === "success" ? colors.success.default : colors.accent.default,
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
  const styles = useThemedStyles(createStyles);
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
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
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
          color={index < value ? colors.warning.default : colors.text.faint}
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
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  return (
    <View style={[styles.banner, style]} accessibilityRole="alert">
      <View style={styles.bannerIcon}>
        <Icon name="alert" size={20} color={colors.danger.default} />
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
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={22} color={colors.text.muted} />
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
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent.default} />
      <Text style={[Type.caption, styles.loadingLabel]}>{label}</Text>
    </View>
  );
}

export const Loading = memo(LoadingBase);

const createStyles = (c: Palette) =>
  StyleSheet.create({
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
    backgroundColor: c.surface.sunken,
    borderWidth: 1,
    borderColor: c.border.subtle,
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
    color: c.text.faint,
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
    backgroundColor: c.danger.surface,
    borderWidth: 1,
    // El rojo vivo, no el canto apagado que usan las pastillas. Es la única
    // superficie de la app cuyo trabajo es interrumpir.
    borderColor: c.danger.default,
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
    color: c.danger.text,
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
    backgroundColor: c.surface.raised,
    borderWidth: 1,
    borderColor: c.border.default,
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
