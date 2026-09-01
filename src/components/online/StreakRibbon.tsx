import { memo, useMemo, type ReactElement } from "react";
import { Pressable, Text, View } from "react-native";

import { Flame } from "@/design/Flame";
import { useThemedStyles } from "@/design/theme";
import { Radius, Space, Type, type Palette } from "@/design/tokens";
import { getLocale, t } from "@/i18n";
import { dayOfMonth, shiftDay, weekdayOf } from "@/online/streak";

/**
 * La racha, dibujada como un calendario de dos semanas.
 *
 * ## Por qué un calendario y no una cifra
 *
 * Un número dice cuánto llevas; **no dice que hoy puedas perderlo, ni cuánto te
 * queda para cerrar la semana**. Aquí se ven las dos cosas: las casillas
 * encendidas son los días que jugaste, la de hoy está hueca hasta que juegas, y
 * las que vienen después están ahí, vacías y esperando. Una semana a medio
 * llenar pica; un «12» no.
 *
 * ## Por qué esta versión sí se entiende
 *
 * La anterior era una fila de cuadrados abstractos con cuatro colores y ninguna
 * etiqueta: un acertijo. El problema no eran los cuatro estados, era que nada
 * decía **qué** era cada cuadrado.
 *
 * Con la rejilla de siete columnas, la inicial del día encima y el número del mes
 * dentro, la forma se reconoce antes de mirar los colores — es un calendario, y
 * en un calendario relleno significa hecho. Los colores dejan de ser un código
 * que hay que aprender y pasan a ser el acabado de algo que ya se entendía.
 *
 * ## Los cuatro estados
 *
 *  - **Encendida** (ámbar relleno) — jugaste ese día.
 *  - **Vacía** (gris) — no jugaste. Es lo que rompe la racha.
 *  - **Hoy sin jugar** (borde discontinuo ámbar) — el único hueco que puedes
 *    llenar ahora mismo, y por eso es el único con trazo cortado.
 *  - **Por venir** (muy tenue) — todavía no ha pasado. No es un fallo, así que
 *    no puede pintarse como el gris de un día perdido.
 *
 * ## Lo que el calendario NO sabe
 *
 * Los días jugados salen de `online/streak`, que empezó a guardarlos hace poco;
 * de más atrás solo se puede reconstruir la racha en curso —eso sí, de forma
 * exacta— y nada anterior a su arranque. Un día del que no se sabe nada se pinta
 * como no jugado, que es lo único que la app puede afirmar y lo que ya dice el
 * contador de al lado. Nunca se contradicen entre sí.
 */

/** Dos semanas: la pasada y la actual. Es lo que cabe sin encoger las casillas. */
const WEEKS = 2;
const DAYS_PER_WEEK = 7;

interface StreakRibbonProps {
  /** Días seguidos. Es la cifra grande; el calendario va aparte. */
  count: number;
  /** Hoy ya cuenta: hay puntuación en algún grupo. */
  lit: boolean;
  /** Jornadas jugadas conocidas, `YYYY-MM-DD`. */
  days: readonly string[];
  /**
   * La jornada de hoy, la del reto. `null` si no se pudo cargar: entonces no hay
   * calendario que pintar y queda solo la línea de la cifra.
   */
  todayKey: string | null;
  onPress?: () => void;
}

interface Cell {
  key: string;
  day: number;
  state: "done" | "missed" | "today" | "future";
}

/**
 * El primer día de la semana del idioma activo: lunes en español y francés,
 * domingo en inglés. Sale de `Intl` en vez de estar escrito a mano, que es lo
 * que hace que la rejilla no salga descolocada al cambiar de idioma.
 *
 * `weekInfo` es reciente y no está en todos los motores; sin él se cae a lunes,
 * que es lo que toca en el idioma principal de la app.
 */
function firstWeekday(locale: string): number {
  try {
    const info = (
      new Intl.Locale(locale) as Intl.Locale & {
        weekInfo?: { firstDay?: number };
      }
    ).weekInfo;
    // `Intl` numera 1 lunes … 7 domingo; aquí se usa 0 domingo … 6 sábado.
    return info?.firstDay != null ? info.firstDay % 7 : 1;
  } catch {
    return 1;
  }
}

function buildGrid(
  todayKey: string,
  played: ReadonlySet<string>,
  weekStart: number,
): Cell[] {
  // Cuánto hay que retroceder desde hoy hasta el principio de esta semana.
  const offset = (weekdayOf(todayKey) - weekStart + 7) % 7;
  // La rejilla arranca una semana antes de ese principio.
  const start = shiftDay(todayKey, -(offset + DAYS_PER_WEEK * (WEEKS - 1)));

  return Array.from({ length: WEEKS * DAYS_PER_WEEK }, (_, index) => {
    const key = shiftDay(start, index);
    const state: Cell["state"] = played.has(key)
      ? "done"
      : key === todayKey
        ? "today"
        : key > todayKey
          ? "future"
          : "missed";

    return { key, day: dayOfMonth(key), state };
  });
}

/** Las iniciales de los siete días, en el idioma activo. */
function weekdayInitials(locale: string, weekStart: number): string[] {
  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => {
    // 4 de enero de 2026 fue domingo: sirve de ancla para sacar las iniciales
    // sin depender de la fecha de hoy.
    const date = new Date(Date.UTC(2026, 0, 4 + ((weekStart + index) % 7)));
    return date.toLocaleDateString(locale, {
      weekday: "narrow",
      timeZone: "UTC",
    });
  });
}

