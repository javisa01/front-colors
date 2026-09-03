import { useRouter } from "expo-router";
import type { ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Polygon } from "react-native-svg";

import { ColorWheel, WHEEL_SIDE_EXTRA } from "@/components/ColorWheel";
import { SoftGlow } from "@/design/Ambient";
import { Button } from "@/design/Button";
import { RoundRing } from "@/design/RoundRing";
import { useColors, useThemedStyles } from "@/design/theme";
import {
  Radius,
  Space,
  Type,
  type Palette,
} from "@/design/tokens";
import { t } from "@/i18n";
import type { HSVColor } from "@/types/challenge";
import { hexToHSV, hsvToHex } from "@/utils/color";
import { calculateColorScore, getScoreMessage } from "@/utils/colorScore";
import { impact, selectionTick } from "@/utils/haptics";
import { setTutorialSeen } from "@/utils/storage";

/**
 * Bienvenida y tutorial de la primera vez.
 *
 * ## Qué enseña, y por qué solo eso
 *
 * Tres cosas, que son las tres que nadie deduce mirando: que al emblema **le
 * falta un color**, que el disco es **tono por ángulo e intensidad por
 * distancia**, y que la nota **es continua, no un sí o un no**. Todo lo demás
 * —los modos, los grupos, el reto diario— se descubre solo.
 *
 * ## La regla que ordena las animaciones
 *
 * Hay una sola línea argumental, y es el color: entra en el emblema, **sale
 * cuando pulsas**, se convierte en la rueda, vuelve al emblema con tu dedo y
 * acaba partido en dos muestras. Ninguna animación de aquí es un adorno suelto;
 * si alguna deja de contar ese viaje, sobra.
 *
 * Por eso el emblema es **un solo objeto que no se mueve** en todo el tutorial:
 * lo que cambia es la interfaz a su alrededor. Con un dibujo distinto por paso,
 * el vaciado no podría ser continuo.
 *
 * ## Por qué el emblema no es un logo del catálogo
 *
 * Porque el tutorial no es una ronda. Un logo real trae consigo lo que uno ya
 * sabe de esa marca, y aquí el objeto solo tiene que ser **una forma con un
 * color que se pueda memorizar**: cuanto menos diga por su cuenta, más limpio
 * queda lo que se está enseñando. Y de paso, la aplicación no se estrena con
 * una marca ajena en pantalla.
 *
 * ## Frontera offline/online
 *
 * Esta pantalla va **antes** de elegir entre online y offline, así que no
 * importa nada de `src/api/` ni de `src/online/`. Funciona sin backend, sin
 * cuenta y sin red.
 */

/** El color que hay que memorizar. */
const TUTORIAL_COLOR = "#F2762B";
const TUTORIAL_HSV = hexToHSV(TUTORIAL_COLOR);

/** Dónde arranca la rueda. Lejos del objetivo: hay que moverla para acertar. */
const START_HSV: HSVColor = { h: 208, s: 46, v: 72 };

const WHEEL_SIZE = 168;
/**
 * `RoundRing` reserva un 21 % de su diámetro como margen interior, así que el
 * emblema tiene que caber en `RING_SIZE * 0.58`. Con más, se sale por encima
 * del trazo y el aro y el dibujo se leen como una sola mancha.
 */
const RING_SIZE = 188;
const MARK_SIZE = 104;

/** Diámetro de cada círculo de la bienvenida y cuánto se solapan en reposo. */
const BALL = 92;
const BALL_OFFSET = 24;

const GHOST_SIZE = 26;
/**
 * El halo naranja de detrás del emblema. **Menor que el aro**: si sobresale,
 * dejan de leerse como una cosa y su luz compite con el trazo del anillo.
 */
const HALO_SIZE = 170;

type Phase = "welcome" | "memorize" | "find" | "result";

