import { LinearGradient } from "expo-linear-gradient";
import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  type ReactElement,
} from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";

import { Color, Duration, Radius, Space, Type } from "@/design/tokens";
import { t } from "@/i18n";
import type { HSVColor } from "@/types/challenge";
import { hsvToHexWorklet } from "@/utils/colorWorklets";
import { selectionTick } from "@/utils/haptics";
import { pointToHueSaturation, pointToValue } from "@/utils/hsvGeometry";

/**
 * Selector de color HSV.
 *
 * ## Por qué está escrito a mano
 *
 * Sustituye a `react-native-wheel-color-picker`, que tenía un fallo de raíz en
 * su arquitectura de estado. Aquella librería se usaba como componente
 * controlado, así que el ciclo era:
 *
 * ```
 *   ColorPicker --hex--> estado de la app --hex--> ColorPicker
 * ```
 *
 * Y en `componentDidUpdate` reaccionaba al hex entrante llamando a `animate()`
 * sin argumento `who`, lo que **sobrescribía su HSV interno** con
 * `hex2Hsv(color)` en cada frame del gesto. Su `rgb2Hsv` hace esto:
 *
 * ```js
 *   if (max === min) { h = 0 }   // acromático
 * ```
 *
 * Con saturación baja, la cuantización a 8 bits vuelve r≈g≈b, de modo que el
 * tono interno se reescribía a 0 (rojo) o saltaba a un valor arbitrario. Al
 * mover después la barra de brillo, su `updateValue` leía ese tono ya corrupto
 * y el color cambiaba de tono en lugar de solo de brillo. Ese era el bug.
 *
 * ## La corrección
 *
 * **El HSV es la única fuente de verdad y nunca vuelve del hexadecimal.** El
 * componente es no controlado: recibe un color inicial, y a partir de ahí el
 * hexadecimal es solo una salida derivada para pintar. Como el tono vive en
 * coma flotante y jamás se reconstruye desde un color de 8 bits, mover el brillo
 * es matemáticamente incapaz de tocar el tono o la saturación, tenga el color la
 * saturación que tenga — incluido exactamente 0.
 *
 * Para reposicionar el picker desde fuera (al pasar de reto) se usa el `ref`
 * imperativo, no una prop: así no existe ningún camino por el que un color de
 * salida pueda volver a entrar.
 *
 * ## Rendimiento
 *
 * El gesto vive entero en el hilo de UI. Pulgares, muestra, degradado del
 * deslizador y lectura hexadecimal se pintan con valores compartidos, así que
 * **arrastrar no provoca ni un solo re-render de React**. Al consumidor se le
 * avisa a intervalos (`NOTIFY_INTERVAL_MS`) porque repintar el logo SVG exige
 * reparsear el XML, y hacerlo a 60 fps era la causa del tirón al arrastrar
 * rápido; al soltar siempre se emite el valor exacto.
 */

export interface ColorWheelHandle {
  /** Reposiciona el selector. Único camino de entrada tras el montaje. */
  setColor: (hsv: HSVColor) => void;
}

interface ColorWheelProps {
  /** Color de arranque. Solo se lee al montar; después manda el `ref`. */
  initialColor: HSVColor;
  /** Se emite a intervalos mientras se arrastra. */
  onChange: (hsv: HSVColor) => void;
  /** Se emite al soltar, con el valor exacto. */
  onChangeComplete: (hsv: HSVColor) => void;
  /** Diámetro de la rueda. El deslizador toma esta misma altura. */
  size: number;
}

/**
 * Cada cuánto se avisa al consumidor mientras el dedo se mueve. 40 ms son 25
 * avisos por segundo: imperceptible en el logo, y deja el hilo de JS libre para
 * que el gesto no compita con el reparseo del SVG.
 */
const NOTIFY_INTERVAL_MS = 40;

const THUMB_SIZE = 28;
const SLIDER_WIDTH = 30;

/**
 * Lo que el selector ocupa **a la derecha de la rueda**: el deslizador y su
 * hueco.
 *
 * Se exporta para que quien quiera dibujar algo encima de la rueda sepa dónde
 * cae su centro sin adivinarlo. Hoy lo usa el tutorial, que pinta un dedo
 * fantasma trazando un arco: sin este dato tendría que copiar aquí dos
 * constantes privadas y romperse el día que cambiaran.
 */
