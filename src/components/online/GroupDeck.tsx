import { memo, type ReactElement } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import type { GroupSummary } from "@/api/types";
import { usePressScale } from "@/design/Button";
import { Icon, type IconName } from "@/design/Icon";
import { useColors, useThemedStyles } from "@/design/theme";
import {
  HIT_SLOP,
  Radius,
  Space,
  Type,
  type Palette,
  type SpectrumTone,
} from "@/design/tokens";
import { t } from "@/i18n";
import { playTick } from "@/utils/sound";
import { selectionTick } from "@/utils/haptics";

/**
 * La baraja de un grupo: con qué imágenes se juega su reto diario.
 *
 * Hay dos, y **no son simétricas**. Los logos son lo que ha jugado siempre todo
 * el mundo: el catálogo del juego los define por *ausencia* de categoría —ver
 * `utils/catalog`— y un grupo que no elige nada juega con ellos. Las banderas
 * son una desviación deliberada: 243 banderas del mundo y ningún logo.
 *
 * Esa asimetría es la que manda en todo lo de este fichero:
 *
 *  - **Solo las banderas llevan color.** El cian es el pigmento de los modos de
 *    banderas desde que existen —el de solitario y el de grupo, ver la nota del
 *    tono en `design/tokens`—, así que reaparece aquí diciendo lo mismo. Un
 *    grupo de logos no lleva marca ninguna, porque «lo normal» no es un estado
 *    que haya que señalar: si los dos llevasen pastilla, la pastilla dejaría de
 *    significar nada y habría que leerla para saber qué pone.
 *  - **Se elige al crear el grupo y ahí se acaba.** No hay forma de cambiarla
 *    después, ni siquiera siendo el dueño. No es una limitación técnica: la
 *    clasificación de una temporada es la suma de las jornadas jugadas dentro
 *    de su ventana, y cambiar de baraja a mitad sumaría dos juegos distintos en
 *    la misma columna.
 *
 * El cian **no** se gasta en el verde azulado de la sección de grupos por un
 * motivo práctico: son vecinos, y una pastilla cian junto a un botón verde
 * azulado se lee a media luz como el mismo color puesto dos veces.
 */

/** El pigmento de las banderas, el mismo que sus dos modos de siempre. */
const FLAGS_TONE: SpectrumTone = "cyan";

/** El globo terráqueo, el mismo icono que llevan esos dos modos. */
const FLAGS_ICON: IconName = "globe";

// ---------------------------------------------------------------------------
// El indicador
// ---------------------------------------------------------------------------

/**
 * «Banderas», en una pastilla cian, allá donde se hable de un grupo.
 *
 * **Devuelve `null` en los grupos de logos**, y ahí está casi todo su valor:
 * no es una etiqueta de estado que haya que leer para saber cuál de dos cosas
 * es, es una señal que o está o no está. Sale en la lista de grupos, en el menú
 * principal, en la cinta de la ficha y en los ajustes, y en los cuatro sitios
 * quiere decir exactamente lo mismo.
 *
 * `compact` le quita la palabra y deja el globo: es para las filas, donde la
 * pastilla comparte sitio con el estado de la temporada y con el punto de
 * avisos, y tres etiquetas seguidas convierten una fila en un formulario. La
 * palabra no se pierde, se va a `accessibilityLabel` — y la enseña entera la
 * ficha del grupo, que es donde se entra.
 */
function DeckBadgeBase({
  flagsOnly,
  compact = false,
}: {
  flagsOnly: boolean;
  compact?: boolean;
}): ReactElement | null {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();

  if (!flagsOnly) {
    return null;
  }

  const label = t("online.groups.deck.flagsShort");

  return (
    <View
      style={[styles.badge, compact && styles.badgeCompact]}
      accessible
      accessibilityLabel={label}
    >
      <Icon
        name={FLAGS_ICON}
        size={13}
        color={colors.spectrum[FLAGS_TONE].icon}
      />
      {compact ? null : (
        <Text style={[Type.label, { color: colors.spectrum[FLAGS_TONE].icon }]}>
          {label}
        </Text>
      )}
    </View>
  );
}

export const DeckBadge = memo(DeckBadgeBase);

/**
 * Lo que un lector de pantalla tiene que oír de un grupo, baraja incluida.
 *
 * Las filas se anuncian como un solo elemento, así que lo que se cuele en el
 * galón —la pastilla, el punto rojo— se ve pero no se oye. Esto compone la
 * frase entera en un sitio, porque hay tres listas que pintan la misma fila y
 * con la frase escrita en cada una se desincronizan a la primera.
 */
export function groupVoice(group: GroupSummary): string {
  const parts = [group.name];
  if (group.flagsOnly) parts.push(t("online.groups.deck.flagsShort"));
  if (group.unreadCount > 0) parts.push(t("online.groups.unread"));
  return parts.join(". ");
}