function StreakRibbonBase({
  count,
  lit,
  days,
  todayKey,
  onPress,
}: StreakRibbonProps): ReactElement | null {
  const styles = useThemedStyles(ribbonStyles);
  const locale = getLocale();

  const grid = useMemo(() => {
    if (todayKey == null) {
      return null;
    }
    const weekStart = firstWeekday(locale);
    return {
      cells: buildGrid(todayKey, new Set(days), weekStart),
      initials: weekdayInitials(locale, weekStart),
    };
  }, [todayKey, days, locale]);

  if (count <= 0 && (grid == null || !grid.cells.some((c) => c.state === "done"))) {
    // Ni racha ni un solo día jugado: un calendario entero vacío el primer día
    // señala lo que te falta, no lo que llevas. Mejor no enseñarlo.
    return null;
  }

  const body = (
    <View style={styles.block}>
      <View style={styles.head}>
        <Flame size={18} lit={lit} />
        <Text style={[Type.metricSmall, styles.count]}>
          {t("online.hub.streakDays", { count })}
        </Text>
        <Text style={[Type.caption, styles.hint]} numberOfLines={1}>
          {t(lit ? "online.hub.streakToday" : "online.hub.streakPending")}
        </Text>
      </View>

      {grid ? (
        <View style={styles.calendar}>
          <View style={styles.week}>
            {grid.initials.map((initial, index) => (
              <Text key={index} style={[Type.label, styles.initial]}>
                {initial}
              </Text>
            ))}
          </View>

          {Array.from({ length: WEEKS }, (_, week) => (
            <View key={week} style={styles.week}>
              {grid.cells
                .slice(week * DAYS_PER_WEEK, (week + 1) * DAYS_PER_WEEK)
                .map((cell) => (
                  <View
                    key={cell.key}
                    style={[
                      styles.cell,
                      cell.state === "done" && styles.cellDone,
                      cell.state === "missed" && styles.cellMissed,
                      cell.state === "today" && styles.cellToday,
                      cell.state === "future" && styles.cellFuture,
                    ]}
                  >
                    <Text
                      style={[
                        styles.number,
                        cell.state === "done" && styles.numberDone,
                        cell.state === "today" && styles.numberToday,
                        cell.state === "future" && styles.numberFuture,
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </View>
                ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  if (onPress == null) {
    return body;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // El calendario entero se anuncia con una sola frase. Catorce casillas
      // leídas una a una no son un dato, son un castigo.
      accessibilityLabel={t(
        lit ? "online.hub.streakSecured" : "online.hub.streakAtRisk",
        { count },
      )}
      style={({ pressed }) => (pressed ? styles.pressed : null)}
    >
      {body}
    </Pressable>
  );
}

export const StreakRibbon = memo(StreakRibbonBase);

const ribbonStyles = (colors: Palette) => ({
  block: {
    padding: Space.md,
    borderRadius: Radius.lg,
    backgroundColor: colors.surface.raised,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: Space.xl,
  },
  head: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: Space.sm,
    marginBottom: Space.md,
  },
  count: {
    color: colors.ember.text,
  },
  hint: {
    marginLeft: "auto" as const,
  },
  calendar: {
    gap: Space.xs,
    // Con tope: en una tablet, catorce casillas repartidas por 700 puntos serían
    // botones enormes de algo que no se pulsa.
    maxWidth: 360,
    alignSelf: "center" as const,
    width: "100%" as const,
  },
  week: {
    flexDirection: "row" as const,
    gap: Space.xs,
  },
  initial: {
    flex: 1,
    textAlign: "center" as const,
    color: colors.text.faint,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: Radius.sm - 2,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 1,
    borderColor: "transparent",
  },
  /** Jugado. Relleno lleno: en un calendario, lleno es hecho. */
  cellDone: {
    backgroundColor: colors.ember.text,
  },
  /** No jugado. El hueco que rompe la racha. */
  cellMissed: {
    backgroundColor: colors.surface.sunken,
    borderColor: colors.border.subtle,
  },
  /**
   * Hoy, sin jugar. Es el único hueco que se puede llenar ahora mismo, y por eso
   * es el único con el trazo cortado: dice «esto está por hacer» sin leyenda.
   */
  cellToday: {
    backgroundColor: colors.ember.surface,
    borderColor: colors.ember.text,
    borderStyle: "dashed" as const,
    borderWidth: 1.5,
  },
  /** Por venir. No es un fallo, así que no se pinta como uno. */
  cellFuture: {
    borderColor: colors.border.subtle,
  },
  number: {
    fontFamily: Type.metricSmall.fontFamily,
    fontSize: 11,
    fontWeight: "600" as const,
    fontVariant: ["tabular-nums" as const],
    color: colors.text.muted,
  },
  numberDone: {
    // Tinta oscura sobre el ámbar: el mismo trato que la etiqueta de un botón
    // con pigmento. Encima del relleno lleno, el texto claro desaparecería.
    color: colors.ember.surface,
  },
  numberToday: {
    color: colors.ember.text,
  },
  numberFuture: {
    color: colors.text.faint,
  },
  pressed: {
    opacity: 0.7,
  },
});