export const WHEEL_SIDE_EXTRA = SLIDER_WIDTH + Space.lg;
/** Grosor del aro blanco del pulgar. Lo bastante para leerse sobre cualquier tono. */
const THUMB_RING = 3;

// ---------------------------------------------------------------------------
// Rueda estática
// ---------------------------------------------------------------------------

/**
 * `react-native-svg` no tiene degradado cónico, así que el disco de tono se
 * compone con cuñas de color macizo. 120 cuñas son 3° cada una y, con el
 * solapamiento de abajo, el escalonado deja de percibirse. El SVG se construye
 * una sola vez a nivel de módulo: es idéntico para cualquier tamaño porque se
 * dibuja sobre un `viewBox` normalizado.
 */
const WEDGE_COUNT = 120;
/** Solapamiento entre cuñas contiguas: sin él, el antialias deja costuras finas. */
const WEDGE_OVERLAP_DEG = 0.4;

function buildHueWedges(): ReactElement[] {
  const wedges: ReactElement[] = [];
  const step = 360 / WEDGE_COUNT;
  const cx = 50;
  const cy = 50;
  const r = 50;

  for (let index = 0; index < WEDGE_COUNT; index += 1) {
    const from = index * step;
    const to = from + step + WEDGE_OVERLAP_DEG;

    const a1 = (from * Math.PI) / 180;
    const a2 = (to * Math.PI) / 180;

    // El eje Y del SVG crece hacia abajo, así que se resta el seno para que el
    // tono avance en sentido antihorario, como en una rueda de color canónica:
    // rojo al este, amarillo arriba a la derecha, cian al oeste.
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy - r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy - r * Math.sin(a2);

    wedges.push(
      <Path
        key={index}
        d={`M${cx} ${cy} L${x1.toFixed(3)} ${y1.toFixed(3)} A${r} ${r} 0 0 0 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`}
        fill={`hsl(${from.toFixed(2)}, 100%, 50%)`}
      />,
    );
  }

  return wedges;
}

const HUE_WEDGES = buildHueWedges();

/**
 * Disco de tono y saturación. Memoizado sin props variables: se monta una vez
 * por partida y nunca vuelve a renderizarse, ni siquiera durante el gesto.
 */
const HueDisc = memo(function HueDisc(): ReactElement {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Defs>
        {/*
          La saturación es el radio: 0 en el centro, 100 en el borde. Se consigue
          fundiendo blanco opaco en el centro hacia blanco transparente al
          borde, encima de las cuñas de tono.
        */}
        <RadialGradient id="saturation" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {HUE_WEDGES}
      <Circle cx={50} cy={50} r={50} fill="url(#saturation)" />
    </Svg>
  );
});

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// ---------------------------------------------------------------------------