// ---------------------------------------------------------------------------
// El selector
// ---------------------------------------------------------------------------

interface DeckOption {
  flagsOnly: boolean;
  icon: IconName;
  titleKey: "online.groups.deck.logos" | "online.groups.deck.flags";
  hintKey:
    | "online.groups.deck.logosHint"
    | "online.groups.deck.flagsHint";
}

const OPTIONS: DeckOption[] = [
  {
    flagsOnly: false,
    // La paleta, no un logotipo: el modo son marcas, pero lo que se adivina de
    // ellas es el color. Es el mismo icono que lleva «Multicolor» en el menú
    // de modos, que es el otro sitio donde la respuesta es un color de marca.
    icon: "palette",
    titleKey: "online.groups.deck.logos",
    hintKey: "online.groups.deck.logosHint",
  },
  {
    flagsOnly: true,
    icon: FLAGS_ICON,
    titleKey: "online.groups.deck.flags",
    hintKey: "online.groups.deck.flagsHint",
  },
];

/**
 * Elegir la baraja al crear el grupo.
 *
 * ## Por qué no es un interruptor
 *
 * «Solo banderas» encendido o apagado habría sido una línea de código, y dice
 * una cosa falsa: que hay un juego y un modificador. Son dos barajas, y apagar
 * el interruptor no es «no hacer nada», es elegir la de logos. Con dos casillas
 * las dos opciones tienen nombre y las dos dicen qué te va a tocar, que es lo
 * único que hace falta saber para escoger.
 *
 * ## Por qué tampoco es otro control segmentado
 *
 * Porque la tarjeta ya abre con uno —«Crear / Unirme»—, y dos raíles de
 * pastillas idénticos, uno encima del otro, obligan a leer los dos para saber
 * cuál es cuál. Las casillas se distinguen del control de arriba por su forma
 * antes de leer nada.
 *
 * La seleccionada se tiñe y lleva el canto superior en su pigmento, que es el
 * mismo recurso que usan las tarjetas de sección y las baldosas del menú: en
 * esta app, un canto de color arriba significa «esto es de esta familia». La de
 * logos se tiñe con el acento de la casa y no con un pigmento propio, porque
 * los logos no son una familia: son el catálogo a secas.
 */
function DeckPickerBase({
  value,
  onChange,
  disabled = false,
}: {
  /** `true` si el grupo va a ser de solo banderas. */
  value: boolean;
  onChange: (flagsOnly: boolean) => void;
  disabled?: boolean;
}): ReactElement {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.picker}>
      <Text style={Type.label}>{t("online.groups.deck.label")}</Text>

      <View
        style={styles.options}
        accessibilityRole="radiogroup"
        accessibilityLabel={t("online.groups.deck.label")}
      >
        {OPTIONS.map((option) => (
          <DeckTile
            key={option.titleKey}
            option={option}
            selected={value === option.flagsOnly}
            disabled={disabled}
            onPress={() => onChange(option.flagsOnly)}
          />
        ))}
      </View>

      {/*
        El aviso va debajo y no arriba: aquí es donde está el ojo justo antes
        de pulsar «Crear grupo», que es el momento en que deja de poder
        cambiarse.
      */}
      <Text style={[Type.caption, styles.pickerHint]}>
        {t("online.groups.deck.hint")}
      </Text>
    </View>
  );
}

export const DeckPicker = memo(DeckPickerBase);