export default function WelcomeScreen(): ReactElement {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<Phase>("welcome");
  /** Lo que está pintado en el emblema ahora mismo. */
  const [paint, setPaint] = useState(TUTORIAL_COLOR);
  const [selected, setSelected] = useState<HSVColor>(START_HSV);
  const [score, setScore] = useState(0);
  /** Cierra la puerta mientras corre una transición. */
  const [busy, setBusy] = useState(false);
  /**
   * Si la bienvenida ha terminado de revelarse.
   *
   * El `Pressable` de los círculos está en el árbol desde el primer fotograma
   * —lo que entra con opacidad es la vista de dentro, no el área táctil—, así
   * que sin esto se podía pulsar donde iban a salir y saltarse la revelación.
   * La pantalla está cerrada hasta que hay algo que pulsar.
   */
  const [revealed, setRevealed] = useState(false);
  /**
   * Si la rueda ya se ha tocado.
   *
   * Hasta entonces el emblema sigue con el hueco puesto, aunque la rueda ya
   * tenga un color cargado: rellenarlo solo porque el selector ha aparecido
   * diría que el color lo pone la app, y lo pone el jugador.
   */
  const [touched, setTouched] = useState(false);

  const mineHex = hsvToHex(selected.h, selected.s, selected.v);

  const handleWheel = useCallback((hsv: HSVColor) => {
    setSelected(hsv);
    setTouched(true);
  }, []);

  // ---------------------------------------------------------------- valores
  const greeting = useSharedValue(0);
  const name = useSharedValue(0);
  const balls = useSharedValue(0);
  const cta = useSharedValue(0);
  /** 0 juntos, 1 separados y girados. */
  const apart = useSharedValue(0);
  const welcomeOut = useSharedValue(0);
  const pulse = useSharedValue(0);
  const hint = useSharedValue(0);
  const step = useSharedValue(0);
  /** Respiración del halo naranja, y si está encendido. */
  const breath = useSharedValue(0);
  const haloOn = useSharedValue(1);
  /** La onda que sale del emblema al vaciarse. */
  const ripple = useSharedValue(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      cancelAnimation(pulse);
      cancelAnimation(hint);
      cancelAnimation(breath);
    },
    [breath, hint, pulse],
  );

  /*
    El halo respira despacio y poco: su trabajo es decir «mira aquí»
    mientras memorizas, no llamar la atención por su cuenta.
  */
  useEffect(() => {
    breath.set(
      withRepeat(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    );
  }, [breath]);

  // ------------------------------------------------------- la revelación
  /*
    El nombre no comparte protagonismo con nada: los círculos no salen hasta
    que ha terminado de asentarse, y la puerta no se abre hasta que está la
    llamada a la acción.
  */
  useEffect(() => {
    greeting.set(withDelay(260, withTiming(1, { duration: 520 })));
    name.set(
      withDelay(560, withSpring(1, { damping: 16, stiffness: 90, mass: 1.1 })),
    );
    balls.set(withDelay(1500, withSpring(1, { damping: 11, stiffness: 120 })));
    cta.set(withDelay(2020, withTiming(1, { duration: 520 })));

    // El destello del aro empieza con la llamada a la acción: antes no hay
    // nada que pulsar, y un aro brillando sobre un botón muerto es una
    // promesa falsa.
    //
    // El reloj es lineal y dura 2,6 s, pero el destello ocupa solo el primer
    // tercio: el resto es silencio. Es lo que lo hace puntual en vez de un
    // latido continuo, que acabaría leyéndose como decoración.
    pulse.set(
      withDelay(
        2020,
        withRepeat(
          withTiming(1, { duration: 2600, easing: Easing.linear }),
          -1,
          false,
        ),
      ),
    );

    later(() => setRevealed(true), 2540);
  }, [balls, cta, greeting, later, name, pulse]);

  const ready = phase === "welcome" && revealed && !busy;

  // -------------------------------------------- salir de la bienvenida
  const leaveWelcome = useCallback(() => {
    if (busy) {
      return;
    }
    setBusy(true);
    impact();
    cancelAnimation(pulse);
    pulse.set(0);

    apart.set(
      withTiming(1, { duration: 1250, easing: Easing.inOut(Easing.cubic) }),
    );
    // El desvanecido empieza con los círculos ya girando, no después: lo que se
    // ve es que se van llevándose la pantalla, no dos animaciones seguidas.
    welcomeOut.set(withDelay(420, withTiming(1, { duration: 620 })));

    later(() => {
      setPhase("memorize");
      setBusy(false);
    }, 1120);
  }, [apart, busy, later, pulse, welcomeOut]);

  // ------------------------------------------------------- el vaciado
  /*
    El color no se va solo: se va cuando pulsas «Siguiente». Se interpola a
    mano en unos pocos pasos; 42 ms entre pasos es el mismo ritmo al que ya
    avisa `ColorWheel` mientras se arrastra, así que es un coste conocido.
  */
  const drain = useCallback(() => {
    if (busy) {
      return;
    }
    setBusy(true);
    selectionTick();

    // La onda sale del emblema en el mismo gesto en que el color se va: no
    // es un adorno de transición, es el color saliendo.
    ripple.set(0);
    ripple.set(
      withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }),
    );
    // Y el halo se apaga con él: un resplandor naranja detrás del hueco
    // estaría enseñando justo el color que hay que recordar.
    haloOn.set(withTiming(0, { duration: 520 }));

    const steps = 14;
    const stepMs = 42;
    for (let i = 1; i <= steps; i += 1) {
      later(() => {
        setPaint(mixHex(TUTORIAL_COLOR, colors.border.strong, i / steps));
      }, i * stepMs);
    }

    // La rueda no brota hasta que el hueco está hecho del todo.
    later(() => {
      setPhase("find");
      step.set(
        withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
      );
      setBusy(false);

      // El dedo fantasma entra cuando la rueda ya está en su sitio.
      hint.set(
        withDelay(
          620,
          withRepeat(
            withTiming(1, {
              duration: 2200,
              easing: Easing.inOut(Easing.quad),
            }),
            -1,
            false,
          ),
        ),
      );
    }, steps * stepMs);
  }, [busy, colors.border.strong, haloOn, hint, later, ripple, step]);

  // ------------------------------------------------------- la nota
  const check = useCallback(() => {
    if (busy) {
      return;
    }
    impact();
    cancelAnimation(hint);
    setScore(calculateColorScore(selected, TUTORIAL_HSV));
    setPhase("result");
    step.set(
      withTiming(2, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );
  }, [busy, hint, selected, step]);

  const finish = useCallback(() => {
    void setTutorialSeen(true);
    // `replace` y no `push`: volver atrás no debe devolver a un tutorial hecho.
    router.replace("/");
  }, [router]);

  // ---------------------------------------------------------------- estilos
  const greetingStyle = useAnimatedStyle(() => ({
    opacity: greeting.get(),
    transform: [{ translateY: interpolate(greeting.get(), [0, 1], [10, 0]) }],
  }));

  const nameStyle = useAnimatedStyle(() => ({
    opacity: name.get(),
    transform: [{ scale: interpolate(name.get(), [0, 1], [1.14, 1]) }],
  }));

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: cta.get() * (1 - apart.get()),
  }));

  const pairStyle = useAnimatedStyle(() => ({
    opacity: balls.get(),
    transform: [
      { scale: interpolate(balls.get(), [0, 1], [0.35, 1]) },
      { rotate: `${apart.get() * 560}deg` },
    ],
  }));

  const violetStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(apart.get(), [0, 1], [-BALL_OFFSET, -200]) },
    ],
  }));

  const roseStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(apart.get(), [0, 1], [BALL_OFFSET, 200]) },
    ],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      pulse.get(),
      [0, 0.05, 0.34, 1],
      [0.16, 0.7, 0, 0],
      "clamp",
    ),
    transform: [
      {
        scale: interpolate(pulse.get(), [0, 0.34, 1], [1, 1.38, 1.38], "clamp"),
      },
    ],
  }));

  const welcomeStyle = useAnimatedStyle(() => ({
    opacity: 1 - welcomeOut.get(),
  }));

  /*
    El halo solo existe mientras el naranja está en pantalla. En cuanto se
    vacía el emblema se apaga, y no vuelve: durante la mezcla, un resplandor
    del color objetivo sería una chuleta.
  */
  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloOn.get() * (0.26 + breath.get() * 0.12),
    transform: [{ scale: 1 + breath.get() * 0.06 }],
  }));

  /*
    Dos aros, no uno. Uno solo se lee como un pulso de interfaz; dos, con el
    segundo saliendo un poco después y más flojo, se leen como la onda de una
    gota — que es lo que se quiere decir: algo ha caído aquí.
  */
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ripple.get(), [0, 0.12, 1], [0, 0.75, 0], "clamp"),
    transform: [{ scale: interpolate(ripple.get(), [0, 1], [0.88, 1.8]) }],
  }));

  const rippleLateStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ripple.get(), [0.18, 0.34, 1], [0, 0.45, 0], "clamp"),
    transform: [
      { scale: interpolate(ripple.get(), [0.18, 1], [0.88, 1.5], "clamp") },
    ],
  }));

  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(step.get(), [0, 1, 2], [1.16, 1, 1.04]) }],
  }));

  const wheelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(step.get(), [0, 1], [0, 1], "clamp"),
    transform: [{ scale: interpolate(step.get(), [0, 1], [0.4, 1], "clamp") }],
  }));

  const resultStyle = useAnimatedStyle(() => ({
    opacity: interpolate(step.get(), [1, 2], [0, 1], "clamp"),
    transform: [
      { translateY: interpolate(step.get(), [1, 2], [16, 0], "clamp") },
    ],
  }));

  /**
   * El dedo fantasma.
   *
   * Traza un arco desde cerca del centro hacia el borde: enseña **las dos cosas
   * que hace la rueda** —girar cambia el tono, alejarse sube la intensidad— sin
   * una sola palabra. Es lo que sustituye a la frase que explicaba el selector,
   * y desaparece en cuanto el dedo de verdad toca la rueda.
   *
   * Va **por encima**, en el sentido de las agujas del reloj: el recorrido
   * pasa por el borde superior del disco, que es donde no lo tapa el dedo al
   * imitarlo. La `y` se resta, igual que hace `ColorWheel`, así que ángulos
   * decrecientes son giro horario.
   */
  const ghostStyle = useAnimatedStyle(() => {
    const progress = hint.get();
    const radius = WHEEL_SIZE / 2;
    const angle = ((174 - progress * 168) * Math.PI) / 180;
    const distance = radius * (0.3 + progress * 0.54);

    return {
      opacity: interpolate(progress, [0, 0.12, 0.82, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: radius + distance * Math.cos(angle) - GHOST_SIZE / 2 },
        { translateY: radius - distance * Math.sin(angle) - GHOST_SIZE / 2 },
      ],
    };
  });

  const head = HEADS[phase === "welcome" ? "memorize" : phase];

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + Space.xl,
          paddingBottom: insets.bottom + Space.lg,
        },
      ]}
    >
      {/* ---------------------------- El tutorial ---------------------------- */}
      <View style={styles.head}>
        <Text style={Type.label}>{t(head.label)}</Text>
        <Text style={[Type.display, styles.title]}>
          {phase === "result" ? t(getScoreMessage(score)) : t(head.title)}
        </Text>

        {/*
          El progreso no son tres puntos: son tres muestras de pintura que se
          llenan con el color de verdad. Al terminar, la tira se lee de
          izquierda a derecha y cuenta el juego entero — el hueco, lo que
          pusiste, lo que era. Unos puntos numerados no codificarían nada.
        */}
        <View style={styles.strip}>
          <Chip color={phase === "memorize" ? null : colors.border.strong} />
          <Chip color={phase === "result" ? mineHex : null} />
          <Chip color={phase === "result" ? TUTORIAL_COLOR : null} />
        </View>
        <View style={styles.legend}>
          {/* Cada rótulo centrado bajo SU muestra, no pegado al borde. */}
          <Text style={[Type.label, styles.legendItem]}>
            {t("tutorial.chipHole")}
          </Text>
          <Text style={[Type.label, styles.legendItem]}>
            {t("tutorial.chipMine")}
          </Text>
          <Text style={[Type.label, styles.legendItem]}>
            {t("tutorial.chipReal")}
          </Text>
        </View>
      </View>

      <View style={styles.middle}>
        <View style={styles.markSlot}>
          {/* El halo naranja: la luz que el color deja detrás. */}
          <Animated.View pointerEvents="none" style={[styles.halo, haloStyle]}>
            <SoftGlow color={TUTORIAL_COLOR} size={HALO_SIZE} />
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[styles.ripple, rippleStyle]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.ripple, rippleLateStyle]}
          />

          <Animated.View style={markStyle}>
            {/*
            El aro es el mismo `RoundRing` del reto diario, con una sola ronda:
            se pinta con el color que enviaste y su longitud es tu precisión.
            Reutilizarlo no es ahorro de código — es que «cuánto te acercaste»
            tiene que verse igual aquí que en una jornada de verdad.
          */}
            <RoundRing
              size={RING_SIZE}
              rounds={1}
              stroke={8}
              solved={
                phase === "result" ? [{ hex: mineHex, accuracy: score }] : null
              }
            >
              <Cap
                size={MARK_SIZE}
                color={
                  phase === "welcome"
                    ? TUTORIAL_COLOR
                    : touched
                      ? mineHex
                      : paint
                }
              />
            </RoundRing>
          </Animated.View>
        </View>

        {phase === "find" ? (
          <Animated.View style={[styles.wheelSlot, wheelStyle]}>
            <ColorWheel
              initialColor={START_HSV}
              onChange={handleWheel}
              onChangeComplete={handleWheel}
              size={WHEEL_SIZE}
            />

            {/*
              El fantasma va encima de la rueda, y por eso este contenedor mide
              exactamente lo que mide el selector: `ColorWheel` centra su fila,
              así que el disco empieza en el borde izquierdo y su centro cae en
              `WHEEL_SIZE / 2`. `WHEEL_SIDE_EXTRA` lo publica el propio selector
              para no tener que adivinar el ancho del deslizador.
            */}
            {touched ? null : (
              <Animated.View
                pointerEvents="none"
                style={[styles.ghost, ghostStyle]}
              />
            )}
          </Animated.View>
        ) : null}

        {phase === "result" ? (
          <Animated.View style={[styles.result, resultStyle]}>
            <Text style={Type.metricHero}>{String(score)}</Text>

            <View style={styles.compare}>
              <Swatch color={mineHex} label={t("tutorial.chipMine")} />
              <Swatch color={TUTORIAL_COLOR} label={t("tutorial.chipReal")} />
            </View>
          </Animated.View>
        ) : null}
      </View>

      <View style={styles.foot}>
        {phase === "result" ? (
          <Text style={[Type.caption, styles.note]}>
            {t("tutorial.resultNote")}
          </Text>
        ) : null}

        <Button
          label={t(
            phase === "result"
              ? "tutorial.start"
              : phase === "find"
                ? "tutorial.check"
                : "tutorial.next",
          )}
          /*
            Dentro de una ronda el pigmento desaparece y el botón vuelve a ser
            claro sobre oscuro: el único color saturado de la pantalla es el del
            juego. Es la regla que ya sigue `Button` en el resto de la app.
          */
          tone={phase === "find" ? "neutral" : "violet"}
          disabled={busy}
          onPress={
            phase === "result" ? finish : phase === "find" ? check : drain
          }
        />

        {phase === "result" ? null : (
          <Button
            label={t("tutorial.skip")}
            variant="ghost"
            size="md"
            disabled={busy}
            onPress={finish}
          />
        )}
      </View>

      {/* ---------------------------- La bienvenida --------------------------
        Va por delante de todo y no lleva la tira de pasos: esta pantalla no es
        del tutorial, es de antes. Se desmonta al terminar su salida.
      */}
      {phase === "welcome" ? (
        <Animated.View
          style={[styles.welcome, welcomeStyle]}
          pointerEvents={ready ? "auto" : "none"}
        >
          <Animated.Text style={[Type.label, greetingStyle]}>
            {t("welcome.greeting")}
          </Animated.Text>

          <Animated.Text style={[Type.display, styles.brand, nameStyle]}>
            {t("welcome.name")}
          </Animated.Text>

          <Pressable
            onPress={leaveWelcome}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityLabel={t("welcome.continue")}
            style={styles.pairHit}
          >
            <Animated.View style={[styles.pair, pairStyle]}>
              {/*
                El aro late para decir dónde hay que tocar. Sin él, dos bolas
                sueltas en medio de una pantalla negra no dicen que se pulsan
                ellas y no la pantalla.
              */}
              <Animated.View style={[styles.tapRing, ringStyle]} />

              {/*
                Macizos y de borde limpio: son un botón, no atmósfera. Los dos
                tonos sí son los del fondo de la portada, que es lo que hace que
                la bienvenida y la app se lean como la misma cosa.
              */}
              <Animated.View
                style={[styles.ball, styles.ballViolet, violetStyle]}
              />
              <Animated.View
                style={[styles.ball, styles.ballRose, roseStyle]}
              />
            </Animated.View>
          </Pressable>

          <Animated.Text style={[Type.caption, styles.cta, ctaStyle]}>
            {t("welcome.cta")}
          </Animated.Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

/**
 * El encabezado de cada paso. El del resultado no lleva título propio: lo pone
 * `getScoreMessage`, que es el mismo veredicto que usa el juego.
 */
const HEADS = {
  memorize: { label: "landing.badge", title: "tutorial.memorize" },
  find: { label: "tutorial.findLabel", title: "tutorial.findTitle" },
  result: { label: "tutorial.accuracy", title: "tutorial.memorize" },
} as const;

/**
 * El emblema: una chapa dentada, generada por código.
 *
 * Los dientes salen de un radio que oscila —`R + amp·cos(n·θ)`— en vez de picos
 * rectos: una estrella se leería como una valoración, y esto tiene que leerse
 * como un objeto con una cara pintada. El cuerpo es la única parte que cambia
 * de color; el aro claro y el centro oscuro están para que ese color tenga
 * contra qué compararse.
 */
const CAP_POINTS = (() => {
  const radius = 56;
  const teeth = 22;
  const amplitude = 3.2;
  const points: string[] = [];

  for (let i = 0; i <= 240; i += 1) {
    const angle = (i / 240) * Math.PI * 2;
    const r = radius + amplitude * Math.cos(teeth * angle);
    const x = (80 + r * Math.cos(angle)).toFixed(2);
    const y = (80 + r * Math.sin(angle)).toFixed(2);
    points.push(`${x},${y}`);
  }

  return points.join(" ");
})();

function Cap({ size, color }: { size: number; color: string }): ReactElement {
  const colors = useColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160">
      <Polygon points={CAP_POINTS} fill={color} />
      <Circle
        cx={80}
        cy={80}
        r={37}
        fill="none"
        stroke={colors.text.primary}
        strokeWidth={7}
      />
      <Circle cx={80} cy={80} r={15} fill={colors.surface.canvas} />
    </Svg>
  );
}

function Chip({ color }: { color: string | null }): ReactElement {
  const styles = useThemedStyles(createStyles);
  return (
    <View
      style={[
        styles.chip,
        color != null && { backgroundColor: color, borderColor: color },
      ]}
    />
  );
}

function Swatch({
  color,
  label,
}: {
  color: string;
  label: string;
}): ReactElement {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.swatch}>
      <View style={[styles.swatchFill, { backgroundColor: color }]} />
      <Text style={Type.metricSmall}>{color}</Text>
      <Text style={Type.label}>{label}</Text>
    </View>
  );
}