function ColorWheelBase(
  { initialColor, onChange, onChangeComplete, size }: ColorWheelProps,
  ref: React.Ref<ColorWheelHandle>,
): ReactElement {
  // El estado del selector: tres números en coma flotante, y nada más. No hay
  // ningún hexadecimal guardado del que se pueda re-derivar el tono.
  const hue = useSharedValue(initialColor.h);
  const saturation = useSharedValue(initialColor.s);
  const value = useSharedValue(initialColor.v);

  const lastNotifyAt = useSharedValue(0);

  const wheelRadius = size / 2;
  const sliderHeight = size;
  /** Recorrido útil del deslizador: el pulgar no puede salirse por los topes. */
  const sliderTravel = sliderHeight - THUMB_SIZE;

  const emitChange = useCallback(
    (h: number, s: number, v: number): void => {
      onChange({ h, s, v });
    },
    [onChange],
  );

  const emitComplete = useCallback(
    (h: number, s: number, v: number): void => {
      onChangeComplete({ h, s, v });
    },
    [onChangeComplete],
  );

  /** Avisa al consumidor como mucho cada `NOTIFY_INTERVAL_MS`. */
  const notifyThrottled = useCallback(() => {
    "worklet";
    const now = Date.now();
    if (now - lastNotifyAt.get() < NOTIFY_INTERVAL_MS) {
      return;
    }
    lastNotifyAt.set(now);
    runOnJS(emitChange)(hue.get(), saturation.get(), value.get());
  }, [emitChange, hue, lastNotifyAt, saturation, value]);

  const notifyFinal = useCallback(() => {
    "worklet";
    lastNotifyAt.set(0);
    runOnJS(emitComplete)(hue.get(), saturation.get(), value.get());
  }, [emitComplete, hue, lastNotifyAt, saturation, value]);

  useImperativeHandle(
    ref,
    () => ({
      setColor: (next: HSVColor): void => {
        // Reposicionamiento externo: se anima suave porque suele coincidir con
        // el cambio de reto, y un salto seco se lee como un fallo de pintado.
        hue.set(withTiming(next.h, { duration: Duration.base }));
        saturation.set(withTiming(next.s, { duration: Duration.base }));
        value.set(withTiming(next.v, { duration: Duration.base }));
      },
    }),
    [hue, saturation, value],
  );

  // -- Gesto de la rueda ---------------------------------------------------

  /**
   * Los dos worklets de posicionamiento van ANTES de los gestos que los usan, y
   * no después: el plugin de Babel de Reanimated reescribe una función marcada
   * `"worklet"` como una declaración léxica (`const`), que a diferencia de una
   * declaración de función no se eleva. Definirlos debajo hacía que el
   * `useMemo` del gesto los leyese dentro de su zona muerta temporal y el
   * componente reventaba al montar.
   */
  const applyWheelPosition = useCallback(
    (x: number, y: number): void => {
      "worklet";
      // La geometría vive en `hsvGeometry.ts` y está cubierta por tests. Aquí
      // solo se escribe en tono y saturación: `value` ni se lee.
      const next = pointToHueSaturation(x, y, wheelRadius);
      hue.set(next.h);
      saturation.set(next.s);

      notifyThrottled();
    },
    [hue, notifyThrottled, saturation, wheelRadius],
  );

  const applySliderPosition = useCallback(
    (y: number): void => {
      "worklet";
      // Aquí está la propiedad que arregla el bug del brillo: esto escribe
      // EXCLUSIVAMENTE en `value`. Tono y saturación no se leen, no se
      // recalculan y no hay ningún camino por el que puedan alterarse.
      value.set(pointToValue(y, sliderTravel, THUMB_SIZE));

      notifyThrottled();
    },
    [notifyThrottled, sliderTravel, value],
  );

  const wheelGesture = useMemo(
    () =>
      Gesture.Pan()
        // Sin distancia mínima el toque simple también coloca el pulgar, en
        // lugar de exigir un arrastre para que ocurra algo.
        .minDistance(0)
        .onBegin((event) => {
          runOnJS(selectionTick)();
          applyWheelPosition(event.x, event.y);
        })
        .onUpdate((event) => {
          applyWheelPosition(event.x, event.y);
        })
        .onFinalize(() => {
          notifyFinal();
        }),
    [applyWheelPosition, notifyFinal],
  );

  // -- Gesto del deslizador de brillo --------------------------------------

  const sliderGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((event) => {
          runOnJS(selectionTick)();
          applySliderPosition(event.y);
        })
        .onUpdate((event) => {
          applySliderPosition(event.y);
        })
        .onFinalize(() => {
          notifyFinal();
        }),
    [applySliderPosition, notifyFinal],
  );

  // -- Pintado derivado (todo en el hilo de UI) ----------------------------

  /** Color completo actual: pulgares y muestra. */
  const currentHex = useDerivedValue(() =>
    hsvToHexWorklet(hue.get(), saturation.get(), value.get()),
  );

  /** El mismo tono y saturación a brillo pleno: fondo del deslizador. */
  const fullValueHex = useDerivedValue(() =>
    hsvToHexWorklet(hue.get(), saturation.get(), 100),
  );

  const wheelThumbStyle = useAnimatedStyle(() => {
    const radians = (hue.get() * Math.PI) / 180;
    const distance = (saturation.get() / 100) * wheelRadius;

    return {
      backgroundColor: currentHex.get(),
      transform: [
        { translateX: Math.cos(radians) * distance },
        { translateY: -Math.sin(radians) * distance },
      ],
    };
  });

  /**
   * Atenuación de la rueda según el brillo. Se queda a medio camino a propósito:
   * comunica que el color está oscurecido sin llegar a apagar el disco, que
   * seguiría teniendo que ser legible para elegir tono.
   */
  const wheelDimStyle = useAnimatedStyle(() => ({
    opacity: (1 - value.get() / 100) * 0.55,
  }));

  const sliderTrackStyle = useAnimatedStyle(() => ({
    backgroundColor: fullValueHex.get(),
  }));

  const sliderThumbStyle = useAnimatedStyle(() => ({
    backgroundColor: currentHex.get(),
    transform: [{ translateY: (1 - value.get() / 100) * sliderTravel }],
  }));

  const swatchStyle = useAnimatedStyle(() => ({
    backgroundColor: currentHex.get(),
  }));

  /**
   * Lectura hexadecimal en vivo.
   *
   * Se pinta sobre un `TextInput` de solo lectura porque es la única forma de
   * cambiar texto desde el hilo de UI: un `<Text>` obligaría a un `setState` por
   * frame. Además de ser el truco que mantiene el gesto a coste cero, cumple lo
   * que pedía la hoja de ruta en accesibilidad — un valor numérico permite
   * distinguir colores sin depender de la vista.
   */
  const hexProps = useAnimatedProps(() => ({
    text: currentHex.get(),
    defaultValue: currentHex.get(),
  }));

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={{ width: size, height: size }}>
          <HueDisc />

          <Animated.View
            pointerEvents="none"
            style={[styles.dim, { borderRadius: wheelRadius }, wheelDimStyle]}
          />
          <View
            pointerEvents="none"
            style={[styles.discEdge, { borderRadius: wheelRadius }]}
          />

          <Animated.View
            pointerEvents="none"
            style={[styles.thumb, styles.wheelThumb, wheelThumbStyle]}
          />

          <GestureDetector gesture={wheelGesture}>
            <View
              style={StyleSheet.absoluteFill}
              accessibilityRole="adjustable"
              accessibilityLabel={t("a11y.wheel")}
            />
          </GestureDetector>
        </View>

        <View style={styles.sliderColumn}>
          <View style={[styles.sliderTrack, { height: sliderHeight }]}>
            <Animated.View
              style={[StyleSheet.absoluteFill, sliderTrackStyle]}
            />
            {/* El brillo es el negro que se compone encima: exactamente lo que
                significa el valor en HSV, color × (1 − alfa). */}
            <LinearGradient
              colors={["rgba(0,0,0,0)", "rgba(0,0,0,1)"]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            <Animated.View
              pointerEvents="none"
              style={[styles.thumb, styles.sliderThumb, sliderThumbStyle]}
            />

            <GestureDetector gesture={sliderGesture}>
              <View
                style={StyleSheet.absoluteFill}
                accessibilityRole="adjustable"
                accessibilityLabel={t("a11y.brightness")}
              />
            </GestureDetector>
          </View>
        </View>
      </View>

      <View style={styles.readout}>
        <Animated.View style={[styles.swatch, swatchStyle]} />
        <AnimatedTextInput
          editable={false}
          style={[Type.metricSmall, styles.hex]}
          animatedProps={hexProps}
          accessibilityLabel={t("a11y.selectedColor")}
        />
      </View>
    </View>
  );
}