function DeckTile({
  option,
  selected,
  disabled,
  onPress,
}: {
  option: DeckOption;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}): ReactElement {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const press = usePressScale(0.975);

  /*
    El pigmento de la casilla elegida. Las banderas traen el suyo; los logos
    tiran del acento, que es lo que esta app usa para decir «esto es lo que
    está seleccionado» en todos los demás controles.
  */
  const skin = option.flagsOnly
    ? {
        wash: colors.spectrum[FLAGS_TONE].surface,
        edge: colors.spectrum[FLAGS_TONE].border,
        mark: colors.spectrum[FLAGS_TONE].pigment,
        icon: colors.spectrum[FLAGS_TONE].icon,
      }
    : {
        wash: colors.accent.surface,
        edge: colors.accent.border,
        mark: colors.accent.default,
        icon: colors.accent.text,
      };

  return (
    <Animated.View style={[styles.tileWrap, press.style]}>
      <Pressable
        onPress={() => {
          if (disabled || selected) return;
          selectionTick();
          playTick();
          onPress();
        }}
        onPressIn={disabled ? undefined : press.onPressIn}
        onPressOut={disabled ? undefined : press.onPressOut}
        disabled={disabled}
        hitSlop={HIT_SLOP}
        style={[
          styles.tile,
          selected && {
            backgroundColor: skin.wash,
            borderColor: skin.edge,
            borderTopColor: skin.mark,
          },
        ]}
        accessibilityRole="radio"
        accessibilityState={{ selected, checked: selected, disabled }}
        accessibilityLabel={t(option.titleKey)}
        accessibilityHint={t(option.hintKey)}
      >
        <Icon
          name={option.icon}
          size={20}
          color={selected ? skin.icon : colors.text.muted}
        />
        <Text
          style={[
            Type.bodyStrong,
            !selected && styles.tileTitleIdle,
          ]}
          numberOfLines={1}
        >
          {t(option.titleKey)}
        </Text>
        <Text style={[Type.caption, styles.tileHint]}>
          {t(option.hintKey)}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// El bloque de solo lectura
// ---------------------------------------------------------------------------

/**
 * La baraja del grupo en los ajustes: qué se juega y que ya no cambia.
 *
 * Es texto y no el selector desactivado a propósito, por lo mismo que el
 * nombre del grupo se le enseña como texto a quien no puede renombrarlo: un
 * control apagado invita a intentarlo, y aquí no hay nada que intentar. Dice
 * también **por qué** no cambia, porque «no se puede» a secas se lee como una
 * carencia de la app y no como la regla que es.
 */
function DeckNoteBase({ flagsOnly }: { flagsOnly: boolean }): ReactElement {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();

  const tone = flagsOnly
    ? colors.spectrum[FLAGS_TONE].icon
    : colors.text.secondary;

  return (
    <View style={styles.note}>
      <View style={styles.noteIcon}>
        <Icon name={flagsOnly ? FLAGS_ICON : "palette"} size={18} color={tone} />
      </View>

      <View style={styles.noteBody}>
        <Text style={Type.label}>{t("online.groups.deck.label")}</Text>
        <Text style={[Type.heading, styles.noteTitle]}>
          {t(flagsOnly ? "online.groups.deck.flags" : "online.groups.deck.logos")}
        </Text>
        <Text style={Type.caption}>
          {t(
            flagsOnly
              ? "online.groups.deck.flagsHint"
              : "online.groups.deck.logosHint",
          )}
        </Text>
        <Text style={[Type.caption, styles.noteFixed]}>
          {t("online.groups.deck.fixed")}
        </Text>
      </View>
    </View>
  );
}

export const DeckNote = memo(DeckNoteBase);

const createStyles = (c: Palette) =>
  StyleSheet.create({
    // -- Pastilla -----------------------------------------------------------
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: Space.xs,
      // Las mismas medidas que `Pill`: en la cinta de la ficha van una al lado
      // de la otra, y dos pastillas de altos distintos se leen como un fallo.
      paddingVertical: Space.xs + 1,
      paddingHorizontal: Space.sm + 2,
      borderRadius: Radius.pill,
      borderWidth: 1,
      backgroundColor: c.spectrum.cyan.surface,
      borderColor: c.spectrum.cyan.border,
    },
    badgeCompact: {
      // Ajustada al glifo: sin la palabra, el relleno horizontal de una
      // pastilla la dejaba como una cápsula vacía con algo dentro.
      paddingHorizontal: Space.xs + 1,
      paddingVertical: Space.xs,
    },

    // -- Selector -----------------------------------------------------------
    picker: {
      gap: Space.sm,
      marginBottom: Space.md,
    },
    options: {
      flexDirection: "row",
      gap: Space.sm,
    },
    pickerHint: {
      color: c.text.muted,
    },
    tileWrap: {
      flex: 1,
    },
    tile: {
      flex: 1,
      gap: Space.xs,
      paddingVertical: Space.md,
      paddingHorizontal: Space.md,
      borderRadius: Radius.lg,
      borderWidth: 1,
      // El canto de arriba existe siempre, aunque sin elegir vaya del color del
      // borde: si apareciera al seleccionar, la casilla crecería 2 puntos y las
      // dos dejarían de estar a la misma altura.
      borderTopWidth: 3,
      backgroundColor: c.surface.raised,
      borderColor: c.border.default,
      borderTopColor: c.border.default,
    },
    tileTitleIdle: {
      color: c.text.secondary,
    },
    tileHint: {
      color: c.text.muted,
    },

    // -- Bloque de ajustes ---------------------------------------------------
    note: {
      flexDirection: "row",
      gap: Space.md,
    },
    noteIcon: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: Radius.md,
      backgroundColor: c.surface.sunken,
      borderWidth: 1,
      borderColor: c.border.default,
    },
    noteBody: {
      flex: 1,
      gap: Space.xxs,
    },
    noteTitle: {
      marginBottom: Space.xxs,
    },
    noteFixed: {
      marginTop: Space.xs,
      color: c.text.muted,
    },
  });