/** Mezcla lineal de dos hexadecimales. Solo para el vaciado del emblema. */
function mixHex(from: string, to: string, amount: number): string {
  const parse = (hex: string): [number, number, number] => {
    const value = hex.replace("#", "");
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
    ];
  };

  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const mix = (a: number, b: number): string =>
    Math.round(a + (b - a) * amount)
      .toString(16)
      .padStart(2, "0");

  return `#${mix(r1, r2)}${mix(g1, g2)}${mix(b1, b2)}`.toUpperCase();
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.surface.canvas,
    paddingHorizontal: Space.xl,
  },

  // -- Cabecera del tutorial -------------------------------------------------
  head: {
    gap: Space.xs,
  },
  title: {
    marginTop: Space.xxs,
  },
  strip: {
    flexDirection: "row",
    gap: Space.xs,
    marginTop: Space.md,
  },
  chip: {
    flex: 1,
    height: 8,
    borderRadius: Radius.sm,
    backgroundColor: c.surface.sunken,
    borderWidth: 1,
    borderColor: c.border.subtle,
  },
  legend: {
    flexDirection: "row",
    gap: Space.xs,
    marginTop: Space.xs,
  },
  legendItem: {
    flex: 1,
    textAlign: "center",
  },

  // -- Banda central ---------------------------------------------------------
  middle: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Space.lg,
  },
  markSlot: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
    /*
      El hueco mide lo que el aro, no lo que el halo: si midiera 300, el paso
      de la rueda no cabria en una pantalla pequena. El halo y la onda se
      salen a proposito, y por eso el desborde se declara — Android recorta
      los hijos de una vista con mas alegria que iOS.
    */
    overflow: "visible",
  },
  halo: {
    position: "absolute",
    top: (RING_SIZE - HALO_SIZE) / 2,
    left: (RING_SIZE - HALO_SIZE) / 2,
    width: HALO_SIZE,
    height: HALO_SIZE,
  },
  ripple: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: TUTORIAL_COLOR,
  },
  wheelSlot: {
    width: WHEEL_SIZE + WHEEL_SIDE_EXTRA,
  },
  ghost: {
    position: "absolute",
    top: 0,
    left: 0,
    width: GHOST_SIZE,
    height: GHOST_SIZE,
    borderRadius: GHOST_SIZE / 2,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  result: {
    width: "100%",
    alignItems: "center",
    gap: Space.lg,
  },
  compare: {
    flexDirection: "row",
    gap: Space.md,
    width: "100%",
  },
  swatch: {
    flex: 1,
    gap: Space.xs,
    padding: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.border.default,
    backgroundColor: c.surface.raised,
  },
  swatchFill: {
    height: 44,
    borderRadius: Radius.sm,
  },

  // -- Pie -------------------------------------------------------------------
  foot: {
    gap: Space.sm,
  },
  note: {
    textAlign: "center",
  },

  // -- Bienvenida ------------------------------------------------------------
  welcome: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: c.surface.canvas,
    alignItems: "center",
    justifyContent: "center",
    gap: Space.lg,
    paddingHorizontal: Space.xl,
  },
  brand: {
    fontSize: 56,
    lineHeight: 62,
    letterSpacing: -1.6,
    textAlign: "center",
  },
  pairHit: {
    marginTop: Space.lg,
    padding: Space.md,
  },
  pair: {
    width: BALL + BALL_OFFSET * 2,
    height: BALL,
    alignItems: "center",
    justifyContent: "center",
  },
  tapRing: {
    position: "absolute",
    width: BALL + 44,
    height: BALL + 44,
    borderRadius: (BALL + 44) / 2,
    borderWidth: 1,
    borderColor: c.accent.text,
  },
  ball: {
    position: "absolute",
    width: BALL,
    height: BALL,
    borderRadius: BALL / 2,
  },
  /*
    Translúcidos, no macizos. Es lo único que hace que el solape enseñe la
    mezcla de los dos tonos en vez de que el de encima tape al de debajo — y
    esa mezcla es la idea entera de la pantalla: dos colores que hacen un
    tercero donde se tocan.
  */
  ballViolet: {
    backgroundColor: c.ambient.violet[0],
    opacity: 0.76,
  },
  ballRose: {
    backgroundColor: c.ambient.rose[0],
    opacity: 0.76,
  },
  cta: {
    marginTop: Space.md,
    textAlign: "center",
  },
  });
