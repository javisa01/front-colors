import {
  memo,
  useCallback,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconButton } from "@/design/Button";
import { useThemedStyles } from "@/design/theme";
import {
  CONTENT_MAX_WIDTH,
  Duration,
  Elevation,
  Motion,
  Radius,
  Space,
  Type,
  type Palette,
} from "@/design/tokens";
import { t } from "@/i18n";

/**
 * Superficie modal: diálogo centrado u hoja inferior.
 *
 * Se construye sobre el `Modal` de React Native en lugar de sobre
 * `react-native-modal` para poder animar con Reanimated en el hilo de UI. La
 * librería animaba con la API `Animated` clásica y solo ofrecía transiciones con
 * nombre («fadeInUp»), lo que dejaba dos cosas fuera de alcance: que el fondo se
 * atenúe con una curva distinta a la del panel, y que el panel entre con muelle.
 *
 * La sensación física sale de separar las dos capas:
 *   - El fondo **funde**, porque es atmósfera y no debe llamar la atención.
 *   - El panel **entra con muelle**, porque es un objeto que llega y se asienta.
 *
 * Al cerrar el panel sale con tiempo, no con muelle: un objeto que se retira no
 * rebota, y un rebote de salida retrasa el momento en que el jugador recupera la
 * pantalla.
 */

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  /** `center` para confirmaciones y resultados; `bottom` para ajustes. */
  placement?: "center" | "bottom";
  title?: string;
  /** Sin él no se pinta la X. Un modal de resultado no debe poder descartarse. */
  dismissible?: boolean;
  children: ReactNode;
}

function SheetBase({
  visible,
  onClose,
  placement = "center",
  title,
  dismissible = true,
  children,
}: SheetProps): ReactElement | null {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  /**
   * El `Modal` nativo desmonta su contenido en cuanto `visible` pasa a false, lo
   * que se comería la animación de salida. Este estado lo mantiene montado hasta
   * que la salida termina de verdad.
   */
  const [mounted, setMounted] = useState(visible);

  const progress = useSharedValue(0);

  const unmount = useCallback(() => {
    setMounted(false);
  }, []);

  // Montar durante el render, no en un efecto: así el panel existe ya en el
  // primer pintado y la animación de entrada no se pierde el primer frame.
  // Llamar a `setMounted` dentro de un efecto provocaría además un render en
  // cascada, que es justo lo que desaconseja la regla de React.
  if (visible && !mounted) {
    setMounted(true);
  }

  useEffect(() => {
    if (visible) {
      progress.set(withSpring(1, Motion.springSoft));
      return;
    }

    progress.set(
      withTiming(0, { duration: Duration.fast }, (finished) => {
        if (finished) {
          runOnJS(unmount)();
        }
      }),
    );
  }, [progress, unmount, visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
  }));

  const panelStyle = useAnimatedStyle(() => {
    if (placement === "bottom") {
      return {
        opacity: progress.get(),
        transform: [{ translateY: (1 - progress.get()) * (height * 0.25) }],
      };
    }

    return {
      opacity: progress.get(),
      transform: [
        // Entra ligeramente encogido y subiendo: la combinación es la que se
        // lee como «este panel viene hacia mí», en vez de como un simple fundido.
        { scale: 0.94 + progress.get() * 0.06 },
        { translateY: (1 - progress.get()) * 24 },
      ],
    };
  });

  if (!mounted) {
    return null;
  }

  return (
    <Modal
      transparent
      visible
      // La animación la lleva Reanimated; la del sistema se apaga para que no
      // se sumen dos transiciones distintas.
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismissible ? onClose : undefined}
    >
      <View
        style={[
          styles.root,
          placement === "bottom" ? styles.rootBottom : styles.rootCenter,
        ]}
      >
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={dismissible ? onClose : undefined}
            accessible={false}
            // Solo intercepta el toque si de verdad cierra: si no, un toque
            // fuera debe caer en el vacío en lugar de parecer que falló.
            pointerEvents={dismissible ? "auto" : "none"}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            /*
              El techo, en proporción a la pantalla y no en píxeles: lo que hay
              que dejar ver es el fondo, y cuánto es eso depende del alto que
              haya. Abajo se deja menos porque la hoja nace pegada a ese borde y
              el velo de arriba ya dice que hay algo detrás; en el centro se deja
              más, que es lo que la separa de una pantalla completa.
            */
            { maxHeight: height * (placement === "bottom" ? 0.9 : 0.85) },
            placement === "bottom"
              ? [styles.panelBottom, { paddingBottom: insets.bottom + Space.xl }]
              : styles.panelCenter,
            Elevation.overlay,
            panelStyle,
          ]}
          accessibilityViewIsModal
        >
          {placement === "bottom" ? <View style={styles.grabber} /> : null}

          {title != null || dismissible ? (
            <View style={styles.header}>
              <Text style={[Type.heading, styles.title]} numberOfLines={1}>
                {title ?? ""}
              </Text>
              {dismissible ? (
                <IconButton
                  name="close"
                  size={18}
                  onPress={onClose}
                  accessibilityLabel={t("a11y.close")}
                  style={styles.close}
                />
              ) : null}
            </View>
          ) : null}

          {/*
            El contenido va en un carril que se desplaza, y la cabecera no.

            Una hoja crece con lo que lleva dentro, y hay pantallas donde no
            cabe: los ajustes tienen sonido, aspecto, idioma y lo legal, y en un
            teléfono pequeño —o con la letra del sistema agrandada— el último
            bloque se quedaba fuera sin ninguna señal de que estaba ahí.

            El `flexShrink` es lo que hace que esto no rompa las hojas cortas:
            sin él, el carril reclamaría toda la altura disponible y un modal de
            dos líneas se estiraría hasta abajo. Con él, la hoja sigue midiendo
            lo que mide su contenido y solo se desplaza cuando se pasa del techo.

            El título y la X se quedan fuera a propósito: son el ancla de la
            hoja, y perderlos al desplazar deja al lector sin saber qué está
            leyendo ni por dónde se sale.
          */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            // Sin esto, con el teclado abierto el primer toque en un botón solo
            // cierra el teclado: hay que tocar dos veces para confirmar.
            keyboardShouldPersistTaps="handled"
            // El rebote delata que no hay más contenido, pero en una hoja que no
            // se desplaza parece que se ha soltado del sitio.
            bounces={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

export const Sheet = memo(SheetBase);

const createStyles = (c: Palette) =>
  StyleSheet.create({
  root: {
    flex: 1,
  },
  rootCenter: {
    alignItems: "center",
    justifyContent: "center",
    padding: Space.xl,
  },
  rootBottom: {
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  panel: {
    width: "100%",
    backgroundColor: c.surface.elevated,
    borderWidth: 1,
    borderColor: c.border.default,
  },
  /*
    `flexShrink` y no `flex`: ver la nota del `ScrollView`. `flexGrow: 0` en el
    contenido es la otra mitad de lo mismo, para que un contenido corto no se
    reparta el alto sobrante.
  */
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    flexGrow: 0,
  },
  panelCenter: {
    maxWidth: 400,
    borderRadius: Radius.xl,
    padding: Space.xxl,
  },
  panelBottom: {
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderBottomWidth: 0,
    paddingHorizontal: Space.xxl,
    paddingTop: Space.md,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: c.border.strong,
    marginBottom: Space.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Space.lg,
  },
  title: {
    flex: 1,
  },
  close: {
    // Compensa el área táctil de 44pt para que la X quede alineada con el borde
    // del panel y no flotando hacia dentro.
    marginRight: -Space.md,
  },
  });
