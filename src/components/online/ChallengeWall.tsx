import { memo, type ReactElement } from "react";
import { Pressable, Text, View } from "react-native";

import type { DailyGroupStatus, GroupSummary } from "@/api/types";
import { RoundRing, type SolvedRound } from "@/design/RoundRing";
import { useColors, useThemedStyles } from "@/design/theme";
import {
  GROUP_TONES,
  Radius,
  Space,
  Type,
  tintForKey,
  type GroupTone,
  type Palette,
} from "@/design/tokens";
import { t } from "@/i18n";
import type { StoredRound } from "@/online/attempts";

/**
 * El muro: los retos de hoy, uno por baldosa.
 *
 * ## Qué sustituye, y por qué
 *
 * Al carrusel de tarjetas. Aquel tenía un problema que no se arreglaba
 * moviéndolo de sitio: su tarjeta era **el mismo objeto** que el héroe de la
 * ficha de un grupo —anillo grande, logo dentro, borde de aurora, botón azul—,
 * así que las dos pantallas principales del modo online se veían iguales.
 *
 * Aquí la pieza se repite en pequeño en vez de mandar en grande, y eso le
 * cambia el significado: **un anillo grande es un reto; tres pequeños son un
 * día**. La ficha del grupo sigue enseñando el suyo a tamaño completo; el menú
 * los enseña todos juntos, que es lo único que la app no dejaba hacer sin ir
 * abriendo grupos de uno en uno.
 *
 * ## El dial no se mueve
 *
 * Va centrado en la baldosa **siempre**, jugado o no, y se rellena igual que en
 * el resto de la app: un arco por ronda, cada uno con el color que enviaste y
 * recortado a tu acierto. Sin jugar son arcos vacíos —la forma de la tarea— y
 * en el centro hay un interrogante, que es literalmente lo que el juego te
 * pregunta.
 *
 * ## De dónde sale el color de una baldosa
 *
 * Del propio grupo: `tintForKey` reparte los seis tonos de `groupTint` a partir
 * del `id`, así que cada grupo tiene su color sin que nadie lo elija y sin
 * guardar nada. La baldosa lo lleva en el relleno, el borde, el canto de arriba,
 * el monograma del fondo y el interrogante del dial.
 *
 * La primera versión tiraba de `spectrum`, y era un error de escala: esos tonos
 * están calculados para teñir un chip de 36 puntos detrás de un icono, y a
 * tamaño de baldosa se leen como negro sucio. Además tres de ellos caben en 33
 * grados de matiz, así que dos baldosas contiguas podían salir prácticamente del
 * mismo color. `groupTint` está calculado para áreas grandes y con los matices
 * repartidos; el porqué entero está en `design/tokens.ts`.
 *
 * ## Y por qué no se repiten
 *
 * El hash reparte bien a lo largo de muchos grupos, pero en un muro de tres una
 * coincidencia es perfectamente posible — y el color aquí no decora, **es lo que
 * distingue una baldosa de otra**. Así que el tono que sale del `id` es una
 * preferencia, no una asignación: si ya lo lleva otra baldosa visible, se pasa
 * al siguiente libre. Ver `assignTints`.
 */

export interface WallItem {
  group: GroupSummary;
  /** Rondas del reto de hoy. 0 mientras no se sepa: se pintan cinco. */
  rounds: number;
  /** El desglose del intento de hoy, del almacén local. */
  solved: StoredRound[] | null;
  status: DailyGroupStatus | undefined;
}

interface ChallengeWallProps {
  items: WallItem[];
  /** Abre la ficha del grupo. Ver la nota de `Tile`. */
  onOpen: (group: GroupSummary) => void;
}

/**
 * Diámetro del dial según el ancho de la baldosa.
 *
 * La primera baldosa ocupa la fila entera y las demás van a media anchura, así
 * que el dial no puede medir lo mismo en las dos: a 132 en media baldosa, los
 * arcos tocarían el borde y el nombre se quedaría sin sitio.
 */
const DIAL_WIDE = 128;
const DIAL_HALF = 92;