export const ColorWheel = memo(forwardRef(ColorWheelBase));

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.lg,
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000000",
  },
  discEdge: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    // El disco llega hasta blanco en el centro y hasta colores muy claros en el
    // borde; sin este aro apagado, la rueda "sangra" sobre el fondo casi negro.
    borderColor: "rgba(255,255,255,0.12)",
  },
  thumb: {
    position: "absolute",
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: THUMB_RING,
    borderColor: "#FFFFFF",
    // Sombra propia: el aro blanco desaparecería sobre un color muy claro.
    shadowColor: "#000000",
    shadowOpacity: 0.45,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  wheelThumb: {
    // Centrado en el origen para que la traslación polar lo mueva desde el
    // centro exacto del disco.
    left: "50%",
    top: "50%",
    marginLeft: -THUMB_SIZE / 2,
    marginTop: -THUMB_SIZE / 2,
  },
  sliderThumb: {
    left: (SLIDER_WIDTH - THUMB_SIZE) / 2,
    top: 0,
  },
  sliderColumn: {
    justifyContent: "center",
  },
  sliderTrack: {
    width: SLIDER_WIDTH,
    borderRadius: SLIDER_WIDTH / 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Color.border.default,
  },
  readout: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    marginTop: Space.lg,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.md,
    borderRadius: Radius.pill,
    backgroundColor: Color.surface.raised,
    borderWidth: 1,
    borderColor: Color.border.default,
  },
  swatch: {
    width: 18,
    height: 18,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  hex: {
    color: Color.text.primary,
    padding: 0,
    minWidth: 74,
  },
});