/**
 * Un tono por baldosa, sin repetir.
 *
 * Cada grupo prefiere el tono que le sale de su `id` —así el mismo grupo tiene
 * siempre el mismo color— y si está cogido, avanza al siguiente libre. Con seis
 * tonos y un muro de tres como mucho, siempre hay hueco.
 *
 * Va por orden de la lista y no por «el que llegue»: el orden del muro es
 * estable dentro de una jornada, así que el reparto también lo es. Si mañana
 * cambia el orden de la cola, un grupo puede cambiar de color — es el precio de
 * garantizar que dos baldosas nunca sean iguales, y merece la pena: un color que
 * se repite no distingue nada, y uno que cambia de un día para otro solo se nota
 * si estabas mirando.
 */
function assignTints(items: WallItem[]): GroupTone[] {
  const taken = new Set<GroupTone>();

  return items.map((item) => {
    const preferred = tintForKey(item.group.id);
    const from = GROUP_TONES.indexOf(preferred);

    for (let step = 0; step < GROUP_TONES.length; step += 1) {
      const candidate = GROUP_TONES[(from + step) % GROUP_TONES.length];
      if (!taken.has(candidate)) {
        taken.add(candidate);
        return candidate;
      }
    }

    return preferred;
  });
}

function ChallengeWallBase({
  items,
  onOpen,
}: ChallengeWallProps): ReactElement {
  const styles = useThemedStyles(wallStyles);

  const tints = assignTints(items);
  const [first, ...rest] = items;

  return (
    <View style={styles.wall}>
      {first ? (
        <Tile item={first} tone={tints[0]} wide onOpen={onOpen} />
      ) : null}

      {rest.length > 0 ? (
        <View style={styles.row}>
          {rest.map((item, index) => (
            <Tile
              key={item.group.id}
              item={item}
              tone={tints[index + 1]}
              /*
                Si abajo solo hay una baldosa, ocupa la fila entera y le toca el
                dial grande. `wide` no es «es la primera», es «ocupa todo el
                ancho»: con dos grupos, la de abajo también lo hace.
              */
              wide={rest.length === 1}
              onOpen={onOpen}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export const ChallengeWall = memo(ChallengeWallBase);

function Tile({
  item,
  tone,
  wide = false,
  onOpen,
}: {
  item: WallItem;
  tone: GroupTone;
  wide?: boolean;
  onOpen: (group: GroupSummary) => void;
}): ReactElement {
  const styles = useThemedStyles(wallStyles);
  const colors = useColors();

  const { group, status, solved } = item;
  const skin = colors.groupTint[tone];

  const played = status?.bestScore != null;
  const attemptsLeft = status?.attemptsLeft ?? 2;
  const canPlay = (status?.canPlay ?? true) && attemptsLeft > 0;

  /**
   * Las rondas guardadas mandan sobre las del reto: si se jugó, son tantas como
   * arcos hay que pintar y no dependen de que el reto se haya podido cargar. El
   * cinco de reserva es el tamaño habitual de una jornada, y evita que el
   * anillo cambie de número de sectores a mitad de carga.
   */
  const rounds = solved?.length || (item.rounds > 0 ? item.rounds : 5);

  const ringSolved: SolvedRound[] | null =
    solved?.map((round) => ({
      hex: round.answerHex,
      accuracy: round.accuracy,
    })) ?? null;

  const size = wide ? DIAL_WIDE : DIAL_HALF;

  return (
    <Pressable
      /*
        SIEMPRE a la ficha del grupo, nunca directa al tablero.

        La baldosa enseña un resumen —cuántas rondas, cuántos intentos, cómo fue
        el último—, y entrar a jugar desde un resumen es empezar una partida sin
        haber visto la cuenta atrás, la clasificación ni de quién es el grupo. La
        ficha es donde está todo eso, y su botón de jugar es el que decide si hoy
        se puede: aquí no hay que duplicar esa lógica.

        Y hay un motivo de forma: un toque en una tarjeta debería abrirla, no
        disparar la acción más irreversible que contiene.
      */
      onPress={() => onOpen(group)}
      style={({ pressed }) => [
        styles.tile,
        wide ? styles.tileWide : styles.tileHalf,
        {
          backgroundColor: skin.wash,
          borderColor: skin.edge,
          borderTopColor: skin.mark,
        },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={group.name}
      accessibilityHint={t("online.hub.tileOpenHint")}
    >
      {/*
        El monograma: la inicial del grupo, enorme y al diez por ciento, sangrada
        por la esquina. Es el «algo del grupo» del fondo — dice de quién es la
        baldosa sin ocupar una línea de texto, y al ser una letra no compite con
        el dial, que es un círculo.
      */}
      <Text
        style={[
          styles.monogram,
          wide ? styles.monogramWide : null,
          { color: skin.mark },
        ]}
        pointerEvents="none"
        accessible={false}
      >
        {group.name.slice(0, 1).toUpperCase()}
      </Text>

      <RoundRing
        size={size}
        rounds={rounds}
        stroke={wide ? 11 : 9}
        solved={ringSolved}
        /*
          La pista se pinta con el BORDE DEL TONO, no con el de la paleta: la
          baldosa está teñida, y el gris de siempre desaparece encima de ella.
        */
        track={skin.edge}
      >
        {played ? (
          <Text style={[Type.metric, styles.score]}>
            {String(status?.bestScore ?? 0)}
          </Text>
        ) : (
          /*
            El interrogante es la pregunta del juego, literal: «¿de qué color
            es?». Va en el tono del grupo y no en el texto normal para que se
            lea como parte del dial y no como una etiqueta puesta encima.
          */
          <Text style={[styles.ask, { color: skin.mark }]}>?</Text>
        )}
      </RoundRing>

      <View style={styles.caption}>
        <Text style={Type.bodyStrong} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={[Type.caption, styles.meta]} numberOfLines={1}>
          {/*
            Los intentos mandan sobre el «hecho». Un reto jugado con un intento
            todavía en la mano no está hecho: está a medias, y esa línea es lo
            único que lo dice.
          */}
          {canPlay
            ? t(
                attemptsLeft === 1
                  ? "online.hub.attemptsOne"
                  : "online.hub.attempts",
                { count: attemptsLeft },
              )
            : played
              ? t("online.hub.tileDone")
              : t("online.hub.tileClosed")}
        </Text>
      </View>
    </Pressable>
  );
}

const wallStyles = (colors: Palette) => ({
  wall: {
    gap: Space.md,
    marginBottom: Space.xl,
  },
  row: {
    flexDirection: "row" as const,
    gap: Space.md,
  },
  tile: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: Radius.lg,
    borderWidth: 1,
    // El canto de arriba, más grueso y en el pigmento del grupo: el mismo
    // recurso que ya usan las tarjetas de sección. Ver `Card`.
    borderTopWidth: 3,
    // Recorta el monograma, que va sangrado por la esquina a propósito.
    overflow: "hidden" as const,
    paddingVertical: Space.xl,
    paddingHorizontal: Space.md,
  },
  tileWide: {
    width: "100%" as const,
  },
  tileHalf: {
    flex: 1,
  },
  monogram: {
    position: "absolute" as const,
    right: -10,
    bottom: -26,
    fontSize: 104,
    lineHeight: 112,
    fontWeight: "700" as const,
    // Al diez por ciento el monograma es textura, no un elemento que se lea.
    // Por encima de quince empieza a discutirle el sitio al dial.
    opacity: 0.1,
  },
  monogramWide: {
    fontSize: 140,
    lineHeight: 150,
    bottom: -36,
  },
  score: {
    color: colors.text.primary,
  },
  ask: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  caption: {
    alignItems: "center" as const,
    gap: Space.xxs,
    marginTop: Space.lg,
    // El texto nunca puede tapar el monograma ni al revés: va por encima.
    zIndex: 1,
  },
  meta: {
    /*
      `secondary`, no `muted`. Sobre la baldosa teñida —que es bastante más clara
      que una tarjeta normal— el apagado se queda en 3,1:1 y no llega al mínimo;
      este pasa de 4,5:1 contra los seis tonos, comprobado uno a uno.
    */
    color: colors.text.secondary,
  },
  pressed: {
    opacity: 0.72,
  },
});
